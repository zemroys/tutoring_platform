"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CabinetHeader from "@/components/CabinetHeader";
import { api, type Course, type User } from "@/lib/api";
import { CATALOG, LEVELS, formatPrice } from "@/lib/courses";
import { syncPendingQuizResult, type QuizResult } from "@/lib/quiz";
import { fullName } from "@/lib/names";
import { SITE } from "@/lib/site";

const ROLE_NAMES: Record<User["role"], string> = {
  student: "ученик",
  teacher: "преподаватель",
  curator: "куратор",
  admin: "администратор",
};

export default function CabinetPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [quiz, setQuiz] = useState<QuizResult | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const me = await api<User>("/me");
        // У куратора нет своих групп: ему нужна только кнопка панели
        if (me.role === "curator") {
          setUser(me);
          return;
        }
        // Ученик видит купленные курсы, преподаватель и админ свои группы
        const path = me.role === "student" ? "/my/courses" : "/teacher/courses";
        const list = await api<Course[]>(path);
        if (me.role === "student") {
          // Если опрос проходили до регистрации, переносим результат в аккаунт
          await syncPendingQuizResult();
          setQuiz(await api<QuizResult | null>("/me/quiz-result").catch(() => null));
        }
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
  // Блок "Мои группы": у куратора его нет вовсе, у админа только если он сам ведёт группы
  const showCourses =
    user.role !== "curator" && !(user.role === "admin" && courses.length === 0);

  return (
    <div className="container-page pb-20">
      <CabinetHeader />

      <main className="mt-8">
        <h1 className="font-display text-4xl md:text-5xl">Личный кабинет</h1>
        <p className="mt-4 text-lg text-muted">
          {fullName(user.first_name, user.last_name, user.email)}, {ROLE_NAMES[user.role]}
        </p>

        {(user.role === "admin" || user.role === "curator") && (
          <Link href="/cabinet/curator" className="btn btn-sun mt-8">
            Панель куратора
          </Link>
        )}

        {showCourses && (
          <h2 className="mt-12 text-2xl font-bold">{isStudent ? "Мои курсы" : "Мои группы"}</h2>
        )}

        {!showCourses ? null : courses.length === 0 ? (
          <div className="card mt-6 bg-sun p-8">
            {isStudent && quiz ? (
              <>
                <p className="text-lg font-bold">Твой подбор</p>
                <ul className="mt-4 grid gap-3">
                  {quiz.items.map((item) => {
                    const subject = CATALOG.find((s) => s.id === item.subject_id);
                    if (!subject) return null;
                    const price = subject.prices[item.level];
                    return (
                      <li
                        key={item.subject_id}
                        className="flex flex-wrap items-baseline justify-between gap-3 rounded-2xl border-2 border-ink bg-white px-5 py-4"
                      >
                        <span>
                          <span className="font-semibold">{subject.name}</span>
                          <span className="text-muted">, {LEVELS[item.level].name.toLowerCase()} уровень</span>
                        </span>
                        {price !== undefined && (
                          <span className="font-bold whitespace-nowrap">{formatPrice(price)} / мес</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-5">
                  {user.telegram
                    ? "Куратор напишет тебе в Телеграм и подберёт группу по расписанию. "
                    : "Напиши нам в Телеграм, и мы подберём группу по расписанию. "}
                  После оплаты курсы появятся здесь.
                </p>
                {!user.telegram && (
                  <a href={SITE.contacts.telegram} className="text-link mt-2 inline-block">
                    Написать в Телеграм
                  </a>
                )}
                <Link href="/quiz" className="text-link mt-4 inline-block">
                  Изменить подбор
                </Link>
              </>
            ) : isStudent ? (
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
