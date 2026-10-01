# Куратор: видит учеников с контактами, подбором и заказами и распределяет их по группам.
# Добавление в группу — это "твоя группа", доступ к занятиям дают только оплаченные заказы.

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from auth import require_role
from database import get_db
from shop import ensure_member, order_out, teacher_name

router = APIRouter()

curator_only = require_role("curator", "admin")


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
    for member, course in (
        db.query(models.GroupMember, models.Course)
        .join(models.Course, models.Course.id == models.GroupMember.course_id)
        .filter(models.GroupMember.status == "active")
    ):
        groups_by_user.setdefault(member.user_id, []).append(
            schemas.GroupShort(id=course.id, title=course.title, subject_id=course.subject_id)
        )

    orders_by_user: dict[int, list[schemas.OrderOut]] = {}
    for order in (
        db.query(models.Order)
        .filter(models.Order.status != "cancelled")
        .order_by(models.Order.created_at.desc(), models.Order.id.desc())
    ):
        orders_by_user.setdefault(order.user_id, []).append(order_out(order, db))

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
            orders=orders_by_user.get(s.id, []),
        )
        for s in students
    ]


@router.get("/curator/courses", response_model=list[schemas.CuratorCourseOut])
def curator_courses(db: Session = Depends(get_db), user: models.User = Depends(curator_only)):
    result = []
    for course in db.query(models.Course).order_by(models.Course.title).all():
        members = (
            db.query(models.GroupMember)
            .filter(models.GroupMember.course_id == course.id, models.GroupMember.status == "active")
            .count()
        )
        result.append(
            schemas.CuratorCourseOut(
                id=course.id,
                title=course.title,
                teacher_name=teacher_name(course, db),
                subject_id=course.subject_id,
                level=course.level,
                members_count=members,
            )
        )
    return result


@router.post("/curator/courses/{course_id}/students", response_model=schemas.GroupShort)
def add_to_group(
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
    existing = (
        db.query(models.GroupMember)
        .filter(models.GroupMember.course_id == course_id, models.GroupMember.user_id == student.id)
        .first()
    )
    if existing is not None and existing.status == "active":
        raise HTTPException(status_code=409, detail="Ученик уже в этой группе")
    ensure_member(course_id, student.id, user.id, db)
    db.commit()
    return schemas.GroupShort(id=course.id, title=course.title, subject_id=course.subject_id)


@router.delete("/curator/courses/{course_id}/students/{user_id}")
def remove_from_group(
    course_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(curator_only),
):
    member = (
        db.query(models.GroupMember)
        .filter(
            models.GroupMember.course_id == course_id,
            models.GroupMember.user_id == user_id,
            models.GroupMember.status == "active",
        )
        .first()
    )
    if member is None:
        raise HTTPException(status_code=404, detail="Ученика нет в этой группе")
    # Оплаченные пропуска не трогаем: за них заплачено. Убирается только "моя группа"
    member.status = "removed"
    db.commit()
    return {"ok": True}
