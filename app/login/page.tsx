"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
export default function Login() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  return (
    <main className="page" style={{ maxWidth: 450 }}>
      <h1>Доступ к CRM</h1>
      {!configured ? (
        <div className="notice">
          Supabase не настроен. Доступен просмотр исходной базы без записи.
        </div>
      ) : (
        <form
          className="panel"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const f = new FormData(e.currentTarget);
            const db = createBrowserClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            );
            const { error } = await db.auth.signInWithPassword({
              email: String(f.get("email")),
              password: String(f.get("password")),
            });
            setBusy(false);
            if (error)
              setMessage("Не удалось войти. Проверьте email и пароль.");
            else {
              router.push("/");
              router.refresh();
            }
          }}
        >
          <label>
            Email
            <input name="email" type="email" required autoComplete="username" />
          </label>
          <label>
            Пароль
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </label>
          <div className="toolbar">
            <button disabled={busy} className="primary">
              Войти
            </button>
            <button
              type="button"
              onClick={async () => {
                const db = createBrowserClient(
                  process.env.NEXT_PUBLIC_SUPABASE_URL!,
                  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                );
                await db.auth.signOut();
                router.push("/login");
                router.refresh();
              }}
            >
              Выйти
            </button>
          </div>
          <p role="alert">{message}</p>
        </form>
      )}
      <p className="muted">Учётную запись и роль выдаёт администратор.</p>
    </main>
  );
}
