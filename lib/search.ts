import { type Project, type Snapshot, present, str } from "./types";
const translit: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
  қ: "q",
  ғ: "g",
  ў: "o",
  ҳ: "h",
};
export function normalizeCompany(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .split("")
    .map((c) => translit[c] ?? c)
    .join("")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(sp|ooo|ooо|llc|mchj|ltd|ao|oao|aj|xk)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
export function companyScore(a: string, b: string) {
  a = normalizeCompany(a);
  b = normalizeCompany(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const grams = (s: string) =>
    Array.from({ length: Math.max(0, s.length - 1) }, (_, i) =>
      s.slice(i, i + 2),
    );
  const x = grams(a),
    y = grams(b);
  let n = 0;
  for (const g of x) {
    const i = y.indexOf(g);
    if (i >= 0) {
      n++;
      y.splice(i, 1);
    }
  }
  return Math.max(
    (2 * n) / Math.max(1, x.length + b.length - 1),
    b.includes(a) && a.length >= 4 ? 0.9 : 0,
  );
}
export function projectSearchText(p: Project, s: Snapshot) {
  const participants = s.project_participants.filter(
    (x) => x.project_id === p.id,
  );
  const ids = new Set(participants.map((x) => x.company_id));
  const people = s.people.filter(
    (x) =>
      ids.has(x.company_id) || participants.some((y) => y.person_id === x.id),
  );
  return normalizeCompany(
    JSON.stringify([
      p,
      ...s.companies.filter((c) => ids.has(c.id)),
      ...people,
      ...s.sources.filter((x) => x.project_id === p.id),
    ]),
  );
}
export function hasContacts(p: Project, s: Snapshot) {
  const ids = new Set(
    s.project_participants
      .filter((x) => x.project_id === p.id)
      .map((x) => x.company_id),
  );
  return (
    [
      "phone",
      "email",
      "clientPhone",
      "clientEmail",
      "designerPhone",
      "designerEmail",
      "contractorPhone",
      "contractorEmail",
    ].some((k) => present(p.legacy[k])) ||
    s.companies.some(
      (c) => ids.has(c.id) && (present(c.main_phone) || present(c.main_email)),
    ) ||
    s.people.some(
      (c) => ids.has(c.company_id) && (present(c.phone) || present(c.email)),
    )
  );
}
export function roleCompanies(p: Project, s: Snapshot, role: string) {
  return s.project_participants
    .filter(
      (x) => x.project_id === p.id && (!role || str(x.role).includes(role)),
    )
    .map((x) => s.companies.find((c) => c.id === x.company_id))
    .filter((x) => x !== undefined);
}
