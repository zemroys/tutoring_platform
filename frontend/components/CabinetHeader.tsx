"use client";

// Шапка личного кабинета: логотип и кнопка выхода. Общая для всех страниц кабинета.

import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import { api } from "@/lib/api";
import { SITE } from "@/lib/site";

export default function CabinetHeader() {
  const router = useRouter();

  async function handleLogout() {
    await api("/logout", { method: "POST" }).catch(() => {});
    router.push("/");
  }

  return (
    <header className="flex items-center justify-between gap-6 py-6">
      <Link href="/cabinet" aria-label={`${SITE.name}, личный кабинет`}>
        <Logo variant="ultra" />
      </Link>
      <button type="button" onClick={handleLogout} className="btn btn-sm bg-white">
        Выйти
      </button>
    </header>
  );
}
