import Link from "next/link";
import AuthButton from "@/components/AuthButton";
import Logo from "@/components/Logo";
import { SITE } from "@/lib/site";

export default function SiteHeader() {
  return (
    <header className="flex items-center justify-between gap-6 py-6">
      <Link href="/" aria-label={`${SITE.name}, на главную`}>
        <Logo variant="sun" />
      </Link>

      <nav className="flex items-center gap-6">
        <Link href="/#subjects" className="nav-link hidden md:inline">
          Предметы
        </Link>
        <Link href="/#how" className="nav-link hidden md:inline">
          Как учимся
        </Link>
        <Link href="/prices" className="nav-link hidden md:inline">
          Цены
        </Link>
        <AuthButton />
      </nav>
    </header>
  );
}
