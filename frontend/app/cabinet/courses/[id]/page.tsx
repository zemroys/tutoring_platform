"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import CabinetHeader from "@/components/CabinetHeader";
import { api, ApiError, type Course, type Homework, type ScheduleItem } from "@/lib/api";

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

// Ближайший вебинар: первый, у которого дата ещё не прошла
function findUpcoming(schedule: ScheduleItem[]): ScheduleItem | null {
  const now = Date.now();
  const future = schedule
    .filter((item) => item.stream_date && new Date(item.stream_date).getTime() > now)
    .sort((a, b) => new Date(a.stream_date!).getTime() - new Date(b.stream_date!).getTime());
  return future[0] ?? null;
}

export default function CoursePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [upcoming, setUpcoming] = useState<ScheduleItem | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        // Три запроса разом, а не по очереди: так страница открывается быстрее
        const [c, s, h] = await Promise.all([
          api<Course>(`/courses/${params.id}`),
          api<ScheduleItem[]>(`/courses/${params.id}/schedule`),
          api<Homework[]>(`/courses/${params.id}/homework`),
        ]);
        setCourse(c);
        setSchedule(s);
        setHomework(h);
        setUpcoming(findUpcoming(s));
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
        } else {
          setError(err instanceof ApiError ? err.message : "Не удалось загрузить курс.");
        }
      }
    }
    load();
  }, [params.id, router]);

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

  if (!course) {
    return <p className="container-page py-20 text-muted">Загружаем...</p>;
  }

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

        <section className="mt-14">
          <h2 className="font-display text-3xl">Расписание</h2>
          {schedule.length === 0 ? (
            <p className="mt-4 text-muted">Расписание пока не добавлено.</p>
          ) : (
            <ul className="mt-6 border-t-2 border-ink">
              {schedule.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-3 border-b-2 border-ink py-5 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-bold">Неделя {item.week_number}</p>
                    <p className="text-muted first-letter:uppercase">{formatDate(item.stream_date)}</p>
                  </div>
                  <a
                    href={item.webinar_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-link"
                  >
                    Ссылка на вебинар
                  </a>
                </li>
              ))}
            </ul>
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
                  <p className="font-bold">Неделя {item.week_number}</p>
                  <p className="mt-3 whitespace-pre-line leading-relaxed">{item.description}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
