"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { type Snapshot, type Row, str, roles, sections } from "@/lib/types";
import { companyScore } from "@/lib/search";
export async function mutate(body: unknown) {
  const res = await fetch("/api/crm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await res.json();
  if (!res.ok) throw Error(result.error || "Ошибка сохранения");
  return result;
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        <div className="toolbar">
          <h2>{title}</h2>
          <button onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
const fields: Record<string, string[][]> = {
  companies: [
    ["name", "Название"],
    ["inn", "ИНН"],
    ["legal_name", "Юридическое название"],
    ["oked", "ОКЭД"],
    ["registration_number", "Регистрационный номер"],
    ["legal_address", "Юридический адрес"],
    ["actual_address", "Фактический адрес"],
    ["website", "Сайт"],
    ["main_phone", "Телефон"],
    ["main_email", "Email"],
    ["country", "Страна"],
    ["region", "Регион"],
    ["notes", "Примечания"],
    ["source", "Источник"],
    ["source_url", "URL источника"],
    ["verified_at", "Дата проверки", "date"],
  ],
  people: [
    ["first_name", "Имя / полное имя"],
    ["last_name", "Фамилия"],
    ["position", "Должность"],
    ["phone", "Телефон"],
    ["additional_phone", "Доп. телефон"],
    ["email", "Email"],
    ["telegram", "Telegram"],
    ["whatsapp", "WhatsApp"],
    ["notes", "Примечание"],
    ["source", "Источник"],
    ["verified_at", "Дата проверки", "date"],
  ],
  projects: [
    ["name", "Название"],
    ["type", "Тип"],
    ["category", "Категория"],
    ["region", "Регион"],
    ["district", "Район"],
    ["address", "Адрес"],
    ["stage", "Стадия"],
    ["priority", "Приоритет"],
    ["area_m2", "Площадь", "number"],
    ["lat", "Широта", "number"],
    ["lng", "Долгота", "number"],
    ["start_date", "Начало строительства"],
    ["deadline", "Срок сдачи"],
    ["description", "Описание"],
    ["verified_at", "Дата проверки", "date"],
  ],
  activities: [
    ["type", "Тип активности"],
    ["description", "Описание"],
    ["date", "Дата", "datetime-local"],
    ["next_action", "Следующий шаг"],
    ["next_action_date", "Дата следующего шага", "date"],
  ],
  products: [
    ["name", "Название"],
    ["manufacturer", "Производитель"],
    ["brand", "Бренд"],
    ["article", "Артикул"],
    ["category", "Категория"],
    ["description", "Описание"],
    ["dn", "DN", "number"],
    ["pn", "PN", "number"],
    ["kvs", "Kvs", "number"],
    ["purchase_price", "Закупочная цена", "number"],
    ["sales_price", "Цена продажи", "number"],
    ["currency", "Валюта (UZS, USD…)"],
  ],
};
export function RecordForm({
  table,
  data,
  initial = {},
  onClose,
  projectId,
  companyId,
}: {
  table: string;
  data: Snapshot;
  initial?: Partial<Row>;
  onClose: () => void;
  projectId?: string;
  companyId?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, unknown>>(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [registryMessage, setRegistryMessage] = useState("");
  const [selectedCompany, setSelectedCompany] = useState(
    companyId ?? str(initial.company_id),
  );
  const [ack, setAck] = useState(false);
  const matches =
    table === "companies" && str(values.name).length > 1
      ? data.companies
          .filter((c) => c.id !== initial.id)
          .map((c) => ({ ...c, score: companyScore(str(values.name), c.name) }))
          .filter((c) => c.score > 0.48 || c.inn === values.inn)
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)
      : [];
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload: Record<string, unknown> = {};
      for (const [key, , type] of fields[table])
        payload[key] =
          type === "number"
            ? str(values[key]) === ""
              ? null
              : Number(values[key])
            : str(values[key]) || null;
      if (table === "companies" && values.provider) {
        payload.registry_provider = values.provider;
        payload.registry_response = values.raw;
      }
      if (table === "people") payload.company_id = selectedCompany;
      if (table === "projects") payload.owner_id = str(values.owner_id) || null;
      if (table === "activities") {
        payload.project_id = projectId;
        payload.company_id = selectedCompany || null;
        payload.person_id = str(values.person_id) || null;
        if (payload.date)
          payload.date = new Date(str(payload.date)).toISOString();
        if (!payload.date) delete payload.date;
      }
      await mutate({ table, id: initial.id, data: payload });
      router.refresh();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        {table === "people" && (
          <label className="span-all">
            Компания
            <select
              required
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
            >
              <option value="">Выберите</option>
              {data.companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {table === "activities" && (
          <>
            <label>
              Компания
              <select
                value={selectedCompany}
                onChange={(e) => {
                  setSelectedCompany(e.target.value);
                  setValues({ ...values, person_id: "" });
                }}
              >
                <option value="">Не выбрана</option>
                {data.companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Контакт
              <select
                value={str(values.person_id)}
                onChange={(e) =>
                  setValues({ ...values, person_id: e.target.value })
                }
              >
                <option value="">Не выбран</option>
                {data.people
                  .filter((p) => p.company_id === selectedCompany)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {str(p.first_name)}
                    </option>
                  ))}
              </select>
            </label>
          </>
        )}
        {table === "projects" && (
          <label>
            Ответственный
            <select
              value={str(values.owner_id)}
              onChange={(e) =>
                setValues({ ...values, owner_id: e.target.value })
              }
            >
              <option value="">Не назначен</option>
              {data.profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {str(p.display_name) || p.id}
                </option>
              ))}
            </select>
          </label>
        )}
        {fields[table].map(([key, label, type]) => (
          <label key={key}>
            {label}
            <input
              required={
                [
                  "name",
                  "first_name",
                  "type",
                  "description",
                  "currency",
                ].includes(key) &&
                !(key === "type" && table === "projects") &&
                !(key === "description" && table !== "activities")
              }
              value={str(values[key])}
              type={type ?? "text"}
              step={type === "number" ? "any" : undefined}
              list={
                table === "activities" && key === "type"
                  ? "activity-types"
                  : undefined
              }
              onChange={(e) => {
                setValues({ ...values, [key]: e.target.value });
                if (key === "name" || key === "inn") setAck(false);
              }}
            />
          </label>
        ))}
      </div>
      <datalist id="activity-types">
        {[
          "Звонок",
          "Встреча",
          "Email",
          "Telegram/WhatsApp",
          "Комментарий",
          "Изменение стадии",
          "Получение спецификации",
          "Коммерческое предложение",
          "Следующий шаг",
        ].map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      {table === "companies" && (
        <>
          <div className="toolbar">
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const res = await fetch(
                    `/api/registry?inn=${encodeURIComponent(str(values.inn))}`,
                  );
                  const r = await res.json();
                  if (r.error) throw Error(r.error);
                  if (r.message) setRegistryMessage(r.message);
                  else {
                    setValues({ ...values, ...r, source: r.provider });
                    setRegistryMessage(
                      "Реквизиты получены из реестра. Проверьте перед сохранением.",
                    );
                  }
                } catch (e) {
                  setRegistryMessage((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Заполнить по ИНН
            </button>
          </div>
          <p>{registryMessage}</p>
          {matches.length > 0 && (
            <div className="notice">
              <b>Возможно, компания уже есть · Возможные совпадения</b>
              {matches.map((c) => (
                <p key={c.id}>
                  <a href={`/companies/${c.id}`}>{c.name}</a> ·{" "}
                  {c.inn || "ИНН не указан"} · {Math.round(c.score * 100)}%
                </p>
              ))}
              <label className="row">
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                />
                Проверено: создать отдельную компанию
              </label>
            </div>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="toolbar">
        <button type="button" onClick={onClose}>
          Отмена
        </button>
        <button
          className="primary"
          disabled={busy || (matches.length > 0 && !ack)}
        >
          Сохранить
        </button>
      </div>
    </form>
  );
}
export function ParticipantForm({
  data,
  projectId,
  onClose,
}: {
  data: Snapshot;
  projectId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [company, setCompany] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState<"companies" | "people" | null>(null);
  const matches = data.companies
    .map((c) => ({
      ...c,
      score: query
        ? Math.max(companyScore(query, c.name), c.inn?.includes(query) ? 1 : 0)
        : 1,
    }))
    .filter((c) => c.score > 0.48)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
  return (
    <>
      {creating && (
        <Modal
          title={creating === "companies" ? "Новая компания" : "Новый контакт"}
          onClose={() => setCreating(null)}
        >
          <RecordForm
            table={creating}
            data={data}
            companyId={company}
            onClose={() => setCreating(null)}
          />
        </Modal>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const f = new FormData(e.currentTarget);
          try {
            await mutate({
              action: "participant",
              data: {
                project_id: projectId,
                company_id: company,
                role: f.get("role"),
                person_id: f.get("person_id") || null,
                comment: f.get("comment") || null,
                source: f.get("source") || null,
                verified_at: f.get("verified_at") || null,
              },
              sections: f.getAll("sections"),
            });
            router.refresh();
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Роль
          <select name="role">
            {roles.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label>
          Поиск компании / ИНН
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Начните вводить название"
          />
        </label>
        <p className="muted">
          Возможные совпадения. Выберите существующую компанию или проверьте
          реквизиты новой.
        </p>
        <select
          value={company}
          required
          onChange={(e) => setCompany(e.target.value)}
          aria-label="Компания"
        >
          <option value="">Выберите компанию</option>
          {matches.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.inn || "без ИНН"}{" "}
              {query ? `· ${Math.round(c.score * 100)}%` : ""}
            </option>
          ))}
          {company && !matches.some((c) => c.id === company) && (
            <option value={company}>
              {data.companies.find((c) => c.id === company)?.name}
            </option>
          )}
        </select>
        <div className="toolbar">
          <button type="button" onClick={() => setCreating("companies")}>
            + Компания
          </button>
          <button
            type="button"
            disabled={!company}
            onClick={() => setCreating("people")}
          >
            + Контакт
          </button>
        </div>
        <label>
          Контактное лицо
          <select key={company} name="person_id">
            <option value="">Не выбран</option>
            {data.people
              .filter((p) => p.company_id === company)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {str(p.first_name)} · {str(p.position)} · {str(p.phone)}
                </option>
              ))}
          </select>
        </label>
        <h3>Разделы</h3>
        <div className="checks">
          {sections.map((s) => (
            <label key={s}>
              <input type="checkbox" name="sections" value={s} />
              {s}
            </label>
          ))}
        </div>
        <label>
          Комментарий
          <textarea name="comment" />
        </label>
        <div className="form-grid">
          <label>
            Источник
            <input name="source" />
          </label>
          <label>
            Дата проверки
            <input type="date" name="verified_at" />
          </label>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="toolbar">
          <button className="primary" disabled={busy || !company}>
            Добавить участника
          </button>
        </div>
      </form>
    </>
  );
}
