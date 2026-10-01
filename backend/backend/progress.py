# Сдача домашек по занятиям, проверка, посещаемость вебинаров и активность учеников.

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from access import (
    check_access,
    check_lesson_access,
    get_lesson,
    get_own_course,
    get_own_lesson,
    get_staff_course,
    group_student_ids,
    student_has_lesson,
)
from auth import get_current_user, require_role
from database import get_db

router = APIRouter()


# ---------- Ученик ----------


@router.get("/courses/{course_id}/my-submissions", response_model=list[schemas.LessonSubmissionOut])
def my_submissions(
    course_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    check_access(course_id, user, db)
    return (
        db.query(models.LessonSubmission)
        .join(models.Lesson, models.Lesson.id == models.LessonSubmission.lesson_id)
        .filter(models.Lesson.course_id == course_id, models.LessonSubmission.user_id == user.id)
        .all()
    )


@router.put("/lessons/{lesson_id}/submission", response_model=schemas.LessonSubmissionOut)
def submit_homework(
    lesson_id: int,
    data: schemas.SubmissionCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    lesson = get_lesson(lesson_id, db)
    if user.role != "student":
        raise HTTPException(status_code=403, detail="Сдавать домашку могут только ученики")
    check_lesson_access(lesson, user, db)
    if not (lesson.homework_text or lesson.homework_link):
        raise HTTPException(status_code=400, detail="У этого занятия нет домашки")

    submission = (
        db.query(models.LessonSubmission)
        .filter(models.LessonSubmission.lesson_id == lesson_id, models.LessonSubmission.user_id == user.id)
        .first()
    )
    if submission is not None and submission.status == "accepted":
        raise HTTPException(status_code=409, detail="Работа уже принята, менять её нельзя")
    if submission is None:
        submission = models.LessonSubmission(lesson_id=lesson_id, user_id=user.id)
        db.add(submission)

    # Повторная сдача снова уходит на проверку. Комментарий и отметки преподавателя сохраняем:
    # ученик видит, что исправляет, а преподаватель начинает с прошлых отметок.
    submission.link = data.link
    submission.comment = data.comment
    submission.status = "submitted"
    submission.submitted_at = datetime.now()
    db.commit()
    db.refresh(submission)
    return submission


# ---------- Преподаватель: проверка домашек ----------


@router.get(
    "/teacher/courses/{course_id}/submissions",
    response_model=list[schemas.LessonSubmissionForTeacher],
)
def course_submissions(
    course_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("teacher", "admin")),
):
    get_own_course(course_id, user, db)
    rows = (
        db.query(models.LessonSubmission, models.User)
        .join(models.Lesson, models.Lesson.id == models.LessonSubmission.lesson_id)
        .join(models.User, models.User.id == models.LessonSubmission.user_id)
        .filter(models.Lesson.course_id == course_id)
        .order_by(models.LessonSubmission.submitted_at.desc())
        .all()
    )
    return [
        schemas.LessonSubmissionForTeacher(
            **schemas.LessonSubmissionOut.model_validate(submission).model_dump(),
            student_email=student.email,
            student_first_name=student.first_name,
            student_last_name=student.last_name,
        )
        for submission, student in rows
    ]


@router.post(
    "/teacher/courses/{course_id}/submissions/{submission_id}/review",
    response_model=schemas.LessonSubmissionOut,
)
def review_submission(
    course_id: int,
    submission_id: int,
    data: schemas.ReviewCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("teacher", "admin")),
):
    get_own_course(course_id, user, db)
    submission = db.get(models.LessonSubmission, submission_id)
    lesson = db.get(models.Lesson, submission.lesson_id) if submission else None
    # Работа должна относиться к ЭТОЙ группе, иначе можно проверять чужие работы
    if submission is None or lesson is None or lesson.course_id != course_id:
        raise HTTPException(status_code=404, detail="Работа не найдена")

    if data.task_results is not None:
        if lesson.tasks_count is None or len(data.task_results) != lesson.tasks_count:
            raise HTTPException(status_code=400, detail="Количество отметок не совпадает с количеством задач")

    submission.status = data.status
    submission.teacher_comment = data.teacher_comment
    submission.task_results = data.task_results
    submission.reviewed_at = datetime.now()
    db.commit()
    db.refresh(submission)
    return submission


# ---------- Преподаватель: посещаемость ----------


@router.get(
    "/teacher/courses/{course_id}/lessons/{lesson_id}/attendance",
    response_model=list[int],
)
def get_attendance(
    course_id: int,
    lesson_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("teacher", "admin")),
):
    get_own_lesson(course_id, lesson_id, user, db)
    rows = db.query(models.LessonAttendance).filter(models.LessonAttendance.lesson_id == lesson_id).all()
    return [row.user_id for row in rows]


@router.put(
    "/teacher/courses/{course_id}/lessons/{lesson_id}/attendance",
    response_model=list[int],
)
def set_attendance(
    course_id: int,
    lesson_id: int,
    data: schemas.AttendanceUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("teacher", "admin")),
):
    lesson = get_own_lesson(course_id, lesson_id, user, db)
    user_ids = set(data.user_ids)
    for user_id in user_ids:
        if not student_has_lesson(lesson, user_id, db):
            raise HTTPException(status_code=400, detail="В списке есть ученик, который не покупал это занятие")

    # Присылается полный список присутствовавших: старые отметки заменяем новыми
    db.query(models.LessonAttendance).filter(models.LessonAttendance.lesson_id == lesson_id).delete()
    for user_id in user_ids:
        db.add(models.LessonAttendance(lesson_id=lesson_id, user_id=user_id))
    db.commit()
    return sorted(user_ids)


# ---------- Ученики группы и их активность ----------


@router.get(
    "/teacher/courses/{course_id}/students",
    response_model=list[schemas.StudentProgressOut],
)
def course_students(
    course_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("teacher", "curator", "admin")),
):
    get_staff_course(course_id, user, db)

    ids = group_student_ids(course_id, db)
    students = (
        db.query(models.User)
        .filter(models.User.id.in_(ids), models.User.role == "student")
        .order_by(models.User.last_name, models.User.first_name, models.User.email)
        .all()
        if ids
        else []
    )

    lessons = db.query(models.Lesson).filter(models.Lesson.course_id == course_id).all()
    now = datetime.now()

    result = []
    for student in students:
        # Активность считаем только по купленным занятиям: что не купил, то и не должен был делать
        own = [l for l in lessons if student_has_lesson(l, student.id, db)]
        homework_ids = [l.id for l in own if l.homework_text or l.homework_link]
        # И только по прошедшим вебинарам: будущие не должны тянуть процент вниз
        past_ids = [l.id for l in own if l.starts_at is not None and l.starts_at < now]
        homework_done = (
            db.query(models.LessonSubmission)
            .filter(
                models.LessonSubmission.user_id == student.id,
                models.LessonSubmission.lesson_id.in_(homework_ids),
                models.LessonSubmission.status == "accepted",
            )
            .count()
            if homework_ids
            else 0
        )
        webinars_attended = (
            db.query(models.LessonAttendance)
            .filter(
                models.LessonAttendance.user_id == student.id,
                models.LessonAttendance.lesson_id.in_(past_ids),
            )
            .count()
            if past_ids
            else 0
        )

        # Домашки и вебинары весят поровну. Если чего-то ещё нет, считаем по тому, что есть
        parts = []
        if homework_ids:
            parts.append(homework_done / len(homework_ids))
        if past_ids:
            parts.append(webinars_attended / len(past_ids))
        percent = round(sum(parts) / len(parts) * 100) if parts else None

        result.append(
            schemas.StudentProgressOut(
                id=student.id,
                email=student.email,
                first_name=student.first_name,
                last_name=student.last_name,
                homework_done=homework_done,
                homework_total=len(homework_ids),
                webinars_attended=webinars_attended,
                webinars_total=len(past_ids),
                activity_percent=percent,
            )
        )
    return result
