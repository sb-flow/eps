import { getData } from "@/lib/data";
import { Dashboard } from "@/components/dashboard";
export default async function Home() {
  const { data, mode } = await getData();
  if (!data)
    return (
      <main className="page">
        <h1>Настройка CRM</h1>
        <p>
          Добавьте Supabase URL и ANON KEY. Для просмотра исходной базы
          установите DEMO_MODE=true.
        </p>
      </main>
    );
  return <Dashboard data={data} mode={mode} />;
}
