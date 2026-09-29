// Общий каркас для страниц входа и регистрации: синий фон, как на первом экране, и белая карточка.

import Link from "next/link";
import { SITE } from "@/lib/site";

type Props = {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export default function AuthLayout({ title, children, footer }: Props) {
  return (
    <div className="min-h-screen bg-ultra pb-16 text-white">
      <div className="container-page py-6">
        <Link href="/" className="font-display text-2xl">
          {SITE.name}
        </Link>
      </div>

      <main className="mx-auto mt-6 max-w-md px-5 md:mt-12">
        <div className="card bg-white p-7 text-ink md:p-10">
          <h1 className="font-display text-3xl">{title}</h1>
          <div className="mt-8">{children}</div>
          {footer && <p className="mt-6 text-muted">{footer}</p>}
        </div>
      </main>
    </div>
  );
}
