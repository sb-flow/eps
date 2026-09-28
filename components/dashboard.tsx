"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { type Snapshot, str } from "@/lib/types";
import {
  normalizeCompany,
  projectSearchText,
  companyScore,
  hasContacts,
  roleCompanies,
} from "@/lib/search";
import { ProjectMap } from "./map";
export function Dashboard({ data, mode }: { data: Snapshot; mode: string }) {
  const [query, setQuery] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [contacts, setContacts] = useState(false);
  const [coords, setCoords] = useState(false);
  const [view, setView] = useState("Таблица");
  const [sort, setSort] = useState("priority");
  const indexed = useMemo(
    () => data.projects.map((p) => ({ p, text: projectSearchText(p, data) })),
    [data],
  );
  const rows = useMemo(
    () =>
      indexed
        .filter(
          ({ p, text }) =>
            Object.entries(filters).every(([k, v]) => !v || p[k] === v) &&
            (!contacts || hasContacts(p, data)) &&
            (!coords || (p.lat !== null && p.lng !== null)) &&
            normalizeCompany(query)
              .split(" ")
              .every((t) => text.includes(t)) &&
            (!company ||
              roleCompanies(p, data, role).some(
                (c) => companyScore(company, c.name) >= 0.48,
              )),
        )
        .map((x) => x.p)
        .sort((a, b) =>
          sort === "area_m2"
            ? Number(b.area_m2 ?? 0) - Number(a.area_m2 ?? 0)
            : str(a[sort]).localeCompare(str(b[sort]), "ru"),
        ),
    [indexed, filters, contacts, coords, query, company, role, sort, data],
  );
  const suggestions =
    company.length > 1
      ? data.companies
          .map((c) => ({ ...c, score: companyScore(company, c.name) }))
          .filter((c) => c.score > 0.48)
          .sort((a, b) => b.score - a.score)
          .slice(0, 4)
      : [];
  const projectIds = new Set(rows.map((p) => p.id));
  const stats = [
    ["Объектов", rows.length],
    ["С контактами", rows.filter((p) => hasContacts(p, data)).length],
    [
      "Со спецификацией",
      new Set(
        data.specifications
          .filter((s) => projectIds.has(str(s.project_id)))
          .map((s) => s.project_id),
      ).size,
    ],
    [
      "Без подрядчика",
      rows.filter((p) => !roleCompanies(p, data, "подрядчик").length).length,
    ],
    [
      "Без проектировщика",
      rows.filter((p) => !roleCompanies(p, data, "роектировщик").length).length,
    ],
    [
      "Активное строительство",
      rows.filter((p) =>
        /активн.*строитель|строительно-монтаж/i.test(str(p.stage)),
      ).length,
    ],
  ];
  return (
    <main className="page">
      {mode === "demo" && (
        <div className="notice">
          Исходная база · только просмотр. Для совместной работы подключите
          Supabase и импортируйте данные.
        </div>
      )}
      <div className="workspace">
        <aside className="filters">
          <h3>Фильтры</h3>
          {[
            ["region", "Регион"],
            ["category", "Сегмент"],
            ["stage", "Стадия"],
            ["priority", "Приоритет"],
          ].map(([k, label]) => (
            <label key={k}>
              {label}
              <select
                value={filters[k] ?? ""}
                onChange={(e) =>
                  setFilters({ ...filters, [k]: e.target.value })
                }
              >
                <option value="">Все</option>
                {[...new Set(data.projects.map((p) => str(p[k])))]
                  .filter(Boolean)
                  .sort()
                  .map((x) => (
                    <option key={x}>{x}</option>
                  ))}
              </select>
            </label>
          ))}
          <label>
            Роль компании
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">Все участники</option>
              {[
                "Заказчик",
                "Застройщик",
                "подрядчик",
                "роектировщик",
                "Другое",
              ].map((r) => (
                <option key={r} value={r}>
                  {r === "подрядчик"
                    ? "Подрядчик"
                    : r === "роектировщик"
                      ? "Проектировщик"
                      : r}
                </option>
              ))}
            </select>
          </label>
          <label>
            Компания / участник
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Название компании"
            />
          </label>
          <div className="matches">
            {suggestions.map((c) => (
              <button key={c.id} onClick={() => setCompany(c.name)}>
                {c.name} · {Math.round(c.score * 100)}%
              </button>
            ))}
          </div>
          <label className="row">
            <input
              type="checkbox"
              checked={contacts}
              onChange={(e) => setContacts(e.target.checked)}
            />
            С контактами
          </label>
          <label className="row">
            <input
              type="checkbox"
              checked={coords}
              onChange={(e) => setCoords(e.target.checked)}
            />
            С координатами
          </label>
          <button
            onClick={() => {
              setFilters({});
              setQuery("");
              setCompany("");
              setRole("");
              setContacts(false);
              setCoords(false);
            }}
          >
            Сбросить
          </button>
        </aside>
        <section>
          <span className="muted">БАЗА СТРОИТЕЛЬНЫХ ОБЪЕКТОВ</span>
          <h1>Объекты и участники строительства</h1>
          <div className="toolbar">
            <input
              className="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Объект, компания, ИНН, телефон, адрес, источник…"
              aria-label="Глобальный поиск"
            />
            <div className="row">
              {["Таблица", "Карточки", "Карта"].map((v) => (
                <button
                  key={v}
                  className={view === v ? "primary" : ""}
                  onClick={() => setView(v)}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className="stats">
            {stats.map(([label, value]) => (
              <div className="stat" key={label}>
                <span className="muted">{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="panel">
            <b>Коммерческий потенциал</b>
            {["confirmed", "estimated"].map((kind) => {
              const totals = new Map<string, number>();
              data.opportunities
                .filter(
                  (o) =>
                    projectIds.has(str(o.project_id)) &&
                    o.value_type === kind &&
                    o.amount !== null,
                )
                .forEach((o) =>
                  totals.set(
                    str(o.currency),
                    (totals.get(str(o.currency)) ?? 0) + Number(o.amount),
                  ),
                );
              return (
                <p key={kind}>
                  {kind === "confirmed" ? "Подтверждено" : "Оценка"}:{" "}
                  {totals.size
                    ? [...totals]
                        .map(
                          ([currency, n]) =>
                            `${n.toLocaleString("ru-RU")} ${currency}`,
                        )
                        .join(" · ")
                    : "данных недостаточно"}
                </p>
              );
            })}
          </div>
          <div className="toolbar">
            <b>{rows.length} объектов</b>
            <select
              style={{ width: 180 }}
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="priority">По приоритету</option>
              <option value="name">По названию</option>
              <option value="region">По региону</option>
              <option value="area_m2">По площади</option>
            </select>
          </div>
          {view === "Карта" ? (
            <ProjectMap projects={rows} />
          ) : view === "Карточки" ? (
            <div className="grid">
              {rows.map((p) => (
                <article className="panel" key={p.id}>
                  <span className="badge">
                    {p.priority || "Без приоритета"}
                  </span>
                  <h3>
                    <Link href={`/projects/${p.id}`}>{p.name}</Link>
                  </h3>
                  <p>
                    {p.region} · {p.category}
                  </p>
                  <p className="muted">{p.stage}</p>
                  <p>
                    Заказчик:{" "}
                    {roleCompanies(p, data, "Заказчик")
                      .map((c) => c.name)
                      .join("; ") || "—"}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {[
                      "Объект",
                      "Регион",
                      "Стадия",
                      "Заказчик",
                      "Проектировщик",
                      "Подрядчик",
                      "м²",
                    ].map((s) => (
                      <th key={s}>{s}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/projects/${p.id}`}>
                          <b>{p.name}</b>
                        </Link>
                        <p className="muted">
                          {p.id} · {p.category}{" "}
                          <span className="badge">{p.priority}</span>
                        </p>
                      </td>
                      <td>{p.region}</td>
                      <td>{p.stage}</td>
                      {["Заказчик", "роектировщик", "подрядчик"].map((r) => (
                        <td key={r}>
                          {roleCompanies(p, data, r)
                            .map((c) => c.name)
                            .join("; ") || "—"}
                        </td>
                      ))}
                      <td>{p.area_m2 === null ? "—" : str(p.area_m2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && (
                <div className="empty">
                  По выбранным условиям ничего не найдено.
                </div>
              )}
            </div>
          )}
          <details className="panel" style={{ marginTop: 18 }}>
            <summary>Последние изменения ({data.history.length})</summary>
            {data.history
              .slice()
              .sort((a, b) =>
                str(b.created_at).localeCompare(str(a.created_at)),
              )
              .slice(0, 12)
              .map((h) => (
                <p key={h.id}>
                  {str(h.created_at)} · {str(h.entity)} · {str(h.operation)} ·{" "}
                  {str(h.entity_id)}
                </p>
              ))}
          </details>
        </section>
      </div>
    </main>
  );
}
