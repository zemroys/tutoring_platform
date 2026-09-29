"use client";

// Форма преподавателя: добавить домашнее задание в группу.

import { useState } from "react";
import { api, ApiError, type Homework } from "@/lib/api";

type Props = {
  courseId: string;
  onAdded: (item: Homework) => void;
};

export default function AddHomeworkForm({ courseId, onAdded }: Props) {
  const [week, setWeek] = useState("1");
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const item = await api<Homework>(`/teacher/courses/${courseId}/homework`, {
        method: "POST",
        body: JSON.stringify({
          week_number: Number(week),
          description: description.trim(),
          link: link.trim() || null,
        }),
      });
      onAdded(item);
      setDescription("");
      setLink("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось сохранить.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card mt-6 flex flex-col gap-5 bg-white p-7">
      <h3 className="text-lg font-bold">Добавить домашку</h3>
      <label className="field md:max-w-[8rem]">
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
        <span>Задание</span>
        <textarea
          required
          rows={5}
          maxLength={5000}
          placeholder="Например: решить задачи 1–10 из сборника, задачу 7 оформить полностью."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

      <label className="field">
        <span>Ссылка на материалы (необязательно)</span>
        <input
          type="url"
          placeholder="https://disk.yandex.ru/..."
          aria-describedby="material-hint"
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />
        <span id="material-hint" className="field-hint">
          Файл с заданием на Яндекс Диске или Google Диске
        </span>
      </label>

      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}

      <button type="submit" className="btn btn-ultra self-start" disabled={saving}>
        {saving ? "Сохраняем..." : "Добавить домашку"}
      </button>
    </form>
  );
}
