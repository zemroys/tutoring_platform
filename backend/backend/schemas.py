import re
from datetime import datetime
from typing import Literal, Optional
from urllib.parse import parse_qs, urlparse

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


# ---------- Видео с теорией ----------
# Принимаем только YouTube и VK Видео и сами собираем адрес плеера.
# Так на страницу никогда не попадёт произвольный iframe с чужого сайта.

YOUTUBE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")
VK_PATH_RE = re.compile(r"^/video(-?\d+)_(\d+)$")


def video_embed_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    parsed = urlparse(url.strip())
    if not is_clean_https(parsed):
        return None
    host = (parsed.hostname or "").lower()
    if host.startswith("www.") or host.startswith("m."):
        host = host.split(".", 1)[1]
    query = parse_qs(parsed.query)

    if host == "youtube.com":
        video_id = None
        if parsed.path == "/watch":
            video_id = query.get("v", [None])[0]
        elif parsed.path.startswith(("/embed/", "/live/", "/shorts/")):
            video_id = parsed.path.split("/")[2]
        if video_id and YOUTUBE_ID_RE.match(video_id):
            return f"https://www.youtube-nocookie.com/embed/{video_id}"
    if host == "youtu.be":
        video_id = parsed.path.lstrip("/")
        if YOUTUBE_ID_RE.match(video_id):
            return f"https://www.youtube-nocookie.com/embed/{video_id}"

    if host in ("vk.com", "vk.ru", "vkvideo.ru"):
        oid = video_id = video_hash = None
        if parsed.path == "/video_ext.php":
            oid = query.get("oid", [None])[0]
            video_id = query.get("id", [None])[0]
            video_hash = query.get("hash", [None])[0]
        else:
            match = VK_PATH_RE.match(parsed.path)
            if match:
                oid, video_id = match.groups()
        if oid and video_id and re.fullmatch(r"-?\d+", oid) and re.fullmatch(r"\d+", video_id):
            embed = f"https://vk.com/video_ext.php?oid={oid}&id={video_id}&hd=2"
            if video_hash:
                if not re.fullmatch(r"[0-9a-f]{1,64}", video_hash):
                    return None
                embed += f"&hash={video_hash}"
            return embed
    return None


def check_video_link(v: Optional[str]) -> Optional[str]:
    if v is None or not v.strip():
        return None
    if video_embed_url(v) is None:
        raise ValueError(
            "Видео: ссылка на YouTube или VK Видео. Для закрытого VK-видео возьми ссылку из «Поделиться» → «Экспортировать»"
        )
    return v.strip()


def optional_webinar_link(v: Optional[str]) -> Optional[str]:
    if v is None or not v.strip():
        return None
    return check_webinar_link(v)


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


SUBJECT_PATTERN = r"^[a-z-]{1,30}$"
PERIOD_PATTERN = r"^\d{4}-(0[1-9]|1[0-2])$"


class CourseCreate(BaseModel):
    title: str
    description: str = ""
    price: int
    teacher_id: int
    subject_id: str = Field(pattern=SUBJECT_PATTERN)
    level: Literal["base", "advanced"]


class CourseUpdate(BaseModel):
    title: Optional[str] = None
    teacher_id: Optional[int] = None
    subject_id: Optional[str] = Field(default=None, pattern=SUBJECT_PATTERN)
    level: Optional[Literal["base", "advanced"]] = None


class CourseOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    price: Optional[int] = None
    teacher_id: Optional[int] = None
    subject_id: Optional[str] = None
    level: Optional[str] = None

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
    subject_id: Optional[str] = None


class PaymentCreate(BaseModel):
    user_id: int
    subject_id: str = Field(pattern=SUBJECT_PATTERN)
    level: Literal["base", "advanced"]
    period: str = Field(pattern=PERIOD_PATTERN)
    amount: int = Field(ge=0, le=1_000_000)


class PaymentOut(BaseModel):
    id: int
    user_id: int
    subject_id: str
    level: str
    period: str
    amount: int
    status: str
    method: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CuratorStudentOut(BaseModel):
    id: int
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    telegram: Optional[str] = None
    created_at: Optional[datetime] = None
    quiz_items: Optional[list[QuizItem]] = None
    groups: list[GroupShort] = []
    payments: list[PaymentOut] = []


class CuratorCourseOut(BaseModel):
    id: int
    title: str
    teacher_name: Optional[str] = None
    subject_id: Optional[str] = None
    level: Optional[str] = None
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



# ---------- Занятия ----------


class LessonFields(BaseModel):
    """Общие проверки для создания и изменения занятия."""

    @field_validator("topic", check_fields=False)
    @classmethod
    def topic_not_empty(cls, v):
        if v is None:
            return v
        v = " ".join(v.split())
        if not v:
            raise ValueError("Укажи тему занятия")
        return v

    @field_validator("webinar_link", check_fields=False)
    @classmethod
    def webinar_ok(cls, v):
        return optional_webinar_link(v)

    @field_validator("video_url", check_fields=False)
    @classmethod
    def video_ok(cls, v):
        return check_video_link(v)

    @field_validator("notes_url", "homework_link", check_fields=False)
    @classmethod
    def material_ok(cls, v):
        return check_material_link(v)

    @field_validator("homework_text", check_fields=False)
    @classmethod
    def homework_text_ok(cls, v):
        if v is None or not v.strip():
            return None
        return v.strip()


class LessonCreate(LessonFields):
    number: int = Field(ge=1, le=500)
    topic: str = Field(max_length=200)
    kind: Literal["lesson", "mock"] = "lesson"
    starts_at: Optional[datetime] = None
    webinar_link: Optional[str] = Field(default=None, max_length=500)
    video_url: Optional[str] = Field(default=None, max_length=500)
    notes_url: Optional[str] = Field(default=None, max_length=500)
    homework_text: Optional[str] = Field(default=None, max_length=5000)
    homework_link: Optional[str] = Field(default=None, max_length=500)
    tasks_count: Optional[int] = Field(default=None, ge=1, le=50)


class LessonUpdate(LessonFields):
    number: Optional[int] = Field(default=None, ge=1, le=500)
    topic: Optional[str] = Field(default=None, max_length=200)
    kind: Optional[Literal["lesson", "mock"]] = None
    starts_at: Optional[datetime] = None
    webinar_link: Optional[str] = Field(default=None, max_length=500)
    video_url: Optional[str] = Field(default=None, max_length=500)
    notes_url: Optional[str] = Field(default=None, max_length=500)
    homework_text: Optional[str] = Field(default=None, max_length=5000)
    homework_link: Optional[str] = Field(default=None, max_length=500)
    tasks_count: Optional[int] = Field(default=None, ge=1, le=50)


class LessonSummary(BaseModel):
    """Строка в списке занятий: без ссылок, только что есть у занятия."""

    id: int
    course_id: int
    number: int
    topic: str
    kind: str
    starts_at: Optional[datetime] = None
    has_video: bool
    has_notes: bool
    has_homework: bool


class LessonOut(BaseModel):
    id: int
    course_id: int
    number: int
    topic: str
    kind: str
    starts_at: Optional[datetime] = None
    webinar_link: Optional[str] = None
    video_url: Optional[str] = None
    video_embed_url: Optional[str] = None
    notes_url: Optional[str] = None
    homework_text: Optional[str] = None
    homework_link: Optional[str] = None
    tasks_count: Optional[int] = None


class LessonSubmissionOut(BaseModel):
    id: int
    lesson_id: int
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


class LessonSubmissionForTeacher(LessonSubmissionOut):
    student_email: str
    student_first_name: Optional[str] = None
    student_last_name: Optional[str] = None
