"use client";

// Карточка ученика для куратора: контакты, подбор, оплаты, группы, добавление в группу.
// Отмечать и отменять оплаты может только админ; куратор их видит.

import { useState } from "react";
import AdminPaymentForm from "@/components/AdminPaymentForm";
import { api, ApiError, type CuratorCourse, type CuratorStudent } from "@/lib/api";
import { CATALOG, LEVELS, formatPrice } from "@/lib/courses";
import { fullName } from "@/lib/names";
import { formatPeriod } from "@/lib/periods";

type Props = {
  student: CuratorStudent;
  courses: CuratorCourse[];
  period: string; // текущий месяц, "2026-10"
  isAdmin: boolean;
  onChanged: () => void;
};

const subjectName = (id: string | null) => CATALOG.find((s) => s.id === id)?.name ?? id ?? "";

export default function CuratorStudentCard({ student, courses, period, isAdmin, onChanged }: Props) {
  const [courseId, setCourseId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const memberOf = new Set(student.groups.map((g) => g.id));
  // Предметы, оплаченные за текущий месяц: только в такие группы можно добавить
  const paidNow = new Set(student.payments.filter((p) => p.period === period).map((p) => p.subject_id));
  // Предметы, по которым ученик в группе, но текущий месяц не оплачен
  const unpaidGroups = student.groups.filter((g) => g.subject_id && !paidNow.has(g.subject_id));

  async function enroll() {
    if (!courseId) return;
    setError("");
    setSaving(true);
    try {
      await api(`/curator/courses/${courseId}/students`, {
        method: "POST",
        body: JSON.stringify({ user_id: student.id }),
      });
      setCourseId("");
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось добавить.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(groupId: number, title: string) {
    if (!window.confirm(`Убрать ученика из группы «${title}»? Доступ к курсу пропадёт сразу.`)) return;
    setError("");
    try {
      await api(`/curator/courses/${groupId}/students/${student.id}`, { method: "DELETE" });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось убрать.");
    }
  }

  async function cancelPayment(paymentId: number) {
    if (!window.confirm("Отменить эту оплату? Запись останется в истории как отменённая.")) return;
    setError("");
    try {
      await api(`/admin/payments/${paymentId}`, { method: "DELETE" });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось отменить.");
    }
  }

  return (
    <li className="card flex flex-col gap-5 bg-white p-6">
      <div>
        <p className="text-lg font-bold">{fullName(student.first_name, student.last_name, student.email)}</p>
        {student.first_name && <p className="text-sm break-all text-muted">{student.email}</p>}
        <p className="mt-2">
          {student.telegram ? (
            <a
              href={`https://t.me/${student.telegram}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-link"
            >
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
        <p className="text-sm font-semibold">Оплаты</p>
        {student.payments.length === 0 ? (
          <p className="mt-1 text-sm text-muted">Оплат пока нет</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {student.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="flex flex-wrap items-center gap-2">
                  <span className={`status-badge ${p.period === period ? "bg-mint" : "bg-white"}`}>
                    {formatPeriod(p.period)}
                  </span>
                  {subjectName(p.subject_id)}, {LEVELS[p.level].name.toLowerCase()}, {formatPrice(p.amount)}
                </span>
                {isAdmin && (
                  <button type="button" onClick={() => cancelPayment(p.id)} className="danger-link">
                    Отменить
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {isAdmin &&
          (showPaymentForm ? (
            <div className="mt-3">
              <AdminPaymentForm
                userId={student.id}
                defaultPeriod={period}
                suggestion={student.quiz_items?.find((q) => !paidNow.has(q.subject_id))}
                onSaved={() => {
                  setShowPaymentForm(false);
                  onChanged();
                }}
              />
            </div>
          ) : (
            <button type="button" onClick={() => setShowPaymentForm(true)} className="text-link mt-3 text-sm">
              Отметить оплату
            </button>
          ))}
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
                <button type="button" onClick={() => remove(g.id, g.title)} className="danger-link text-sm">
                  Убрать
                </button>
              </li>
            ))}
          </ul>
        )}
        {unpaidGroups.length > 0 && (
          <p className="mt-3 rounded-2xl border-2 border-ink bg-peach/40 px-4 py-3 text-sm first-letter:uppercase">
            {formatPeriod(period)} не оплачен: {unpaidGroups.map((g) => subjectName(g.subject_id)).join(", ")}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3 border-t-2 border-dashed border-ink/30 pt-5">
        <label className="field min-w-0 flex-1">
          <span className="text-sm">Добавить в группу</span>
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">Выбери группу</option>
            {courses.map((c) => {
              const full = c.students_count >= c.capacity;
              const member = memberOf.has(c.id);
              const unpaid = Boolean(c.subject_id) && !paidNow.has(c.subject_id!);
              const note = member ? ", уже там" : full ? ", мест нет" : unpaid ? ", нет оплаты" : "";
              return (
                <option key={c.id} value={c.id} disabled={full || member || unpaid}>
                  {c.title} ({c.students_count}/{c.capacity}){note}
                </option>
              );
            })}
          </select>
        </label>
        <button type="button" onClick={enroll} className="btn btn-ultra btn-sm" disabled={!courseId || saving}>
          {saving ? "Добавляем..." : "Добавить"}
        </button>
      </div>

      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </li>
  );
}
