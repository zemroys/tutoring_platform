"use client";

// Отметка присутствия на прошедшем вебинаре: галочки напротив учеников группы.

import { useState } from "react";
import { api, ApiError, type StudentProgress } from "@/lib/api";
import { fullName } from "@/lib/names";

type Props = {
  courseId: string;
  lessonId: number;
  students: StudentProgress[];
  onSaved: () => void;
};

export default function AttendanceEditor({ courseId, lessonId, students, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [present, setPresent] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const url = `/teacher/courses/${courseId}/lessons/${lessonId}/attendance`;

  async function handleOpen() {
    setOpen(true);
    setMessage("");
    setLoading(true);
    try {
      const ids = await api<number[]>(url);
      setPresent(new Set(ids));
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Не удалось загрузить отметки.");
    } finally {
      setLoading(false);
    }
  }

  function toggle(id: number) {
    const next = new Set(present);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPresent(next);
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      await api<number[]>(url, {
        method: "PUT",
        body: JSON.stringify({ user_ids: [...present] }),
      });
      setMessage("Сохранено");
      onSaved();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Не удалось сохранить.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={handleOpen} className="text-link">
        Отметить присутствие
      </button>
    );
  }

  return (
    <div className="mt-4 w-full rounded-2xl border-2 border-ink bg-white p-5">
      <p className="font-semibold">Кто был на вебинаре</p>
      {loading ? (
        <p className="mt-3 text-muted">Загружаем...</p>
      ) : students.length === 0 ? (
        <p className="mt-3 text-muted">В группе пока нет учеников.</p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {students.map((student) => (
            <li key={student.id}>
              <label className="flex cursor-pointer items-center gap-3 break-all">
                <input
                  type="checkbox"
                  className="size-5 shrink-0 accent-ultra"
                  checked={present.has(student.id)}
                  onChange={() => toggle(student.id)}
                />
                {fullName(student.first_name, student.last_name, student.email)}
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={handleSave}
          className="btn btn-ultra btn-sm"
          disabled={saving || loading}
        >
          {saving ? "Сохраняем..." : "Сохранить"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-link">
          Свернуть
        </button>
        {message && (
          <span role="status" className="text-muted">
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
