# Витрина групп и заказы: месяц группы или отдельные занятия.
# Сумму считает сервер. Пропуска выдаются только когда заказ оплачен:
# сейчас это кнопка админа "Оплачено", позже то же самое будет делать онлайн-касса.

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from access import is_member, lesson_period, seats_taken, student_has_lesson
from auth import get_current_user, require_role
from database import get_db
from pricing import GROUP_CAPACITY, get_prices

router = APIRouter()

MONTHS = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"]
MONTHS_AHEAD = 3  # покупать можно текущий месяц и ещё 2 вперёд


def current_period() -> str:
    return datetime.now().strftime("%Y-%m")


def allowed_periods() -> list[str]:
    now = datetime.now()
    result = []
    year, month = now.year, now.month
    for _ in range(MONTHS_AHEAD):
        result.append(f"{year}-{month:02d}")
        month += 1
        if month > 12:
            year, month = year + 1, 1
    return result


def period_name(period: str) -> str:
    year, month = period.split("-")
    return f"{MONTHS[int(month) - 1]} {year}"


def teacher_name(course: models.Course, db: Session) -> Optional[str]:
    teacher = db.get(models.User, course.teacher_id) if course.teacher_id else None
    if teacher is None:
        return None
    return " ".join(filter(None, [teacher.last_name, teacher.first_name])) or teacher.email


def course_prices(course: models.Course) -> tuple[int, int]:
    prices = get_prices(course.subject_id, course.level)
    if prices is None:
        raise HTTPException(status_code=400, detail="У группы не указаны предмет и уровень, цену не посчитать")
    return prices


def order_out(order: models.Order, db: Session) -> schemas.OrderOut:
    course = db.get(models.Course, order.course_id)
    if order.kind == "month":
        description = f"Месяц: {period_name(order.period)}"
    else:
        numbers = sorted(
            l.number for l in db.query(models.Lesson).filter(models.Lesson.id.in_(order.lesson_ids or []))
        )
        label = "Занятие" if len(numbers) == 1 else "Занятия"
        description = f"{label} " + ", ".join(str(n) for n in numbers)
    return schemas.OrderOut(
        id=order.id,
        user_id=order.user_id,
        course_id=order.course_id,
        course_title=course.title if course else "",
        kind=order.kind,
        period=order.period,
        lesson_ids=order.lesson_ids,
        description=description,
        amount=order.amount,
        status=order.status,
        method=order.method,
        created_at=order.created_at,
        paid_at=order.paid_at,
    )


def check_capacity(lessons: list[models.Lesson], user_id: int, db: Session) -> None:
    for lesson in lessons:
        if student_has_lesson(lesson, user_id, db):
            continue
        if seats_taken(lesson, db) >= GROUP_CAPACITY:
            raise HTTPException(status_code=409, detail=f"На занятии {lesson.number} нет свободных мест")


def build_order(data: schemas.OrderCreate, student: models.User, db: Session) -> models.Order:
    """Проверяет заказ и считает сумму. Ничего не сохраняет."""
    course = db.get(models.Course, data.course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    month_price, lesson_price = course_prices(course)

    if data.kind == "month":
        if data.period is None or data.lesson_ids:
            raise HTTPException(status_code=400, detail="Для месяца укажи только месяц")
        if data.period not in allowed_periods():
            raise HTTPException(status_code=400, detail="Этот месяц сейчас купить нельзя")
        already = (
            db.query(models.MonthPass)
            .filter(
                models.MonthPass.user_id == student.id,
                models.MonthPass.course_id == course.id,
                models.MonthPass.period == data.period,
            )
            .first()
        )
        if already:
            raise HTTPException(status_code=409, detail="Этот месяц уже оплачен")
        pending = (
            db.query(models.Order)
            .filter(
                models.Order.user_id == student.id,
                models.Order.course_id == course.id,
                models.Order.kind == "month",
                models.Order.period == data.period,
                models.Order.status == "pending",
            )
            .first()
        )
        if pending:
            raise HTTPException(status_code=409, detail="Заказ на этот месяц уже ждёт оплаты")
        lessons = [
            l
            for l in db.query(models.Lesson).filter(models.Lesson.course_id == course.id)
            if lesson_period(l) == data.period
        ]
        if not lessons:
            raise HTTPException(status_code=400, detail="В этом месяце у группы пока нет занятий")
        check_capacity(lessons, student.id, db)
        return models.Order(user_id=student.id, course_id=course.id, kind="month", period=data.period, amount=month_price)

    # Отдельные занятия
    if not data.lesson_ids or data.period is not None:
        raise HTTPException(status_code=400, detail="Выбери занятия")
    ids = sorted(set(data.lesson_ids))
    lessons = db.query(models.Lesson).filter(models.Lesson.id.in_(ids)).all()
    if len(lessons) != len(ids) or any(l.course_id != course.id for l in lessons):
        raise HTTPException(status_code=400, detail="Занятия не из этой группы")
    for lesson in lessons:
        if lesson.kind == "mock":
            raise HTTPException(status_code=400, detail="Пробники доступны только при покупке месяца")
        if student_has_lesson(lesson, student.id, db):
            raise HTTPException(status_code=409, detail=f"Занятие {lesson.number} у тебя уже есть")
    check_capacity(lessons, student.id, db)
    return models.Order(
        user_id=student.id, course_id=course.id, kind="lessons", lesson_ids=ids, amount=lesson_price * len(ids)
    )


def ensure_member(course_id: int, user_id: int, added_by: int, db: Session) -> None:
    member = (
        db.query(models.GroupMember)
        .filter(models.GroupMember.course_id == course_id, models.GroupMember.user_id == user_id)
        .first()
    )
    if member is None:
        db.add(models.GroupMember(course_id=course_id, user_id=user_id, added_by=added_by))
    elif member.status != "active":
        member.status = "active"


def fulfil_order(order: models.Order, method: str, db: Session) -> None:
    """Заказ оплачен: выдаём пропуска. Места проверяем ещё раз: пока заказ ждал оплаты, их могли занять."""
    if order.status != "pending":
        raise HTTPException(status_code=409, detail="Заказ уже обработан")
    if order.kind == "month":
        lessons = [
            l
            for l in db.query(models.Lesson).filter(models.Lesson.course_id == order.course_id)
            if lesson_period(l) == order.period
        ]
        check_capacity(lessons, order.user_id, db)
        exists = (
            db.query(models.MonthPass)
            .filter(
                models.MonthPass.user_id == order.user_id,
                models.MonthPass.course_id == order.course_id,
                models.MonthPass.period == order.period,
            )
            .first()
        )
        if exists:
            raise HTTPException(status_code=409, detail="Этот месяц уже оплачен")
        db.add(models.MonthPass(user_id=order.user_id, course_id=order.course_id, period=order.period, order_id=order.id))
    else:
        lessons = db.query(models.Lesson).filter(models.Lesson.id.in_(order.lesson_ids or [])).all()
        for lesson in lessons:
            if student_has_lesson(lesson, order.user_id, db):
                raise HTTPException(status_code=409, detail=f"Занятие {lesson.number} у ученика уже есть")
        check_capacity(lessons, order.user_id, db)
        for lesson in lessons:
            db.add(models.LessonPass(user_id=order.user_id, lesson_id=lesson.id, order_id=order.id))
    ensure_member(order.course_id, order.user_id, order.created_by or order.user_id, db)
    order.status = "paid"
    order.method = method
    order.paid_at = datetime.now()


# ---------- Витрина ----------


@router.get("/catalog/courses", response_model=list[schemas.CatalogCourseOut])
def catalog(
    subject_id: Optional[str] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    query = db.query(models.Course).order_by(models.Course.title)
    if subject_id:
        query = query.filter(models.Course.subject_id == subject_id)
    result = []
    for course in query.all():
        prices = get_prices(course.subject_id, course.level)
        if prices is None:
            continue  # группа без цены в витрину не попадает
        result.append(
            schemas.CatalogCourseOut(
                id=course.id,
                title=course.title,
                subject_id=course.subject_id,
                level=course.level,
                teacher_name=teacher_name(course, db),
                month_price=prices[0],
                lesson_price=prices[1],
                is_member=is_member(course.id, user.id, db),
            )
        )
    return result


@router.get("/catalog/courses/{course_id}", response_model=schemas.CatalogCourseDetail)
def catalog_course(
    course_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    course = db.get(models.Course, course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    month_price, lesson_price = course_prices(course)
    allowed = allowed_periods()
    lessons = [
        l
        for l in db.query(models.Lesson)
        .filter(models.Lesson.course_id == course.id)
        .order_by(models.Lesson.starts_at, models.Lesson.number)
        if lesson_period(l) in allowed
    ]
    owned = [
        p.period
        for p in db.query(models.MonthPass).filter(
            models.MonthPass.user_id == user.id, models.MonthPass.course_id == course.id
        )
    ]
    return schemas.CatalogCourseDetail(
        id=course.id,
        title=course.title,
        subject_id=course.subject_id,
        level=course.level,
        teacher_name=teacher_name(course, db),
        month_price=month_price,
        lesson_price=lesson_price,
        is_member=is_member(course.id, user.id, db),
        capacity=GROUP_CAPACITY,
        lessons=[
            schemas.CatalogLesson(
                id=l.id,
                number=l.number,
                topic=l.topic,
                kind=l.kind,
                starts_at=l.starts_at,
                period=lesson_period(l),
                seats_left=max(0, GROUP_CAPACITY - seats_taken(l, db)),
                has_access=student_has_lesson(l, user.id, db),
            )
            for l in lessons
        ],
        months=sorted({lesson_period(l) for l in lessons}),
        owned_months=owned,
    )


# ---------- Заказы ученика ----------


@router.post("/orders", response_model=schemas.OrderOut)
def create_order(
    data: schemas.OrderCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if user.role != "student":
        raise HTTPException(status_code=403, detail="Покупать могут только ученики")
    order = build_order(data, user, db)
    order.created_by = user.id
    db.add(order)
    # Выбрал группу и оформил заказ — группа становится "моей", даже пока заказ не оплачен
    ensure_member(order.course_id, user.id, user.id, db)
    db.commit()
    db.refresh(order)
    return order_out(order, db)


@router.get("/my/orders", response_model=list[schemas.OrderOut])
def my_orders(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    orders = (
        db.query(models.Order)
        .filter(models.Order.user_id == user.id, models.Order.status != "cancelled")
        .order_by(models.Order.created_at.desc(), models.Order.id.desc())
        .all()
    )
    return [order_out(o, db) for o in orders]


@router.delete("/orders/{order_id}")
def cancel_my_order(order_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    order = db.get(models.Order, order_id)
    if order is None or order.user_id != user.id:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    if order.status != "pending":
        raise HTTPException(status_code=409, detail="Отменить можно только неоплаченный заказ")
    order.status = "cancelled"
    db.commit()
    return {"ok": True}


# ---------- Админ ----------


@router.post("/admin/orders/{order_id}/paid", response_model=schemas.OrderOut)
def mark_paid(
    order_id: int,
    data: schemas.OrderPaid,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_role("admin")),
):
    order = db.get(models.Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    fulfil_order(order, data.method, db)
    db.commit()
    db.refresh(order)
    return order_out(order, db)


@router.post("/admin/orders/{order_id}/cancel", response_model=schemas.OrderOut)
def admin_cancel(
    order_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_role("admin")),
):
    order = db.get(models.Order, order_id)
    if order is None or order.status == "cancelled":
        raise HTTPException(status_code=404, detail="Заказ не найден")
    # Отмена оплаченного заказа забирает выданные по нему пропуска. Сам заказ остаётся в истории
    db.query(models.MonthPass).filter(models.MonthPass.order_id == order.id).delete()
    db.query(models.LessonPass).filter(models.LessonPass.order_id == order.id).delete()
    order.status = "cancelled"
    db.commit()
    db.refresh(order)
    return order_out(order, db)


@router.post("/admin/orders", response_model=schemas.OrderOut)
def admin_create_paid_order(
    data: schemas.AdminOrderCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_role("admin")),
):
    """Ученик заплатил переводом, а заказ на сайте не оформлял: админ оформляет и сразу отмечает оплату."""
    student = db.get(models.User, data.user_id)
    if student is None or student.role != "student":
        raise HTTPException(status_code=400, detail="Ученик не найден")
    order = build_order(data, student, db)
    order.created_by = admin.id
    db.add(order)
    db.flush()  # нужен номер заказа, чтобы привязать к нему пропуска
    fulfil_order(order, "transfer", db)
    db.commit()
    db.refresh(order)
    return order_out(order, db)
