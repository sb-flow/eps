"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="page">
      <h1>Не удалось загрузить CRM</h1>
      <p>
        Проверьте подключение Supabase, миграции и роль пользователя.
        Производственная база не заменяется демонстрационными данными при
        ошибке.
      </p>
      <button onClick={reset}>Повторить</button>
    </main>
  );
}
