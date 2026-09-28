from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from auth import create_access_token, get_current_user, require_role
from database import get_db
import models
import schemas

app = FastAPI()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

@app.get("/")
def read_root():
    return {"status": "ok"}
@app.post("/register", response_model=schemas.UserOut)
def register(user: schemas.UserRegister, db: Session = Depends(get_db)):
    existing_user = db.query(models.User).filter(models.User.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email уже зарегистрирован")

    hashed_password = pwd_context.hash(user.password)
    new_user = models.User(
        email=user.email,
        password_hash=hashed_password,
        role="student"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


@app.post("/login", response_model=schemas.Token)
def login(credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == credentials.email).first()
    if not user or not pwd_context.verify(credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Неверный email или пароль")

    token = create_access_token(user.id)
    return {"access_token": token, "token_type": "bearer"}


@app.get("/me", response_model=schemas.UserOut)
def me(user: models.User = Depends(get_current_user)):
    return user


# Временный, для проверки ролей. Заменим настоящими endpoint'ами преподавателя.
@app.get("/teacher/ping")
def teacher_ping(user: models.User = Depends(require_role("teacher", "admin"))):
    return {"ok": True, "role": user.role}