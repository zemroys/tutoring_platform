import os
from datetime import datetime, timedelta

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from passlib.context import CryptContext
from slowapi.errors import RateLimitExceeded
from sqlalchemy.orm import Session

import account
import curator
import lessons
import models
import progress
import quiz
import schemas
import shop
from access import check_access
from auth import (
    REFRESH_TOKEN_EXPIRE_DAYS,
    clear_auth_cookies,
    create_session,
    find_active_session,
    get_current_user,
    require_role,
    revoke_user_sessions,
    set_auth_cookies,
)
from database import get_db
from rate_limit import limiter

app = FastAPI()

# Ограничение попыток (настройка в rate_limit.py). Счётчики в памяти, после перезапуска обнуляются.
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
app.include_router(lessons.router)
app.include_router(progress.router)
app.include_router(quiz.router)
app.include_router(curator.router)
app.include_router(account.router)
app.include_router(shop.router)

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
        telegram=user.telegram,
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

    session, refresh_token = create_session(db, user.id)
    set_auth_cookies(response, user.id, session.id, refresh_token)
    return user


@app.post("/refresh", response_model=schemas.UserOut)
def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    """Короткий токен истёк: по долгому выдаём новый и продлеваем сессию ещё на 30 дней."""
    session = find_active_session(db, request.cookies.get("refresh_token"))
    user = db.get(models.User, session.user_id) if session else None
    if session is None or user is None:
        clear_auth_cookies(response)
        raise HTTPException(status_code=401, detail="Сессия закончилась, войди снова")

    now = datetime.now()
    session.last_used_at = now
    session.expires_at = now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    db.commit()
    set_auth_cookies(response, user.id, session.id, request.cookies["refresh_token"])
    return user


@app.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    session = find_active_session(db, request.cookies.get("refresh_token"))
    if session is not None:
        session.revoked_at = datetime.now()
        db.commit()
    clear_auth_cookies(response)
    return {"ok": True}


@app.post("/logout-all")
def logout_all(
    response: Response,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    revoke_user_sessions(db, user.id)
    clear_auth_cookies(response)
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


@app.patch("/courses/{course_id}", response_model=schemas.CourseOut)
def update_course(
    course_id: int,
    data: schemas.CourseUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_role("admin")),
):
    course = db.get(models.Course, course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    changes = data.model_dump(exclude_unset=True)
    if "teacher_id" in changes:
        teacher = db.get(models.User, changes["teacher_id"])
        if teacher is None or teacher.role != "teacher":
            raise HTTPException(status_code=400, detail="Преподаватель не найден")
    for field, value in changes.items():
        setattr(course, field, value)
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


# ---------- Ученик: купленные курсы ----------


@app.get("/my/courses", response_model=list[schemas.CourseOut])
def my_purchased_courses(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    # Мои группы: где я состою или что-то купил
    ids = {
        m.course_id
        for m in db.query(models.GroupMember).filter(
            models.GroupMember.user_id == user.id, models.GroupMember.status == "active"
        )
    }
    ids |= {p.course_id for p in db.query(models.MonthPass).filter(models.MonthPass.user_id == user.id)}
    ids |= {
        l.course_id
        for l in db.query(models.Lesson)
        .join(models.LessonPass, models.LessonPass.lesson_id == models.Lesson.id)
        .filter(models.LessonPass.user_id == user.id)
    }
    if not ids:
        return []
    return db.query(models.Course).filter(models.Course.id.in_(ids)).order_by(models.Course.title).all()


@app.get("/courses/{course_id}", response_model=schemas.CourseOut)
def course_detail(
    course_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    return check_access(course_id, user, db)
