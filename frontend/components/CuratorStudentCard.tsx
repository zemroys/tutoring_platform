"use client";

// Карточка ученика для куратора: контакты, подбор, заказы, группы.
// Отмечать оплату и отменять заказы может только админ; куратор видит заказы и распределяет по группам.

import { useState } from "react";
import OrderBadge from "@/components/OrderBadge";
import { api, ApiError, type CuratorCourse, type CuratorStudent, type Order } from "@/lib/api";
import { CATALOG, LEVELS, formatPrice } from "@/lib/courses";
import { fullName } from "@/lib/names";

type Props = {
  student: CuratorStudent;
  courses: CuratorCourse[];
  isAdmin: boolean;
  onChanged: () => void;
};

const subjectName = (id: string | null) => CATALOG.find((s) => s.id === id)?.name ?? id ?? "";

export default function CuratorStudentCard({ student, courses, isAdmin, onChanged }: Props) {
  const [courseId, setCourseId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const memberOf = new Set(student.groups.map((g) => g.id));

  async function run(action: () => Promise<unknown>, fallback: string) {
    setError("");
    setSaving(true);
    try {
      await action();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : fallback);
    } finally {
      setSaving(false);
    }
  }

  function addToGroup() {
    if (!courseId) return;
    run(async () => {
      await api(`/curator/courses/${courseId}/students`, {
        method: "POST",
        body: JSON.stringify({ user_id: student.id }),
      });
      setCourseId("");
    }, "Не удалось добавить.");
  }

  function removeFromGroup(groupId: number, title: string) {
    if (!window.confirm(`Убрать ученика из группы «${title}»? Оплаченные занятия у него останутся.`)) return;
    run(() => api(`/curator/courses/${groupId}/students/${student.id}`, { method: "DELETE" }), "Не удалось убрать.");
  }

  function markPaid(order: Order) {
    if (!window.confirm(`Оплата ${formatPrice(order.amount)} пришла? Ученик сразу получит доступ.`)) return;
    run(
      () => api(`/admin/orders/${order.id}/paid`, { method: "POST", body: JSON.stringify({ method: "transfer" }) }),
      "Не удалось отметить оплату.",
    );
  }

  function cancelOrder(order: Order) {
    const warning =
      order.status === "paid"
        ? "Отменить оплаченный заказ? Доступ к занятиям по нему пропадёт."
        : "Отменить заказ?";
    if (!window.confirm(warning)) return;
    run(() => api(`/admin/orders/${order.id}/cancel`, { method: "POST" }), "Не удалось отменить.");
  }

  return (
    <li className="card flex flex-col gap-5 bg-white p-6">
      <div>
        <p className="text-lg font-bold">{fullName(student.first_name, student.last_name, student.email)}</p>
        {student.first_name && <p className="text-sm break-all text-muted">{student.email}</p>}
        <p className="mt-2">
          {student.telegram ? (
            <a href={`https://t.me/${student.telegram}`} target="_blank" rel="noopener noreferrer" className="text-link">
              @{student.telegram}
            </a>
          ) : (
            <span className="text-muted">Телеграм не указан</span>
          )}
        </p>
      </div>

      <div>
        <p className="text-sm font-semibold">Подбор из опроса</p>
        {student.quiz_items && student.quiz_items.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {student.quiz_items.map((item) => (
              <li
                key={item.subject_id}
                className={`status-badge ${item.level === "advanced" ? "bg-bubble" : "bg-mint"}`}
              >
                {subjectName(item.subject_id)}, {LEVELS[item.level].name.toLowerCase()}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted">Опрос не проходил</p>
        )}
      </div>

      <div>
        <p className="text-sm font-semibold">Заказы</p>
        {student.orders.length === 0 ? (
          <p className="mt-1 text-sm text-muted">Заказов пока нет</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-3">
            {student.orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  <span className="font-semibold">{o.course_title}</span>. {o.description}
                </span>
                <span className="flex flex-wrap items-center gap-3">
                  <span className="font-bold whitespace-nowrap">{formatPrice(o.amount)}</span>
                  <OrderBadge status={o.status} />
                  {isAdmin && o.status === "pending" && (
                    <button type="button" className="btn btn-sm bg-mint" disabled={saving} onClick={() => markPaid(o)}>
                      Оплачено
                    </button>
                  )}
                  {isAdmin && (
                    <button type="button" className="danger-link" disabled={saving} onClick={() => cancelOrder(o)}>
                      Отменить
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="text-sm font-semibold">Группы</p>
        {student.groups.length === 0 ? (
          <p className="mt-1 text-sm text-muted">Пока ни в одной</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {student.groups.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3">
                <span>{g.title}</span>
                <button type="button" onClick={() => removeFromGroup(g.id, g.title)} className="danger-link text-sm">
                  Убрать
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3 border-t-2 border-dashed border-ink/30 pt-5">
        <label className="field min-w-0 flex-1">
          <span className="text-sm">Назначить группу</span>
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">Выбери группу</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id} disabled={memberOf.has(c.id)}>
                {c.title}
                {memberOf.has(c.id) ? ", уже там" : ""}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={addToGroup} className="btn btn-ultra btn-sm" disabled={!courseId || saving}>
          Назначить
        </button>
      </div>
      <p className="-mt-3 text-xs text-muted">
        Назначенная группа появится у ученика в кабинете. Занятия откроются после оплаты.
      </p>

      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </li>
  );
}
