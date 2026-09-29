"use client";

// Блок преподавателя под домашкой: работы учеников и кнопки "Принять" / "На доработку".

import { useState } from "react";
import StatusBadge from "@/components/StatusBadge";
import TaskMarks from "@/components/TaskMarks";
import { api, ApiError, type Submission, type SubmissionForTeacher, type TaskResult } from "@/lib/api";
import { fullName } from "@/lib/names";

type Props = {
  courseId: string;
  tasksCount: number | null;
  submissions: SubmissionForTeacher[];
  onReviewed: (submission: Submission) => void;
};

function ReviewItem({
  courseId,
  tasksCount,
  submission,
  onReviewed,
}: {
  courseId: string;
  tasksCount: number | null;
  submission: SubmissionForTeacher;
  onReviewed: (submission: Submission) => void;
}) {
  const [comment, setComment] = useState(submission.teacher_comment ?? "");
  const [marks, setMarks] = useState<TaskResult[] | null>(submission.task_results);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function review(status: "accepted" | "returned") {
    setError("");
    setSaving(true);
    try {
      const saved = await api<Submission>(
        `/teacher/courses/${courseId}/submissions/${submission.id}/review`,
        {
          method: "POST",
          body: JSON.stringify({
            status,
            teacher_comment: comment.trim() || null,
            // Отметки отправляем, только если в домашке указано количество задач
            task_results: tasksCount
              ? Array.from({ length: tasksCount }, (_, i) => marks?.[i] ?? null)
              : null,
          }),
        },
      );
      onReviewed(saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось сохранить.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="rounded-2xl border-2 border-ink bg-paper p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-semibold">
          {fullName(submission.student_first_name, submission.student_last_name, submission.student_email)}
        </span>
        <StatusBadge status={submission.status} />
      </div>
      {submission.link && (
        <a
          href={submission.link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-link mt-3 inline-block"
        >
          Открыть решение
        </a>
      )}
      {submission.comment && (
        <p className="mt-2 whitespace-pre-line text-muted">{submission.comment}</p>
      )}

      {tasksCount && (
        <div className="mt-4">
          <p className="mb-2 font-semibold">Задачи</p>
          <TaskMarks count={tasksCount} results={marks} onChange={setMarks} />
        </div>
      )}

      <label className="field mt-4">
        <span>Комментарий ученику</span>
        <textarea
          rows={2}
          maxLength={2000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="form-error mt-3">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          className="btn btn-sm bg-mint"
          disabled={saving}
          onClick={() => review("accepted")}
        >
          Принять
        </button>
        <button
          type="button"
          className="btn btn-sm bg-peach"
          disabled={saving}
          onClick={() => review("returned")}
        >
          На доработку
        </button>
      </div>
    </li>
  );
}

export default function ReviewSubmissions({ courseId, tasksCount, submissions, onReviewed }: Props) {
  if (submissions.length === 0) {
    return <p className="mt-5 text-muted">Пока никто не сдал.</p>;
  }
  return (
    <div className="mt-6 border-t-2 border-dashed border-ink/30 pt-5">
      <p className="font-semibold">Работы учеников: {submissions.length}</p>
      <ul className="mt-4 grid gap-4">
        {submissions.map((submission) => (
          <ReviewItem
            key={submission.id}
            courseId={courseId}
            tasksCount={tasksCount}
            submission={submission}
            onReviewed={onReviewed}
          />
        ))}
      </ul>
    </div>
  );
}
