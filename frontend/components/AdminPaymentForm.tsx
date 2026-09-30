"use client";

// Форма админа: отметить, что ученик оплатил предмет за месяц (оплата переводом).

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { CATALOG, LEVELS, type LevelId } from "@/lib/courses";

type Props = {
  userId: number;
  defaultPeriod: string;
  // Подсказка из опроса: какой предмет и уровень ученику подобрали
  suggestion?: { subject_id: string; level: LevelId };
  onSaved: () => void;
};

export default function AdminPaymentForm({ userId, defaultPeriod, suggestion, onSaved }: Props) {
  const firstSubject = suggestion?.subject_id ?? CATALOG[0].id;
  const [subjectId, setSubjectId] = useState(firstSubject);
  const [level, setLevel] = useState<LevelId>(suggestion?.level ?? "base");
  const [period, setPeriod] = useState(defaultPeriod);
  const [amount, setAmount] = useState(
    String(CATALOG.find((s) => s.id === firstSubject)?.prices[suggestion?.level ?? "base"] ?? ""),
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const subject = CATALOG.find((s) => s.id === subjectId);
  const levels = (Object.keys(subject?.prices ?? {}) as LevelId[]).filter((l) => l in LEVELS);

  // При смене предмета или уровня подставляем цену из каталога
  function choose(nextSubject: string, nextLevel: LevelId) {
    const s = CATALOG.find((x) => x.id === nextSubject);
    const allowed = Object.keys(s?.prices ?? {}) as LevelId[];
    const lvl = allowed.includes(nextLevel) ? nextLevel : allowed[0];
    setSubjectId(nextSubject);
    setLevel(lvl);
    setAmount(String(s?.prices[lvl] ?? ""));
  }

  async function save() {
    setError("");
    setSaving(true);
    try {
      await api("/admin/payments", {
        method: "POST",
        body: JSON.stringify({ user_id: userId, subject_id: subjectId, level, period, amount: Number(amount) }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось сохранить.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-ink/40 p-4">
      <p className="text-sm font-semibold">Отметить оплату (видно только админу)</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="field">
          <span className="text-sm">Предмет</span>
          <select value={subjectId} onChange={(e) => choose(e.target.value, level)}>
            {CATALOG.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="text-sm">Уровень</span>
          <select value={level} onChange={(e) => choose(subjectId, e.target.value as LevelId)}>
            {levels.map((l) => (
              <option key={l} value={l}>
                {LEVELS[l].name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="text-sm">Месяц</span>
          {/* Safari на Mac показывает это поле как текстовое, поэтому подсказываем формат */}
          <input
            type="month"
            required
            pattern="\d{4}-\d{2}"
            placeholder="2026-10"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="text-sm">Сумма, ₽</span>
          <input
            type="number"
            min={0}
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="form-error mt-3">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={save}
        className="btn btn-sun btn-sm mt-3"
        disabled={saving || !period || amount === ""}
      >
        {saving ? "Сохраняем..." : "Оплачено"}
      </button>
    </div>
  );
}
