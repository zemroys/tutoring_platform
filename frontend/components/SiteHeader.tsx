import Link from "next/link";
import AuthButton from "@/components/AuthButton";
import Logo from "@/components/Logo";
import NavLink from "@/components/NavLink";
import { SITE } from "@/lib/site";

export default function SiteHeader() {
  return (
    <header className="flex items-center justify-between gap-6 py-6">
      <Link href="/" aria-label={`${SITE.name}, на главную`}>
        <Logo variant="sun" />
      </Link>

      <nav className="flex items-center gap-6">
        <NavLink href="/#subjects" className="hidden md:inline">
          Предметы
        </NavLink>
        <NavLink href="/#how" className="hidden md:inline">
          Как учимся
        </NavLink>
        <NavLink href="/prices" className="hidden md:inline">
          Цены
        </NavLink>
        <AuthButton />
      </nav>
    </header>
  );
}
