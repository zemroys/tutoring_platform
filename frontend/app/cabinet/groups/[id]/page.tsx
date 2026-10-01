"use client";

// Покупка в группе: месяц целиком или отдельные занятия.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import CabinetHeader from "@/components/CabinetHeader";
import { api, ApiError, type CatalogCourseDetail, type Order } from "@/lib/api";
import { CATALOG, LEVELS, formatPrice } from "@/lib/courses";
import { formatDateTime, plural } from "@/lib/dates";
import { formatPeriod } from "@/lib/periods";

export default function GroupShopPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [course, setCourse] = useState<CatalogCourseDetail | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setCourse(await api<CatalogCourseDetail>(`/catalog/courses/${params.id}`));
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) router.replace("/login");
        else setError(err instanceof ApiError ? err.message : "Не удалось загрузить группу.");
      }
    }
    load();
  }, [params.id, router]);

  async function buy(body: object) {
    setError("");
    setSaving(true);
    try {
      setOrder(await api<Order>("/orders", { method: "POST", body: JSON.stringify(body) }));
      setSelected([]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось оформить заказ.");
    } finally {
      setSaving(false);
    }
  }

  function toggle(id: number) {
    setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  if (!course) {
    return (
      <div className="container-page pb-20">
        <CabinetHeader />
        {error ? (
          <p role="alert" className="form-error mt-8">
            {error}
          </p>
        ) : (
          <p className="py-12 text-muted">Загружаем...</p>
        )}
      </div>
    );
  }

  const subjectName = CATALOG.find((s) => s.id === course.subject_id)?.name;

  if (order) {
    return (
      <div className="container-page pb-20">
        <CabinetHeader />
        <main className="mt-8 max-w-2xl">
          <div className="card bg-sun p-8">
            <h1 className="font-display text-3xl">Заказ оформлен</h1>
            <p className="mt-4 text-lg">
              {course.title}. {order.description}. К оплате: <b>{formatPrice(order.amount)}</b>
            </p>
            <p className="mt-4">
              Онлайн-оплата скоро появится. Пока оплата переводом: куратор напишет тебе в Телеграм с реквизитами.
              Как только оплата придёт, занятия откроются сами.
            </p>
            <Link href="/cabinet" className="btn btn-ultra mt-6">
              В кабинет
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const selectedTotal = selected.length * course.lesson_price;

  return (
    <div className="container-page pb-20">
      <CabinetHeader />
      <main className="mt-8 max-w-4xl">
        <Link href="/cabinet/groups" className="text-link">
          Все группы
        </Link>
        <h1 className="mt-4 font-display text-4xl leading-tight md:text-5xl">{course.title}</h1>
        <p className="mt-3 text-muted">
          {subjectName}
          {course.level ? `, ${LEVELS[course.level].name.toLowerCase()} уровень` : ""}
          {course.teacher_name ? `. Преподаватель: ${course.teacher_name}` : ""}
        </p>

        {error && (
          <p role="alert" className="form-error mt-6">
            {error}
          </p>
        )}

        {course.months.length === 0 ? (
          <p className="mt-10 text-muted">Расписание на ближайшие месяцы пока не готово.</p>
        ) : (
          course.months.map((month) => {
            const lessons = course.lessons.filter((l) => l.period === month);
            const owned = course.owned_months.includes(month);
            const full = lessons.some((l) => l.seats_left === 0 && !l.has_access);
            return (
              <section key={month} className="mt-12">
                <div className="card flex flex-col items-start gap-4 bg-ultra p-7 text-white md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="font-display text-2xl first-letter:uppercase">{formatPeriod(month)}</h2>
                    <p className="mt-1 text-white/85">
                      Весь месяц: {lessons.length} {plural(lessons.length, ["занятие", "занятия", "занятий"])}
                      {lessons.some((l) => l.kind === "mock") ? ", включая пробники" : ""}
                    </p>
                  </div>
                  {owned ? (
                    <span className="status-badge bg-mint text-ink">Месяц оплачен</span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sun shrink-0"
                      disabled={saving || full}
                      onClick={() => buy({ course_id: course.id, kind: "month", period: month })}
                    >
                      {full ? "Мест нет" : `Купить месяц за ${formatPrice(course.month_price)}`}
                    </button>
                  )}
                </div>

                <ul className="mt-4 grid gap-3">
                  {lessons.map((l) => {
                    const canPick = !l.has_access && l.kind !== "mock" && l.seats_left > 0 && !owned;
                    return (
                      <li key={l.id}>
                        <label className={`lesson-row ${canPick ? "cursor-pointer" : ""}`}>
                          <input
                            type="checkbox"
                            className="size-5 shrink-0 accent-ultra"
                            disabled={!canPick}
                            checked={selected.includes(l.id)}
                            onChange={() => toggle(l.id)}
                            aria-label={`Выбрать занятие ${l.number}`}
                          />
                          <span className="lesson-number" aria-hidden="true">
                            {l.number}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block font-bold">{l.topic}</span>
                            <span className="block text-sm text-muted first-letter:uppercase">
                              {formatDateTime(l.starts_at)}
                            </span>
                          </span>
                          <span className="flex flex-wrap justify-end gap-2">
                            {l.has_access ? (
                              <span className="status-badge bg-mint">Куплено</span>
                            ) : l.kind === "mock" ? (
                              <span className="status-badge bg-bubble">Пробник, только в месяце</span>
                            ) : l.seats_left === 0 ? (
                              <span className="status-badge bg-peach">Мест нет</span>
                            ) : (
                              <span className="status-badge bg-white">Мест: {l.seats_left}</span>
                            )}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })
        )}

        {selected.length > 0 && (
          <div className="sticky bottom-4 mt-10">
            <div className="card flex flex-col items-start gap-4 bg-sun p-6 md:flex-row md:items-center md:justify-between">
              <p className="text-lg">
                Выбрано занятий: <b>{selected.length}</b> × {formatPrice(course.lesson_price)} ={" "}
                <b>{formatPrice(selectedTotal)}</b>
              </p>
              <button
                type="button"
                className="btn btn-ultra shrink-0"
                disabled={saving}
                onClick={() => buy({ course_id: course.id, kind: "lessons", lesson_ids: selected })}
              >
                {saving ? "Оформляем..." : "Купить выбранные"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
