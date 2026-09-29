# Куратор: видит учеников с контактами и результатом опроса, добавляет их в группы и убирает из групп.
# Добавление в группу = оплаченная покупка курса (пока нет онлайн-оплаты, так оформляются оплаты переводом).

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from auth import require_role
from database import get_db

router = APIRouter()

GROUP_CAPACITY = 6  # максимум учеников в группе

curator_only = require_role("curator", "admin")


def paid_count(course_id: int, db: Session) -> int:
    return (
        db.query(models.Purchase)
        .filter(models.Purchase.course_id == course_id, models.Purchase.status == "paid")
        .count()
    )


@router.get("/curator/students", response_model=list[schemas.CuratorStudentOut])
def curator_students(db: Session = Depends(get_db), user: models.User = Depends(curator_only)):
    students = (
        db.query(models.User)
        .filter(models.User.role == "student")
        .order_by(models.User.created_at.desc(), models.User.id.desc())
        .all()
    )
    quiz_by_user = {q.user_id: q.items for q in db.query(models.QuizResult).all()}

    groups_by_user: dict[int, list[schemas.GroupShort]] = {}
    rows = (
        db.query(models.Purchase.user_id, models.Course.id, models.Course.title)
        .join(models.Course, models.Course.id == models.Purchase.course_id)
        .filter(models.Purchase.status == "paid")
        .all()
    )
    for user_id, course_id, title in rows:
        groups_by_user.setdefault(user_id, []).append(schemas.GroupShort(id=course_id, title=title))

    return [
        schemas.CuratorStudentOut(
            id=s.id,
            email=s.email,
            first_name=s.first_name,
            last_name=s.last_name,
            telegram=s.telegram,
            created_at=s.created_at,
            quiz_items=quiz_by_user.get(s.id),
            groups=groups_by_user.get(s.id, []),
        )
        for s in students
    ]


@router.get("/curator/courses", response_model=list[schemas.CuratorCourseOut])
def curator_courses(db: Session = Depends(get_db), user: models.User = Depends(curator_only)):
    result = []
    for course in db.query(models.Course).order_by(models.Course.title).all():
        teacher = db.get(models.User, course.teacher_id) if course.teacher_id else None
        teacher_name = None
        if teacher:
            teacher_name = " ".join(filter(None, [teacher.last_name, teacher.first_name])) or teacher.email
        result.append(
            schemas.CuratorCourseOut(
                id=course.id,
                title=course.title,
                teacher_name=teacher_name,
                students_count=paid_count(course.id, db),
                capacity=GROUP_CAPACITY,
            )
        )
    return result


@router.post("/curator/courses/{course_id}/students", response_model=schemas.GroupShort)
def enroll_student(
    course_id: int,
    data: schemas.EnrollIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(curator_only),
):
    course = db.get(models.Course, course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    student = db.get(models.User, data.user_id)
    if student is None or student.role != "student":
        raise HTTPException(status_code=400, detail="Ученик не найден")

    purchase = (
        db.query(models.Purchase)
        .filter(models.Purchase.user_id == student.id, models.Purchase.course_id == course_id)
        .first()
    )
    if purchase is not None and purchase.status == "paid":
        raise HTTPException(status_code=409, detail="Ученик уже в этой группе")
    if paid_count(course_id, db) >= GROUP_CAPACITY:
        raise HTTPException(status_code=409, detail=f"В группе уже {GROUP_CAPACITY} человек")

    # Если ученика раньше убирали из этой группы, возвращаем ту же запись, а не создаём вторую
    if purchase is None:
        purchase = models.Purchase(user_id=student.id, course_id=course_id)
        db.add(purchase)
    purchase.status = "paid"
    purchase.paid_at = datetime.now()
    db.commit()
    return schemas.GroupShort(id=course.id, title=course.title)


@router.delete("/curator/courses/{course_id}/students/{user_id}")
def remove_student(
    course_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(curator_only),
):
    purchase = (
        db.query(models.Purchase)
        .filter(
            models.Purchase.user_id == user_id,
            models.Purchase.course_id == course_id,
            models.Purchase.status == "paid",
        )
        .first()
    )
    if purchase is None:
        raise HTTPException(status_code=404, detail="Ученика нет в этой группе")
    # Не удаляем запись, а меняем статус: история сохраняется, а доступ пропадает сразу
    purchase.status = "removed"
    db.commit()
    return {"ok": True}
