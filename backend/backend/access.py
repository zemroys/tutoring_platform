# Проверки доступа к курсам. Вынесены в отдельный файл, чтобы ими пользовались и main.py, и progress.py.

from fastapi import HTTPException
from sqlalchemy.orm import Session

import models


def get_own_course(course_id: int, user: models.User, db: Session) -> models.Course:
    """Курс, который может менять этот преподаватель (или админ). Иначе 404/403."""
    course = db.get(models.Course, course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Курс не найден")
    if user.role != "admin" and course.teacher_id != user.id:
        raise HTTPException(status_code=403, detail="Это не ваша группа")
    return course


def is_paid_student(course_id: int, user_id: int, db: Session) -> bool:
    """Есть ли у пользователя оплаченная покупка этого курса."""
    return (
        db.query(models.Purchase)
        .filter(
            models.Purchase.user_id == user_id,
            models.Purchase.course_id == course_id,
            models.Purchase.status == "paid",
        )
        .first()
        is not None
    )


def check_access(course_id: int, user: models.User, db: Session) -> models.Course:
    """Курс, который этот человек может смотреть: купивший ученик, преподаватель курса или админ."""
    course = db.get(models.Course, course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Курс не найден")
    if user.role == "admin" or course.teacher_id == user.id:
        return course
    if not is_paid_student(course_id, user.id, db):
        raise HTTPException(status_code=403, detail="Курс не куплен")
    return course
