"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AddHomeworkForm from "@/components/AddHomeworkForm";
import AddScheduleForm from "@/components/AddScheduleForm";
import AttendanceEditor from "@/components/AttendanceEditor";
import CabinetHeader from "@/components/CabinetHeader";
import ReviewSubmissions from "@/components/ReviewSubmissions";
import StudentsProgress from "@/components/StudentsProgress";
import SubmitHomework from "@/components/SubmitHomework";
import {
  api,
  ApiError,
  type Course,
  type Homework,
  type ScheduleItem,
  type StudentProgress,
  type Submission,
  type SubmissionForTeacher,
  type User,
} from "@/lib/api";

// Дата хранится без часового пояса и показывается как есть: время, которое указал преподаватель
function formatDate(value: string | null): string {
  if (!value) return "время уточняется";
  return new Date(value).toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Показываем ученику, на какой сайт ведёт ссылка, прежде чем он по ней нажмёт
function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function sortSchedule(items: ScheduleItem[]): ScheduleItem[] {
  return [...items].sort(
    (a, b) =>
      a.week_number - b.week_number ||
      (a.stream_date ?? "").localeCompare(b.stream_date ?? ""),
  );
}

function sortHomework(items: Homework[]): Homework[] {
  return [...items].sort((a, b) => a.week_number - b.week_number || a.id - b.id);
}

// Ближайший вебинар и список уже прошедших считаются в момент загрузки, а не при отрисовке
function splitByTime(schedule: ScheduleItem[]) {
  const now = Date.now();
  const time = (item: ScheduleItem) => new Date(item.stream_date!).getTime();
  const dated = schedule.filter((item) => item.stream_date);
  const upcoming = dated.filter((item) => time(item) > now).sort((a, b) => time(a) - time(b))[0] ?? null;
  const pastIds = new Set(dated.filter((item) => time(item) <= now).map((item) => item.id));
  return { upcoming, pastIds };
}

export default function CoursePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const courseId = params.id;

  const [me, setMe] = useState<User | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [upcoming, setUpcoming] = useState<ScheduleItem | null>(null);
  const [pastIds, setPastIds] = useState<Set<number>>(new Set());
  const [students, setStudents] = useState<StudentProgress[]>([]);
  const [teacherSubs, setTeacherSubs] = useState<SubmissionForTeacher[]>([]);
  const [mySubs, setMySubs] = useState<Submission[]>([]);
  const [error, setError] = useState("");

  // Обновить активность учеников (после проверки работы или отметки присутствия)
  const reloadStudents = useCallback(async () => {
    try {
      setStudents(await api<StudentProgress[]>(`/teacher/courses/${courseId}/students`));
    } catch {
      // не страшно: цифры обновятся при следующем открытии страницы
    }
  }, [courseId]);

  useEffect(() => {
    async function load() {
      try {
        const [u, c, s, h] = await Promise.all([
          api<User>("/me"),
          api<Course>(`/courses/${courseId}`),
          api<ScheduleItem[]>(`/courses/${courseId}/schedule`),
          api<Homework[]>(`/courses/${courseId}/homework`),
        ]);

        if (u.role === "admin" || c.teacher_id === u.id) {
          // Преподавателю: ученики с активностью и все работы группы
          const [st, subs] = await Promise.all([
            api<StudentProgress[]>(`/teacher/courses/${courseId}/students`),
            api<SubmissionForTeacher[]>(`/teacher/courses/${courseId}/submissions`),
          ]);
          setStudents(st);
          setTeacherSubs(subs);
        } else {
          // Ученику: только его собственные работы
          setMySubs(await api<Submission[]>(`/courses/${courseId}/my-submissions`));
        }

        const { upcoming: next, pastIds: past } = splitByTime(s);
        setMe(u);
        setCourse(c);
        setSchedule(s);
        setHomework(h);
        setUpcoming(next);
        setPastIds(past);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
        } else {
          setError(err instanceof ApiError ? err.message : "Не удалось загрузить курс.");
        }
      }
    }
    load();
  }, [courseId, router]);

  function updateSchedule(items: ScheduleItem[]) {
    const sorted = sortSchedule(items);
    const { upcoming: next, pastIds: past } = splitByTime(sorted);
    setSchedule(sorted);
    setUpcoming(next);
    setPastIds(past);
  }

  async function deleteScheduleItem(item: ScheduleItem) {
    if (!window.confirm(`Удалить вебинар недели ${item.week_number}?`)) return;
    try {
      await api(`/teacher/courses/${courseId}/schedule/${item.id}`, { method: "DELETE" });
      updateSchedule(schedule.filter((s) => s.id !== item.id));
      reloadStudents();
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : "Не удалось удалить.");
    }
  }

  async function deleteHomework(item: Homework) {
    if (!window.confirm(`Удалить домашку недели ${item.week_number}?`)) return;
    try {
      await api(`/teacher/courses/${courseId}/homework/${item.id}`, { method: "DELETE" });
      setHomework(homework.filter((h) => h.id !== item.id));
      reloadStudents();
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : "Не удалось удалить.");
    }
  }

  function handleMySubmission(saved: Submission) {
    setMySubs([...mySubs.filter((s) => s.id !== saved.id), saved]);
  }

  function handleReviewed(saved: Submission) {
    setTeacherSubs(teacherSubs.map((s) => (s.id === saved.id ? { ...s, ...saved } : s)));
    reloadStudents();
  }

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

  // Редактировать может преподаватель этой группы и админ. Сервер проверяет то же самое,
  // здесь это только чтобы не показывать ученику формы, которыми он всё равно не сможет пользоваться.
  const canEdit = me.role === "admin" || course.teacher_id === me.id;

  return (
    <div className="container-page pb-20">
      <CabinetHeader />

      <main className="mt-8">
        <Link href="/cabinet" className="text-link">
          Все курсы
        </Link>
        <h1 className="mt-4 font-display text-4xl leading-tight md:text-5xl">{course.title}</h1>

        {upcoming && (
          <section className="card mt-10 flex flex-col items-start gap-6 bg-ultra p-8 text-white md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold">Ближайший вебинар</h2>
              <p className="mt-1 text-2xl font-bold first-letter:uppercase">
                {formatDate(upcoming.stream_date)}
              </p>
              <p className="mt-1 text-white/80">Неделя {upcoming.week_number}</p>
            </div>
            <a
              href={upcoming.webinar_link}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sun shrink-0"
            >
              Войти на вебинар
            </a>
          </section>
        )}

        {canEdit && (
          <section className="mt-14">
            <h2 className="font-display text-3xl">Ученики группы</h2>
            <StudentsProgress students={students} />
          </section>
        )}

        <section className="mt-14">
          <h2 className="font-display text-3xl">Расписание</h2>
          {schedule.length === 0 ? (
            <p className="mt-4 text-muted">Расписание пока не добавлено.</p>
          ) : (
            <ul className="mt-6 border-t-2 border-ink">
              {schedule.map((item) => (
                <li key={item.id} className="border-b-2 border-ink py-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-bold">Неделя {item.week_number}</p>
                      <p className="text-muted first-letter:uppercase">
                        {formatDate(item.stream_date)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-6">
                      <a
                        href={item.webinar_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-link"
                      >
                        Ссылка на вебинар
                      </a>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => deleteScheduleItem(item)}
                          className="danger-link"
                        >
                          Удалить
                        </button>
                      )}
                    </div>
                  </div>
                  {canEdit && pastIds.has(item.id) && (
                    <div className="mt-3">
                      <AttendanceEditor
                        courseId={courseId}
                        scheduleId={item.id}
                        students={students}
                        onSaved={reloadStudents}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canEdit && (
            <AddScheduleForm
              courseId={courseId}
              onAdded={(item) => updateSchedule([...schedule, item])}
            />
          )}
        </section>

        <section className="mt-14">
          <h2 className="font-display text-3xl">Домашние задания</h2>
          {homework.length === 0 ? (
            <p className="mt-4 text-muted">Домашек пока нет.</p>
          ) : (
            <ul className="mt-6 grid gap-6">
              {homework.map((item) => (
                <li key={item.id} className="card bg-white p-7">
                  <div className="flex items-start justify-between gap-6">
                    <p className="font-bold">Неделя {item.week_number}</p>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => deleteHomework(item)}
                        className="danger-link"
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                  <p className="mt-3 whitespace-pre-line leading-relaxed">{item.description}</p>
                  {item.link && (
                    <p className="mt-4">
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-link"
                      >
                        Открыть материалы
                      </a>{" "}
                      <span className="text-sm text-muted">({hostOf(item.link)})</span>
                    </p>
                  )}

                  {canEdit ? (
                    <ReviewSubmissions
                      courseId={courseId}
                      tasksCount={item.tasks_count}
                      submissions={teacherSubs.filter((s) => s.homework_id === item.id)}
                      onReviewed={handleReviewed}
                    />
                  ) : (
                    <SubmitHomework
                      courseId={courseId}
                      homeworkId={item.id}
                      tasksCount={item.tasks_count}
                      submission={mySubs.find((s) => s.homework_id === item.id)}
                      onSaved={handleMySubmission}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
          {canEdit && (
            <AddHomeworkForm
              courseId={courseId}
              onAdded={(item) => {
                setHomework(sortHomework([...homework, item]));
                reloadStudents();
              }}
            />
          )}
        </section>
      </main>
    </div>
  );
}
