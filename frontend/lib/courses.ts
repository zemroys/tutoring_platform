// Каталог курсов для страницы цен и опросника: предметы, уровни и цены в одном месте.

export type LevelId = "base" | "advanced";

export const LEVELS: Record<LevelId, { name: string; text: string }> = {
  base: {
    name: "Базовый",
    text: "Закрываем пробелы и выходим на уверенный результат.",
  },
  advanced: {
    name: "Продвинутый",
    text: "База уже есть: разбираем самые сложные задания варианта.",
  },
};

export type CatalogSubject = {
  id: string;
  name: string;
  // Цена за месяц в рублях для каждого уровня, который есть у предмета
  prices: Partial<Record<LevelId, number>>;
};

// TODO: поставить настоящие цены до запуска! Сейчас это заглушки.
export const CATALOG: CatalogSubject[] = [
  { id: "informatics", name: "Информатика", prices: { base: 4900, advanced: 5900 } },
  { id: "physics", name: "Физика", prices: { base: 4900, advanced: 5900 } },
  { id: "math", name: "Профильная математика", prices: { base: 4900, advanced: 5900 } },
  { id: "base-math", name: "Базовая математика", prices: { base: 3900 } },
  { id: "russian", name: "Русский язык", prices: { base: 4500, advanced: 5500 } },
  { id: "english", name: "Английский язык", prices: { base: 4500, advanced: 5500 } },
];

export function formatPrice(rubles: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(rubles)} ₽`;
}

// Что входит в любой курс. Только то, что уже работает на сайте.
export const INCLUDED = [
  "Мини-группа до 6 человек и свой преподаватель",
  "Вебинары по расписанию, ссылки в личном кабинете",
  "Домашка каждую неделю с проверкой",
  "Отметки по каждой задаче и комментарии преподавателя",
];
