# Настройки аккаунта: изменить свои данные и пароль.

from fastapi import APIRouter, Depends, HTTPException, Request
from passlib.context import CryptContext
from sqlalchemy.orm import Session

import models
import schemas
from auth import get_current_user
from database import get_db
from rate_limit import limiter

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@router.patch("/me", response_model=schemas.UserOut)
def update_profile(
    data: schemas.ProfileUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    # Ученику ник обязателен: по нему с ним связывается куратор
    if user.role == "student" and data.telegram is None:
        raise HTTPException(status_code=400, detail="Ник в Телеграме нужен, чтобы куратор мог написать тебе")

    user.first_name = data.first_name
    user.last_name = data.last_name
    user.telegram = data.telegram
    db.commit()
    db.refresh(user)
    return user


@router.post("/me/password")
@limiter.limit("10/hour")
def change_password(
    request: Request,
    data: schemas.PasswordChange,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    # Текущий пароль спрашиваем всегда: если кто-то сел за чужой открытый ноутбук,
    # он не сможет сменить пароль и забрать аккаунт
    if not pwd_context.verify(data.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Текущий пароль неверный")
    if data.current_password == data.new_password:
        raise HTTPException(status_code=400, detail="Новый пароль совпадает с текущим")

    user.password_hash = pwd_context.hash(data.new_password)
    db.commit()
    return {"ok": True}
