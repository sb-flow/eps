import { type Row, str } from "../types";
import { companyScore } from "../search";
// Conservative deterministic candidate selection. A reviewer confirms every proposed match.
export type ProductMatch = {
  specification_item_id: string;
  product_id: string | null;
  confidence: number;
  reason: string;
  match_status: string;
};
export function matchProducts(item: Row, products: Row[]): ProductMatch[] {
  const candidates = products
    .map((p) => {
      const exact = Boolean(
        item.article &&
        p.article &&
        str(item.article).toLowerCase() === str(p.article).toLowerCase() &&
        item.manufacturer &&
        str(item.manufacturer).toLowerCase() ===
          str(p.manufacturer).toLowerCase(),
      );
      const conflicts = ["dn", "pn", "kvs"].filter(
        (k) =>
          item[k] != null && p[k] != null && Number(item[k]) !== Number(p[k]),
      );
      const score = conflicts.length
        ? 0
        : exact
          ? 0.99
          : companyScore(
              str(item.normalized_name || item.original_name),
              str(p.name),
            ) * 0.7;
      return {
        specification_item_id: item.id,
        product_id: p.id,
        confidence: score,
        reason: exact
          ? "Артикул и производитель совпали. Проверьте все технические параметры."
          : "Кандидат по названию; техническая эквивалентность не подтверждена.",
        match_status:
          Number(item.confidence) < 0.8 ? "manual_review" : "suggested",
      };
    })
    .filter((x) => x.confidence >= 0.4)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
  return candidates.length
    ? candidates
    : [
        {
          specification_item_id: item.id,
          product_id: null,
          confidence: 0,
          reason: "Подходящий товар не найден",
          match_status: "unmatched",
        },
      ];
}
