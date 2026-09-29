"use client";

// Форма преподавателя: добавить вебинар в расписание группы.

import { useState } from "react";
import { api, ApiError, type ScheduleItem } from "@/lib/api";

type Props = {
  courseId: string;
  onAdded: (item: ScheduleItem) => void;
};

export default function AddScheduleForm({ courseId, onAdded }: Props) {
  const [week, setWeek] = useState("1");
  const [date, setDate] = useState("");
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const item = await api<ScheduleItem>(`/teacher/courses/${courseId}/schedule`, {
        method: "POST",
        body: JSON.stringify({
          week_number: Number(week),
          webinar_link: link.trim(),
          stream_date: date || null,
        }),
      });
      onAdded(item);
      setLink("");
      setDate("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось сохранить.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card mt-6 flex flex-col gap-5 bg-white p-7">
      <h3 className="text-lg font-bold">Добавить вебинар</h3>
      <div className="grid gap-5 md:grid-cols-[8rem_1fr]">
        <label className="field">
          <span>Неделя</span>
          <input
            type="number"
            min={1}
            max={60}
            required
            value={week}
            onChange={(e) => setWeek(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Дата и время</span>
          <input type="datetime-local" required value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>Ссылка на вебинар</span>
        <input
          type="url"
          required
          placeholder="https://telemost.yandex.ru/j/..."
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />
      </label>

      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}

      <button type="submit" className="btn btn-ultra self-start" disabled={saving}>
        {saving ? "Сохраняем..." : "Добавить вебинар"}
      </button>
    </form>
  );
}
