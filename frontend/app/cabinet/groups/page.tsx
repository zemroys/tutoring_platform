"use client";

// Витрина групп: ученик выбирает группу по предмету.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CabinetHeader from "@/components/CabinetHeader";
import { api, ApiError, type CatalogCourse } from "@/lib/api";
import { CATALOG, LEVELS, formatPrice } from "@/lib/courses";
import type { QuizResult } from "@/lib/quiz";

export default function GroupsPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<CatalogCourse[] | null>(null);
  const [subject, setSubject] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [list, quiz] = await Promise.all([
          api<CatalogCourse[]>("/catalog/courses"),
          api<QuizResult | null>("/me/quiz-result").catch(() => null),
        ]);
        setCourses(list);
        // Если проходил опрос, сразу показываем первый подобранный предмет
        const first = quiz?.items.find((i) => list.some((c) => c.subject_id === i.subject_id));
        if (first) setSubject(first.subject_id);
      } catch (err) {
        router.replace(err instanceof ApiError && err.status === 401 ? "/login" : "/cabinet");
      }
    }
    load();
  }, [router]);

  if (!courses) {
    return <p className="container-page py-20 text-muted">Загружаем...</p>;
  }

  const subjects = CATALOG.filter((s) => courses.some((c) => c.subject_id === s.id));
  const visible = subject ? courses.filter((c) => c.subject_id === subject) : courses;

  return (
    <div className="container-page pb-20">
      <CabinetHeader />
      <main className="mt-8">
        <Link href="/cabinet" className="text-link">
          В кабинет
        </Link>
        <h1 className="mt-4 font-display text-4xl md:text-5xl">Выбор группы</h1>
        <p className="mt-3 max-w-[60ch] text-muted">
          Можно купить месяц целиком (все занятия и пробники) или отдельные занятия. Месяц выгоднее.
        </p>

        <div className="mt-8 flex flex-wrap gap-3" role="group" aria-label="Предмет">
          <button type="button" className="quiz-option py-2" aria-pressed={subject === ""} onClick={() => setSubject("")}>
            Все предметы
          </button>
          {subjects.map((s) => (
            <button
              key={s.id}
              type="button"
              className="quiz-option py-2"
              aria-pressed={subject === s.id}
              onClick={() => setSubject(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <p className="mt-10 text-muted">Групп пока нет.</p>
        ) : (
          <ul className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {visible.map((c) => (
              <li key={c.id}>
                <Link href={`/cabinet/groups/${c.id}`} className="card flex h-full flex-col gap-3 bg-white p-6 transition-transform hover:-translate-y-1">
                  <span className="font-display text-xl leading-tight">{c.title}</span>
                  <span className="text-sm text-muted">
                    {CATALOG.find((s) => s.id === c.subject_id)?.name}
                    {c.level ? `, ${LEVELS[c.level].name.toLowerCase()} уровень` : ""}
                  </span>
                  {c.teacher_name && <span className="text-sm text-muted">Преподаватель: {c.teacher_name}</span>}
                  <span className="mt-auto pt-3">
                    <span className="text-lg font-bold">{formatPrice(c.month_price)}</span>
                    <span className="text-muted"> / месяц</span>
                    <span className="block text-sm text-muted">или {formatPrice(c.lesson_price)} за занятие</span>
                  </span>
                  {c.is_member && <span className="status-badge self-start bg-mint">Твоя группа</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
