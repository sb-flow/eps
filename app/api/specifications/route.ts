import { verifyOrigin } from "@/lib/request";
import { requireEditor, serverDb } from "@/lib/supabase/server";
import { parseSpecification } from "@/lib/ai/specification-parser";
import { matchProducts } from "@/lib/ai/product-matcher";
import { sections, type Row } from "@/lib/types";
import { z } from "zod";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    const db = await serverDb();
    const id = z
      .string()
      .uuid()
      .parse(new URL(request.url).searchParams.get("id"));
    const { data, error } = await db
      .from("specifications")
      .select("storage_path")
      .eq("id", id)
      .single();
    if (error || !data) throw Error("NOT_FOUND");
    const signed = await db.storage
      .from("specifications")
      .createSignedUrl(data.storage_path, 60);
    if (signed.error) throw signed.error;
    return Response.json({ url: signed.data.signedUrl });
  } catch {
    return Response.json({ error: "Файл недоступен" }, { status: 403 });
  }
}
export async function POST(request: Request) {
  try {
    verifyOrigin(request);
    const { db, user } = await requireEditor();
    const form = await request.formData();
    const file = form.get("file");
    const projectId = z.string().min(1).parse(form.get("project_id"));
    const section = z
      .enum(sections as [string, ...string[]])
      .parse(form.get("section"));
    if (
      !(file instanceof File) ||
      file.size > 4 * 1024 * 1024 ||
      file.size === 0 ||
      !/\.(xlsx|xls|csv|pdf|docx)$/i.test(file.name)
    )
      return Response.json(
        { error: "Допустимы XLSX/XLS/CSV/PDF/DOCX до 4 МБ" },
        { status: 400 },
      );
    const { data: project } = await db
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .single();
    if (!project) throw Error("PROJECT_NOT_FOUND");
    const path = `${projectId}/${crypto.randomUUID()}.${file.name.split(".").pop()?.toLowerCase()}`;
    const { error: uploadError } = await db.storage
      .from("specifications")
      .upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (uploadError) throw uploadError;
    const { data, error } = await db
      .from("specifications")
      .insert({
        project_id: projectId,
        section,
        name: file.name,
        storage_path: path,
        mime_type: file.type,
        file_size: file.size,
        uploader: user.id,
        source: String(form.get("source") || ""),
      })
      .select("id")
      .single();
    if (error) {
      await db.storage.from("specifications").remove([path]);
      throw error;
    }
    return Response.json(data);
  } catch {
    console.error("specification_upload_failed");
    return Response.json(
      { error: "Загрузка не выполнена. Проверьте доступ и настройки Storage." },
      { status: 400 },
    );
  }
}
export async function PATCH(request: Request) {
  let specId: string | undefined;
  try {
    verifyOrigin(request);
    const { db } = await requireEditor();
    const body = await request.json();
    specId = z.string().uuid().parse(body.id);
    if (!process.env.OPENAI_API_KEY)
      return Response.json(
        { error: "Для разбора настройте OPENAI_API_KEY. Оригинал сохранён." },
        { status: 503 },
      );
    const { data: spec, error } = await db
      .from("specifications")
      .update({ status: "processing", error_code: null })
      .eq("id", specId)
      .in("status", ["uploaded", "failed"])
      .select("*")
      .single();
    if (error || !spec)
      return Response.json(
        { error: "Разбор уже запущен или завершён" },
        { status: 409 },
      );
    try {
      const file = await db.storage
        .from("specifications")
        .download(spec.storage_path);
      if (file.error) throw file.error;
      const items = await parseSpecification(
        Buffer.from(await file.data.arrayBuffer()),
        spec.name,
      );
      const saved = await db.rpc("complete_specification", {
        spec_id: specId,
        items,
      });
      if (saved.error) throw saved.error;
      const itemResult = await db
        .from("specification_items")
        .select("*")
        .eq("specification_id", specId);
      if (itemResult.error) throw itemResult.error;
      const products: Row[] = [];
      for (let start = 0; ; start += 1000) {
        const p = await db
          .from("products")
          .select("*")
          .order("id")
          .range(start, start + 999);
        if (p.error) throw p.error;
        products.push(...p.data);
        if (p.data.length < 1000) break;
      }
      const matches = itemResult.data.flatMap((item) =>
        matchProducts(item, products),
      );
      if (matches.length) {
        const result = await db.from("product_matches").insert(matches);
        if (result.error) throw result.error;
      }
      return Response.json({ ok: true });
    } catch {
      await db
        .from("specifications")
        .update({ status: "failed", error_code: "PARSE_FAILED" })
        .eq("id", specId);
      throw Error("PARSE_FAILED");
    }
  } catch {
    console.error("specification_parse_failed", { specId });
    return Response.json(
      {
        error:
          "Разбор не выполнен. Оригинал сохранён, можно повторить попытку.",
      },
      { status: 400 },
    );
  }
}
