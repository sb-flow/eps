import { verifyOrigin } from "@/lib/request";
import { z } from "zod";
import { requireEditor } from "@/lib/supabase/server";
import { normalizeCompany } from "@/lib/search";
import { sections, roles } from "@/lib/types";
import { calculationSchema, calculate } from "@/lib/finance";
const text = z.string().trim().max(10000).nullable().optional();
const id = z.string().uuid();
const schemas = {
  companies: z.object({
    name: z.string().trim().min(1).max(500),
    inn: z
      .string()
      .regex(/^\d{9}$/)
      .nullable()
      .optional(),
    legal_name: text,
    oked: text,
    registration_number: text,
    legal_address: text,
    actual_address: text,
    website: text,
    main_phone: text,
    main_email: text,
    country: text,
    region: text,
    notes: text,
    source: text,
    source_url: text,
    verified_at: text,
    registry_provider: text,
    registry_response: z.json().optional(),
  }),
  people: z.object({
    first_name: z.string().trim().min(1),
    last_name: text,
    position: text,
    company_id: id,
    phone: text,
    additional_phone: text,
    email: text,
    telegram: text,
    whatsapp: text,
    notes: text,
    source: text,
    verified_at: text,
  }),
  projects: z.object({
    name: z.string().trim().min(1),
    region: text,
    address: text,
    district: text,
    category: text,
    type: text,
    stage: text,
    priority: text,
    area_m2: z.number().nonnegative().nullable(),
    lat: z.number().min(-90).max(90).nullable(),
    lng: z.number().min(-180).max(180).nullable(),
    start_date: text,
    deadline: text,
    description: text,
    verified_at: text,
    owner_id: id.nullable().optional(),
  }),
  activities: z.object({
    project_id: z.string().min(1).nullable().optional(),
    company_id: id.nullable().optional(),
    person_id: id.nullable().optional(),
    type: z.string().min(1),
    description: z.string().min(1).max(10000),
    date: text,
    next_action: text,
    next_action_date: text,
  }),
  products: z.object({
    name: z.string().min(1),
    manufacturer: text,
    brand: text,
    article: text,
    category: text,
    description: text,
    dn: z.number().nonnegative().nullable(),
    pn: z.number().nonnegative().nullable(),
    kvs: z.number().nonnegative().nullable(),
    purchase_price: z.number().nonnegative().nullable(),
    sales_price: z.number().nonnegative().nullable(),
    currency: z.string().regex(/^[A-Z]{3}$/),
  }),
};
export async function POST(request: Request) {
  try {
    verifyOrigin(request);
    const { db, user } = await requireEditor();
    const body = await request.json();
    if (body.action === "participant") {
      const p = z
        .object({
          project_id: z.string().min(1),
          company_id: id,
          role: z.enum(roles as [string, ...string[]]),
          person_id: id.nullable().optional(),
          comment: text,
          source: text,
          verified_at: text,
        })
        .parse(body.data);
      const chosen = z
        .array(z.enum(sections as [string, ...string[]]))
        .max(15)
        .parse(body.sections);
      const { data, error } = await db.rpc("add_participant", {
        payload: p,
        sections: [...new Set(chosen)],
      });
      if (error) throw error;
      return Response.json({ id: data });
    }
    if (body.action === "calculate") {
      const input = calculationSchema.parse(body.data);
      const result = calculate(input);
      const opp = z
        .object({
          project_id: z.string().min(1),
          section: z.enum(sections as [string, ...string[]]),
          name: z.string().min(1),
          value_type: z.enum(["confirmed", "estimated", "unknown"]),
        })
        .parse(body.opportunity);
      const { data, error } = await db.rpc("save_calculation", {
        opp: {
          ...opp,
          value_type: result.total === null ? "unknown" : opp.value_type,
          currency: input.currency,
          amount: opp.value_type === "unknown" ? null : result.total,
        },
        calc: input,
        item: {
          ...result,
          specification_item_id: body.specification_item_id
            ? id.parse(body.specification_item_id)
            : null,
        },
      });
      if (error) throw error;
      return Response.json({ id: data, result });
    }
    if (body.action === "section") {
      const p = z
        .object({ id, status: z.string().trim().min(1).max(100) })
        .parse(body.data);
      const { error } = await db
        .from("project_participant_sections")
        .update({ status: p.status })
        .eq("id", p.id)
        .select("id")
        .single();
      if (error) throw error;
      return Response.json({ ok: true });
    }
    if (body.action === "review") {
      const p = z
        .object({ id, match_status: z.enum(["matched", "rejected"]) })
        .parse(body.data);
      const { error } = await db
        .from("product_matches")
        .update({ match_status: p.match_status, reviewed_by: user.id })
        .eq("id", p.id);
      if (error) throw error;
      return Response.json({ ok: true });
    }
    const table = z
      .enum(["companies", "people", "projects", "activities", "products"])
      .parse(body.table);
    const parsed = schemas[table].parse(body.data);
    const values: Record<string, unknown> =
      table === "companies"
        ? {
            ...parsed,
            normalized_name: normalizeCompany(
              (parsed as { name: string }).name,
            ),
          }
        : table === "activities"
          ? { ...parsed, user_id: user.id }
          : parsed;
    if (table === "projects" && !body.id) throw Error("Project ID required");
    const query = body.id
      ? db.from(table).update(values).eq("id", z.string().min(1).parse(body.id))
      : db.from(table).insert(values);
    const { data, error } = await query.select("id").single();
    if (error) throw error;
    return Response.json(data);
  } catch (error) {
    if (error instanceof z.ZodError)
      return Response.json(
        {
          error: "Проверьте поля формы",
          details: error.issues.map((x) => x.path.join(".")),
        },
        { status: 400 },
      );
    console.error("crm_mutation_failed", {
      code: (error as { code?: string }).code ?? "request",
    });
    return Response.json(
      {
        error:
          "Сохранение не выполнено. Проверьте права, уникальность ИНН и обязательные поля.",
      },
      { status: 400 },
    );
  }
}
