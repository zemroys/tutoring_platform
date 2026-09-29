// Всё общение сайта с сервером идёт через эту функцию.
// Она сама отправляет cookie с токеном и превращает ошибки сервера в понятный текст.

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type User = {
  id: number;
  email: string;
  role: "student" | "teacher" | "admin";
};

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// FastAPI присылает ошибки в двух видах:
// {"detail": "текст"} или {"detail": [{"msg": "Value error, текст"}, ...]}
function readError(data: unknown): string {
  if (data && typeof data === "object" && "detail" in data) {
    const detail = (data as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      return detail
        .map((item) => String((item as { msg?: string })?.msg ?? "").replace(/^Value error, /, ""))
        .join(". ");
    }
  }
  return "Что-то пошло не так. Попробуй ещё раз.";
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      credentials: "include", // отправлять cookie с токеном на сервер
      headers: { "Content-Type": "application/json", ...options.headers },
    });
  } catch {
    throw new ApiError(0, "Не удалось связаться с сервером. Попробуй ещё раз через минуту.");
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, readError(data));
  return data as T;
}

export type Course = {
  id: number;
  title: string;
  description: string | null;
  price: number | null;
  teacher_id: number | null;
};

export type ScheduleItem = {
  id: number;
  course_id: number;
  week_number: number;
  webinar_link: string;
  stream_date: string | null; // дата и время, например "2026-10-05T18:00:00"
};

export type Homework = {
  id: number;
  course_id: number;
  week_number: number;
  description: string;
  link: string | null; // ссылка на материалы, может не быть
};
