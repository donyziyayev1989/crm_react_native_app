// Sayt bilan umumiy (ko'p tilli) jadvallar uchun qator <-> hujjat adapterlari.
// Ilova faqat `uz` matnini ko'radi va yozadi; `ru`/`en` ga tegilmaydi.
// Supabase'ga bog'liq emas — Jest bilan sinaladi.

import type { FAQ, Product } from "../interfaces";

export type Row = Record<string, any>;

export interface CollectionAdapter<T> {
  /** Bazadagi qator → ilova hujjati (id bilan) */
  fromRow(row: Row): T & { id: string };
  /**
   * Hujjat → qator. `existing` berilmasa — yangi qator (create, barcha majburiy ustunlar bilan);
   * berilsa — update: faqat hujjatdagi maydonlar, ko'p tilli ustunlar `existing` bilan birlashtiriladi.
   */
  toRow(doc: Partial<T>, existing?: Row): Row;
  /** update'da birlashtirish uchun mavjud qatordan o'qiladigan ustunlar */
  mergeColumns: string[];
  /** Filtr/tartib uchun maydon → PostgREST ustun ifodasi (masalan `name` → `name->>uz`) */
  columns: Record<string, string>;
}

type Localized<V = string> = { uz: V; ru: V; en: V };

const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

/** Ko'p tilli qiymatdan `uz` matni (eski oddiy satr ham qabul qilinadi) */
export const readUz = (v: unknown): string => {
  if (isObject(v)) return typeof v.uz === "string" ? v.uz : "";
  return typeof v === "string" ? v : "";
};

/** `existing` dagi boshqa tillarni saqlab, `uz` ni almashtiradi; yo'q bo'lsa ru/en bo'sh */
export const withUz = (existing: unknown, text: string): Localized & Record<string, unknown> => ({
  ru: "",
  en: "",
  ...(isObject(existing) ? existing : {}),
  uz: text,
});

/** UUID v4 (kichik harflar — `public.products.id` tekshiruviga mos) */
export const uuidv4 = (): string => {
  const c: any = (globalThis as any).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

// ─── public.products ────────────────────────────────────────────────────────
// Sayt modeli: name/description/summary/slug/features — jsonb {uz,ru,en}, price numeric|null,
// published boolean. Ilova `Product.active` = `published` (false — saytda yashirin).

export const productAdapter = (newId: () => string = uuidv4): CollectionAdapter<Product> => ({
  fromRow: (row) => ({
    id: row.id,
    name: readUz(row.name),
    description: readUz(row.description),
    price: Number(row.price ?? 0),
    active: !!row.published,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }),

  toRow: (doc, existing) => {
    if (!existing) {
      const id = newId();
      const name = doc.name ?? "";
      const description = doc.description ?? "";
      return {
        id,
        slug: { uz: id, ru: id, en: id },
        name: withUz(undefined, name),
        description: withUz(undefined, description),
        summary: withUz(undefined, description || name),
        features: { uz: [], ru: [], en: [] },
        price: doc.price ?? null,
        published: doc.active ?? false,
      };
    }
    const row: Row = {};
    if (doc.name !== undefined) row.name = withUz(existing.name, doc.name);
    if (doc.description !== undefined) row.description = withUz(existing.description, doc.description);
    if (doc.price !== undefined) row.price = doc.price;
    if (doc.active !== undefined) row.published = doc.active;
    // createdAt/updatedAt: baza boshqaradi (default va trigger)
    return row;
  },

  mergeColumns: ["name", "description"],
  columns: { name: "name->>uz", description: "description->>uz", active: "published" },
});

// ─── public.faqs ────────────────────────────────────────────────────────────

export const faqAdapter: CollectionAdapter<FAQ> = {
  fromRow: (row) => ({
    id: row.id,
    question: readUz(row.question),
    answer: readUz(row.answer),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }),

  toRow: (doc, existing) => {
    if (!existing) {
      return {
        question: withUz(undefined, doc.question ?? ""),
        answer: withUz(undefined, doc.answer ?? ""),
        published: true,
      };
    }
    const row: Row = {};
    if (doc.question !== undefined) row.question = withUz(existing.question, doc.question);
    if (doc.answer !== undefined) row.answer = withUz(existing.answer, doc.answer);
    return row;
  },

  mergeColumns: ["question", "answer"],
  columns: { question: "question->>uz", answer: "answer->>uz" },
};
