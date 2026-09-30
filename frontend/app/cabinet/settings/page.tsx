"use client";

// Настройки аккаунта: личные данные и смена пароля.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CabinetHeader from "@/components/CabinetHeader";
import { api, ApiError, type User } from "@/lib/api";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  // Личные данные
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [telegram, setTelegram] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Пароль
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const me = await api<User>("/me");
        setUser(me);
        setFirstName(me.first_name ?? "");
        setLastName(me.last_name ?? "");
        setTelegram(me.telegram ? `@${me.telegram}` : "");
      } catch {
        router.replace("/login");
      }
    }
    load();
  }, [router]);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileMessage("");
    setProfileError("");
    setSavingProfile(true);
    try {
      const updated = await api<User>("/me", {
        method: "PATCH",
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          telegram: telegram.trim() || null,
        }),
      });
      setUser(updated);
      setFirstName(updated.first_name ?? "");
      setLastName(updated.last_name ?? "");
      setTelegram(updated.telegram ? `@${updated.telegram}` : "");
      setProfileMessage("Сохранено");
    } catch (err) {
      setProfileError(err instanceof ApiError ? err.message : "Не удалось сохранить.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordMessage("");
    setPasswordError("");
    setSavingPassword(true);
    try {
      await api("/me/password", {
        method: "POST",
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setPasswordMessage("Пароль изменён");
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : "Не удалось изменить пароль.");
    } finally {
      setSavingPassword(false);
    }
  }

  async function logoutEverywhere() {
    if (!window.confirm("Выйти из аккаунта на всех устройствах, включая это?")) return;
    setLoggingOutAll(true);
    try {
      await api("/logout-all", { method: "POST" });
    } catch {
      // даже если что-то пошло не так, уводим на вход: там будет видно, остался ли вход
    }
    router.push("/login");
  }

  if (!user) {
    return <p className="container-page py-20 text-muted">Загружаем...</p>;
  }

  return (
    <div className="container-page pb-20">
      <CabinetHeader />

      <main className="mt-8 max-w-2xl">
        <h1 className="font-display text-4xl md:text-5xl">Настройки</h1>

        <form onSubmit={saveProfile} className="card mt-10 flex flex-col gap-5 bg-white p-7 md:p-9">
          <h2 className="text-xl font-bold">Личные данные</h2>
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
            <span>Ник в Телеграме</span>
            <input
              type="text"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              required={user.role === "student"}
              maxLength={60}
              placeholder="@ivan_petrov"
              value={telegram}
              onChange={(e) => setTelegram(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Email</span>
            <input type="email" value={user.email} readOnly disabled aria-describedby="email-hint" />
            <span id="email-hint" className="field-hint">
              Email используется для входа
            </span>
          </label>

          {profileError && (
            <p role="alert" className="form-error">
              {profileError}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" className="btn btn-ultra" disabled={savingProfile}>
              {savingProfile ? "Сохраняем..." : "Сохранить"}
            </button>
            {profileMessage && (
              <span role="status" className="font-semibold text-muted">
                {profileMessage}
              </span>
            )}
          </div>
        </form>

        <form onSubmit={savePassword} className="card mt-8 flex flex-col gap-5 bg-white p-7 md:p-9">
          <h2 className="text-xl font-bold">Смена пароля</h2>
          <label className="field">
            <span>Текущий пароль</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Новый пароль</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              aria-describedby="new-password-hint"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <span id="new-password-hint" className="field-hint">
              Минимум 8 символов и хотя бы одна буква
            </span>
          </label>

          {passwordError && (
            <p role="alert" className="form-error">
              {passwordError}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" className="btn btn-ultra" disabled={savingPassword}>
              {savingPassword ? "Меняем..." : "Изменить пароль"}
            </button>
            {passwordMessage && (
              <span role="status" className="font-semibold text-muted">
                {passwordMessage}. Другие устройства вышли из аккаунта
              </span>
            )}
          </div>
        </form>

        <section className="card mt-8 flex flex-col items-start gap-4 bg-white p-7 md:p-9">
          <h2 className="text-xl font-bold">Устройства</h2>
          <p className="text-muted">
            Если заходил в аккаунт с чужого компьютера или потерял телефон, выйди везде. После смены
            пароля другие устройства выходят сами.
          </p>
          <button
            type="button"
            onClick={logoutEverywhere}
            className="btn btn-sm bg-white"
            disabled={loggingOutAll}
          >
            {loggingOutAll ? "Выходим..." : "Выйти на всех устройствах"}
          </button>
        </section>
      </main>
    </div>
  );
}
