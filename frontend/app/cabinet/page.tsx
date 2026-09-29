"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, type User } from "@/lib/api";
import { SITE } from "@/lib/site";

const ROLE_NAMES: Record<User["role"], string> = {
  student: "ученик",
  teacher: "преподаватель",
  admin: "администратор",
};

export default function CabinetPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  // При открытии страницы спрашиваем сервер, кто мы. Нет входа — отправляем на страницу входа.
  useEffect(() => {
    api<User>("/me")
      .then(setUser)
      .catch(() => router.replace("/login"));
  }, [router]);

  async function handleLogout() {
    await api("/logout", { method: "POST" }).catch(() => {});
    router.push("/");
  }

  if (!user) {
    return <p className="container-page py-20 text-muted">Загружаем...</p>;
  }

  return (
    <div className="container-page pb-20">
      <header className="flex items-center justify-between gap-6 py-6">
        <Link href="/" className="font-display text-2xl">
          {SITE.name}
        </Link>
        <button type="button" onClick={handleLogout} className="btn btn-sm bg-white">
          Выйти
        </button>
      </header>

      <main className="mt-8">
        <h1 className="font-display text-4xl md:text-5xl">Личный кабинет</h1>
        <p className="mt-4 text-lg text-muted">
          {user.email}, {ROLE_NAMES[user.role]}
        </p>

        <div className="card mt-10 bg-sun p-8">
          <h2 className="text-xl font-bold">Скоро тут будет всё для учёбы</h2>
          <p className="mt-2 max-w-[50ch]">
            Расписание, ссылки на вебинары и домашки твоих групп появятся здесь.
          </p>
        </div>
      </main>
    </div>
  );
}
