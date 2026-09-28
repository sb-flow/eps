"use client";
import { useState } from "react";
import { type Snapshot, str } from "@/lib/types";
import { Modal, RecordForm } from "./forms";
export function Products({
  data,
  editable,
}: {
  data: Snapshot;
  editable: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <main className="page">
      <div className="toolbar">
        <h1>Каталог товаров</h1>
        <button disabled={!editable} onClick={() => setOpen(true)}>
          + Товар
        </button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Товар</th>
              <th>Производитель</th>
              <th>Артикул</th>
              <th>DN / PN / Kvs</th>
              <th>Закупка</th>
            </tr>
          </thead>
          <tbody>
            {data.products.map((p) => (
              <tr key={p.id}>
                <td>{str(p.name)}</td>
                <td>{str(p.manufacturer)}</td>
                <td>{str(p.article)}</td>
                <td>{[p.dn, p.pn, p.kvs].map((v) => v ?? "—").join(" / ")}</td>
                <td>
                  {p.purchase_price == null
                    ? "—"
                    : `${p.purchase_price} ${p.currency}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.products.length && (
          <div className="empty">
            Каталог пока пуст. Добавьте реальные товары для подбора
            спецификаций.
          </div>
        )}
      </div>
      {open && (
        <Modal title="Товар" onClose={() => setOpen(false)}>
          <RecordForm
            table="products"
            data={data}
            onClose={() => setOpen(false)}
          />
        </Modal>
      )}
    </main>
  );
}
