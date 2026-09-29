import os

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from passlib.context import CryptContext
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

import models
import progress
import schemas
from access import check_access, get_own_course
from auth import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    COOKIE_SECURE,
    create_access_token,
    get_current_user,
    require_role,
)
from database import get_db

app = FastAPI()

# Ограничение попыток: считаем запросы с одного IP-адреса.
# Хранится в памяти сервера, после перезапуска счётчики обнуляются.
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
def rate_limit_exceeded(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Слишком много попыток. Подожди немного и попробуй снова."},
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Сдача домашек, проверка, посещаемость и активность лежат в progress.py
app.include_router(progress.router)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@app.get("/")
def read_root():
    return {"status": "ok"}


# ---------- Регистрация, вход, выход ----------


@app.post("/register", response_model=schemas.UserOut)
@limiter.limit("10/hour")
def register(request: Request, user: schemas.UserRegister, db: Session = Depends(get_db)):
    existing_user = db.query(models.User).filter(models.User.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email уже зарегистрирован")

    new_user = models.User(
        email=user.email,
        password_hash=pwd_context.hash(user.password),
        role="student",
        first_name=user.first_name,
        last_name=user.last_name,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@app.post("/login", response_model=schemas.UserOut)
@limiter.limit("10/minute;100/hour")
def login(
    request: Request,
    credentials: schemas.UserLogin,
    response: Response,
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.email == credentials.email).first()
    if not user or not pwd_context.verify(credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Неверный email или пароль")

    token = create_access_token(user.id)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    return user


@app.post("/logout")
def logout(response: Response):
    response.delete_cookie("access_token", httponly=True, samesite="lax", secure=COOKIE_SECURE)
    return {"ok": True}


@app.get("/me", response_model=schemas.UserOut)
def me(user: models.User = Depends(get_current_user)):
    return user


# ---------- Админ: создание групп ----------


@app.post("/courses", response_model=schemas.CourseOut)
def create_course(
    data: schemas.CourseCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_role("admin")),
):
    teacher = db.get(models.User, data.teacher_id)
    if teacher is None or teacher.role != "teacher":
        raise HTTPException(status_code=400, detail="Преподаватель не найден")
    course = models.Course(**data.model_dump())
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


# ---------- Преподаватель: свои группы, расписание, домашки ----------


@app.get("/teacher/courses", response_model=list[schemas.CourseOut])
def my_courses(
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("teacher", "admin")),
):
    return db.query(models.Course).filter(models.Course.teacher_id == user.id).all()


@app.post("/teacher/courses/{course_id}/schedule", response_model=schemas.ScheduleOut)
def add_schedule(
    course_id: int,
    data: schemas.ScheduleCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("teacher", "admin")),
):
    get_own_course(course_id, user, db)
    item = models.Schedule(course_id=course_id, **data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@app.post("/teacher/courses/{course_id}/homework", response_model=schemas.HomeworkOut)
def add_homework(
    course_id: int,
    data: schemas.HomeworkCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("teacher", "admin")),
):
    get_own_course(course_id, user, db)
    item = models.Homework(course_id=course_id, **data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@app.delete("/teacher/courses/{course_id}/schedule/{item_id}")
def delete_schedule(
    course_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("teacher", "admin")),
):
    get_own_course(course_id, user, db)
    item = db.get(models.Schedule, item_id)
    # Запись обязательно из ЭТОГО курса, иначе можно удалить чужую через свой курс
    if item is None or item.course_id != course_id:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    db.query(models.Attendance).filter(models.Attendance.schedule_id == item_id).delete()
    db.delete(item)
    db.commit()
    return {"ok": True}


@app.delete("/teacher/courses/{course_id}/homework/{item_id}")
def delete_homework(
    course_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("teacher", "admin")),
):
    get_own_course(course_id, user, db)
    item = db.get(models.Homework, item_id)
    if item is None or item.course_id != course_id:
        raise HTTPException(status_code=404, detail="Домашка не найдена")
    has_submissions = (
        db.query(models.Submission).filter(models.Submission.homework_id == item_id).first()
    )
    if has_submissions:
        raise HTTPException(status_code=409, detail="Нельзя удалить: ученики уже сдали работы")
    db.delete(item)
    db.commit()
    return {"ok": True}


# ---------- Ученик: купленные курсы ----------


@app.get("/my/courses", response_model=list[schemas.CourseOut])
def my_purchased_courses(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    return (
        db.query(models.Course)
        .join(models.Purchase, models.Purchase.course_id == models.Course.id)
        .filter(models.Purchase.user_id == user.id, models.Purchase.status == "paid")
        .all()
    )


@app.get("/courses/{course_id}", response_model=schemas.CourseOut)
def course_detail(
    course_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    return check_access(course_id, user, db)


@app.get("/courses/{course_id}/schedule", response_model=list[schemas.ScheduleOut])
def course_schedule(
    course_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    check_access(course_id, user, db)
    return (
        db.query(models.Schedule)
        .filter(models.Schedule.course_id == course_id)
        .order_by(models.Schedule.week_number, models.Schedule.stream_date)
        .all()
    )


@app.get("/courses/{course_id}/homework", response_model=list[schemas.HomeworkOut])
def course_homework(
    course_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    check_access(course_id, user, db)
    return (
        db.query(models.Homework)
        .filter(models.Homework.course_id == course_id)
        .order_by(models.Homework.week_number)
        .all()
    )