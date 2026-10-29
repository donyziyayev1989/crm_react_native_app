import { supabase } from "@/supabase/client";
import {
  Customer,
  District,
  ProductLot,
  Region,
  Order,
  Product,
  Tag,
  Rate,
  LostProduct,
  Lead,
  LeadChat,
  LeadMessage,
  FAQ,
  User,
  LotExpense,
  WithId,
} from "@interfaces/index";
import { cacheRead, cacheWrite } from "./cache";
import {
  applyConstraints,
  Constraint,
  docToRow,
  eventAffects,
  getLimit,
  isPlainOrdered,
  makeComparator,
  rowToDoc,
  toColumn,
  where as whereConstraint,
} from "./query";

// Cheklov quruvchilar: ilgari Firestore SDK'dan edi, endi o'z (bir xil imzoli) versiyalar.
export { where, orderBy, limit } from "./query";

const PAGE = 1000; // PostgREST max_rows

/**
 * Hamma qatorlarni oladi. Limit berilmagan bo'lsa 1000 talik sahifalar bilan
 * (aks holda server jimgina 1000 ta bilan kesib tashlaydi).
 */
async function fetchRows(
  table: string,
  constraints: Constraint[],
): Promise<Record<string, any>[]> {
  const lim = getLimit(constraints);

  if (lim !== null) {
    const { data, error } = await applyConstraints(
      supabase.from(table).select("*") as any,
      constraints,
    );
    if (error) throw error;
    return data ?? [];
  }

  const all: Record<string, any>[] = [];
  for (let from = 0; ; from += PAGE) {
    // `id` bo'yicha qo'shimcha tartib — sahifalar orasida qatorlar qaytarilmasligi uchun
    const q = applyConstraints(supabase.from(table).select("*") as any, constraints)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    const { data, error } = await q;
    if (error) throw error;
    all.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return all;
}

interface WatchOptions {
  /** Jadvalda Realtime yo'q (masalan view) */
  realtime?: boolean;
}

/**
 * `watch` yadrosi: birinchi fetch + Realtime. Filtrsiz (faqat orderBy) so'rovlar xotirada
 * patch qilinadi va keshlanadi; boshqalari tegishli hodisada qayta fetch qilinadi.
 */
function startWatch<T extends { id: string }>(
  table: string,
  constraints: Constraint[],
  onRows: (rows: T[]) => void,
  onFailure: () => void,
  opts: WatchOptions = {},
): () => void {
  let active = true;
  let loaded = false;
  let hadSubscribed = false;
  let rows: T[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const plain = isPlainOrdered(constraints);
  const compare = makeComparator(constraints);
  const cacheKey = plain
    ? `${table}|${constraints.map((c) => (c.kind === "orderBy" ? `${c.field}:${c.dir}` : "")).join(",")}`
    : null;

  const emit = () => {
    if (!active) return;
    onRows(rows);
    if (cacheKey) cacheWrite(cacheKey, rows);
  };

  const load = async () => {
    try {
      const raw = await fetchRows(table, constraints);
      if (!active) return;
      rows = raw.map((r) => rowToDoc<T>(r));
      loaded = true;
      emit();
    } catch (error) {
      if (!active) return;
      // Kirilmagan holatda (anon) ruxsat xatosi kutiladi: kirgandan keyin qayta yuklanadi (pastda)
      const { data: s } = await supabase.auth.getSession();
      if (s.session) console.error(`Error watching ${table}:`, error);
      else console.warn(`watch ${table}: tizimga kirilmagan, kirgandan keyin qayta yuklanadi`);
      // Keshdan ko'rsatilgan ma'lumot bo'lsa saqlaymiz; aks holda ekranlar "loading" da qolmasin
      if (!loaded && rows.length === 0) onFailure();
    }
  };

  const scheduleLoad = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(load, 150);
  };

  // Keshdan darhol ko'rsatish (server javobi kelguncha)
  if (cacheKey) {
    cacheRead(cacheKey).then((cached) => {
      if (active && !loaded && cached) {
        rows = cached as T[];
        onRows(rows);
      }
    });
  }
  load();

  // Login'dan oldin ochilgan watch (masalan chat ro'yxati) kirgandan keyin o'zi yangilansin
  const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN") scheduleLoad();
  });

  let channel: ReturnType<typeof supabase.channel> | null = null;
  if (opts.realtime !== false) {
    channel = supabase
      .channel(`crm-${table}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "crm", table },
        (payload: any) => {
          if (!active) return;
          if (plain && loaded) {
            // Xotirada patch: to'liq qator keladi (replica identity full)
            if (payload.eventType === "DELETE") {
              const id = payload.old?.id;
              rows = rows.filter((r) => r.id !== id);
            } else {
              const doc = rowToDoc<T>(payload.new);
              const i = rows.findIndex((r) => r.id === doc.id);
              rows = i === -1 ? [...rows, doc] : rows.map((r, idx) => (idx === i ? doc : r));
            }
            rows = [...rows].sort(compare);
            emit();
          } else if (eventAffects(constraints, payload.old, payload.new)) {
            scheduleLoad();
          }
        },
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          // Aloqa uzilib qayta tiklanganda o'tkazib yuborilgan o'zgarishlar uchun
          if (hadSubscribed) scheduleLoad();
          hadSubscribed = true;
        }
      });
  }

  return () => {
    active = false;
    if (timer) clearTimeout(timer);
    authSub.subscription.unsubscribe();
    if (channel) supabase.removeChannel(channel);
  };
}

/**
 * Kolleksiya o'ramasi. `scope` — kichik kolleksiya (masalan chat xabarlari) uchun doimiy
 * `ustun == qiymat` sharti.
 */
function createCollection<T>(
  table: string,
  scope?: { column: string; value: string },
  opts: WatchOptions = {},
): CollectionMethods<T> {
  const scoped = (constraints: Constraint[]): Constraint[] =>
    scope ? [whereConstraint(scope.column, "==", scope.value), ...constraints] : constraints;

  const strip = (doc: any) => {
    if (scope) delete doc[scope.column];
    return doc;
  };

  return {
    list: async (...constraints: Constraint[]): Promise<T[]> => {
      const rows = await fetchRows(table, scoped(constraints));
      return rows.map((r) => strip({ ...rowToDoc<any>(r) }) as T);
    },

    get: async (id: string): Promise<T | null> => {
      const { data, error } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return strip(rowToDoc<any>(data)) as T;
    },

    create: async (data: Omit<T, "id">): Promise<string> => {
      const row = docToRow(data as any);
      if (scope) row[scope.column] = scope.value;
      const { data: res, error } = await supabase.from(table).insert(row).select("id").single();
      if (error) throw error;
      return res.id as string;
    },

    update: async (id: string, data: Partial<Omit<T, "id">>): Promise<void> => {
      const { error } = await supabase.from(table).update(docToRow(data as any)).eq("id", id);
      if (error) throw error;
    },

    delete: async (id: string): Promise<void> => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },

    // Firestore setDoc(merge) kabi: yo'q bo'lsa yaratadi, bo'lsa faqat berilgan maydonlarni yangilaydi
    set: async (id: string, data: Partial<T>): Promise<void> => {
      const row: Record<string, any> = { ...docToRow(data as any), id };
      if (scope) row[scope.column] = scope.value;
      const { error } = await supabase.from(table).upsert(row, { onConflict: "id" });
      if (error) throw error;
    },

    watch: (callback: (data: T[]) => void, ...constraints: Constraint[]) =>
      startWatch<any>(
        table,
        scoped(constraints),
        (rows) => callback(rows.map((r) => strip({ ...r })) as T[]),
        // Xato (masalan ruxsat yo'q) bo'lsa ham callback chaqiriladi — ekranlar abadiy "loading" da qolmasin.
        () => callback([]),
        opts,
      ),

    watchDoc: (id: string, callback: (data: WithId<T> | null) => void) =>
      startWatch<any>(
        table,
        scoped([whereConstraint("id", "==", id)]),
        (rows) => callback(rows[0] ? (strip({ ...rows[0] }) as WithId<T>) : null),
        () => callback(null),
        opts,
      ),

    sum: async (field: string, ...constraints: Constraint[]): Promise<number> => {
      const all = scoped(constraints);
      // Tez yo'l: partiya bo'yicha buyurtmalar soni — serverda yig'iladi
      const eq = all.length === 1 && all[0].kind === "where" && all[0].op === "==" ? all[0] : null;
      if (table === "orders" && field === "product_count" && eq && toColumn(eq.field) === "lot_id") {
        const { data, error } = await supabase.rpc("sum_orders_product_count", {
          p_lot_id: eq.value,
        });
        if (error) throw error;
        return Number(data) || 0;
      }
      const rows = await fetchRows(table, all);
      return rows.reduce((acc, r) => acc + (Number(r[toColumn(field)]) || 0), 0);
    },
  };
}

/** Ichki kolleksiya: `lead_chats/{id}/messages` → `lead_messages` jadvali (chat_id = parent id) */
function createSubCollection<T>(
  table: string,
  parentColumn: string,
): (parentId: string) => CollectionMethods<T> {
  return (parentId: string) => createCollection<T>(table, { column: parentColumn, value: parentId });
}

// ─── Database Exports ───────────────────────────────────────────────────────
const db = {
  // view: Realtime yo'q
  users: createCollection<User>("users", undefined, { realtime: false }),
  lots: createCollection<ProductLot>("lots"),
  orders: createCollection<Order>("orders"),
  products: createCollection<Product>("products"),
  regions: createCollection<Region>("regions"),
  districts: createCollection<District>("districts"),
  customers: createCollection<Customer>("customers"),
  tags: createCollection<Tag>("tags"),
  rates: createCollection<Rate>("rates"),
  lost_products: createCollection<LostProduct>("lost_products"),
  leads: createCollection<Lead>("leads"),
  lead_chats: createCollection<LeadChat>("lead_chats"),
  // Sub-collections
  lead_messages: createSubCollection<LeadMessage>("lead_messages", "chat_id"),
  faqs: createCollection<FAQ>("faqs"),
  settings: createCollection<any>("settings"),
  lot_expenses: createCollection<LotExpense>("lot_expenses"),
};

export default db;

// Types
export interface CollectionMethods<T> {
  list: (...constraints: Constraint[]) => Promise<T[]>;
  get: (id: string) => Promise<T | null>;
  create: (data: Omit<T, "id">) => Promise<string>;
  update: (id: string, data: Partial<Omit<T, "id">>) => Promise<void>;
  delete: (id: string) => Promise<void>;
  set: (id: string, data: Partial<T>) => Promise<void>;
  watch: (callback: (data: T[]) => void, ...constraints: Constraint[]) => () => void;
  watchDoc: (id: string, callback: (data: WithId<T> | null) => void) => () => void;
  sum: (field: string, ...constraints: Constraint[]) => Promise<number>;
}
