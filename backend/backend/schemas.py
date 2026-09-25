import re
from pydantic import BaseModel, field_validator

class UserRegister(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def email_format(cls, v: str) -> str:
        pattern = r"^[^@\s]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"
        if not re.match(pattern, v):
            raise ValueError("Некорректный формат email")
        return v

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Пароль должен быть минимум 8 символов")
        if not any(char.isalpha() for char in v):
            raise ValueError("Пароль должен содержать хотя бы одну букву")
        return v

    
class UserOut(BaseModel):
    id: int
    email: str
    role: str

    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str