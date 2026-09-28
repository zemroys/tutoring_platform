import type { Metadata } from "next";
import { Dela_Gothic_One, Onest } from "next/font/google";
import "./globals.css";
import { SITE } from "@/lib/site";

// Dela Gothic One: жирный плакатный шрифт для заголовков
const dela = Dela_Gothic_One({
  weight: "400",
  subsets: ["latin", "cyrillic"],
  variable: "--font-dela",
});

// Onest: спокойный шрифт для текста, изначально сделан под кириллицу
const onest = Onest({
  subsets: ["latin", "cyrillic"],
  variable: "--font-onest",
});

export const metadata: Metadata = {
  title: `${SITE.name}: подготовка к ЕГЭ в группах по шесть человек`,
  description:
      "Подготовка к ЕГЭ в мини-группах по 5–6 человек: информатика, физика, математика, английский и русский.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={`${dela.variable} ${onest.variable}`}>
      <body>{children}</body>
    </html>
  );
}
