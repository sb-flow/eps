"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { type Snapshot, type Row, str, sections } from "@/lib/types";
import { Calculation } from "./calculation";
import { Modal, mutate } from "./forms";
export function Specifications({
  data,
  projectId,
  editable,
}: {
  data: Snapshot;
  projectId?: string;
  editable: boolean;
}) {
  const [calculation, setCalculation] = useState<{
    item: Row;
    projectId: string;
  } | null>(null);
  const [upload, setUpload] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const specs = data.specifications.filter(
    (s) => !projectId || s.project_id === projectId,
  );
  async function parse(id: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/specifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const result = await res.json();
      if (!res.ok) throw Error(result.error);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="toolbar">
        <h2>Спецификации</h2>
        <button
          className="primary"
          disabled={!editable}
          onClick={() => setUpload(true)}
        >
          + Загрузить спецификацию
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!specs.length && (
        <div className="panel empty">Спецификации пока не загружены.</div>
      )}
      {specs.map((s) => (
        <article key={s.id} className="panel">
          <div className="toolbar">
            <div>
              <b>{str(s.name)}</b>
              <p className="muted">
                {str(s.section)} · {str(s.status)} · {str(s.created_at)} ·
                Загрузил:{" "}
                {(data.profiles.find((p) => p.id === s.uploader)
                  ?.display_name as string) || str(s.uploader)}
              </p>
              <p>Источник: {str(s.source) || "—"}</p>
            </div>
            <div className="row">
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/specifications?id=${s.id}`);
                    const r = await res.json();
                    if (!res.ok) throw Error(r.error);
                    window.open(r.url, "_blank", "noopener,noreferrer");
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Оригинал
              </button>
              <button
                disabled={
                  !editable ||
                  busy ||
                  !["uploaded", "failed"].includes(str(s.status))
                }
                onClick={() => parse(s.id)}
              >
                AI-разбор
              </button>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {[
                    "Оригинал / нормализация",
                    "Параметры",
                    "Кол-во",
                    "Уверенность",
                    "Подбор товаров",
                  ].map((s) => (
                    <th key={s}>{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.specification_items
                  .filter((i) => i.specification_id === s.id)
                  .map((i) => (
                    <tr key={i.id}>
                      <td>
                        <b>{str(i.original_name)}</b>
                        <p>{str(i.normalized_name)}</p>
                        <p className="muted">
                          {str(i.manufacturer)} {str(i.model)} {str(i.article)}
                        </p>
                      </td>
                      <td>
                        {["dn", "pn", "kvs", "voltage", "power"]
                          .filter((k) => i[k] != null)
                          .map((k) => (
                            <p key={k}>
                              {k.toUpperCase()}: {str(i[k])}
                            </p>
                          ))}
                        <p>{str(i.notes)}</p>
                      </td>
                      <td>
                        {i.quantity == null ? "—" : str(i.quantity)}{" "}
                        {str(i.unit)}
                        <p>
                          <button
                            disabled={!editable}
                            onClick={() =>
                              setCalculation({
                                item: i,
                                projectId: str(s.project_id),
                              })
                            }
                          >
                            Рассчитать
                          </button>
                        </p>
                      </td>
                      <td>
                        {Math.round(Number(i.confidence) * 100)}%
                        {Number(i.confidence) < 0.8 && (
                          <p className="badge">Ручная проверка</p>
                        )}
                      </td>
                      <td>
                        {data.product_matches
                          .filter((m) => m.specification_item_id === i.id)
                          .map((m) => (
                            <div key={m.id}>
                              <b>
                                {(data.products.find(
                                  (p) => p.id === m.product_id,
                                )?.name as string) || "Не найдено"}
                              </b>
                              <p>
                                {str(m.match_status)} ·{" "}
                                {Math.round(Number(m.confidence) * 100)}%
                              </p>
                              <p className="muted">{str(m.reason)}</p>
                              {editable &&
                                m.product_id != null &&
                                !["matched", "rejected"].includes(
                                  str(m.match_status),
                                ) && (
                                  <div className="row">
                                    {["matched", "rejected"].map((status) => (
                                      <button
                                        key={status}
                                        disabled={busy}
                                        onClick={async () => {
                                          setBusy(true);
                                          try {
                                            await mutate({
                                              action: "review",
                                              data: {
                                                id: m.id,
                                                match_status: status,
                                              },
                                            });
                                            router.refresh();
                                          } catch (e) {
                                            setError((e as Error).message);
                                          } finally {
                                            setBusy(false);
                                          }
                                        }}
                                      >
                                        {status === "matched"
                                          ? "Подтвердить параметры"
                                          : "Отклонить"}
                                      </button>
                                    ))}
                                  </div>
                                )}
                            </div>
                          ))}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </article>
      ))}
      {calculation && (
        <Modal title="Расчёт позиции" onClose={() => setCalculation(null)}>
          <Calculation
            projectId={calculation.projectId}
            item={calculation.item}
            onClose={() => setCalculation(null)}
          />
        </Modal>
      )}
      {upload && (
        <Modal title="Загрузить спецификацию" onClose={() => setUpload(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                const res = await fetch("/api/specifications", {
                  method: "POST",
                  body: new FormData(e.currentTarget),
                });
                const r = await res.json();
                if (!res.ok) throw Error(r.error);
                setUpload(false);
                router.refresh();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Объект
              <select name="project_id" required defaultValue={projectId ?? ""}>
                <option value="">Выберите объект</option>
                {data.projects.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Раздел
              <select name="section">
                {sections.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Источник
              <input name="source" />
            </label>
            <label>
              Файл · до 4 МБ
              <input
                type="file"
                name="file"
                accept=".xlsx,.xls,.csv,.pdf,.docx"
                required
              />
            </label>
            <p>
              Оригинал сохраняется в закрытом Supabase Storage. AI-разбор
              запускается отдельно и передаёт документ OpenAI.
            </p>
            {error && <p className="error">{error}</p>}
            <button className="primary" disabled={busy}>
              {busy ? "Загрузка…" : "Сохранить оригинал"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
