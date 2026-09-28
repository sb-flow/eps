import { getData } from "@/lib/data";
import { Products } from "@/components/products";
export default async function Page() {
  const { data, mode, role } = await getData();
  if (!data) return <main className="page">Настройте Supabase.</main>;
  return (
    <Products data={data} editable={mode === "live" && role !== "viewer"} />
  );
}
