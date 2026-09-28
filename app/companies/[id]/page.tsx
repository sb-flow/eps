import { getData } from "@/lib/data";
import { Companies } from "@/components/companies";
import { notFound } from "next/navigation";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data, mode, role } = await getData();
  if (!data || !data.companies.some((c) => c.id === id)) notFound();
  return (
    <Companies
      data={data}
      companyId={id}
      editable={mode === "live" && role !== "viewer"}
    />
  );
}
