# Сдача домашек, проверка, посещаемость вебинаров и активность учеников.

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from access import check_access, get_own_course, get_staff_course, is_paid_student
from auth import get_current_user, require_role
from database import get_db

router = APIRouter()


def get_course_homework(course_id: int, homework_id: int, db: Session) -> models.Homework:
    # Домашка обязательно из ЭТОГО курса: иначе можно было бы подставить id чужой домашки
    homework = db.get(models.Homework, homework_id)
    if homework is None or homework.course_id != course_id:
        raise HTTPException(status_code=404, detail="Домашка не найдена")
    return homework


def get_course_schedule_item(course_id: int, item_id: int, db: Session) -> models.Schedule:
    item = db.get(models.Schedule, item_id)
    if item is None or item.course_id != course_id:
        raise HTTPException(status_code=404, detail="Вебинар не найден")
    return item


# ---------- Ученик ----------


@router.get("/courses/{course_id}/my-submissions", response_model=list[schemas.SubmissionOut])
def my_submissions(
    course_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    check_access(course_id, user, db)
    return (
        db.query(models.Submission)
        .join(models.Homework, models.Homework.id == models.Submission.homework_id)
        .filter(models.Homework.course_id == course_id, models.Submission.user_id == user.id)
        .all()
    )


@router.put(
    "/courses/{course_id}/homework/{homework_id}/submission",
    response_model=schemas.SubmissionOut,
)
def submit_homework(
    course_id: int,
    homework_id: int,
    data: schemas.SubmissionCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if not is_paid_student(course_id, user.id, db):
        raise HTTPException(status_code=403, detail="Сдавать домашку могут только ученики этой группы")
    get_course_homework(course_id, homework_id, db)

    submission = (
        db.query(models.Submission)
        .filter(models.Submission.homework_id == homework_id, models.Submission.user_id == user.id)
        .first()
    )
    if submission is not None and submission.status == "accepted":
        raise HTTPException(status_code=409, detail="Работа уже принята, менять её нельзя")
    if submission is None:
        submission = models.Submission(homework_id=homework_id, user_id=user.id)
        db.add(submission)

    # Повторная сдача после "на доработку" снова уходит на проверку.
    # Комментарий и отметки преподавателя не стираем: ученик видит, что исправляет,
    # а преподаватель при повторной проверке начинает с прошлых отметок.
    submission.link = data.link
    submission.comment = data.comment
    submission.status = "submitted"
    submission.submitted_at = datetime.now()
    submission.reviewed_at = None
    db.commit()
    db.refresh(submission)
    return submission


# ---------- Преподаватель: проверка домашек ----------


@router.get(
    "/teacher/courses/{course_id}/submissions",
    response_model=list[schemas.SubmissionForTeacher],
)
def course_submissions(
    course_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("teacher", "admin")),
):
    get_own_course(course_id, user, db)
    rows = (
        db.query(models.Submission, models.User)
        .join(models.Homework, models.Homework.id == models.Submission.homework_id)
        .join(models.User, models.User.id == models.Submission.user_id)
        .filter(models.Homework.course_id == course_id)
        .order_by(models.Submission.submitted_at.desc())
        .all()
    )
    return [
        schemas.SubmissionForTeacher(
            **schemas.SubmissionOut.model_validate(submission).model_dump(),
            student_email=student.email,
            student_first_name=student.first_name,
            student_last_name=student.last_name,
        )
        for submission, student in rows
    ]


@router.post(
    "/teacher/courses/{course_id}/submissions/{submission_id}/review",
    response_model=schemas.SubmissionOut,
)
def review_submission(
    course_id: int,
    submission_id: int,
    data: schemas.ReviewCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("teacher", "admin")),
):
    get_own_course(course_id, user, db)
    submission = db.get(models.Submission, submission_id)
    homework = db.get(models.Homework, submission.homework_id) if submission else None
    # Работа должна относиться к ЭТОМУ курсу, иначе можно проверять чужие работы
    if submission is None or homework is None or homework.course_id != course_id:
        raise HTTPException(status_code=404, detail="Работа не найдена")

    # Отметок по задачам должно быть ровно столько, сколько задач в домашке
    if data.task_results is not None:
        if homework.tasks_count is None or len(data.task_results) != homework.tasks_count:
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
    "/teacher/courses/{course_id}/schedule/{item_id}/attendance",
    response_model=list[int],
)
def get_attendance(
    course_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("teacher", "admin")),
):
    get_own_course(course_id, user, db)
    get_course_schedule_item(course_id, item_id, db)
    rows = db.query(models.Attendance).filter(models.Attendance.schedule_id == item_id).all()
    return [row.user_id for row in rows]


@router.put(
    "/teacher/courses/{course_id}/schedule/{item_id}/attendance",
    response_model=list[int],
)
def set_attendance(
    course_id: int,
    item_id: int,
    data: schemas.AttendanceUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("teacher", "admin")),
):
    get_own_course(course_id, user, db)
    get_course_schedule_item(course_id, item_id, db)

    user_ids = set(data.user_ids)
    for user_id in user_ids:
        if not is_paid_student(course_id, user_id, db):
            raise HTTPException(status_code=400, detail="В списке есть человек не из этой группы")

    # Присылается полный список присутствовавших: старые отметки заменяем новыми
    db.query(models.Attendance).filter(models.Attendance.schedule_id == item_id).delete()
    for user_id in user_ids:
        db.add(models.Attendance(schedule_id=item_id, user_id=user_id))
    db.commit()
    return sorted(user_ids)


# ---------- Преподаватель: ученики и их активность ----------


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

    students = (
        db.query(models.User)
        .join(models.Purchase, models.Purchase.user_id == models.User.id)
        .filter(models.Purchase.course_id == course_id, models.Purchase.status == "paid")
        .distinct()
        .order_by(models.User.last_name, models.User.first_name, models.User.email)
        .all()
    )

    homework_total = db.query(models.Homework).filter(models.Homework.course_id == course_id).count()

    # Считаем только вебинары, которые уже прошли: будущие не должны тянуть процент вниз
    past_webinar_ids = [
        row.id
        for row in db.query(models.Schedule.id).filter(
            models.Schedule.course_id == course_id,
            models.Schedule.stream_date.isnot(None),
            models.Schedule.stream_date < datetime.now(),
        )
    ]
    webinars_total = len(past_webinar_ids)

    result = []
    for student in students:
        homework_done = (
            db.query(models.Submission)
            .join(models.Homework, models.Homework.id == models.Submission.homework_id)
            .filter(
                models.Homework.course_id == course_id,
                models.Submission.user_id == student.id,
                models.Submission.status == "accepted",
            )
            .count()
        )
        webinars_attended = (
            db.query(models.Attendance)
            .filter(
                models.Attendance.user_id == student.id,
                models.Attendance.schedule_id.in_(past_webinar_ids),
            )
            .count()
            if past_webinar_ids
            else 0
        )

        # Домашки и вебинары весят поровну. Если чего-то ещё нет, считаем по тому, что есть
        parts = []
        if homework_total:
            parts.append(homework_done / homework_total)
        if webinars_total:
            parts.append(webinars_attended / webinars_total)
        percent = round(sum(parts) / len(parts) * 100) if parts else None

        result.append(
            schemas.StudentProgressOut(
                id=student.id,
                email=student.email,
                first_name=student.first_name,
                last_name=student.last_name,
                homework_done=homework_done,
                homework_total=homework_total,
                webinars_attended=webinars_attended,
                webinars_total=webinars_total,
                activity_percent=percent,
            )
        )
    return result
