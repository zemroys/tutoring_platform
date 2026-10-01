# Занятия: создание и правка преподавателем, список и страница занятия для всех, у кого есть доступ.

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from access import check_access, check_lesson_access, get_lesson, get_own_course, get_own_lesson
from auth import get_current_user, require_role
from database import get_db

router = APIRouter()


def lesson_out(lesson: models.Lesson) -> schemas.LessonOut:
    return schemas.LessonOut(
        id=lesson.id,
        course_id=lesson.course_id,
        number=lesson.number,
        topic=lesson.topic,
        kind=lesson.kind,
        starts_at=lesson.starts_at,
        webinar_link=lesson.webinar_link,
        video_url=lesson.video_url,
        # Адрес плеера собирает сервер из проверенной ссылки
        video_embed_url=schemas.video_embed_url(lesson.video_url),
        notes_url=lesson.notes_url,
        homework_text=lesson.homework_text,
        homework_link=lesson.homework_link,
        tasks_count=lesson.tasks_count,
    )


def has_homework(lesson: models.Lesson) -> bool:
    return bool(lesson.homework_text or lesson.homework_link)


# ---------- Смотреть ----------


@router.get("/courses/{course_id}/lessons", response_model=list[schemas.LessonSummary])
def course_lessons(
    course_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    check_access(course_id, user, db)
    lessons = (
        db.query(models.Lesson)
        .filter(models.Lesson.course_id == course_id)
        .order_by(models.Lesson.number, models.Lesson.starts_at)
        .all()
    )
    return [
        schemas.LessonSummary(
            id=lesson.id,
            course_id=lesson.course_id,
            number=lesson.number,
            topic=lesson.topic,
            kind=lesson.kind,
            starts_at=lesson.starts_at,
            has_video=bool(lesson.video_url),
            has_notes=bool(lesson.notes_url),
            has_homework=has_homework(lesson),
        )
        for lesson in lessons
    ]


@router.get("/lessons/{lesson_id}", response_model=schemas.LessonOut)
def lesson_detail(
    lesson_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    lesson = get_lesson(lesson_id, db)
    check_lesson_access(lesson, user, db)
    return lesson_out(lesson)


# ---------- Преподаватель ----------


@router.post("/teacher/courses/{course_id}/lessons", response_model=schemas.LessonOut)
def create_lesson(
    course_id: int,
    data: schemas.LessonCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("teacher", "admin")),
):
    get_own_course(course_id, user, db)
    lesson = models.Lesson(course_id=course_id, **data.model_dump())
    db.add(lesson)
    db.commit()
    db.refresh(lesson)
    return lesson_out(lesson)


@router.patch("/teacher/courses/{course_id}/lessons/{lesson_id}", response_model=schemas.LessonOut)
def update_lesson(
    course_id: int,
    lesson_id: int,
    data: schemas.LessonUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("teacher", "admin")),
):
    lesson = get_own_lesson(course_id, lesson_id, user, db)
    changes = data.model_dump(exclude_unset=True)
    # Номер, тему и тип очистить нельзя: без них занятия нет
    for field in ("number", "topic", "kind"):
        if field in changes and changes[field] is None:
            raise HTTPException(status_code=400, detail="Номер, тема и тип занятия обязательны")
    for field, value in changes.items():
        setattr(lesson, field, value)
    db.commit()
    db.refresh(lesson)
    return lesson_out(lesson)


@router.delete("/teacher/courses/{course_id}/lessons/{lesson_id}")
def delete_lesson(
    course_id: int,
    lesson_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("teacher", "admin")),
):
    lesson = get_own_lesson(course_id, lesson_id, user, db)
    has_submissions = (
        db.query(models.LessonSubmission).filter(models.LessonSubmission.lesson_id == lesson_id).first()
    )
    if has_submissions:
        raise HTTPException(status_code=409, detail="Нельзя удалить: ученики уже сдали домашку по этому занятию")
    db.query(models.LessonAttendance).filter(models.LessonAttendance.lesson_id == lesson_id).delete()
    db.delete(lesson)
    db.commit()
    return {"ok": True}
