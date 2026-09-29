import re
from datetime import datetime
from typing import Literal, Optional
from urllib.parse import urlparse

from pydantic import BaseModel, Field, field_validator


# ---------- Проверка ссылок ----------

# Ссылки на вебинары: только эти сервисы и только такой вид адреса
ALLOWED_WEBINAR_PREFIXES = {
    "telemost.yandex.ru": "/j/",
    "teams.live.com": "/meet/",
}

# Ссылки на материалы и решения: только облачные диски
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


# ---------- Имя и фамилия ----------

NAME_EXTRA_CHARS = set(" -'’")


def check_name(v: str) -> str:
    v = " ".join(v.split())  # убираем лишние пробелы по краям и двойные внутри
    if not v:
        raise ValueError("Заполни имя и фамилию")
    if len(v) > 50:
        raise ValueError("Слишком длинное имя")
    if not all(ch.isalpha() or ch in NAME_EXTRA_CHARS for ch in v):
        raise ValueError("В имени и фамилии можно использовать только буквы, пробел и дефис")
    return v


# ---------- Телеграм ----------

TELEGRAM_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_]{4,31}$")


def check_telegram(v: str) -> str:
    v = v.strip()
    # Принимаем и "@nick", и "nick", и ссылку "t.me/nick"
    for prefix in ("https://", "http://", "t.me/", "@"):
        if v.lower().startswith(prefix):
            v = v[len(prefix):]
    if not TELEGRAM_RE.match(v):
        raise ValueError(
            "Ник в Телеграме: от 5 до 32 символов, латинские буквы, цифры и _, например @ivan_petrov"
        )
    return v


# ---------- Пароль ----------


def check_password(v: str) -> str:
    if len(v) < 8:
        raise ValueError("Пароль должен быть минимум 8 символов")
    if not any(char.isalpha() for char in v):
        raise ValueError("Пароль должен содержать хотя бы одну букву")
    return v


# ---------- Пользователи ----------


class UserRegister(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=64)
    first_name: str
    last_name: str
    telegram: str

    @field_validator("email")
    @classmethod
    def email_format(cls, v: str) -> str:
        pattern = r"^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"
        if not re.match(pattern, v):
            raise ValueError("Некорректный формат email")
        return v

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return check_password(v)

    @field_validator("first_name", "last_name")
    @classmethod
    def names_valid(cls, v: str) -> str:
        return check_name(v)

    @field_validator("telegram")
    @classmethod
    def telegram_valid(cls, v: str) -> str:
        return check_telegram(v)


class UserLogin(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=64)


class UserOut(BaseModel):
    id: int
    email: str
    role: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    telegram: Optional[str] = None

    class Config:
        from_attributes = True


# ---------- Курсы, расписание, домашки ----------


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
    tasks_count: Optional[int] = Field(default=None, ge=1, le=50)

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
    tasks_count: Optional[int] = None

    class Config:
        from_attributes = True


# ---------- Сдача домашек и активность учеников ----------


class SubmissionCreate(BaseModel):
    link: str = Field(max_length=500)
    comment: Optional[str] = Field(default=None, max_length=2000)

    @field_validator("link")
    @classmethod
    def solution_link_allowed(cls, v: str) -> str:
        checked = check_material_link(v)
        if checked is None:
            raise ValueError("Добавь ссылку на решение")
        return checked


class SubmissionOut(BaseModel):
    id: int
    homework_id: int
    user_id: int
    link: Optional[str] = None
    comment: Optional[str] = None
    status: str
    teacher_comment: Optional[str] = None
    task_results: Optional[list[Optional[bool]]] = None
    submitted_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SubmissionForTeacher(SubmissionOut):
    student_email: str
    student_first_name: Optional[str] = None
    student_last_name: Optional[str] = None


class ReviewCreate(BaseModel):
    status: Literal["accepted", "returned"]
    teacher_comment: Optional[str] = Field(default=None, max_length=2000)
    task_results: Optional[list[Optional[bool]]] = Field(default=None, max_length=50)


class AttendanceUpdate(BaseModel):
    user_ids: list[int] = Field(max_length=100)


class StudentProgressOut(BaseModel):
    id: int
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    homework_done: int
    homework_total: int
    webinars_attended: int
    webinars_total: int
    activity_percent: Optional[int] = None  # None, пока считать не из чего


# ---------- Результат опросника ----------


class QuizItem(BaseModel):
    subject_id: str = Field(pattern=r"^[a-z-]{1,30}$")
    level: Literal["base", "advanced"]


class QuizResultIn(BaseModel):
    items: list[QuizItem] = Field(min_length=1, max_length=10)


class QuizResultOut(BaseModel):
    items: list[QuizItem]
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class QuizLeadOut(QuizResultOut):
    user_id: int
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None



# ---------- Куратор ----------


class GroupShort(BaseModel):
    id: int
    title: str


class CuratorStudentOut(BaseModel):
    id: int
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    telegram: Optional[str] = None
    created_at: Optional[datetime] = None
    quiz_items: Optional[list[QuizItem]] = None
    groups: list[GroupShort] = []


class CuratorCourseOut(BaseModel):
    id: int
    title: str
    teacher_name: Optional[str] = None
    students_count: int
    capacity: int


class EnrollIn(BaseModel):
    user_id: int



# ---------- Настройки аккаунта ----------


class ProfileUpdate(BaseModel):
    first_name: str
    last_name: str
    telegram: Optional[str] = None

    @field_validator("first_name", "last_name")
    @classmethod
    def names_valid(cls, v: str) -> str:
        return check_name(v)

    @field_validator("telegram")
    @classmethod
    def telegram_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not v.strip():
            return None
        return check_telegram(v)


class PasswordChange(BaseModel):
    current_password: str = Field(max_length=64)
    new_password: str = Field(max_length=64)

    @field_validator("new_password")
    @classmethod
    def new_password_strength(cls, v: str) -> str:
        return check_password(v)
