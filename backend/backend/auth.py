# Вход и сессии.
#
# При входе выдаются два токена в httpOnly cookie:
#   access_token  — короткий (15 минут), проверяется на каждом запросе;
#   refresh_token — длинный (30 дней), нужен только чтобы получить новый короткий.
# Длинные токены записаны в таблицу sessions (в виде хеша), поэтому сессию можно завершить:
# выход, "выйти на всех устройствах", смена пароля.

import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from dotenv import load_dotenv
from fastapi import Depends, HTTPException, Request, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

import models
from database import get_db

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY не задан в .env")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 30
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"

bearer_scheme = HTTPBearer(auto_error=False)


# ---------- Токены ----------


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_access_token(user_id: int, session_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    # sid — номер сессии: по нему проверяем, что из сессии не вышли
    payload = {"sub": str(user_id), "sid": session_id, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_session(db: Session, user_id: int) -> tuple[models.UserSession, str]:
    """Новая сессия. Возвращает запись и сам долгий токен (он уходит только в cookie)."""
    token = secrets.token_urlsafe(32)
    now = datetime.now()
    session = models.UserSession(
        user_id=user_id,
        token_hash=hash_token(token),
        last_used_at=now,
        expires_at=now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session, token


def find_active_session(db: Session, refresh_token: Optional[str]) -> Optional[models.UserSession]:
    if not refresh_token:
        return None
    session = (
        db.query(models.UserSession)
        .filter(models.UserSession.token_hash == hash_token(refresh_token))
        .first()
    )
    if session is None or session.revoked_at is not None or session.expires_at < datetime.now():
        return None
    return session


def revoke_user_sessions(db: Session, user_id: int, except_session_id: Optional[int] = None) -> None:
    query = db.query(models.UserSession).filter(
        models.UserSession.user_id == user_id,
        models.UserSession.revoked_at.is_(None),
    )
    if except_session_id is not None:
        query = query.filter(models.UserSession.id != except_session_id)
    query.update({models.UserSession.revoked_at: datetime.now()}, synchronize_session=False)
    db.commit()


# ---------- Cookie ----------


def set_auth_cookies(response: Response, user_id: int, session_id: int, refresh_token: str) -> None:
    response.set_cookie(
        key="access_token",
        value=create_access_token(user_id, session_id),
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )


def clear_auth_cookies(response: Response) -> None:
    for key in ("access_token", "refresh_token"):
        response.delete_cookie(key, httponly=True, samesite="lax", secure=COOKIE_SECURE)


# ---------- Кто делает запрос ----------


def get_current_session(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> models.UserSession:
    token = credentials.credentials if credentials else request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Нужно войти")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
        session_id = int(payload["sid"])
    except (JWTError, KeyError, ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Недействительный или просроченный токен")

    session = db.get(models.UserSession, session_id)
    # Если из сессии вышли, короткий токен перестаёт работать сразу, не дожидаясь 15 минут
    if session is None or session.user_id != user_id or session.revoked_at is not None:
        raise HTTPException(status_code=401, detail="Сессия завершена, войди снова")
    return session


def get_current_user(
    session: models.UserSession = Depends(get_current_session),
    db: Session = Depends(get_db),
) -> models.User:
    user = db.get(models.User, session.user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="Пользователь не найден")
    return user


def require_role(*roles: str):
    def checker(user: models.User = Depends(get_current_user)) -> models.User:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        return user

    return checker
