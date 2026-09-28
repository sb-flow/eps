import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { importLegacy } from "../lib/import-legacy";
test("UI search, view switching, project tabs, company/contact/participant forms and upload wiring", async () => {
  const dom = new JSDOM('<html><body><div id="root"></div></body></html>', {
    url: "http://localhost:3000",
  });
  const keys = [
    "window",
    "self",
    "document",
    "HTMLElement",
    "HTMLInputElement",
    "HTMLSelectElement",
    "Event",
    "MouseEvent",
    "FormData",
    "File",
  ];
  const originals = new Map(
    keys.map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]),
  );
  for (const k of keys)
    Object.defineProperty(globalThis, k, {
      value: Reflect.get(dom.window, k),
      configurable: true,
      writable: true,
    });
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { AppRouterContext } =
    await import("next/dist/shared/lib/app-router-context.shared-runtime.js");
  const { Dashboard } = await import("../components/dashboard");
  const { ProjectDetail } = await import("../components/project-detail");
  const { RecordForm, ParticipantForm } = await import("../components/forms");
  const { Specifications } = await import("../components/specifications");
  const { data } = importLegacy(
    JSON.parse(readFileSync("data/projects.json", "utf8")),
    JSON.parse(readFileSync("data/participants.json", "utf8")),
  );
  const root = createRoot(document.getElementById("root")!);
  const router = {
    bfcacheId: "test",
    back() {},
    forward() {},
    refresh() {},
    push() {},
    replace() {},
    prefetch: async () => {},
    hmrRefresh() {},
  };
  const render = async (component: React.ReactElement) => {
    await React.act(async () =>
      root.render(
        React.createElement(
          AppRouterContext.Provider,
          { value: router },
          component,
        ),
      ),
    );
  };
  const click = async (text: string) => {
    const button = [...document.querySelectorAll("button")].find(
      (b) => b.textContent === text,
    );
    assert.ok(button, `Button: ${text}`);
    await React.act(async () => button.click());
  };
  const fetchOriginal = globalThis.fetch;
  const calls: { url: string; body: unknown }[] = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), body: init?.body });
    return new Response(JSON.stringify({ id: "created" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    await render(React.createElement(Dashboard, { data, mode: "demo" }));
    assert.equal(document.querySelectorAll("tbody tr").length, 372);
    const search = document.querySelector<HTMLInputElement>(
      '[aria-label="Глобальный поиск"]',
    )!;
    await React.act(async () => {
      Object.getOwnPropertyDescriptor(
        dom.window.HTMLInputElement.prototype,
        "value",
      )!.set!.call(search, "ETÉRA");
      search.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
    assert.equal(document.querySelectorAll("tbody tr").length, 1);
    await click("Карточки");
    assert.equal(document.querySelectorAll("article").length, 1);
    await render(
      React.createElement(ProjectDetail, {
        data,
        project: data.projects[0],
        editable: false,
        mode: "demo",
      }),
    );
    await click("Участники");
    assert.equal(
      [...document.querySelectorAll("button")].find(
        (b) => b.textContent === "+ Добавить участника",
      )?.disabled,
      true,
    );
    await click("Спецификации");
    assert.match(document.body.textContent!, /Спецификации пока не загружены/);
    await render(
      React.createElement(RecordForm, {
        table: "companies",
        data,
        initial: { name: "Unique Company QA", inn: "123456789" },
        onClose() {},
      }),
    );
    await React.act(async () => {
      document
        .querySelector("form")!
        .dispatchEvent(
          new dom.window.Event("submit", { bubbles: true, cancelable: true }),
        );
    });
    assert.equal(
      JSON.parse(String(calls.at(-1)?.body)).data.name,
      "Unique Company QA",
    );
    await render(
      React.createElement(RecordForm, {
        key: "person",
        table: "people",
        data,
        companyId: data.companies[0].id,
        initial: { first_name: "QA contact", phone: "+998000000000" },
        onClose() {},
      }),
    );
    await React.act(async () => {
      document
        .querySelector("form")!
        .dispatchEvent(
          new dom.window.Event("submit", { bubbles: true, cancelable: true }),
        );
    });
    assert.equal(
      JSON.parse(String(calls.at(-1)?.body)).data.company_id,
      data.companies[0].id,
    );
    await render(
      React.createElement(ParticipantForm, {
        data,
        projectId: "city-001",
        onClose() {},
      }),
    );
    const select = document.querySelector<HTMLSelectElement>(
      '[aria-label="Компания"]',
    )!;
    await React.act(async () => {
      select.value = data.companies[0].id;
      select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    await React.act(async () => {
      (
        document.querySelector('input[name="sections"]') as HTMLInputElement
      ).click();
      document
        .querySelector("form")!
        .dispatchEvent(
          new dom.window.Event("submit", { bubbles: true, cancelable: true }),
        );
    });
    const participant = JSON.parse(String(calls.at(-1)?.body));
    assert.equal(participant.action, "participant");
    assert.deepEqual(participant.sections, ["ИТП"]);
    await render(
      React.createElement(Specifications, {
        data,
        projectId: "city-001",
        editable: true,
      }),
    );
    await click("+ Загрузить спецификацию");
    await React.act(async () => {
      document
        .querySelector("form")!
        .dispatchEvent(
          new dom.window.Event("submit", { bubbles: true, cancelable: true }),
        );
    });
    const upload = calls.at(-1)!;
    assert.equal(upload.url, "/api/specifications");
    assert.equal((upload.body as FormData).get("project_id"), "city-001");
    assert.equal((upload.body as FormData).get("section"), "ИТП");
  } finally {
    await React.act(async () => root.unmount());
    globalThis.fetch = fetchOriginal;
    dom.window.close();
    for (const [k, d] of originals) {
      if (d) Object.defineProperty(globalThis, k, d);
      else Reflect.deleteProperty(globalThis, k);
    }
  }
});
