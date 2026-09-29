"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CabinetHeader from "@/components/CabinetHeader";
import { api, type Course, type User } from "@/lib/api";
import { fullName } from "@/lib/names";

const ROLE_NAMES: Record<User["role"], string> = {
  student: "ученик",
  teacher: "преподаватель",
  admin: "администратор",
};

export default function CabinetPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const me = await api<User>("/me");
        // Ученик видит купленные курсы, преподаватель и админ свои группы
        const path = me.role === "student" ? "/my/courses" : "/teacher/courses";
        const list = await api<Course[]>(path);
        setUser(me);
        setCourses(list);
      } catch {
        router.replace("/login");
      }
    }
    load();
  }, [router]);

  if (!user) {
    return <p className="container-page py-20 text-muted">Загружаем...</p>;
  }

  const isStudent = user.role === "student";

  return (
    <div className="container-page pb-20">
      <CabinetHeader />

      <main className="mt-8">
        <h1 className="font-display text-4xl md:text-5xl">Личный кабинет</h1>
        <p className="mt-4 text-lg text-muted">
          {fullName(user.first_name, user.last_name, user.email)}, {ROLE_NAMES[user.role]}
        </p>

        <h2 className="mt-12 text-2xl font-bold">{isStudent ? "Мои курсы" : "Мои группы"}</h2>

        {courses.length === 0 ? (
          <div className="card mt-6 bg-sun p-8">
            {isStudent ? (
              <>
                <p className="text-lg font-bold">У тебя пока нет курсов</p>
                <p className="mt-2">Пройди опрос, и мы подберём курс под твой предмет и уровень.</p>
                <Link href="/quiz" className="btn btn-ultra mt-6">
                  Подобрать курс
                </Link>
              </>
            ) : (
              <p className="text-lg">За тобой пока не закреплено ни одной группы.</p>
            )}
          </div>
        ) : (
          <ul className="mt-6 grid gap-6 md:grid-cols-2">
            {courses.map((course) => (
              <li key={course.id}>
                <Link
                  href={`/cabinet/courses/${course.id}`}
                  className="card block h-full bg-white p-7 transition-transform hover:-translate-y-1"
                >
                  <h3 className="font-display text-2xl leading-tight">{course.title}</h3>
                  {course.description && (
                    <p className="mt-3 text-muted">{course.description}</p>
                  )}
                  <p className="mt-5 font-semibold text-ultra">Открыть курс</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
