"use client";

// Шапка личного кабинета: логотип (ведёт на главную), разделы кабинета и выход.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import { api } from "@/lib/api";
import { SITE } from "@/lib/site";

export default function CabinetHeader() {
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    await api("/logout", { method: "POST" }).catch(() => {});
    router.push("/");
  }

  const links = [
    { href: "/cabinet", label: "Кабинет" },
    { href: "/cabinet/settings", label: "Настройки" },
  ];

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 py-6">
      <Link href="/" aria-label={`${SITE.name}, на главную`}>
        <Logo variant="ultra" />
      </Link>
      <nav className="flex items-center gap-5">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={pathname === link.href ? "page" : undefined}
            className="nav-link aria-[current=page]:underline"
          >
            {link.label}
          </Link>
        ))}
        <button type="button" onClick={handleLogout} className="btn btn-sm bg-white">
          Выйти
        </button>
      </nav>
    </header>
  );
}
