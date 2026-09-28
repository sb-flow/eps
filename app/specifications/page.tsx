import { getData } from "@/lib/data";
import { Specifications } from "@/components/specifications";
export default async function Page() {
  const { data, mode, role } = await getData();
  if (!data) return <main className="page">Настройте Supabase.</main>;
  return (
    <main className="page">
      <Specifications
        data={data}
        editable={mode === "live" && role !== "viewer"}
      />
    </main>
  );
}
