import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { importLegacy } from "../lib/import-legacy";
import {
  normalizeCompany,
  companyScore,
  projectSearchText,
  hasContacts,
} from "../lib/search";
import { calculate } from "../lib/finance";
import { matchProducts } from "../lib/ai/product-matcher";
const projects = JSON.parse(readFileSync("data/projects.json", "utf8"));
const participants = JSON.parse(readFileSync("data/participants.json", "utf8"));
test("real dataset preserves every project, coordinate and original field; deterministic IDs", () => {
  const a = importLegacy(projects, participants),
    b = importLegacy(projects, participants);
  assert.equal(a.data.projects.length, 372);
  assert.equal(a.report["Coordinates imported"], 331);
  assert.deepEqual(a, b);
  assert.deepEqual(
    a.data.sources.filter((s) => s.raw).map((s) => s.raw),
    participants,
  );
  for (const p of a.data.projects) {
    const raw = projects.find((x: { id: string }) => x.id === p.id);
    assert.deepEqual(p.legacy, raw);
    assert.equal(p.lat, raw.lat);
    assert.equal(p.lng, raw.lng);
  }
  assert.equal(
    new Set(a.data.project_participants.map((p) => p.id)).size,
    a.data.project_participants.length,
  );
  assert.equal(
    new Set(a.data.companies.filter((c) => c.inn).map((c) => c.inn)).size,
    a.data.companies.filter((c) => c.inn).length,
  );
});
test("company normalization folds legal forms, punctuation and Cyrillic", () => {
  assert.equal(
    normalizeCompany("OOO TASH BUILD"),
    normalizeCompany('"TASH BUILD" MCHJ'),
  );
  assert.ok(companyScore("ООО «Таш Билд»", "TASH BUILD LLC") > 0.7);
  assert.equal(companyScore("", ""), 0);
  assert.equal(normalizeCompany("СП ООО «Таш-Билд»"), "tash bild");
});
test("missing values stay unknown and financial arithmetic is deterministic", () => {
  const input = {
    quantity: 4,
    purchase_price: 100,
    sales_price: null,
    delivery: 20,
    customs_duty: 10,
    certification: 0,
    additional_costs: 0,
    vat: 12,
    markup: 25,
    currency: "UZS",
  };
  assert.equal(calculate(input).total, 602);
  assert.throws(() =>
    calculate({ ...input, quantity: 1e12, purchase_price: 1e12 }),
  );
  assert.equal(calculate({ ...input, quantity: null }).total, null);
  assert.equal(calculate({ ...input, purchase_price: null }).total, null);
  assert.equal(
    calculate({ ...input, quantity: 0, delivery: 0, customs_duty: 0 }).total,
    0,
  );
  assert.throws(() => calculate({ ...input, quantity: -1 }));
  assert.equal(calculate({ ...input, sales_price: 150 }).total, 672);
});
test("search includes district, source, people and placeholders are not contacts", () => {
  const { data } = importLegacy(
    [
      {
        id: "a",
        name: "Test",
        district: "Mirzo",
        sourceProject: "https://example.test/source",
        phone: "—",
      },
    ],
    [],
  );
  const p = data.projects[0];
  assert.match(projectSearchText(p, data), /mirzo/);
  assert.match(projectSearchText(p, data), /example/);
  assert.equal(hasContacts(p, data), false);
});
test("matching rejects conflicting dimensions and never asserts equivalence automatically", () => {
  const item = {
    id: "i",
    original_name: "Valve",
    manufacturer: "A",
    article: "42",
    dn: 50,
    confidence: 0.99,
  };
  assert.equal(
    matchProducts(item, [
      { id: "p", name: "Valve", manufacturer: "A", article: "42", dn: 25 },
    ])[0].match_status,
    "unmatched",
  );
  assert.equal(
    matchProducts(item, [
      { id: "p", name: "Valve", manufacturer: "A", article: "42", dn: 50 },
    ])[0].match_status,
    "suggested",
  );
  assert.equal(
    matchProducts({ ...item, confidence: 0.4 }, [
      { id: "p", name: "Valve", manufacturer: "A", article: "42", dn: 50 },
    ])[0].match_status,
    "manual_review",
  );
});
