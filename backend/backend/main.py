from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from auth import create_access_token, get_current_user, require_role
from database import get_db
import models
import schemas

app = FastAPI()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

@app.get("/")
def read_root():
    return {"status": "ok"}
@app.post("/register", response_model=schemas.UserOut)
def register(user: schemas.UserRegister, db: Session = Depends(get_db)):
    existing_user = db.query(models.User).filter(models.User.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email уже зарегистрирован")

    hashed_password = pwd_context.hash(user.password)
    new_user = models.User(
        email=user.email,
        password_hash=hashed_password,
        role="student"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


@app.post("/login", response_model=schemas.Token)
def login(credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == credentials.email).first()
    if not user or not pwd_context.verify(credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Неверный email или пароль")

    token = create_access_token(user.id)
    return {"access_token": token, "token_type": "bearer"}


@app.get("/me", response_model=schemas.UserOut)
def me(user: models.User = Depends(get_current_user)):
    return user


def get_own_course(course_id: int, user: models.User, db: Session) -> models.Course:
    course = db.get(models.Course, course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Курс не найден")
    if user.role != "admin" and course.teacher_id != user.id:
        raise HTTPException(status_code=403, detail="Это не ваша группа")
    return course


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


def check_access(course_id: int, user: models.User, db: Session) -> models.Course:
    course = db.get(models.Course, course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Курс не найден")
    if user.role == "admin" or course.teacher_id == user.id:
        return course
    purchase = (
        db.query(models.Purchase)
        .filter(
            models.Purchase.user_id == user.id,
            models.Purchase.course_id == course_id,
            models.Purchase.status == "paid",
        )
        .first()
    )
    if purchase is None:
        raise HTTPException(status_code=403, detail="Курс не куплен")
    return course


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