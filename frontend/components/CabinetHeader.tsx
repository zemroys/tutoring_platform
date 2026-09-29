"use client";

// Шапка личного кабинета: логотип (ведёт на главную), разделы кабинета и выход.

import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import NavLink from "@/components/NavLink";
import { api } from "@/lib/api";
import { SITE } from "@/lib/site";

export default function CabinetHeader() {
  const router = useRouter();

  async function handleLogout() {
    await api("/logout", { method: "POST" }).catch(() => {});
    router.push("/");
  }

  // "Кабинет" подсвечен на всех страницах кабинета (курсы, панель куратора), кроме настроек
  const inCabinet = (path: string) =>
    path.startsWith("/cabinet") && !path.startsWith("/cabinet/settings");
  const inSettings = (path: string) => path.startsWith("/cabinet/settings");

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 py-6">
      <Link href="/" aria-label={`${SITE.name}, на главную`}>
        <Logo variant="ultra" />
      </Link>
      <nav className="flex items-center gap-5">
        <NavLink href="/cabinet" isActive={inCabinet}>
          Кабинет
        </NavLink>
        <NavLink href="/cabinet/settings" isActive={inSettings}>
          Настройки
        </NavLink>
        <button type="button" onClick={handleLogout} className="btn btn-sm bg-white">
          Выйти
        </button>
      </nav>
    </header>
  );
}
