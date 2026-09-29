"use client"; // страница работает в браузере: у неё есть форма и состояние

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthLayout from "@/components/AuthLayout";
import { api, ApiError, type User } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); // не перезагружать страницу, отправляем сами
    setError("");
    setLoading(true);
    try {
      await api<User>("/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.push("/cabinet");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Что-то пошло не так. Попробуй ещё раз.");
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Вход"
      footer={
        <>
          Нет аккаунта?{" "}
          <Link href="/register" className="text-link">
            Зарегистрироваться
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Пароль</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}

        <button type="submit" className="btn btn-ultra mt-2" disabled={loading}>
          {loading ? "Входим..." : "Войти"}
        </button>
      </form>
    </AuthLayout>
  );
}
