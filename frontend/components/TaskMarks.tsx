"use client";

// Отметки по задачам домашки: зелёная "верно", оранжевая "ошибка", белая "не отмечено".
// Ученик их только видит, преподаватель переключает нажатием.

import type { TaskResult } from "@/lib/api";

const LABEL = (r: TaskResult) => (r === true ? "верно" : r === false ? "ошибка" : "не отмечено");
const COLOR = (r: TaskResult) => (r === true ? "bg-mint" : r === false ? "bg-peach" : "bg-white");

// Порядок переключения: не отмечено → верно → ошибка → не отмечено
const NEXT = (r: TaskResult): TaskResult => (r === null ? true : r === true ? false : null);

type Props = {
  count: number;
  results: TaskResult[] | null;
  onChange?: (results: TaskResult[]) => void; // есть только у преподавателя
};

export default function TaskMarks({ count, results, onChange }: Props) {
  const values: TaskResult[] = Array.from({ length: count }, (_, i) => results?.[i] ?? null);

  function toggle(index: number) {
    if (!onChange) return;
    onChange(values.map((v, i) => (i === index ? NEXT(v) : v)));
  }

  return (
    <div>
      <ul className="flex flex-wrap gap-2">
        {values.map((value, index) => (
          <li key={index}>
            {onChange ? (
              <button
                type="button"
                onClick={() => toggle(index)}
                aria-label={`Задача ${index + 1}: ${LABEL(value)}. Нажми, чтобы изменить`}
                className={`task-mark ${COLOR(value)}`}
              >
                {index + 1}
              </button>
            ) : (
              <span
                aria-label={`Задача ${index + 1}: ${LABEL(value)}`}
                className={`task-mark ${COLOR(value)}`}
              >
                {index + 1}
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 flex flex-wrap gap-x-4 text-sm text-muted">
        <span>
          <span className="task-legend bg-mint" aria-hidden="true" /> верно
        </span>
        <span>
          <span className="task-legend bg-peach" aria-hidden="true" /> ошибка
        </span>
        {onChange && <span>нажми на номер, чтобы отметить</span>}
      </p>
    </div>
  );
}
