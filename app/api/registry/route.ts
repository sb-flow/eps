import { requireEditor } from "@/lib/supabase/server";
import { registry } from "@/lib/registry/provider";
import { normalizeRegistryCompany } from "@/lib/ai/company-normalizer";
export async function GET(request: Request) {
  try {
    await requireEditor();
    const inn = new URL(request.url).searchParams.get("inn") ?? "";
    const record = await registry.lookupByInn(inn);
    return Response.json(
      record
        ? normalizeRegistryCompany(record)
        : {
            message:
              "Запись не найдена. Настройте registry provider; dev provider не выдаёт вымышленные реквизиты.",
          },
    );
  } catch {
    return Response.json(
      {
        error:
          "Не удалось получить реквизиты. Проверьте ИНН, доступ и provider.",
      },
      { status: 400 },
    );
  }
}
