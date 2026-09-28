import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { importLegacy } from "../lib/import-legacy";
const result = importLegacy(
  JSON.parse(readFileSync("data/projects.json", "utf8")),
  JSON.parse(readFileSync("data/participants.json", "utf8")),
);
mkdirSync("work", { recursive: true });
writeFileSync(
  "work/import-report.json",
  JSON.stringify(result.report, null, 2),
);
console.log(
  JSON.stringify(
    { ...result.report, Warnings: result.report.Warnings.length },
    null,
    2,
  ),
);
if (process.argv.includes("--apply")) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw Error("Set Supabase URL and service role key in the shell.");
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Single DB transaction; conflict-ignore preserves CRM edits on reruns.
  const { error } = await db.rpc("import_legacy", { payload: result.data });
  if (error) throw Error(error.message);
  console.log("Import committed. Existing IDs left unchanged.");
} else
  console.log(
    "Dry run only. Use --apply for a transactional import. Report: work/import-report.json",
  );
