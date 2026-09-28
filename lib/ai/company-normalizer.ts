import "server-only";
import { normalizeCompany } from "../search";
import type { RegistryResult } from "../registry/provider";
// Deterministic normalization is sufficient here: legal attributes come only from the registry.
export function normalizeRegistryCompany(record: RegistryResult) {
  return { ...record, normalized_name: normalizeCompany(record.name) };
}
