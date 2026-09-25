from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from passlib.context import CryptContext

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
