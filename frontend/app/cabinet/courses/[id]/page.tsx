"use client";

// Страница группы: ближайшее занятие, ученики (для преподавателя и куратора) и список занятий.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import CabinetHeader from "@/components/CabinetHeader";
import LessonForm from "@/components/LessonForm";
import StatusBadge from "@/components/StatusBadge";
import StudentsProgress from "@/components/StudentsProgress";
import {
  api,
  ApiError,
  type Course,
  type LessonSummary,
  type StudentProgress,
  type Submission,
  type SubmissionForTeacher,
  type User,
} from "@/lib/api";
import { formatDateTime } from "@/lib/dates";

// Ближайшее занятие считаем в момент загрузки, а не при отрисовке
function findUpcoming(lessons: LessonSummary[]): LessonSummary | null {
  const now = Date.now();
  const time = (l: LessonSummary) => new Date(l.starts_at!).getTime();
  return (
    lessons.filter((l) => l.starts_at && time(l) > now).sort((a, b) => time(a) - time(b))[0] ?? null
  );
}

function sortLessons(items: LessonSummary[]): LessonSummary[] {
  return [...items].sort(
    (a, b) => a.number - b.number || (a.starts_at ?? "").localeCompare(b.starts_at ?? ""),
  );
}

export default function CoursePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const courseId = params.id;

  const [me, setMe] = useState<User | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [upcoming, setUpcoming] = useState<LessonSummary | null>(null);
  const [students, setStudents] = useState<StudentProgress[]>([]);
  const [teacherSubs, setTeacherSubs] = useState<SubmissionForTeacher[]>([]);
  const [mySubs, setMySubs] = useState<Submission[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [u, c, l] = await Promise.all([
          api<User>("/me"),
          api<Course>(`/courses/${courseId}`),
          api<LessonSummary[]>(`/courses/${courseId}/lessons`),
        ]);
        if (u.role === "admin" || c.teacher_id === u.id) {
          const [st, subs] = await Promise.all([
            api<StudentProgress[]>(`/teacher/courses/${courseId}/students`),
            api<SubmissionForTeacher[]>(`/teacher/courses/${courseId}/submissions`),
          ]);
          setStudents(st);
          setTeacherSubs(subs);
        } else if (u.role === "curator") {
          setStudents(await api<StudentProgress[]>(`/teacher/courses/${courseId}/students`));
        } else {
          setMySubs(await api<Submission[]>(`/courses/${courseId}/my-submissions`));
        }
        const sorted = sortLessons(l);
        setMe(u);
        setCourse(c);
        setLessons(sorted);
        setUpcoming(findUpcoming(sorted));
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
        } else {
          setError(err instanceof ApiError ? err.message : "Не удалось загрузить группу.");
        }
      }
    }
    load();
  }, [courseId, router]);

  if (error) {
    return (
      <div className="container-page pb-20">
        <CabinetHeader />
        <div className="card mt-8 bg-sun p-8">
          <p className="text-lg font-bold">{error}</p>
          <Link href="/cabinet" className="btn btn-ultra mt-6">
            В кабинет
          </Link>
        </div>
      </div>
    );
  }

  if (!course || !me) {
    return <p className="container-page py-20 text-muted">Загружаем...</p>;
  }

  const canEdit = me.role === "admin" || course.teacher_id === me.id;
  const isCurator = me.role === "curator";
  const isStudent = me.role === "student";
  const nextNumber = lessons.reduce((max, l) => Math.max(max, l.number), 0) + 1;

  return (
    <div className="container-page pb-20">
      <CabinetHeader />

      <main className="mt-8">
        <Link href={isCurator ? "/cabinet/curator" : "/cabinet"} className="text-link">
          {isCurator ? "К панели куратора" : "Все курсы"}
        </Link>
        <h1 className="mt-4 font-display text-4xl leading-tight md:text-5xl">{course.title}</h1>
        {isCurator && (
          <p className="mt-3 text-muted">Режим просмотра: менять занятия может преподаватель группы.</p>
        )}
        {isStudent && (
          <Link href={`/cabinet/groups/${courseId}`} className="btn btn-sun btn-sm mt-5">
            Купить занятия
          </Link>
        )}

        {upcoming && (
          <section className="card mt-10 flex flex-col items-start gap-6 bg-ultra p-8 text-white md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold">Ближайшее занятие</h2>
              <p className="mt-1 text-2xl font-bold first-letter:uppercase">{formatDateTime(upcoming.starts_at)}</p>
              <p className="mt-1 text-white/85">
                {upcoming.number}. {upcoming.topic}
              </p>
            </div>
            <Link href={`/cabinet/courses/${courseId}/lessons/${upcoming.id}`} className="btn btn-sun shrink-0">
              Открыть занятие
            </Link>
          </section>
        )}

        {(canEdit || isCurator) && (
          <section className="mt-14">
            <h2 className="font-display text-3xl">Ученики группы</h2>
            <StudentsProgress students={students} />
          </section>
        )}

        <section className="mt-14">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-display text-3xl">Занятия</h2>
            {canEdit && !showForm && (
              <button type="button" onClick={() => setShowForm(true)} className="btn btn-ultra btn-sm">
                Добавить занятие
              </button>
            )}
          </div>

          {canEdit && showForm && (
            <div className="mt-6">
              <LessonForm
                courseId={courseId}
                nextNumber={nextNumber}
                onCancel={() => setShowForm(false)}
                onSaved={(saved) => {
                  const summary: LessonSummary = {
                    id: saved.id,
                    course_id: saved.course_id,
                    number: saved.number,
                    topic: saved.topic,
                    kind: saved.kind,
                    starts_at: saved.starts_at,
                    has_video: Boolean(saved.video_url),
                    has_notes: Boolean(saved.notes_url),
                    has_homework: Boolean(saved.homework_text || saved.homework_link),
                    has_access: true,
                    seats_left: 6,
                  };
                  const sorted = sortLessons([...lessons, summary]);
                  setLessons(sorted);
                  setUpcoming(findUpcoming(sorted));
                  setShowForm(false);
                }}
              />
            </div>
          )}

          {lessons.length === 0 ? (
            <p className="mt-4 text-muted">Занятий пока нет.</p>
          ) : (
            <ul className="mt-6 grid gap-4">
              {lessons.map((lesson) => {
                const toReview = teacherSubs.filter(
                  (s) => s.lesson_id === lesson.id && s.status === "submitted",
                ).length;
                const mine = mySubs.find((s) => s.lesson_id === lesson.id);
                return (
                  <li key={lesson.id}>
                    <Link
                      href={
                        lesson.has_access
                          ? `/cabinet/courses/${courseId}/lessons/${lesson.id}`
                          : `/cabinet/groups/${courseId}`
                      }
                      className={`lesson-row ${lesson.has_access ? "" : "lesson-locked"}`}
                    >
                      <span className="lesson-number" aria-hidden="true">
                        {lesson.number}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-lg font-bold">
                          <span className="sr-only">Занятие {lesson.number}. </span>
                          {lesson.topic}
                        </span>
                        <span className="block text-sm text-muted first-letter:uppercase">
                          {formatDateTime(lesson.starts_at)}
                        </span>
                      </span>
                      <span className="flex flex-wrap items-center justify-end gap-2">
                        {!lesson.has_access && <span className="status-badge bg-white">🔒 Не куплено</span>}
                        {lesson.kind === "mock" && <span className="status-badge bg-bubble">Пробник</span>}
                        {lesson.has_video && <span className="status-badge bg-white">Видео</span>}
                        {lesson.has_notes && <span className="status-badge bg-white">Конспект</span>}
                        {lesson.has_homework && !isStudent && (
                          <span className="status-badge bg-white">Домашка</span>
                        )}
                        {lesson.has_homework && isStudent && lesson.has_access && (
                          <StatusBadge status={mine?.status ?? "none"} />
                        )}
                        {toReview > 0 && <span className="status-badge bg-sky">На проверке: {toReview}</span>}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
