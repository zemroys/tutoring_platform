// Даты хранятся без часового пояса и показываются как есть: время, которое указал преподаватель

export function formatDateTime(value: string | null): string {
  if (!value) return "время уточняется";
  return new Date(value).toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// "2026-10-05T18:00:00" → "2026-10-05T18:00" для поля <input type="datetime-local">
export function toDateTimeInput(value: string | null): string {
  return value ? value.slice(0, 16) : "";
}

// Показываем, на какой сайт ведёт ссылка, прежде чем по ней нажмут
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

// Русские окончания: plural(4, ["занятие", "занятия", "занятий"]) → "занятия"
export function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}
