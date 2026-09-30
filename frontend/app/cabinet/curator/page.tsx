"use client";

// Панель куратора: заполненность групп и все ученики с контактами и подбором из опроса.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CabinetHeader from "@/components/CabinetHeader";
import CuratorStudentCard from "@/components/CuratorStudentCard";
import { api, ApiError, type CuratorCourse, type CuratorStudent, type User } from "@/lib/api";
import { CATALOG, LEVELS } from "@/lib/courses";
import { fullName } from "@/lib/names";
import { currentPeriod, formatPeriod } from "@/lib/periods";

function fetchCuratorData() {
  return Promise.all([
    api<CuratorStudent[]>("/curator/students"),
    api<CuratorCourse[]>("/curator/courses"),
  ]);
}

const subjectName = (id: string | null) => CATALOG.find((s) => s.id === id)?.name;

export default function CuratorPage() {
  const router = useRouter();
  const [students, setStudents] = useState<CuratorStudent[] | null>(null);
  const [courses, setCourses] = useState<CuratorCourse[]>([]);
  const [search, setSearch] = useState("");
  const [onlyWithoutGroup, setOnlyWithoutGroup] = useState(false);
  const [me, setMe] = useState<User | null>(null);
  const [period, setPeriod] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [[s, c], u] = await Promise.all([fetchCuratorData(), api<User>("/me")]);
        setStudents(s);
        setCourses(c);
        setMe(u);
        setPeriod(currentPeriod());
      } catch (err) {
        // Не вошёл — на вход, вошёл без прав куратора — в обычный кабинет
        router.replace(err instanceof ApiError && err.status === 401 ? "/login" : "/cabinet");
      }
    }
    load();
  }, [router]);

  // После добавления или удаления ученика обновляем и учеников, и заполненность групп
  async function reload() {
    try {
      const [s, c] = await fetchCuratorData();
      setStudents(s);
      setCourses(c);
    } catch {
      // не страшно: обновится при следующем открытии страницы
    }
  }

  if (!students) {
    return <p className="container-page py-20 text-muted">Загружаем...</p>;
  }

  const query = search.trim().toLowerCase().replace(/^@/, "");
  const visible = students.filter((s) => {
    if (onlyWithoutGroup && s.groups.length > 0) return false;
    if (!query) return true;
    const haystack = [fullName(s.first_name, s.last_name, s.email), s.email, s.telegram ?? ""]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });

  return (
    <div className="container-page pb-20">
      <CabinetHeader />

      <main className="mt-8">
        <Link href="/cabinet" className="text-link">
          В кабинет
        </Link>
        <h1 className="mt-4 font-display text-4xl md:text-5xl">Панель куратора</h1>
        <p className="mt-3 text-muted">Текущий месяц: {period && formatPeriod(period)}</p>

        <section className="mt-12">
          <h2 className="font-display text-3xl">Группы</h2>
          {courses.length === 0 ? (
            <p className="mt-4 text-muted">Групп пока нет. Их создаёт администратор.</p>
          ) : (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((c) => (
                <li key={c.id} className="rounded-2xl border-2 border-ink bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/cabinet/courses/${c.id}`} className="font-semibold hover:underline">
                      {c.title}
                    </Link>
                    <span
                      className={`status-badge shrink-0 ${c.students_count >= c.capacity ? "bg-peach" : "bg-mint"}`}
                    >
                      {c.students_count}/{c.capacity}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted">
                    {c.subject_id
                      ? `${subjectName(c.subject_id) ?? c.subject_id}, ${c.level ? LEVELS[c.level].name.toLowerCase() : "уровень не указан"}`
                      : "Предмет не указан"}
                  </p>
                  <p className="text-sm text-muted">{c.teacher_name ?? "Преподаватель не назначен"}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-14">
          <h2 className="font-display text-3xl">Ученики</h2>
          <div className="mt-6 flex flex-wrap items-end gap-5">
            <label className="field w-full max-w-sm">
              <span>Поиск</span>
              <input
                type="search"
                placeholder="Имя, email или ник"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <label className="flex cursor-pointer items-center gap-3 pb-3 font-semibold">
              <input
                type="checkbox"
                className="size-5 accent-ultra"
                checked={onlyWithoutGroup}
                onChange={(e) => setOnlyWithoutGroup(e.target.checked)}
              />
              Только без группы
            </label>
          </div>
          <p className="mt-4 text-muted">
            Показано: {visible.length} из {students.length}
          </p>

          <ul className="mt-6 grid gap-6 lg:grid-cols-2">
            {visible.map((student) => (
              <CuratorStudentCard
                key={student.id}
                student={student}
                courses={courses}
                period={period}
                isAdmin={me?.role === "admin"}
                onChanged={reload}
              />
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
