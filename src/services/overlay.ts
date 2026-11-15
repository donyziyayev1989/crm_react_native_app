// Yuborilmagan (oflayn) o'zgarishlarni server qatorlari ustiga qo'llash — sof funksiya, Jest bilan sinaladi.
import { Constraint, getLimit, makeComparator, matchesConstraints } from "./query";

export type OpKind = "create" | "update" | "delete" | "set";

export interface PendingOp {
  opId: string;
  /** `${schema}.${table}` */
  coll: string;
  kind: OpKind;
  id: string;
  /** Hujjat maydonlari (create uchun — to'liq hujjat) */
  data?: Record<string, any>;
  /** Faqat create: serverga yuboriladigan tayyor qator (id va slug kabi hosilalar bilan) */
  row?: Record<string, any>;
  ts: number;
  /** Serverga yetib bordi; Realtime/refetch kelguncha qisqa vaqt ko'rinishda ushlab turiladi */
  settledAt?: number;
}

/**
 * `rows` (server holati) ustiga `ops` ni ketma-ket qo'llaydi.
 * `constraints` berilsa: faqat op tegib o'tgan hujjatlar shartga qayta tekshiriladi (server qatorlari
 * o'zgarmaydi — formatlar farqi tufayli noto'g'ri yashirilmasin), so'ng tartib va limit qo'llanadi.
 */
export function applyOps<T extends { id: string }>(
  rows: T[],
  ops: PendingOp[],
  constraints?: Constraint[],
): T[] {
  if (ops.length === 0) return rows;
  const map = new Map<string, T>(rows.map((r) => [r.id, r]));
  const touched = new Set<string>();

  for (const op of ops) {
    touched.add(op.id);
    const cur = map.get(op.id);
    switch (op.kind) {
      case "create":
        map.set(op.id, { createdAt: new Date(op.ts).toISOString(), ...cur, ...op.data, id: op.id } as unknown as T);
        break;
      case "set":
        map.set(op.id, { ...cur, ...op.data, id: op.id } as T);
        break;
      case "update":
        if (cur) map.set(op.id, { ...cur, ...op.data, id: op.id });
        break;
      case "delete":
        map.delete(op.id);
        break;
    }
  }

  let out = [...map.values()];
  if (constraints) {
    out = out.filter((r) => !touched.has(r.id) || matchesConstraints(r, constraints));
    if (constraints.some((c) => c.kind === "orderBy")) out.sort(makeComparator(constraints));
    const lim = getLimit(constraints);
    if (lim !== null) out = out.slice(0, lim);
  }
  return out;
}
