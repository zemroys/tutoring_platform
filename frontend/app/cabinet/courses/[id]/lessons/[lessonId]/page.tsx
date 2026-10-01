"use client";

// Страница занятия: вебинар, видео с теорией, конспект, домашка со сдачей и проверкой.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AttendanceEditor from "@/components/AttendanceEditor";
import CabinetHeader from "@/components/CabinetHeader";
import LessonForm from "@/components/LessonForm";
import ReviewSubmissions from "@/components/ReviewSubmissions";
import SubmitHomework from "@/components/SubmitHomework";
import {
  api,
  ApiError,
  type Course,
  type Lesson,
  type StudentProgress,
  type Submission,
  type SubmissionForTeacher,
  type User,
} from "@/lib/api";
import { formatDateTime, hostOf } from "@/lib/dates";

export default function LessonPage() {
  const router = useRouter();
  const params = useParams<{ id: string; lessonId: string }>();
  const courseId = params.id;
  const lessonId = params.lessonId;

  const [me, setMe] = useState<User | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [isPast, setIsPast] = useState(false);
  const [students, setStudents] = useState<StudentProgress[]>([]);
  const [teacherSubs, setTeacherSubs] = useState<SubmissionForTeacher[]>([]);
  const [mySub, setMySub] = useState<Submission | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [u, c, l] = await Promise.all([
          api<User>("/me"),
          api<Course>(`/courses/${courseId}`),
          api<Lesson>(`/lessons/${lessonId}`),
        ]);
        if (l.course_id !== Number(courseId)) {
          setError("Занятие не найдено.");
          return;
        }
        if (u.role === "admin" || c.teacher_id === u.id) {
          const [st, subs] = await Promise.all([
            api<StudentProgress[]>(`/teacher/courses/${courseId}/students`),
            api<SubmissionForTeacher[]>(`/teacher/courses/${courseId}/submissions`),
          ]);
          setStudents(st);
          setTeacherSubs(subs.filter((s) => s.lesson_id === l.id));
        } else if (u.role === "student") {
          const subs = await api<Submission[]>(`/courses/${courseId}/my-submissions`);
          setMySub(subs.find((s) => s.lesson_id === l.id));
        }
        setMe(u);
        setCourse(c);
        setLesson(l);
        setIsPast(Boolean(l.starts_at && new Date(l.starts_at).getTime() <= Date.now()));
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
        } else {
          setError(err instanceof ApiError ? err.message : "Не удалось загрузить занятие.");
        }
      }
    }
    load();
  }, [courseId, lessonId, router]);

  async function reloadStudents() {
    try {
      setStudents(await api<StudentProgress[]>(`/teacher/courses/${courseId}/students`));
    } catch {
      // не страшно: обновится при следующем открытии
    }
  }

  async function handleDelete() {
    if (!lesson || !window.confirm(`Удалить занятие «${lesson.topic}»?`)) return;
    try {
      await api(`/teacher/courses/${courseId}/lessons/${lesson.id}`, { method: "DELETE" });
      router.push(`/cabinet/courses/${courseId}`);
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : "Не удалось удалить.");
    }
  }

  if (error) {
    return (
      <div className="container-page pb-20">
        <CabinetHeader />
        <div className="card mt-8 bg-sun p-8">
          <p className="text-lg font-bold">{error}</p>
          <div className="mt-6 flex flex-wrap gap-4">
            <Link href={`/cabinet/courses/${courseId}`} className="btn btn-ultra">
              К группе
            </Link>
            {error === "Занятие не куплено" && (
              <Link href={`/cabinet/groups/${courseId}`} className="btn bg-white">
                Купить
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!lesson || !course || !me) {
    return <p className="container-page py-20 text-muted">Загружаем...</p>;
  }

  const canEdit = me.role === "admin" || course.teacher_id === me.id;
  const isStudent = me.role === "student";
  const hasHomework = Boolean(lesson.homework_text || lesson.homework_link);

  return (
    <div className="container-page pb-20">
      <CabinetHeader />

      <main className="mt-8 max-w-4xl">
        <Link href={`/cabinet/courses/${courseId}`} className="text-link">
          {course.title}
        </Link>
        <p className="mt-4 flex flex-wrap items-center gap-3 text-muted">
          <span>Занятие {lesson.number}</span>
          {lesson.kind === "mock" && <span className="status-badge bg-bubble text-ink">Пробник</span>}
        </p>
        <h1 className="mt-1 font-display text-3xl leading-tight md:text-5xl">{lesson.topic}</h1>

        {canEdit && !editing && (
          <div className="mt-5 flex flex-wrap gap-5">
            <button type="button" className="text-link" onClick={() => setEditing(true)}>
              Редактировать
            </button>
            <button type="button" className="danger-link" onClick={handleDelete}>
              Удалить
            </button>
          </div>
        )}
        {canEdit && editing && (
          <div className="mt-6">
            <LessonForm
              courseId={courseId}
              lesson={lesson}
              onCancel={() => setEditing(false)}
              onSaved={(saved) => {
                setLesson(saved);
                setEditing(false);
              }}
            />
          </div>
        )}

        {/* ---------- Вебинар ---------- */}
        <section className="card mt-10 flex flex-col items-start gap-5 bg-ultra p-7 text-white md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold">Вебинар</h2>
            <p className="mt-1 text-xl font-bold first-letter:uppercase">{formatDateTime(lesson.starts_at)}</p>
          </div>
          {lesson.webinar_link ? (
            <a href={lesson.webinar_link} target="_blank" rel="noopener noreferrer" className="btn btn-sun shrink-0">
              Войти на вебинар
            </a>
          ) : (
            <p className="text-white/80">Ссылка появится позже</p>
          )}
        </section>
        {canEdit && isPast && (
          <div className="mt-4">
            <AttendanceEditor courseId={courseId} lessonId={lesson.id} students={students} onSaved={reloadStudents} />
          </div>
        )}

        {/* ---------- Теория ---------- */}
        {(lesson.video_embed_url || lesson.notes_url) && (
          <section className="mt-12">
            <h2 className="font-display text-3xl">Теория</h2>
            {lesson.video_embed_url && (
              <div className="video-frame mt-6">
                <iframe
                  src={lesson.video_embed_url}
                  title={`Видео: ${lesson.topic}`}
                  allow="encrypted-media; fullscreen; picture-in-picture"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            )}
            {lesson.notes_url && (
              <p className="mt-8">
                <a href={lesson.notes_url} target="_blank" rel="noopener noreferrer" className="btn btn-sun btn-sm">
                  Открыть конспект
                </a>{" "}
                <span className="text-sm text-muted">({hostOf(lesson.notes_url)})</span>
              </p>
            )}
          </section>
        )}

        {/* ---------- Домашка ---------- */}
        {hasHomework && (
          <section className="mt-12">
            <h2 className="font-display text-3xl">Домашка</h2>
            <div className="card mt-6 bg-white p-7">
              {lesson.homework_text && <p className="whitespace-pre-line leading-relaxed">{lesson.homework_text}</p>}
              {lesson.homework_link && (
                <p className="mt-4">
                  <a href={lesson.homework_link} target="_blank" rel="noopener noreferrer" className="text-link">
                    Открыть материалы
                  </a>{" "}
                  <span className="text-sm text-muted">({hostOf(lesson.homework_link)})</span>
                </p>
              )}
              {lesson.tasks_count && <p className="mt-3 text-sm text-muted">Задач: {lesson.tasks_count}</p>}

              {canEdit ? (
                <ReviewSubmissions
                  courseId={courseId}
                  tasksCount={lesson.tasks_count}
                  submissions={teacherSubs}
                  onReviewed={(saved) => {
                    setTeacherSubs(teacherSubs.map((s) => (s.id === saved.id ? { ...s, ...saved } : s)));
                    reloadStudents();
                  }}
                />
              ) : (
                isStudent && (
                  <SubmitHomework
                    lessonId={lesson.id}
                    tasksCount={lesson.tasks_count}
                    submission={mySub}
                    onSaved={setMySub}
                  />
                )
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
