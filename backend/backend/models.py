from sqlalchemy import JSON, Column, Integer, String, Text, ForeignKey, TIMESTAMP, UniqueConstraint
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    role = Column(String, default="student")
    first_name = Column(String(50), nullable=True)
    last_name = Column(String(50), nullable=True)
    telegram = Column(String(32), nullable=True)  # ник без @, виден только куратору и админу
    created_at = Column(TIMESTAMP, server_default=func.now())

class Course(Base):
    __tablename__ = "courses"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    description = Column(Text)
    price = Column(Integer)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    subject_id = Column(String(30), nullable=True)  # "physics", "base-math" и т.д., как в lib/courses.ts
    level = Column(String(10), nullable=True)  # "base" или "advanced"

class Purchase(Base):
    __tablename__ = "purchases"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    course_id = Column(Integer, ForeignKey("courses.id"))
    status = Column(String, default="pending")
    paid_at = Column(TIMESTAMP, nullable=True)

# ---------- СТАРОЕ: расписание и домашки до перехода на занятия ----------
# Сайт этими таблицами больше не пользуется. Удалим их отдельной миграцией.


class Schedule(Base):
    __tablename__ = "schedule"
    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"))
    week_number = Column(Integer)
    webinar_link = Column(String)
    stream_date = Column(TIMESTAMP, nullable=True)

class Homework(Base):
    __tablename__ = "homework"
    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"))
    week_number = Column(Integer)
    description = Column(Text)
    link = Column(String, nullable=True)
    tasks_count = Column(Integer, nullable=True)  # сколько задач в домашке, для отметок "верно/ошибка"

class Submission(Base):
    __tablename__ = "submissions"
    __table_args__ = (UniqueConstraint("homework_id", "user_id", name="uq_submission_homework_user"),)
    id = Column(Integer, primary_key=True, index=True)
    homework_id = Column(Integer, ForeignKey("homework.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    file_url = Column(String)  # на будущее, для загрузки файлов
    link = Column(String, nullable=True)  # ссылка на решение
    comment = Column(Text, nullable=True)  # комментарий ученика
    status = Column(String, nullable=False, default="submitted", server_default="submitted")
    teacher_comment = Column(Text, nullable=True)
    task_results = Column(JSON, nullable=True)  # [true, false, null, ...]: верно / ошибка / не отмечено
    submitted_at = Column(TIMESTAMP, server_default=func.now())
    reviewed_at = Column(TIMESTAMP, nullable=True)

class Attendance(Base):
    __tablename__ = "attendance"
    __table_args__ = (UniqueConstraint("schedule_id", "user_id", name="uq_attendance_schedule_user"),)
    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("schedule.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)


class QuizResult(Base):
    """Результат опросника: какие курсы подошли ученику. Одна запись на пользователя."""

    __tablename__ = "quiz_results"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    items = Column(JSON, nullable=False)  # [{"subject_id": "physics", "level": "base"}, ...]
    updated_at = Column(TIMESTAMP, server_default=func.now())


class UserSession(Base):
    """Сессия входа на одном устройстве. Хранится хеш долгого токена, не сам токен."""

    __tablename__ = "sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    last_used_at = Column(TIMESTAMP, nullable=True)
    expires_at = Column(TIMESTAMP, nullable=False)
    revoked_at = Column(TIMESTAMP, nullable=True)  # заполнено, если из сессии вышли


# СТАРОЕ: ручные оплаты по предметам до перехода на заказы. Сайт больше не использует, удалим позже.
class Payment(Base):
    """Оплата предмета за месяц. Пока отмечается админом вручную, позже её будет создавать онлайн-касса."""

    __tablename__ = "payments"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    subject_id = Column(String(30), nullable=False)
    level = Column(String(10), nullable=False)
    period = Column(String(7), nullable=False)  # месяц в виде "2026-10"
    amount = Column(Integer, nullable=False)  # в рублях
    status = Column(String(20), nullable=False, default="paid", server_default="paid")  # paid / cancelled
    method = Column(String(20), nullable=False, default="transfer", server_default="transfer")
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)  # кто отметил оплату
    created_at = Column(TIMESTAMP, server_default=func.now())


# ---------- Занятия ----------


class Lesson(Base):
    """Занятие группы: вебинар, видео с теорией, конспект и домашка. Пробник — занятие с kind="mock"."""

    __tablename__ = "lessons"
    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)
    number = Column(Integer, nullable=False)
    topic = Column(String(200), nullable=False)
    kind = Column(String(10), nullable=False, default="lesson", server_default="lesson")
    starts_at = Column(TIMESTAMP, nullable=True)  # дата и время вебинара
    webinar_link = Column(String, nullable=True)
    video_url = Column(String, nullable=True)  # теория: YouTube или VK Видео
    notes_url = Column(String, nullable=True)  # конспект на Яндекс Диске или Google Диске
    homework_text = Column(Text, nullable=True)
    homework_link = Column(String, nullable=True)
    tasks_count = Column(Integer, nullable=True)


class LessonSubmission(Base):
    """Сданная домашка к занятию. Одна на ученика и занятие, пересдача обновляет её."""

    __tablename__ = "lesson_submissions"
    __table_args__ = (UniqueConstraint("lesson_id", "user_id", name="uq_lesson_submission_user"),)
    id = Column(Integer, primary_key=True, index=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    link = Column(String, nullable=True)
    comment = Column(Text, nullable=True)
    status = Column(String, nullable=False, default="submitted", server_default="submitted")
    teacher_comment = Column(Text, nullable=True)
    task_results = Column(JSON, nullable=True)
    submitted_at = Column(TIMESTAMP, server_default=func.now())
    reviewed_at = Column(TIMESTAMP, nullable=True)


class LessonAttendance(Base):
    """Отметка, что ученик был на вебинаре занятия."""

    __tablename__ = "lesson_attendance"
    __table_args__ = (UniqueConstraint("lesson_id", "user_id", name="uq_lesson_attendance_user"),)
    id = Column(Integer, primary_key=True, index=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)


# ---------- Группы, заказы и пропуска ----------


class GroupMember(Base):
    """Ученик в группе: выбрал сам или назначил куратор. Само по себе доступа к занятиям не даёт."""

    __tablename__ = "group_members"
    __table_args__ = (UniqueConstraint("user_id", "course_id", name="uq_group_member"),)
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="active", server_default="active")  # active / removed
    added_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())


class Order(Base):
    """Заказ: месяц группы или отдельные занятия. Сумму считает сервер."""

    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    kind = Column(String(10), nullable=False)  # month / lessons
    period = Column(String(7), nullable=True)  # для месяца: "2026-10"
    lesson_ids = Column(JSON, nullable=True)  # для отдельных занятий: [12, 15]
    amount = Column(Integer, nullable=False)
    status = Column(String(20), nullable=False, default="pending", server_default="pending")  # pending / paid / cancelled
    method = Column(String(20), nullable=True)  # transfer / online
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    paid_at = Column(TIMESTAMP, nullable=True)


class MonthPass(Base):
    """Оплаченный месяц группы: доступ ко всем её занятиям в этом месяце, включая пробники."""

    __tablename__ = "month_passes"
    __table_args__ = (UniqueConstraint("user_id", "course_id", "period", name="uq_month_pass"),)
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)
    period = Column(String(7), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)


class LessonPass(Base):
    """Оплаченное отдельное занятие."""

    __tablename__ = "lesson_passes"
    __table_args__ = (UniqueConstraint("user_id", "lesson_id", name="uq_lesson_pass"),)
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id"), nullable=False, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
