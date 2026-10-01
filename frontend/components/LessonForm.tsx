"use client";

// Форма занятия для преподавателя: создать новое или изменить существующее.

import { useState } from "react";
import { api, ApiError, type Lesson, type LessonKind } from "@/lib/api";
import { toDateTimeInput } from "@/lib/dates";

type Props = {
  courseId: string;
  lesson?: Lesson; // если передано, форма редактирует это занятие
  nextNumber?: number; // номер по умолчанию для нового занятия
  onSaved: (lesson: Lesson) => void;
  onCancel?: () => void;
};

export default function LessonForm({ courseId, lesson, nextNumber = 1, onSaved, onCancel }: Props) {
  const [number, setNumber] = useState(String(lesson?.number ?? nextNumber));
  const [topic, setTopic] = useState(lesson?.topic ?? "");
  const [kind, setKind] = useState<LessonKind>(lesson?.kind ?? "lesson");
  const [startsAt, setStartsAt] = useState(toDateTimeInput(lesson?.starts_at ?? null));
  const [webinarLink, setWebinarLink] = useState(lesson?.webinar_link ?? "");
  const [videoUrl, setVideoUrl] = useState(lesson?.video_url ?? "");
  const [notesUrl, setNotesUrl] = useState(lesson?.notes_url ?? "");
  const [homeworkText, setHomeworkText] = useState(lesson?.homework_text ?? "");
  const [homeworkLink, setHomeworkLink] = useState(lesson?.homework_link ?? "");
  const [tasksCount, setTasksCount] = useState(lesson?.tasks_count ? String(lesson.tasks_count) : "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    // Пустые поля отправляем как null: так при правке их можно очистить
    const body = {
      number: Number(number),
      topic,
      kind,
      starts_at: startsAt || null,
      webinar_link: webinarLink.trim() || null,
      video_url: videoUrl.trim() || null,
      notes_url: notesUrl.trim() || null,
      homework_text: homeworkText.trim() || null,
      homework_link: homeworkLink.trim() || null,
      tasks_count: tasksCount ? Number(tasksCount) : null,
    };
    try {
      const saved = lesson
        ? await api<Lesson>(`/teacher/courses/${courseId}/lessons/${lesson.id}`, {
            method: "PATCH",
            body: JSON.stringify(body),
          })
        : await api<Lesson>(`/teacher/courses/${courseId}/lessons`, {
            method: "POST",
            body: JSON.stringify(body),
          });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось сохранить.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card flex flex-col gap-5 bg-white p-7">
      <h3 className="text-lg font-bold">{lesson ? "Изменить занятие" : "Новое занятие"}</h3>

      <div className="grid gap-5 sm:grid-cols-[7rem_1fr_12rem]">
        <label className="field">
          <span>Номер</span>
          <input type="number" min={1} max={500} required value={number} onChange={(e) => setNumber(e.target.value)} />
        </label>
        <label className="field">
          <span>Тема</span>
          <input type="text" required maxLength={200} value={topic} onChange={(e) => setTopic(e.target.value)} />
        </label>
        <label className="field">
          <span>Тип</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as LessonKind)}>
            <option value="lesson">Занятие</option>
            <option value="mock">Пробник</option>
          </select>
        </label>
      </div>

      <fieldset className="grid gap-5 sm:grid-cols-[16rem_1fr]">
        <legend className="mb-3 font-bold">Вебинар</legend>
        <label className="field">
          <span>Дата и время</span>
          <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </label>
        <label className="field">
          <span>Ссылка</span>
          <input
            type="url"
            placeholder="https://telemost.yandex.ru/j/..."
            value={webinarLink}
            onChange={(e) => setWebinarLink(e.target.value)}
          />
          <span className="field-hint">Яндекс Телемост или Microsoft Teams</span>
        </label>
      </fieldset>

      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-3 font-bold">Теория</legend>
        <label className="field">
          <span>Видео</span>
          <input
            type="url"
            placeholder="https://youtu.be/... или ссылка VK Видео"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
          />
          <span className="field-hint">
            YouTube или VK Видео. Для закрытого VK-видео: «Поделиться» → «Экспортировать», ссылка из кода
          </span>
        </label>
        <label className="field">
          <span>Конспект</span>
          <input
            type="url"
            placeholder="https://disk.yandex.ru/..."
            value={notesUrl}
            onChange={(e) => setNotesUrl(e.target.value)}
          />
          <span className="field-hint">Яндекс Диск или Google Диск</span>
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="mb-3 font-bold">Домашка (необязательно)</legend>
        <label className="field">
          <span>Задание</span>
          <textarea rows={4} maxLength={5000} value={homeworkText} onChange={(e) => setHomeworkText(e.target.value)} />
        </label>
        <div className="grid gap-5 sm:grid-cols-[1fr_12rem]">
          <label className="field">
            <span>Материалы к домашке</span>
            <input
              type="url"
              placeholder="https://disk.yandex.ru/..."
              value={homeworkLink}
              onChange={(e) => setHomeworkLink(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Сколько задач</span>
            <input
              type="number"
              min={1}
              max={50}
              placeholder="необязательно"
              value={tasksCount}
              onChange={(e) => setTasksCount(e.target.value)}
            />
          </label>
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-5">
        <button type="submit" className="btn btn-ultra" disabled={saving}>
          {saving ? "Сохраняем..." : lesson ? "Сохранить" : "Добавить занятие"}
        </button>
        {onCancel && (
          <button type="button" className="text-link" onClick={onCancel}>
            Отмена
          </button>
        )}
      </div>
    </form>
  );
}
