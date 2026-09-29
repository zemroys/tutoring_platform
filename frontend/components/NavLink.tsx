"use client";

// Ссылка в меню, которая подчёркивается, если мы сейчас в этом разделе.

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  href: string;
  children: React.ReactNode;
  className?: string;
  // Своё правило "раздел активен", например для всех страниц внутри кабинета
  isActive?: (pathname: string) => boolean;
};

export default function NavLink({ href, children, className = "", isActive }: Props) {
  const pathname = usePathname();
  // Ссылки на блоки главной (/#subjects) не подсвечиваем: это не отдельный раздел
  const active = isActive ? isActive(pathname) : !href.includes("#") && pathname === href;

  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={`nav-link ${className}`}>
      {children}
    </Link>
  );
}
