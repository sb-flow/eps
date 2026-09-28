import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import projects from "@/data/projects.json";
import participants from "@/data/participants.json";
import { importLegacy } from "./import-legacy";
import { configured, serverDb } from "./supabase/server";
import type { Snapshot } from "./types";
export const getData = cache(async () => {
  if (!configured()) {
    if (
      process.env.NODE_ENV === "production" &&
      process.env.DEMO_MODE !== "true"
    )
      return { data: null, mode: "setup", role: "viewer" };
    return {
      data: compactSnapshot(importLegacy(projects, participants).data),
      mode: "demo",
      role: "viewer",
    };
  }
  const db = await serverDb();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await db
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile) throw Error("Профиль доступа не найден");
  const tables = [
    "projects",
    "companies",
    "people",
    "project_participants",
    "project_participant_sections",
    "project_sections",
    "specifications",
    "specification_items",
    "products",
    "product_matches",
    "calculations",
    "calculation_items",
    "opportunities",
    "activities",
    "sources",
    "history",
    "profiles",
  ] as const;
  const data = {} as Snapshot;
  await Promise.all(
    tables.map(async (table) => {
      const rows = [];
      for (let from = 0; ; from += 1000) {
        const result = await db
          .from(table)
          .select("*")
          .order(table === "history" ? "created_at" : "id", {
            ascending: table !== "history",
          })
          .range(from, from + (table === "history" ? 199 : 999));
        if (result.error)
          throw Error(
            `Не удалось загрузить ${table}. Проверьте миграции и доступ.`,
          );
        rows.push(...result.data);
        if (table === "history" || result.data.length < 1000) break;
      }
      Object.assign(data, { [table]: rows });
    }),
  );
  return {
    data: compactSnapshot(data),
    mode: "live",
    role: profile.role as string,
  };
});

function compactSnapshot(data: Snapshot): Snapshot {
  // Original raw records remain in PostgreSQL; avoid shipping duplicate participant exports to every browser.
  for (const p of data.projects) {
    p.legacy = { ...p.legacy };
    delete p.legacy.participantLinks;
  }
  for (const c of data.companies) {
    delete c.legacy;
    delete c.registry_response;
  }
  for (const p of data.project_participants) delete p.legacy;
  for (const s of data.sources) delete s.raw;
  return data;
}
