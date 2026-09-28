import { createHash } from "node:crypto";
import { normalizeCompany } from "./search";
import {
  present,
  str,
  type Snapshot,
  type Row,
  type Company,
  type Project,
} from "./types";
type Legacy = Record<string, unknown>;
export const stableId = (key: string) => {
  const h = createHash("sha256").update(key).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
export function importLegacy(projects: Legacy[], participants: Legacy[]) {
  const out: Snapshot = {
    projects: [],
    companies: [],
    people: [],
    project_participants: [],
    project_participant_sections: [],
    project_sections: [],
    specifications: [],
    specification_items: [],
    products: [],
    product_matches: [],
    calculations: [],
    calculation_items: [],
    opportunities: [],
    activities: [],
    sources: [],
    history: [],
    profiles: [],
  };
  const aliasInns = new Map<string, Set<string>>();
  for (const p of participants) {
    if (present(p.organization) && present(p.taxId)) {
      const key = normalizeCompany(str(p.organization));
      const values = aliasInns.get(key) ?? new Set<string>();
      values.add(str(p.taxId).trim());
      aliasInns.set(key, values);
    }
  }
  const warnings: string[] = [];
  let matched = 0;
  const companyKeys = new Map<string, Company>();
  const seen = new Set<string>();
  function company(name: unknown, inn: unknown, raw: Legacy): Company | null {
    if (!present(name)) return null;
    const n = normalizeCompany(str(name));
    const aliases = aliasInns.get(n);
    const tax = present(inn)
      ? str(inn).trim()
      : aliases?.size === 1
        ? [...aliases][0]
        : null;
    const key = tax ? "inn:" + tax : "name:" + n;
    let c = companyKeys.get(key);
    if (c) {
      matched++;
      if (!present(c.main_phone) && present(raw.phone))
        c.main_phone = raw.phone;
      if (!present(c.main_email) && present(raw.email))
        c.main_email = raw.email;
      if (!present(c.legal_address) && present(raw.legalAddress))
        c.legal_address = raw.legalAddress;
      return c;
    }
    c = {
      id: stableId("company:" + key),
      name: str(name),
      normalized_name: n,
      inn: tax,
      legal_name: str(name),
      main_phone: present(raw.phone) ? str(raw.phone) : null,
      main_email: present(raw.email) ? str(raw.email) : null,
      legal_address: raw.legalAddress ?? null,
      region: raw.regions ?? null,
      country: "Узбекистан",
      source: raw.source ?? null,
      source_url: raw.source ?? null,
      verified_at: date(raw.checkedAt),
      notes: raw.note ?? null,
      legacy: raw,
    };
    companyKeys.set(key, c);
    out.companies.push(c);
    if (/[;]|якоря:|меморандум/i.test(c.name))
      warnings.push(`Company needs review: ${c.name}`);
    return c;
  }
  function link(p: Project, c: Company, role: string, raw: Legacy) {
    const key = `${p.id}:${c.id}:${role}`;
    if (seen.has(key)) return;
    seen.add(key);
    let person: Row | undefined;
    const head = raw.head ?? raw.decisionMaker;
    if (present(head)) {
      const id = stableId("person:" + c.id + ":" + str(head));
      person = out.people.find((x) => x.id === id);
      if (!person) {
        person = {
          id,
          company_id: c.id,
          first_name: str(head),
          last_name: null,
          position: null,
          phone: raw.phone ?? null,
          email: raw.email ?? null,
          source: raw.source ?? null,
          verified_at: date(raw.checkedAt),
          notes: raw.note ?? null,
        };
        out.people.push(person);
      }
    }
    out.project_participants.push({
      id: stableId("participant:" + key),
      project_id: p.id,
      company_id: c.id,
      role,
      person_id: person?.id ?? null,
      comment: raw.note ?? null,
      source: raw.source ?? null,
      verified_at: date(raw.checkedAt),
      legacy: raw,
    });
  }
  for (const raw of projects) {
    const p: Project = {
      id: str(raw.id),
      name: str(raw.name),
      region: str(raw.region) || null,
      address: str(raw.address) || null,
      stage: str(raw.stage) || null,
      priority: str(raw.priority) || null,
      category: str(raw.category) || null,
      type: raw.type ?? null,
      district: raw.district ?? null,
      area_m2: raw.areaM2 ?? null,
      lat: typeof raw.lat === "number" ? raw.lat : null,
      lng: typeof raw.lng === "number" ? raw.lng : null,
      start_date: raw.startDate ?? null,
      deadline: raw.deadline ?? null,
      description: raw.notes ?? null,
      verified_at: date(raw.checkedAt),
      legacy: raw,
    };
    out.projects.push(p);
    for (const [field, role, prefix] of [
      ["client", "Заказчик", "client"],
      ["developer", "Застройщик", "developer"],
      ["designer", "Проектировщик", "designer"],
      ["contractor", "Генеральный подрядчик", "contractor"],
    ]) {
      const c = company(raw[field], raw[prefix + "TaxId"], {
        phone: raw[prefix + "Phone"],
        email: raw[prefix + "Email"],
        source: raw.sourceParticipants,
        checkedAt: raw.checkedAt,
      });
      if (c) link(p, c, role, {});
    }
    for (const field of [
      "sourceProject",
      "sourceParticipants",
      "shaffofUrl",
      "expertiseUrl",
      "website",
    ])
      if (present(raw[field]))
        out.sources.push({
          id: stableId("source:" + p.id + ":" + field),
          project_id: p.id,
          company_id: null,
          raw: null,
          name: field,
          url: str(raw[field]),
          verified_at: date(raw.checkedAt),
        });
  }
  // Authoritative INN matches are preferred. Names without INN are intentionally not merged into conflicting legal identities.
  for (const raw of participants) {
    const c = company(raw.organization, raw.taxId, raw);
    if (!c) continue;
    out.sources.push({
      id: stableId("participant-source:" + JSON.stringify(raw)),
      project_id: null,
      company_id: c.id,
      name: "Участник: " + str(raw.organization),
      url: present(raw.source) ? str(raw.source) : null,
      verified_at: date(raw.checkedAt),
      raw,
    });
    for (const objectId of (raw.objectIds ?? []) as string[]) {
      const ps = out.projects.filter(
        (p) => str(p.legacy.shaffofId) === str(objectId),
      );
      if (!ps.length)
        warnings.push(`Unlinked participant ${c.id}: Shaffof ${objectId}`);
      for (const p of ps) link(p, c, str(raw.role) || "Другое", raw);
    }
  }
  // Preserve any embedded links absent from the participants export.
  for (const p of out.projects)
    for (const raw of (p.legacy.participantLinks ?? []) as Legacy[]) {
      const c = company(raw.organization, raw.taxId, raw);
      if (c) link(p, c, str(raw.role) || "Другое", raw);
    }
  return {
    data: out,
    report: {
      "Projects imported": out.projects.length,
      "Companies created": out.companies.length,
      "Companies matched": matched,
      "Participants created": out.project_participants.length,
      "Coordinates imported": out.projects.filter(
        (p) => p.lat !== null && p.lng !== null,
      ).length,
      Warnings: [...new Set(warnings)],
    },
  };
}
function date(v: unknown) {
  const s = str(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) return s.split(".").reverse().join("-");
  return null;
}
