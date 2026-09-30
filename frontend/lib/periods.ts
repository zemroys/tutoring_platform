// Месяцы оплаты хранятся строкой "2026-10"

export function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// "2026-10" → "октябрь 2026"
export function formatPeriod(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const name = new Date(year, month - 1, 1).toLocaleDateString("ru-RU", { month: "long" });
  return `${name} ${year}`;
}
