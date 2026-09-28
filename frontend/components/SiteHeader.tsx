import Link from "next/link";
import { SITE } from "@/lib/site";

export default function SiteHeader() {
  return (
    <header className="flex items-center justify-between gap-6 py-6">
      <Link href="/" className="font-display text-2xl">
        {SITE.name}
      </Link>

      <nav className="flex items-center gap-6">
        <a href="#subjects" className="nav-link hidden md:inline">
          Предметы
        </a>
        <a href="#how" className="nav-link hidden md:inline">
          Как учимся
        </a>
        <Link href="/prices" className="nav-link hidden md:inline">
          Цены
        </Link>
        <Link href="/login" className="btn btn-sun btn-sm">
          Войти
        </Link>
      </nav>
    </header>
  );
}
