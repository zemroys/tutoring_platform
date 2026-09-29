"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthLayout from "@/components/AuthLayout";
import { api, ApiError, type User } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      // Сначала создаём аккаунт, потом сразу входим, чтобы не заставлять вводить всё второй раз
      await api<User>("/register", {
        method: "POST",
        body: JSON.stringify({ email, password, first_name: firstName, last_name: lastName }),
      });
      await api<User>("/login", { method: "POST", body: JSON.stringify({ email, password }) });
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
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="field">
            <span>Имя</span>
            <input
              type="text"
              autoComplete="given-name"
              required
              maxLength={50}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Фамилия</span>
            <input
              type="text"
              autoComplete="family-name"
              required
              maxLength={50}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </label>
        </div>
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
