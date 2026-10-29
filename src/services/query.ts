// Firestore uslubidagi so'rov cheklovlarini (where/orderBy/limit) PostgREST so'roviga o'giruvchi
// sof yordamchilar. Supabase'ga bog'liq emas — Jest bilan sinaladi.

export type WhereOp = "==" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "array-contains";

export type Constraint =
  | { kind: "where"; field: string; op: WhereOp; value: any }
  | { kind: "orderBy"; field: string; dir: "asc" | "desc" }
  | { kind: "limit"; n: number };

export const where = (field: string, op: WhereOp, value: any): Constraint => ({
  kind: "where",
  field,
  op,
  value,
});
export const orderBy = (field: string, dir: "asc" | "desc" = "asc"): Constraint => ({
  kind: "orderBy",
  field,
  dir,
});
export const limit = (n: number): Constraint => ({ kind: "limit", n });

// ─── Maydon nomlari ─────────────────────────────────────────────────────────
// Firestore'dagi camelCase maydonlar Postgres'da snake_case ustun. Boshqalari bir xil.

const FIELD_TO_COLUMN: Record<string, string> = {
  lotId: "lot_id",
  regionId: "region_id",
  createdAt: "created_at",
  updatedAt: "updated_at",
  photoURL: "photo_url",
  __name__: "id",
};
const COLUMN_TO_FIELD: Record<string, string> = Object.fromEntries(
  Object.entries(FIELD_TO_COLUMN)
    .filter(([k]) => k !== "__name__")
    .map(([k, v]) => [v, k]),
);

export const toColumn = (field: string): string => FIELD_TO_COLUMN[field] ?? field;
export const toField = (column: string): string => COLUMN_TO_FIELD[column] ?? column;

/** Qator → hujjat (camelCase maydonlar tiklanadi) */
export const rowToDoc = <T>(row: Record<string, any>): T => {
  const out: Record<string, any> = {};
  for (const key of Object.keys(row)) out[toField(key)] = row[key];
  return out as T;
};

/** uuid ustunlar: ilova ilgari bo'sh satr ("") yuborgan — Postgres uchun null */
const UUID_COLUMNS = new Set(["user_id"]);

/** Hujjat → qator: undefined tashlanadi, nomlar ustun nomiga o'giriladi, `id` olib tashlanadi */
export const docToRow = (data: Record<string, any>): Record<string, any> => {
  const out: Record<string, any> = {};
  for (const key of Object.keys(data)) {
    if (key === "id" || data[key] === undefined) continue;
    const col = toColumn(key);
    out[col] = UUID_COLUMNS.has(col) && data[key] === "" ? null : data[key];
  }
  return out;
};

// ─── PostgREST filtr qo'llash ───────────────────────────────────────────────

/** `ilike` uchun % _ \ belgilarini ekranlash */
export const escapeLike = (s: string): string => s.replace(/[\\%_]/g, (c) => `\\${c}`);

const PREFIX_END = "";

/** PostgREST so'rov quruvchining ishlatiladigan metodlari (testda soxta ob'ekt bilan almashtiriladi) */
export interface FilterBuilder {
  eq(col: string, v: any): this;
  neq(col: string, v: any): this;
  gt(col: string, v: any): this;
  gte(col: string, v: any): this;
  lt(col: string, v: any): this;
  lte(col: string, v: any): this;
  in(col: string, v: any[]): this;
  contains(col: string, v: any): this;
  ilike(col: string, pattern: string): this;
  order(col: string, opts: { ascending: boolean }): this;
  limit(n: number): this;
}

/**
 * Cheklovlarni so'rovga qo'llaydi. Prefiks qidiruv juftligi (`>= q` va `<= q + `)
 * `ilike 'q%'` ga aylantiriladi (Postgres kollatsiyasida  diapazoni ishonchsiz).
 */
export function applyConstraints<B extends FilterBuilder>(q: B, constraints: Constraint[]): B {
  const wheres = constraints.filter((c): c is Extract<Constraint, { kind: "where" }> => c.kind === "where");
  const consumed = new Set<Constraint>();

  for (const lo of wheres) {
    if (lo.op !== ">=" || typeof lo.value !== "string") continue;
    const hi = wheres.find(
      (c) => c.field === lo.field && c.op === "<=" && c.value === lo.value + PREFIX_END,
    );
    if (hi) {
      q = q.ilike(toColumn(lo.field), `${escapeLike(lo.value)}%`);
      consumed.add(lo);
      consumed.add(hi);
    }
  }

  for (const c of constraints) {
    if (consumed.has(c)) continue;
    if (c.kind === "orderBy") {
      q = q.order(toColumn(c.field), { ascending: c.dir === "asc" });
    } else if (c.kind === "limit") {
      q = q.limit(c.n);
    } else {
      const col = toColumn(c.field);
      switch (c.op) {
        case "==": q = q.eq(col, c.value); break;
        case "!=": q = q.neq(col, c.value); break;
        case ">": q = q.gt(col, c.value); break;
        case ">=": q = q.gte(col, c.value); break;
        case "<": q = q.lt(col, c.value); break;
        case "<=": q = q.lte(col, c.value); break;
        case "in": q = q.in(col, c.value); break;
        case "array-contains": q = q.contains(col, [c.value]); break;
      }
    }
  }
  return q;
}

// ─── Realtime / xotirada ishlash yordamchilari ──────────────────────────────

/** Faqat orderBy dan iborat (filtrsiz, limitsiz) so'rovmi — xotirada patch qilish mumkin */
export const isPlainOrdered = (constraints: Constraint[]): boolean =>
  constraints.every((c) => c.kind === "orderBy");

export const getLimit = (constraints: Constraint[]): number | null => {
  const l = constraints.find((c): c is Extract<Constraint, { kind: "limit" }> => c.kind === "limit");
  return l ? l.n : null;
};

/** orderBy bo'yicha qiyoslovchi (Firestore tartibiga yaqin: null birinchi, raqam/satr o'z tartibida) */
export function makeComparator(constraints: Constraint[]) {
  const orders = constraints.filter((c): c is Extract<Constraint, { kind: "orderBy" }> => c.kind === "orderBy");
  return (a: any, b: any): number => {
    for (const o of orders) {
      const field = toField(toColumn(o.field));
      const av = a[field];
      const bv = b[field];
      let cmp = 0;
      if (av == null && bv == null) cmp = 0;
      else if (av == null) cmp = -1;
      else if (bv == null) cmp = 1;
      else if (typeof av === "string" && typeof bv === "string") cmp = av.localeCompare(bv);
      else cmp = av < bv ? -1 : av > bv ? 1 : 0;
      if (cmp !== 0) return o.dir === "desc" ? -cmp : cmp;
    }
    return 0;
  };
}

/**
 * Realtime hodisasi shu so'rovga tegishlimi? Faqat `==` shartlar bo'yicha tekshiriladi:
 * eski yoki yangi qator ulardan birortasiga mos kelmasa, hodisa e'tiborsiz qoldiriladi.
 * (replica identity full tufayli DELETE/UPDATE da `old` to'liq keladi.)
 */
export function eventAffects(
  constraints: Constraint[],
  oldRow: Record<string, any> | null | undefined,
  newRow: Record<string, any> | null | undefined,
): boolean {
  const eqs = constraints.filter(
    (c): c is Extract<Constraint, { kind: "where" }> => c.kind === "where" && c.op === "==",
  );
  if (eqs.length === 0) return true;
  const matches = (row: Record<string, any> | null | undefined) =>
    !!row && eqs.every((c) => {
      const col = toColumn(c.field);
      // Ustun hodisada bo'lmasa (to'liq kelmagan) — ehtiyot uchun "mos" deb hisoblaymiz
      return !(col in row) || row[col] === c.value;
    });
  return matches(oldRow) || matches(newRow);
}
