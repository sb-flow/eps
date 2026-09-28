"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { sections, type Row, str } from "@/lib/types";
import { calculate } from "@/lib/finance";
import { mutate } from "./forms";
const labels: Record<string, string> = {
  quantity: "Количество",
  purchase_price: "Закупочная цена / ед.",
  sales_price: "Цена продажи / ед. (необязательно)",
  delivery: "Доставка за партию",
  customs_duty: "Пошлина за партию",
  certification: "Сертификация за партию",
  additional_costs: "Доп. затраты за партию",
  vat: "НДС, %",
  markup: "Наценка, %",
};
export function Calculation({
  projectId,
  item,
  onClose,
}: {
  projectId: string;
  item?: Row;
  onClose: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({
    quantity: str(item?.quantity),
    purchase_price: "",
    sales_price: "",
    delivery: "0",
    customs_duty: "0",
    certification: "0",
    additional_costs: "0",
    vat: "0",
    markup: "0",
  });
  const [currency, setCurrency] = useState("UZS");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const input = {
    quantity: values.quantity === "" ? null : Number(values.quantity),
    purchase_price:
      values.purchase_price === "" ? null : Number(values.purchase_price),
    sales_price: values.sales_price === "" ? null : Number(values.sales_price),
    delivery: Number(values.delivery),
    customs_duty: Number(values.customs_duty),
    certification: Number(values.certification),
    additional_costs: Number(values.additional_costs),
    vat: Number(values.vat),
    markup: Number(values.markup),
    currency,
  };
  let result;
  try {
    result = calculate(input);
  } catch {
    /* Invalid drafts are not saved. */
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const f = new FormData(e.currentTarget);
        try {
          await mutate({
            action: "calculate",
            data: input,
            specification_item_id: item?.id,
            opportunity: {
              project_id: projectId,
              name: f.get("name"),
              section: f.get("section"),
              value_type: f.get("value_type"),
            },
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
      <div className="form-grid">
        <label>
          Название расчёта
          <input name="name" defaultValue={str(item?.original_name)} required />
        </label>
        <label>
          Раздел
          <select
            name="section"
            defaultValue={
              sections.includes(str(item?.section)) ? str(item?.section) : "ИТП"
            }
          >
            {sections.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Основание суммы
          <select name="value_type">
            <option value="estimated">Оценочная</option>
            <option value="confirmed">Подтверждённая</option>
            <option value="unknown">Неизвестная</option>
          </select>
        </label>
        <label>
          Валюта
          <input
            value={currency}
            pattern="[A-Z]{3}"
            required
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
          />
        </label>
        {Object.entries(labels).map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              type="number"
              step="any"
              min="0"
              max={key === "vat" ? 100 : key === "markup" ? 1000 : 1e12}
              value={values[key]}
              onChange={(e) => setValues({ ...values, [key]: e.target.value })}
              required={
                !["quantity", "purchase_price", "sales_price"].includes(key)
              }
            />
          </label>
        ))}
      </div>
      <p className="muted">
        Все суммы в одной валюте. Затраты указаны за партию; НДС применяется к
        выручке. При явной цене продажи наценка не применяется. Предыдущие КП не
        используются.
      </p>
      <div className="panel">
        <b>
          Итого:{" "}
          {result?.total == null
            ? "данных недостаточно"
            : `${result.total.toLocaleString("ru-RU")} ${currency}`}
        </b>
        <p>
          Маржа до НДС: {result?.margin == null ? "—" : `${result.margin}%`}
        </p>
      </div>
      {error && <p className="error">{error}</p>}
      <button className="primary" disabled={busy || !result}>
        Сохранить отдельный расчёт
      </button>
    </form>
  );
}
