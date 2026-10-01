# Проверки доступа. Все правила "кто что может открыть" собраны здесь, в одном месте.
#
# Быть в группе (GroupMember) — это "моя группа", доступа к занятиям не даёт.
# Доступ дают оплаченные пропуска: на месяц (MonthPass) или на отдельное занятие (LessonPass).

from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

import models

STAFF_ALL = ("admin", "curator")  # видят любую группу (куратор только читает)


def lesson_period(lesson: models.Lesson) -> Optional[str]:
    """Месяц занятия по дате вебинара: "2026-10". Без даты — None."""
    return lesson.starts_at.strftime("%Y-%m") if lesson.starts_at else None


# ---------- Группы ----------


def get_own_course(course_id: int, user: models.User, db: Session) -> models.Course:
    """Группа, которую может менять этот преподаватель (или админ)."""
    course = db.get(models.Course, course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Курс не найден")
    if user.role != "admin" and course.teacher_id != user.id:
        raise HTTPException(status_code=403, detail="Это не ваша группа")
    return course


def get_staff_course(course_id: int, user: models.User, db: Session) -> models.Course:
    """Группа, учеников и активность которой можно смотреть: своя для преподавателя, любая для куратора и админа."""
    if user.role == "curator":
        course = db.get(models.Course, course_id)
        if course is None:
            raise HTTPException(status_code=404, detail="Курс не найден")
        return course
    return get_own_course(course_id, user, db)


def is_member(course_id: int, user_id: int, db: Session) -> bool:
    return (
        db.query(models.GroupMember)
        .filter(
            models.GroupMember.course_id == course_id,
            models.GroupMember.user_id == user_id,
            models.GroupMember.status == "active",
        )
        .first()
        is not None
    )


def has_any_pass(course_id: int, user_id: int, db: Session) -> bool:
    month = (
        db.query(models.MonthPass)
        .filter(models.MonthPass.course_id == course_id, models.MonthPass.user_id == user_id)
        .first()
    )
    if month:
        return True
    return (
        db.query(models.LessonPass)
        .join(models.Lesson, models.Lesson.id == models.LessonPass.lesson_id)
        .filter(models.Lesson.course_id == course_id, models.LessonPass.user_id == user_id)
        .first()
        is not None
    )


def is_group_student(course_id: int, user_id: int, db: Session) -> bool:
    """Ученик этой группы: состоит в ней или купил хоть что-то."""
    return is_member(course_id, user_id, db) or has_any_pass(course_id, user_id, db)


def group_student_ids(course_id: int, db: Session) -> set[int]:
    ids = {
        m.user_id
        for m in db.query(models.GroupMember).filter(
            models.GroupMember.course_id == course_id, models.GroupMember.status == "active"
        )
    }
    ids |= {p.user_id for p in db.query(models.MonthPass).filter(models.MonthPass.course_id == course_id)}
    ids |= {
        p.user_id
        for p in db.query(models.LessonPass)
        .join(models.Lesson, models.Lesson.id == models.LessonPass.lesson_id)
        .filter(models.Lesson.course_id == course_id)
    }
    return ids


def check_access(course_id: int, user: models.User, db: Session) -> models.Course:
    """Страница группы: список занятий видят её ученики, её преподаватель, куратор и админ."""
    course = db.get(models.Course, course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Курс не найден")
    if user.role in STAFF_ALL or course.teacher_id == user.id:
        return course
    if not is_group_student(course_id, user.id, db):
        raise HTTPException(status_code=403, detail="Ты не в этой группе")
    return course


# ---------- Занятия ----------


def get_lesson(lesson_id: int, db: Session) -> models.Lesson:
    lesson = db.get(models.Lesson, lesson_id)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Занятие не найдено")
    return lesson


def get_own_lesson(course_id: int, lesson_id: int, user: models.User, db: Session) -> models.Lesson:
    """Занятие своей группы для преподавателя (или любой для админа).
    Занятие обязательно из этой группы: иначе через свою группу можно было бы менять чужие занятия."""
    get_own_course(course_id, user, db)
    lesson = db.get(models.Lesson, lesson_id)
    if lesson is None or lesson.course_id != course_id:
        raise HTTPException(status_code=404, detail="Занятие не найдено")
    return lesson


def student_has_lesson(lesson: models.Lesson, user_id: int, db: Session) -> bool:
    """Купил ли ученик это занятие: месяцем или отдельно. Пробники — только месяцем."""
    period = lesson_period(lesson)
    month_query = db.query(models.MonthPass).filter(
        models.MonthPass.user_id == user_id, models.MonthPass.course_id == lesson.course_id
    )
    # Занятие без даты не относится ни к какому месяцу: его открывает любой оплаченный месяц группы
    if period is not None:
        month_query = month_query.filter(models.MonthPass.period == period)
    if month_query.first():
        return True
    if lesson.kind == "mock":
        return False
    return (
        db.query(models.LessonPass)
        .filter(models.LessonPass.user_id == user_id, models.LessonPass.lesson_id == lesson.id)
        .first()
        is not None
    )


def can_open_lesson(lesson: models.Lesson, user: models.User, db: Session) -> bool:
    if user.role in STAFF_ALL:
        return True
    course = db.get(models.Course, lesson.course_id)
    if course is not None and course.teacher_id == user.id:
        return True
    return student_has_lesson(lesson, user.id, db)


def check_lesson_access(lesson: models.Lesson, user: models.User, db: Session) -> None:
    if not can_open_lesson(lesson, user, db):
        raise HTTPException(status_code=403, detail="Занятие не куплено")


def seats_taken(lesson: models.Lesson, db: Session) -> int:
    """Сколько учеников уже имеют доступ к занятию: месячные пропуска плюс разовые."""
    period = lesson_period(lesson)
    month = 0
    if period is not None:
        month = (
            db.query(models.MonthPass)
            .filter(models.MonthPass.course_id == lesson.course_id, models.MonthPass.period == period)
            .count()
        )
    single = db.query(models.LessonPass).filter(models.LessonPass.lesson_id == lesson.id).count()
    return month + single
