import { notFound } from "next/navigation";
import { getData } from "@/lib/data";
import { ProjectDetail } from "@/components/project-detail";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data, mode, role } = await getData();
  const project = data?.projects.find((p) => p.id === id);
  if (!data || !project) notFound();
  return (
    <ProjectDetail
      data={data}
      project={project}
      mode={mode}
      editable={mode === "live" && role !== "viewer"}
    />
  );
}
