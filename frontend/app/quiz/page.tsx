"use client";

// Опросник: предметы → баллы на пробниках по каждому → цель → рекомендация с ценой.

import { useState } from "react";
import Link from "next/link";
import PageTop from "@/components/PageTop";
import { CATALOG, LEVELS, formatPrice, type CatalogSubject, type LevelId } from "@/lib/courses";
import { SITE } from "@/lib/site";

type Score = "none" | "low" | "mid" | "high";
type Goal = "pass" | "good" | "top";

const SCORE_OPTIONS: { id: Score; label: string }[] = [
  { id: "none", label: "Ещё не писал пробник" },
  { id: "low", label: "До 40 баллов" },
  { id: "mid", label: "40–60 баллов" },
  { id: "high", label: "Больше 60 баллов" },
];

const GOAL_OPTIONS: { id: Goal; label: string }[] = [
  { id: "pass", label: "Сдать уверенно, без погони за баллами" },
  { id: "good", label: "70–80 баллов" },
  { id: "top", label: "85 баллов и выше" },
];

type Step = { kind: "subjects" } | { kind: "score"; subject: CatalogSubject } | { kind: "goal" };

// Предметы, у которых есть выбор уровня (у базовой математики он один)
const hasLevels = (s: CatalogSubject) => Object.keys(s.prices).length > 1;

function pickLevel(subject: CatalogSubject, score: Score | undefined, goal: Goal | null): LevelId {
  if (!hasLevels(subject)) return "base";
  if (score === "high") return "advanced";
  if (score === "mid" && goal === "top") return "advanced";
  return "base";
}

export default function QuizPage() {
  const [selected, setSelected] = useState<string[]>([]);
  const [scores, setScores] = useState<Record<string, Score>>({});
  const [goal, setGoal] = useState<Goal | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [done, setDone] = useState(false);

  const chosen = CATALOG.filter((s) => selected.includes(s.id));
  const steps: Step[] = [
    { kind: "subjects" },
    ...chosen.filter(hasLevels).map((subject) => ({ kind: "score" as const, subject })),
    ...(chosen.some(hasLevels) ? [{ kind: "goal" as const }] : []),
  ];
  const step = steps[stepIndex];

  function toggleSubject(id: string) {
    setSelected(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }

  function next() {
    if (stepIndex + 1 < steps.length) setStepIndex(stepIndex + 1);
    else setDone(true);
  }

  function back() {
    if (done) setDone(false);
    else setStepIndex(Math.max(0, stepIndex - 1));
  }

  function restart() {
    setSelected([]);
    setScores({});
    setGoal(null);
    setStepIndex(0);
    setDone(false);
  }

  const canContinue =
    step.kind === "subjects"
      ? selected.length > 0
      : step.kind === "score"
        ? scores[step.subject.id] !== undefined
        : goal !== null;

  const results = chosen.map((subject) => {
    const level = pickLevel(subject, scores[subject.id], goal);
    return { subject, level, price: subject.prices[level]! };
  });
  const total = results.reduce((sum, r) => sum + r.price, 0);

  return (
    <>
      <PageTop title="Подбор курса" lead="Несколько вопросов, и мы посоветуем группу по каждому предмету." />

      <main className="container-page py-14 md:py-20">
        <div className="mx-auto max-w-2xl">
          {!done ? (
            <div className="card bg-white p-7 md:p-10">
              <p className="text-sm font-semibold text-muted">
                Вопрос {stepIndex + 1} из {steps.length}
              </p>

              {step.kind === "subjects" && (
                <>
                  <h2 className="mt-2 text-2xl font-bold">Какие предметы сдаёшь?</h2>
                  <p className="mt-1 text-muted">Можно выбрать несколько.</p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {CATALOG.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        aria-pressed={selected.includes(s.id)}
                        onClick={() => toggleSubject(s.id)}
                        className="quiz-option"
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step.kind === "score" && (
                <>
                  <h2 className="mt-2 text-2xl font-bold">
                    Сколько баллов сейчас по предмету «{step.subject.name}»?
                  </h2>
                  <p className="mt-1 text-muted">По последнему пробнику или примерно, как чувствуешь.</p>
                  <div className="mt-6 grid gap-3">
                    {SCORE_OPTIONS.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        aria-pressed={scores[step.subject.id] === o.id}
                        onClick={() => setScores({ ...scores, [step.subject.id]: o.id })}
                        className="quiz-option"
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step.kind === "goal" && (
                <>
                  <h2 className="mt-2 text-2xl font-bold">На какой результат целишься?</h2>
                  <div className="mt-6 grid gap-3">
                    {GOAL_OPTIONS.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        aria-pressed={goal === o.id}
                        onClick={() => setGoal(o.id)}
                        className="quiz-option"
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div className="mt-8 flex flex-wrap items-center gap-5">
                <button type="button" className="btn btn-ultra" disabled={!canContinue} onClick={next}>
                  {stepIndex + 1 < steps.length ? "Дальше" : "Показать результат"}
                </button>
                {stepIndex > 0 && (
                  <button type="button" className="text-link" onClick={back}>
                    Назад
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div>
              <h2 className="font-display text-3xl md:text-4xl">Тебе подойдёт</h2>
              <ul className="mt-8 grid gap-5">
                {results.map(({ subject, level, price }) => (
                  <li key={subject.id} className="card bg-white p-7">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <h3 className="text-xl font-bold">{subject.name}</h3>
                      <span className="text-xl font-bold whitespace-nowrap">
                        {formatPrice(price)}
                        <span className="text-base font-normal text-muted"> / мес</span>
                      </span>
                    </div>
                    <p className="mt-2">
                      <span className={`status-badge ${level === "advanced" ? "bg-bubble" : "bg-mint"}`}>
                        {LEVELS[level].name} уровень
                      </span>
                    </p>
                    <p className="mt-3 text-muted">{LEVELS[level].text}</p>
                  </li>
                ))}
              </ul>

              {results.length > 1 && (
                <p className="mt-6 text-right text-lg">
                  Всего в месяц: <span className="font-bold">{formatPrice(total)}</span>
                </p>
              )}

              <div className="card mt-8 flex flex-col items-start gap-5 bg-sun p-8">
                <p className="text-lg">
                  Создай аккаунт и напиши нам в{" "}
                  <a href={SITE.contacts.telegram} className="text-link">
                    Телеграм
                  </a>
                  , какие курсы тебе подошли. Подберём группу по расписанию.
                </p>
                <div className="flex flex-wrap items-center gap-5">
                  <Link href="/register" className="btn btn-ultra">
                    Записаться
                  </Link>
                  <button type="button" className="text-link" onClick={back}>
                    Изменить ответы
                  </button>
                  <button type="button" className="text-link" onClick={restart}>
                    Пройти заново
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
