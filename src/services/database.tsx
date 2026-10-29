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
import { CollectionAdapter, faqAdapter, productAdapter } from "./adapters";
import { cacheRead, cacheWrite } from "./cache";
import {
  applyConstraints,
  Constraint,
  docToRow,
  eventAffects,
  getLimit,
  isPlainOrdered,
  makeComparator,
  mapFields,
  rowToDoc,
  toColumn,
  where as whereConstraint,
} from "./query";

// Cheklov quruvchilar: ilgari Firestore SDK'dan edi, endi o'z (bir xil imzoli) versiyalar.
export { where, orderBy, limit } from "./query";

const PAGE = 1000; // PostgREST max_rows

/**
 * `crm` — CRM jadvallari (klient default'i); `public` — sayt bilan umumiy jadvallar
 * (lots, tags, lost_products, lot_expenses, products, faqs). Realtime ham shu sxemada tinglanadi.
 */
type Schema = "public" | "crm";

const tableOf = (schema: Schema, table: string) => supabase.schema(schema).from(table);

/**
 * Hamma qatorlarni oladi. Limit berilmagan bo'lsa 1000 talik sahifalar bilan
 * (aks holda server jimgina 1000 ta bilan kesib tashlaydi).
 */
async function fetchRows(
  table: string,
  constraints: Constraint[],
  schema: Schema = "crm",
): Promise<Record<string, any>[]> {
  const lim = getLimit(constraints);

  if (lim !== null) {
    const { data, error } = await applyConstraints(
      tableOf(schema, table).select("*") as any,
      constraints,
    );
    if (error) throw error;
    return data ?? [];
  }

  const all: Record<string, any>[] = [];
  for (let from = 0; ; from += PAGE) {
    // `id` bo'yicha qo'shimcha tartib — sahifalar orasida qatorlar qaytarilmasligi uchun
    const q = applyConstraints(tableOf(schema, table).select("*") as any, constraints)
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
  /** Default: `crm` */
  schema?: Schema;
  /** Filtr/tartib uchun maydon → ustun ifodasi (adapterdan) */
  columns?: Record<string, string>;
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
  toDoc: (row: Record<string, any>) => T = (row) => rowToDoc<T>(row),
): () => void {
  const schema = opts.schema ?? "crm";
  // Server so'rovi va Realtime filtri ustunlar bilan; xotiradagi tartib — hujjat maydonlari bilan
  const server = mapFields(constraints, opts.columns);
  let active = true;
  let loaded = false;
  let hadSubscribed = false;
  let rows: T[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const plain = isPlainOrdered(constraints);
  const compare = makeComparator(constraints);
  const cacheKey = plain
    ? `${schema === "crm" ? "" : `${schema}.`}${table}|${constraints.map((c) => (c.kind === "orderBy" ? `${c.field}:${c.dir}` : "")).join(",")}`
    : null;

  const emit = () => {
    if (!active) return;
    onRows(rows);
    if (cacheKey) cacheWrite(cacheKey, rows);
  };

  const load = async () => {
    try {
      const raw = await fetchRows(table, server, schema);
      if (!active) return;
      rows = raw.map(toDoc);
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
      .channel(`${schema}-${table}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes" as any,
        { event: "*", schema, table },
        (payload: any) => {
          if (!active) return;
          if (plain && loaded) {
            // Xotirada patch: to'liq qator keladi (replica identity full)
            if (payload.eventType === "DELETE") {
              const id = payload.old?.id;
              rows = rows.filter((r) => r.id !== id);
            } else {
              const doc = toDoc(payload.new);
              const i = rows.findIndex((r) => r.id === doc.id);
              rows = i === -1 ? [...rows, doc] : rows.map((r, idx) => (idx === i ? doc : r));
            }
            rows = [...rows].sort(compare);
            emit();
          } else if (eventAffects(server, payload.old, payload.new)) {
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

interface CollectionOptions<T> {
  /** Default: `crm` */
  schema?: Schema;
  /** Jadvalda Realtime yo'q (masalan view) */
  realtime?: boolean;
  /** Qator <-> hujjat moslashtiruvchi (ko'p tilli sayt jadvallari); yo'q bo'lsa camelCase xaritasi */
  adapter?: CollectionAdapter<T>;
}

/**
 * Kolleksiya o'ramasi. `scope` — kichik kolleksiya (masalan chat xabarlari) uchun doimiy
 * `ustun == qiymat` sharti.
 */
function createCollection<T>(
  table: string,
  scope?: { column: string; value: string },
  opts: CollectionOptions<T> = {},
): CollectionMethods<T> {
  const schema: Schema = opts.schema ?? "crm";
  const adapter = opts.adapter;
  const watchOpts: WatchOptions = { realtime: opts.realtime, schema, columns: adapter?.columns };
  const q = () => tableOf(schema, table);

  const scoped = (constraints: Constraint[]): Constraint[] =>
    scope ? [whereConstraint(scope.column, "==", scope.value), ...constraints] : constraints;

  const strip = (doc: any) => {
    if (scope) delete doc[scope.column];
    return doc;
  };

  const toDoc = (row: Record<string, any>): any =>
    adapter ? adapter.fromRow(row) : rowToDoc<any>(row);

  return {
    list: async (...constraints: Constraint[]): Promise<T[]> => {
      const rows = await fetchRows(table, mapFields(scoped(constraints), adapter?.columns), schema);
      return rows.map((r) => strip({ ...toDoc(r) }) as T);
    },

    get: async (id: string): Promise<T | null> => {
      const { data, error } = await q().select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return strip(toDoc(data)) as T;
    },

    create: async (data: Omit<T, "id">): Promise<string> => {
      const row = adapter ? adapter.toRow(data as Partial<T>) : docToRow(data as any);
      if (scope) row[scope.column] = scope.value;
      const { data: res, error } = await q().insert(row).select("id").single();
      if (error) throw error;
      return res.id as string;
    },

    update: async (id: string, data: Partial<Omit<T, "id">>): Promise<void> => {
      let row: Record<string, any>;
      if (adapter) {
        // Ko'p tilli ustunlar: mavjud jsonb o'qiladi va faqat `uz` almashtiriladi (ru/en saqlanadi)
        const touches = adapter.mergeColumns.some((c) => (data as any)[c] !== undefined);
        let existing: Record<string, any> = {};
        if (touches) {
          const { data: cur, error } = await q()
            .select(adapter.mergeColumns.join(","))
            .eq("id", id)
            .maybeSingle();
          if (error) throw error;
          if (!cur) return; // qator yo'q — oddiy update kabi hech narsa qilinmaydi
          existing = cur as Record<string, any>;
        }
        row = adapter.toRow(data as Partial<T>, existing);
        if (Object.keys(row).length === 0) return;
      } else {
        row = docToRow(data as any);
      }
      const { error } = await q().update(row).eq("id", id);
      if (error) throw error;
    },

    delete: async (id: string): Promise<void> => {
      const { error } = await q().delete().eq("id", id);
      if (error) throw error;
    },

    // Firestore setDoc(merge) kabi: yo'q bo'lsa yaratadi, bo'lsa faqat berilgan maydonlarni yangilaydi
    set: async (id: string, data: Partial<T>): Promise<void> => {
      if (adapter) {
        // Upsert yarim qator yozib qo'yishi mumkin (majburiy ko'p tilli ustunlar) — create/update ishlating
        throw new Error(`db.${table}.set() qo'llab-quvvatlanmaydi: create() yoki update() ishlating`);
      }
      const row: Record<string, any> = { ...docToRow(data as any), id };
      if (scope) row[scope.column] = scope.value;
      const { error } = await q().upsert(row, { onConflict: "id" });
      if (error) throw error;
    },

    watch: (callback: (data: T[]) => void, ...constraints: Constraint[]) =>
      startWatch<any>(
        table,
        scoped(constraints),
        (rows) => callback(rows.map((r) => strip({ ...r })) as T[]),
        // Xato (masalan ruxsat yo'q) bo'lsa ham callback chaqiriladi — ekranlar abadiy "loading" da qolmasin.
        () => callback([]),
        watchOpts,
        toDoc,
      ),

    watchDoc: (id: string, callback: (data: WithId<T> | null) => void) =>
      startWatch<any>(
        table,
        scoped([whereConstraint("id", "==", id)]),
        (rows) => callback(rows[0] ? (strip({ ...rows[0] }) as WithId<T>) : null),
        () => callback(null),
        watchOpts,
        toDoc,
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
      const rows = await fetchRows(table, mapFields(all, adapter?.columns), schema);
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
  // Sayt bilan umumiy jadvallar — `public` sxemasida (crm'dagi bir xil nomli view'lar eski build'lar uchun)
  lots: createCollection<ProductLot>("lots", undefined, { schema: "public" }),
  orders: createCollection<Order>("orders"),
  products: createCollection<Product>("products", undefined, {
    schema: "public",
    adapter: productAdapter(),
  }),
  regions: createCollection<Region>("regions"),
  districts: createCollection<District>("districts"),
  customers: createCollection<Customer>("customers"),
  tags: createCollection<Tag>("tags", undefined, { schema: "public" }),
  rates: createCollection<Rate>("rates"),
  lost_products: createCollection<LostProduct>("lost_products", undefined, { schema: "public" }),
  leads: createCollection<Lead>("leads"),
  lead_chats: createCollection<LeadChat>("lead_chats"),
  // Sub-collections
  lead_messages: createSubCollection<LeadMessage>("lead_messages", "chat_id"),
  faqs: createCollection<FAQ>("faqs", undefined, { schema: "public", adapter: faqAdapter }),
  settings: createCollection<any>("settings"),
  lot_expenses: createCollection<LotExpense>("lot_expenses", undefined, { schema: "public" }),
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
