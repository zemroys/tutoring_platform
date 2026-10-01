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
    """Курс, который этот человек может смотреть: купивший ученик, преподаватель курса, куратор или админ."""
    course = db.get(models.Course, course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Курс не найден")
    # Куратор смотрит любую группу, но только читает: все изменения проверяются через get_own_course
    if user.role in ("admin", "curator") or course.teacher_id == user.id:
        return course
    if not is_paid_student(course_id, user.id, db):
        raise HTTPException(status_code=403, detail="Курс не куплен")
    return course


def get_staff_course(course_id: int, user: models.User, db: Session) -> models.Course:
    """Курс, учеников и активность которого можно смотреть: свой для преподавателя, любой для куратора и админа."""
    if user.role == "curator":
        course = db.get(models.Course, course_id)
        if course is None:
            raise HTTPException(status_code=404, detail="Курс не найден")
        return course
    return get_own_course(course_id, user, db)


def get_lesson(lesson_id: int, db: Session) -> models.Lesson:
    lesson = db.get(models.Lesson, lesson_id)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Занятие не найдено")
    return lesson


def check_lesson_access(lesson: models.Lesson, user: models.User, db: Session) -> models.Course:
    """Можно ли открыть занятие целиком (видео, конспект, домашку).
    Сейчас доступ по группе. На этапе покупки отдельных занятий меняется только эта функция."""
    return check_access(lesson.course_id, user, db)


def get_own_lesson(course_id: int, lesson_id: int, user: models.User, db: Session) -> models.Lesson:
    """Занятие своей группы для преподавателя (или любой для админа).
    Занятие обязательно из этой группы: иначе через свою группу можно было бы менять чужие занятия."""
    get_own_course(course_id, user, db)
    lesson = db.get(models.Lesson, lesson_id)
    if lesson is None or lesson.course_id != course_id:
        raise HTTPException(status_code=404, detail="Занятие не найдено")
    return lesson
