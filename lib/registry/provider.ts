import "server-only";
import { z } from "zod";
const resultSchema = z.object({
  inn: z.string().regex(/^\d{9}$/),
  name: z.string(),
  legal_name: z.string().nullable(),
  legal_address: z.string().nullable(),
  oked: z.string().nullable(),
  registration_number: z.string().nullable(),
  source_url: z.string().url(),
});
export type RegistryResult = z.infer<typeof resultSchema> & {
  provider: string;
  verified_at: string;
  raw: unknown;
};
export interface CompanyRegistryProvider {
  lookupByInn(inn: string): Promise<RegistryResult | null>;
}
export class DevRegistryProvider implements CompanyRegistryProvider {
  async lookupByInn(inn: string) {
    z.string()
      .regex(/^\d{9}$/)
      .parse(inn);
    return null;
  }
}
export class HttpRegistryProvider implements CompanyRegistryProvider {
  async lookupByInn(inn: string) {
    z.string()
      .regex(/^\d{9}$/)
      .parse(inn);
    const url = new URL(process.env.COMPANY_REGISTRY_URL!);
    if (url.protocol !== "https:") throw Error("Registry requires HTTPS");
    url.searchParams.set("inn", inn);
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.COMPANY_REGISTRY_TOKEN ?? ""}`,
      },
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (res.status === 404) return null;
    if (!res.ok) throw Error("Registry unavailable");
    const raw = await res.json();
    const result = resultSchema.parse(raw);
    if (result.inn !== inn) throw Error("Registry INN mismatch");
    return {
      ...result,
      provider: url.hostname,
      verified_at: new Date().toISOString().slice(0, 10),
      raw,
    };
  }
}
export const registry: CompanyRegistryProvider = process.env
  .COMPANY_REGISTRY_URL
  ? new HttpRegistryProvider()
  : new DevRegistryProvider();
