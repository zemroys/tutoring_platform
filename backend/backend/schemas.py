import re
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional
from urllib.parse import urlparse


# Ссылки на вебинары: только эти сервисы и только такой вид адреса
ALLOWED_WEBINAR_PREFIXES = {
    "telemost.yandex.ru": "/j/",
    "teams.live.com": "/meet/",
}

# Ссылки на материалы к домашке: только облачные диски
ALLOWED_MATERIAL_HOSTS = {
    "disk.yandex.ru",
    "yadi.sk",
    "drive.google.com",
    "docs.google.com",
}


def is_clean_https(parsed) -> bool:
    # Никаких портов и логинов в ссылке: https://telemost.yandex.ru@evil.com не пройдёт
    return (
        parsed.scheme == "https"
        and parsed.port is None
        and not parsed.username
        and not parsed.password
    )


def check_webinar_link(v: str) -> str:
    v = v.strip()
    parsed = urlparse(v)
    prefix = ALLOWED_WEBINAR_PREFIXES.get(parsed.hostname or "")
    if (
        prefix is None
        or not is_clean_https(parsed)
        or not parsed.path.startswith(prefix)
        or len(parsed.path) <= len(prefix)
    ):
        raise ValueError(
            "Ссылка должна быть вида https://telemost.yandex.ru/j/... или https://teams.live.com/meet/..."
        )
    return v


def check_material_link(v: Optional[str]) -> Optional[str]:
    if v is None or not v.strip():
        return None
    v = v.strip()
    parsed = urlparse(v)
    if not is_clean_https(parsed) or parsed.hostname not in ALLOWED_MATERIAL_HOSTS:
        raise ValueError("Ссылка на материалы: только Яндекс Диск или Google Диск")
    return v


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
    webinar_link: str = Field(max_length=500)
    stream_date: Optional[datetime] = None

    @field_validator("webinar_link")
    @classmethod
    def webinar_link_allowed(cls, v: str) -> str:
        return check_webinar_link(v)


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
    description: str = Field(max_length=5000)
    link: Optional[str] = Field(default=None, max_length=500)

    @field_validator("link")
    @classmethod
    def material_link_allowed(cls, v: Optional[str]) -> Optional[str]:
        return check_material_link(v)


class HomeworkOut(BaseModel):
    id: int
    course_id: int
    week_number: int
    description: str
    link: Optional[str] = None

    class Config:
        from_attributes = True