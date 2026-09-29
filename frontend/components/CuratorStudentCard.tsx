"use client";

// Карточка ученика для куратора: контакты, подбор из опросника, группы, добавление в группу.

import { useState } from "react";
import { api, ApiError, type CuratorCourse, type CuratorStudent } from "@/lib/api";
import { CATALOG, LEVELS } from "@/lib/courses";
import { fullName } from "@/lib/names";

type Props = {
  student: CuratorStudent;
  courses: CuratorCourse[];
  onChanged: () => void;
};

export default function CuratorStudentCard({ student, courses, onChanged }: Props) {
  const [courseId, setCourseId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const memberOf = new Set(student.groups.map((g) => g.id));

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
            {student.quiz_items.map((item) => {
              const subject = CATALOG.find((s) => s.id === item.subject_id);
              return (
                <li
                  key={item.subject_id}
                  className={`status-badge ${item.level === "advanced" ? "bg-bubble" : "bg-mint"}`}
                >
                  {subject?.name ?? item.subject_id}, {LEVELS[item.level].name.toLowerCase()}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted">Опрос не проходил</p>
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
                <button type="button" onClick={() => remove(g.id, g.title)} className="danger-link text-sm">
                  Убрать
                </button>
              </li>
            ))}
          </ul>
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
              return (
                <option key={c.id} value={c.id} disabled={full || member}>
                  {c.title} ({c.students_count}/{c.capacity}){member ? ", уже там" : full ? ", мест нет" : ""}
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
