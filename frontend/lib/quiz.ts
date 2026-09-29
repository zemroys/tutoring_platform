// Сохранение результата опросника.
// Если человек не вошёл, результат ждёт в браузере и переезжает в аккаунт после регистрации или входа.

import { api } from "@/lib/api";
import type { LevelId } from "@/lib/courses";

export type QuizItem = { subject_id: string; level: LevelId };
export type QuizResult = { items: QuizItem[]; updated_at: string | null };

const STORAGE_KEY = "binamika-quiz-result";

// Возвращает true, если результат сохранён в аккаунт, и false, если пока только в браузере
export async function saveQuizResult(items: QuizItem[]): Promise<boolean> {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // браузер может запрещать хранилище (например, в режиме инкогнито), это не страшно
  }
  try {
    await api("/me/quiz-result", { method: "PUT", body: JSON.stringify({ items }) });
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false; // не вошёл: результат подождёт в браузере
  }
}

// Вызывается в кабинете: если в браузере лежит несохранённый результат, отправляем его в аккаунт
export async function syncPendingQuizResult(): Promise<void> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return;
  }
  if (!raw) return;
  try {
    const items = JSON.parse(raw) as QuizItem[];
    await api("/me/quiz-result", { method: "PUT", body: JSON.stringify({ items }) });
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // не получилось: попробуем при следующем открытии кабинета
  }
}
