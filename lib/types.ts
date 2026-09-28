export type Row = { id: string; [key: string]: unknown };
export type Project = Row & {
  name: string;
  region: string | null;
  address: string | null;
  stage: string | null;
  priority: string | null;
  category: string | null;
  lat: number | null;
  lng: number | null;
  legacy: Record<string, unknown>;
};
export type Company = Row & {
  name: string;
  normalized_name: string;
  inn: string | null;
};
export type Snapshot = {
  projects: Project[];
  companies: Company[];
  people: Row[];
  project_participants: Row[];
  project_participant_sections: Row[];
  project_sections: Row[];
  specifications: Row[];
  specification_items: Row[];
  products: Row[];
  product_matches: Row[];
  calculations: Row[];
  calculation_items: Row[];
  opportunities: Row[];
  activities: Row[];
  sources: Row[];
  history: Row[];
  profiles: Row[];
};
export const sections = [
  "ИТП",
  "ТМ",
  "ОВ",
  "Вентиляция",
  "Холодоснабжение",
  "ВК",
  "ЭОМ",
  "Автоматика",
  "КИП",
  "СС",
  "Пожаротушение",
  "Дымоудаление",
  "Теплоснабжение",
  "Водоподготовка",
  "Другое",
];
export const roles = [
  "Заказчик",
  "Застройщик",
  "Инвестор",
  "Генеральный подрядчик",
  "Генеральный проектировщик",
  "Проектировщик",
  "Субподрядчик",
  "Поставщик",
  "Технический заказчик",
  "Управляющая компания",
  "Другое",
];
export const str = (v: unknown) =>
  v === null || v === undefined ? "" : String(v);
export const present = (v: unknown) =>
  Boolean(
    str(v).trim() &&
    !["—", "-", "нет", "неизвестно"].includes(str(v).trim().toLowerCase()),
  );
