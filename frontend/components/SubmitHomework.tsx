"use client";

// Блок ученика под домашкой: статус работы, отметки по задачам, комментарий преподавателя и форма сдачи.
// Процент активности ученику не показывается: он только для преподавателя.

import { useState } from "react";
import StatusBadge from "@/components/StatusBadge";
import TaskMarks from "@/components/TaskMarks";
import { api, ApiError, type Submission } from "@/lib/api";

type Props = {
  lessonId: number;
  tasksCount: number | null;
  submission: Submission | undefined;
  onSaved: (submission: Submission) => void;
};

export default function SubmitHomework({ lessonId, tasksCount, submission, onSaved }: Props) {
  const [link, setLink] = useState(submission?.link ?? "");
  const [comment, setComment] = useState(submission?.comment ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const accepted = submission?.status === "accepted";
  const hasMarks = Boolean(tasksCount && submission?.task_results);
  const hasFeedback = Boolean(submission?.teacher_comment) || hasMarks;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const saved = await api<Submission>(`/lessons/${lessonId}/submission`, {
        method: "PUT",
        body: JSON.stringify({ link: link.trim(), comment: comment.trim() || null }),
      });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось отправить.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 border-t-2 border-dashed border-ink/30 pt-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold">Моё решение</span>
        <StatusBadge status={submission?.status ?? "none"} />
      </div>

      {hasFeedback && (
        <div className="mt-4 rounded-2xl border-2 border-ink bg-paper p-5">
          <p className="font-semibold">
            {submission?.status === "submitted" ? "Прошлая проверка" : "Проверка преподавателя"}
          </p>
          {hasMarks && (
            <div className="mt-3">
              <TaskMarks count={tasksCount!} results={submission!.task_results} />
            </div>
          )}
          {submission?.teacher_comment && (
            <p className="mt-3 whitespace-pre-line">{submission.teacher_comment}</p>
          )}
        </div>
      )}

      {!accepted && (
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <label className="field">
            <span>Ссылка на решение</span>
            <input
              type="url"
              required
              placeholder="https://disk.yandex.ru/..."
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
            <span className="field-hint">Яндекс Диск или Google Диск, с открытым доступом по ссылке</span>
          </label>
          <label className="field">
            <span>Комментарий (необязательно)</span>
            <textarea rows={2} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} />
          </label>

          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}

          <button type="submit" className="btn btn-ultra btn-sm self-start" disabled={saving}>
            {saving ? "Отправляем..." : submission ? "Отправить заново" : "Сдать на проверку"}
          </button>
        </form>
      )}
    </div>
  );
}
