"use client";

// Кнопка в шапке сайта: "Войти" для гостей и "Личный кабинет" для тех, кто уже вошёл.
// Токен лежит в httpOnly cookie, которую сайт прочитать не может, поэтому спрашиваем сервер.

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type User } from "@/lib/api";

export default function AuthButton() {
  const [state, setState] = useState<"loading" | "guest" | "user">("loading");

  useEffect(() => {
    async function check() {
      try {
        await api<User>("/me");
        setState("user");
      } catch {
        setState("guest");
      }
    }
    check();
  }, []);

  // Пока ждём ответ, держим место под кнопку, чтобы шапка не прыгала
  if (state === "loading") {
    return <span className="btn btn-sun btn-sm invisible" aria-hidden="true">Войти</span>;
  }

  return state === "user" ? (
    <Link href="/cabinet" className="btn btn-sun btn-sm">
      Личный кабинет
    </Link>
  ) : (
    <Link href="/login" className="btn btn-sun btn-sm">
      Войти
    </Link>
  );
}
