"use client";
import { useState } from "react";
import Link from "next/link";
import { type Snapshot, type Row, str } from "@/lib/types";
import { companyScore } from "@/lib/search";
import { Modal, RecordForm } from "./forms";
export function Companies({
  data,
  editable,
  companyId,
}: {
  data: Snapshot;
  editable: boolean;
  companyId?: string;
}) {
  const [query, setQuery] = useState("");
  const [editingContact, setEditingContact] = useState<Row | undefined>();
  const [form, setForm] = useState("");
  const company = data.companies.find((c) => c.id === companyId);
  const linked = data.project_participants.filter(
    (p) => p.company_id === companyId,
  );
  return (
    <main className="page">
      <div className="toolbar">
        <h1>{company?.name || "Компании"}</h1>
        <button disabled={!editable} onClick={() => setForm("companies")}>
          {company ? "Редактировать" : "+ Добавить компанию"}
        </button>
      </div>
      {company ? (
        <>
          <div className="panel">
            <dl className="details">
              {Object.entries(company)
                .filter(
                  ([k, v]) =>
                    !["id", "legacy", "normalized_name"].includes(k) &&
                    v !== null,
                )
                .map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{str(v)}</dd>
                  </div>
                ))}
            </dl>
          </div>
          <h2>Связанные объекты</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Объект</th>
                  <th>Роль</th>
                  <th>Разделы</th>
                </tr>
              </thead>
              <tbody>
                {linked.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/projects/${p.project_id}`}>
                        {data.projects.find((x) => x.id === p.project_id)?.name}
                      </Link>
                    </td>
                    <td>{str(p.role)}</td>
                    <td>
                      {data.project_participant_sections
                        .filter((s) => s.participant_id === p.id)
                        .map((s) => s.section)
                        .join(", ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="toolbar">
            <h2>Контакты</h2>
            <button
              disabled={!editable}
              onClick={() => {
                setEditingContact(undefined);
                setForm("people");
              }}
            >
              + Контакт
            </button>
          </div>
          {data.people
            .filter((p) => p.company_id === companyId)
            .map((p) => (
              <div className="panel" key={p.id}>
                <b>
                  {str(p.first_name)} {str(p.last_name)}
                </b>
                <p>
                  {str(p.position)} · {str(p.phone)} · {str(p.email)} ·{" "}
                  {str(p.telegram)} · {str(p.whatsapp)}
                </p>
                <button
                  disabled={!editable}
                  onClick={() => {
                    setEditingContact(p);
                    setForm("people");
                  }}
                >
                  Редактировать контакт
                </button>
              </div>
            ))}
          <div className="toolbar">
            <h2>Активности</h2>
            <button disabled={!editable} onClick={() => setForm("activities")}>
              + Активность
            </button>
          </div>
          {data.activities
            .filter(
              (a) =>
                a.company_id === companyId ||
                linked.some((p) => p.project_id === a.project_id),
            )
            .map((a) => (
              <div className="panel" key={a.id}>
                {str(a.type)} · {str(a.date)}
                <p>{str(a.description)}</p>
              </div>
            ))}
        </>
      ) : (
        <>
          <input
            aria-label="Поиск компаний"
            placeholder="Название или ИНН…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="table-wrap" style={{ marginTop: 15 }}>
            <table>
              <thead>
                <tr>
                  <th>Компания</th>
                  <th>ИНН</th>
                  <th>Телефон</th>
                  <th>Объектов</th>
                </tr>
              </thead>
              <tbody>
                {data.companies
                  .filter(
                    (c) =>
                      !query ||
                      companyScore(query, c.name) > 0.48 ||
                      c.inn?.includes(query),
                  )
                  .map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/companies/${c.id}`}>{c.name}</Link>
                      </td>
                      <td>{c.inn || "—"}</td>
                      <td>{str(c.main_phone) || "—"}</td>
                      <td>
                        {
                          new Set(
                            data.project_participants
                              .filter((p) => p.company_id === c.id)
                              .map((p) => p.project_id),
                          ).size
                        }
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {form && (
        <Modal
          title={
            form === "companies"
              ? "Компания"
              : form === "people"
                ? "Контакт"
                : "Активность"
          }
          onClose={() => setForm("")}
        >
          <RecordForm
            table={form}
            initial={
              form === "companies" && company
                ? company
                : form === "people" && editingContact
                  ? editingContact
                  : {}
            }
            data={data}
            companyId={companyId}
            onClose={() => setForm("")}
          />
        </Modal>
      )}
    </main>
  );
}
