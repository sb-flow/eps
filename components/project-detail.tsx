"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { type Snapshot, type Project, str, sections } from "@/lib/types";
import { Modal, RecordForm, ParticipantForm, mutate } from "./forms";
import { Specifications } from "./specifications";
import { Calculation } from "./calculation";
import { ProjectMap } from "./map";
const tabs = [
  "Обзор",
  "Участники",
  "Разделы",
  "Спецификации",
  "Возможности",
  "Контакты",
  "Активности",
  "История",
];
export function ProjectDetail({
  data,
  project,
  editable,
  mode,
}: {
  data: Snapshot;
  project: Project;
  editable: boolean;
  mode: string;
}) {
  const router = useRouter();
  const [sectionError, setSectionError] = useState("");
  const [tab, setTab] = useState("Обзор");
  const [form, setForm] = useState("");
  const participants = data.project_participants.filter(
    (p) => p.project_id === project.id,
  );
  const companyIds = new Set(participants.map((p) => p.company_id));
  const people = data.people.filter(
    (p) =>
      companyIds.has(p.company_id) ||
      participants.some((x) => x.person_id === p.id),
  );
  const specs = data.specifications.filter((s) => s.project_id === project.id);
  const opportunities = data.opportunities.filter(
    (o) => o.project_id === project.id,
  );
  const sourceLinks = data.sources.filter((s) => s.project_id === project.id);
  return (
    <main className="page">
      {mode === "demo" && (
        <div className="notice">
          Просмотр исходной базы. Изменения доступны после настройки Supabase.
        </div>
      )}
      <Link href="/">← Все объекты</Link>
      <div className="toolbar">
        <div className="project-title">
          <p className="muted">
            {project.id} · {project.region}{" "}
            <span className="badge">{project.priority}</span>
          </p>
          <h1>{project.name}</h1>
        </div>
        <button disabled={!editable} onClick={() => setForm("projects")}>
          Редактировать
        </button>
      </div>
      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? "active" : ""}
            key={t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {sectionError && <p className="error">{sectionError}</p>}
      {tab === "Обзор" && (
        <>
          <div className="panel">
            <dl className="details">
              {[
                ["type", "Тип"],
                ["address", "Адрес"],
                ["region", "Регион"],
                ["district", "Район"],
                ["area_m2", "Площадь, м²"],
                ["stage", "Стадия"],
                ["start_date", "Начало строительства"],
                ["deadline", "Срок сдачи"],
                ["lat", "Широта"],
                ["lng", "Долгота"],
                ["verified_at", "Последняя проверка"],
                ["priority", "Приоритет"],
                ["description", "Описание"],
              ].map(([k, label]) => (
                <div key={k}>
                  <dt>{label}</dt>
                  <dd>{str(project[k]) || "—"}</dd>
                </div>
              ))}
              <div>
                <dt>Ответственный</dt>
                <dd>
                  {str(
                    data.profiles.find((p) => p.id === project.owner_id)
                      ?.display_name,
                  ) || "Не назначен"}
                </dd>
              </div>
            </dl>
          </div>
          <div className="panel">
            <h3>Источники</h3>
            {sourceLinks.map((s) => (
              <p key={s.id}>
                {/^https?:\/\//.test(str(s.url)) ? (
                  <a href={str(s.url)} target="_blank" rel="noreferrer">
                    {str(s.name)} ↗
                  </a>
                ) : (
                  str(s.url)
                )}
              </p>
            ))}
          </div>
          <ProjectMap projects={[project]} />
          <details className="panel">
            <summary>Все исходные сведения (сохранены без изменений)</summary>
            <dl className="details">
              {Object.entries(project.legacy)
                .filter(([, v]) => v !== null && typeof v !== "object")
                .map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{str(v)}</dd>
                  </div>
                ))}
            </dl>
          </details>
        </>
      )}
      {tab === "Участники" && (
        <>
          <div className="toolbar">
            <h2>Компании и роли</h2>
            <button disabled={!editable} onClick={() => setForm("participant")}>
              + Добавить участника
            </button>
          </div>
          <div className="grid">
            {participants.map((p) => {
              const c = data.companies.find((c) => c.id === p.company_id);
              return (
                <article className="panel" key={p.id}>
                  <span className="badge">{str(p.role)}</span>
                  <h3>
                    <Link href={`/companies/${p.company_id}`}>{c?.name}</Link>
                  </h3>
                  <p>ИНН: {str(c?.inn) || "—"}</p>
                  <p>
                    {str(c?.main_phone)} {str(c?.main_email)}
                  </p>
                  <p>
                    {people
                      .filter((x) => x.company_id === p.company_id)
                      .map((x) =>
                        [x.first_name, x.phone, x.email]
                          .filter(Boolean)
                          .join(" · "),
                      )
                      .join("; ")}
                  </p>
                  <p>
                    {data.project_participant_sections
                      .filter((x) => x.participant_id === p.id)
                      .map((x) => x.section)
                      .join(" · ")}
                  </p>
                </article>
              );
            })}
          </div>
        </>
      )}
      {tab === "Разделы" && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Раздел</th>
                  <th>Компания</th>
                  <th>Роль</th>
                  <th>Контакт</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {data.project_participant_sections
                  .filter((s) =>
                    participants.some((p) => p.id === s.participant_id),
                  )
                  .map((s) => {
                    const p = participants.find(
                      (p) => p.id === s.participant_id,
                    )!;
                    const c = data.companies.find((c) => c.id === p.company_id);
                    const contact = data.people.find(
                      (x) => x.id === p.person_id,
                    );
                    return (
                      <tr key={s.id}>
                        <td>{str(s.section)}</td>
                        <td>{c?.name}</td>
                        <td>{str(p.role)}</td>
                        <td>{str(contact?.first_name) || "—"}</td>
                        <td>
                          <select
                            aria-label={`Статус ${s.section}`}
                            disabled={!editable}
                            value={str(s.status)}
                            onChange={async (e) => {
                              try {
                                await mutate({
                                  action: "section",
                                  data: { id: s.id, status: e.target.value },
                                });
                                router.refresh();
                              } catch (error) {
                                setSectionError((error as Error).message);
                              }
                            }}
                          >
                            {[
                              "Уточняется",
                              "Проектирование",
                              "Закупка",
                              "Монтаж",
                              "Завершён",
                            ].map((status) => (
                              <option key={status}>{status}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <div className="grid" style={{ marginTop: 15 }}>
            {sections.map((section) => {
              const assigned = data.project_participant_sections.filter(
                (s) =>
                  s.section === section &&
                  participants.some((p) => p.id === s.participant_id),
              );
              const ps = participants.filter((p) =>
                assigned.some((s) => s.participant_id === p.id),
              );
              const specIds = new Set(
                specs.filter((s) => s.section === section).map((s) => s.id),
              );
              const items = data.specification_items.filter((i) =>
                specIds.has(str(i.specification_id)),
              );
              const matched = new Set(
                data.product_matches
                  .filter(
                    (m) =>
                      m.match_status === "matched" &&
                      items.some((i) => i.id === m.specification_item_id),
                  )
                  .map((m) => m.specification_item_id),
              );
              return (
                <section className="panel" key={section}>
                  <h3>{section}</h3>
                  <p>
                    Проектировщик:{" "}
                    {ps.some((p) => /проектировщик/i.test(str(p.role)))
                      ? "найден"
                      : "неизвестен"}
                  </p>
                  <p>
                    Подрядчик:{" "}
                    {ps.some((p) => /подрядчик/i.test(str(p.role)))
                      ? "найден"
                      : "неизвестен"}
                  </p>
                  <p>
                    Спецификации: {specIds.size || "нет"} · Позиций:{" "}
                    {items.length} · Подтверждено товаров: {matched.size}
                  </p>
                  <p>
                    Потенциал:{" "}
                    {opportunities
                      .filter((o) => o.section === section && o.amount !== null)
                      .map(
                        (o) =>
                          `${o.amount} ${o.currency} (${o.value_type === "confirmed" ? "подтверждено" : "оценка"})`,
                      )
                      .join("; ") || "данных недостаточно"}
                  </p>
                </section>
              );
            })}
          </div>
        </>
      )}
      {tab === "Спецификации" && (
        <Specifications
          data={data}
          projectId={project.id}
          editable={editable}
        />
      )}
      {tab === "Возможности" && (
        <>
          <div className="toolbar">
            <h2>Коммерческий потенциал</h2>
            <button disabled={!editable} onClick={() => setForm("calculation")}>
              + Отдельный расчёт
            </button>
          </div>
          {!opportunities.length && (
            <div className="panel empty">
              Данных о стоимости недостаточно. Создайте расчёт с явными
              параметрами.
            </div>
          )}
          {opportunities.map((o) => (
            <article className="panel" key={o.id}>
              <h3>
                {str(o.name)} · {str(o.section)}
              </h3>
              <p>
                {o.value_type === "confirmed"
                  ? "Подтверждено"
                  : o.value_type === "estimated"
                    ? "Оценка"
                    : "Неизвестно"}
                :{" "}
                {o.amount == null
                  ? "данных недостаточно"
                  : `${Number(o.amount).toLocaleString("ru-RU")} ${o.currency}`}
              </p>
              {data.calculations
                .filter((c) => c.opportunity_id === o.id)
                .map((c) => (
                  <details key={c.id}>
                    <summary>Сохранённые параметры расчёта</summary>
                    <pre className="history">
                      {JSON.stringify(c.parameters, null, 2)}
                    </pre>
                  </details>
                ))}
            </article>
          ))}
        </>
      )}
      {tab === "Контакты" && (
        <>
          <div className="toolbar">
            <h2>Контактные лица</h2>
            <button disabled={!editable} onClick={() => setForm("people")}>
              + Добавить контакт
            </button>
          </div>
          <div className="grid">
            {people.map((p) => (
              <div className="panel" key={p.id}>
                <h3>
                  {str(p.first_name)} {str(p.last_name)}
                </h3>
                {[
                  "position",
                  "phone",
                  "additional_phone",
                  "email",
                  "telegram",
                  "whatsapp",
                  "source",
                  "verified_at",
                ]
                  .filter((k) => p[k])
                  .map((k) => (
                    <p key={k}>
                      {k}: {str(p[k])}
                    </p>
                  ))}
              </div>
            ))}
          </div>
        </>
      )}
      {tab === "Активности" && (
        <>
          <div className="toolbar">
            <h2>Журнал активности</h2>
            <button disabled={!editable} onClick={() => setForm("activities")}>
              + Активность
            </button>
          </div>
          {data.activities
            .filter((a) => a.project_id === project.id)
            .map((a) => (
              <div className="panel" key={a.id}>
                <h3>
                  {str(a.type)} · {str(a.date)}
                </h3>
                <p>{str(a.description)}</p>
                <p>
                  Следующий шаг: {str(a.next_action) || "—"} ·{" "}
                  {str(a.next_action_date)}
                </p>
              </div>
            ))}
        </>
      )}
      {tab === "История" && (
        <>
          {data.history
            .filter(
              (h) =>
                h.project_id === project.id ||
                participants.some((p) => p.id === h.entity_id) ||
                companyIds.has(h.entity_id) ||
                people.some((p) => p.id === h.entity_id) ||
                specs.some((s) => s.id === h.entity_id) ||
                opportunities.some((o) => o.id === h.entity_id),
            )
            .sort((a, b) => str(b.created_at).localeCompare(str(a.created_at)))
            .map((h) => (
              <details className="panel" key={h.id}>
                <summary>
                  {str(h.created_at)} · {str(h.entity)} · {str(h.operation)} ·{" "}
                  {str(
                    data.profiles.find((p) => p.id === h.user_id)?.display_name,
                  ) || "Импорт / система"}
                </summary>
                <div className="grid">
                  <pre className="history">
                    До: {JSON.stringify(h.old_value, null, 2)}
                  </pre>
                  <pre className="history">
                    После: {JSON.stringify(h.new_value, null, 2)}
                  </pre>
                </div>
              </details>
            ))}
        </>
      )}
      {form && (
        <Modal
          title={
            form === "participant"
              ? "Добавить участника"
              : form === "calculation"
                ? "Новый расчёт"
                : "Редактирование"
          }
          onClose={() => setForm("")}
        >
          {form === "participant" ? (
            <ParticipantForm
              data={data}
              projectId={project.id}
              onClose={() => setForm("")}
            />
          ) : form === "calculation" ? (
            <Calculation projectId={project.id} onClose={() => setForm("")} />
          ) : (
            <RecordForm
              table={form}
              data={data}
              initial={form === "projects" ? project : {}}
              projectId={project.id}
              companyId={str(participants[0]?.company_id) || undefined}
              onClose={() => setForm("")}
            />
          )}
        </Modal>
      )}
    </main>
  );
}
