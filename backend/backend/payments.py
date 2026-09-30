# Оплаты. Пока оплачивают переводом, админ отмечает оплату вручную.
# Позже эти же записи будет создавать онлайн-касса после успешной оплаты.

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from auth import require_role
from database import get_db

router = APIRouter()


def current_period() -> str:
    return datetime.now().strftime("%Y-%m")


def has_paid(db: Session, user_id: int, subject_id: str, period: str) -> bool:
    """Оплачен ли предмет за этот месяц."""
    return (
        db.query(models.Payment)
        .filter(
            models.Payment.user_id == user_id,
            models.Payment.subject_id == subject_id,
            models.Payment.period == period,
            models.Payment.status == "paid",
        )
        .first()
        is not None
    )


@router.post("/admin/payments", response_model=schemas.PaymentOut)
def create_payment(
    data: schemas.PaymentCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_role("admin")),
):
    student = db.get(models.User, data.user_id)
    if student is None or student.role != "student":
        raise HTTPException(status_code=400, detail="Ученик не найден")
    if has_paid(db, data.user_id, data.subject_id, data.period):
        raise HTTPException(status_code=409, detail="Этот месяц по этому предмету уже отмечен как оплаченный")

    payment = models.Payment(**data.model_dump(), status="paid", method="transfer", created_by=admin.id)
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


@router.delete("/admin/payments/{payment_id}")
def cancel_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_role("admin")),
):
    payment = db.get(models.Payment, payment_id)
    if payment is None or payment.status != "paid":
        raise HTTPException(status_code=404, detail="Оплата не найдена")
    # Не удаляем, а помечаем отменённой: история денег должна сохраняться
    payment.status = "cancelled"
    db.commit()
    return {"ok": True}
