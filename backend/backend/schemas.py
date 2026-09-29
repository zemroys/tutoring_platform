import re
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional


class UserRegister(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=64)

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
    email: str = Field(max_length=254)
    password: str = Field(max_length=64)

class Token(BaseModel):
    access_token: str
    token_type: str


class CourseCreate(BaseModel):
    title: str
    description: str = ""
    price: int
    teacher_id: int

class CourseOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    price: Optional[int] = None
    teacher_id: Optional[int] = None

    class Config:
        from_attributes = True

class ScheduleCreate(BaseModel):
    week_number: int
    webinar_link: str
    stream_date: Optional[datetime] = None

    @field_validator("webinar_link")
    @classmethod
    def link_must_be_https(cls, v: str) -> str:
        if not v.startswith("https://"):
            raise ValueError("Ссылка должна начинаться с https://")
        return v

class ScheduleOut(BaseModel):
    id: int
    course_id: int
    week_number: int
    webinar_link: str
    stream_date: Optional[datetime] = None

    class Config:
        from_attributes = True

class HomeworkCreate(BaseModel):
    week_number: int
    description: str

class HomeworkOut(BaseModel):
    id: int
    course_id: int
    week_number: int
    description: str

    class Config:
        from_attributes = True