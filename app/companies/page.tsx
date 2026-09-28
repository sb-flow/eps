import { getData } from "@/lib/data";
import { Companies } from "@/components/companies";
export default async function Page() {
  const { data, mode, role } = await getData();
  if (!data) return <main className="page">Настройте Supabase.</main>;
  return (
    <Companies data={data} editable={mode === "live" && role !== "viewer"} />
  );
}
