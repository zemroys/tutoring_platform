"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthLayout from "@/components/AuthLayout";
import { api, ApiError, type User } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const body = JSON.stringify({ email, password });
      // Сначала создаём аккаунт, потом сразу входим, чтобы не заставлять вводить всё второй раз
      await api<User>("/register", { method: "POST", body });
      await api<User>("/login", { method: "POST", body });
      router.push("/cabinet");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Что-то пошло не так. Попробуй ещё раз.");
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Регистрация"
      footer={
        <>
          Уже есть аккаунт?{" "}
          <Link href="/login" className="text-link">
            Войти
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
            autoComplete="new-password"
            required
            minLength={8}
            aria-describedby="password-hint"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <span id="password-hint" className="field-hint">
            Минимум 8 символов и хотя бы одна буква
          </span>
        </label>

        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}

        <button type="submit" className="btn btn-ultra mt-2" disabled={loading}>
          {loading ? "Создаём аккаунт..." : "Создать аккаунт"}
        </button>
      </form>
    </AuthLayout>
  );
}
