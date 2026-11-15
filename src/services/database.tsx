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
import type { ConfirmArgs } from "@/utils/leads";
import { CollectionAdapter, faqAdapter, productAdapter, uuidv4 } from "./adapters";
import { cacheRead, cacheWrite } from "./cache";
import { isOnline, subscribeConnectivity } from "./connectivity";
import {
  getOps,
  hasPending,
  onOpSettled,
  outboxEnqueue,
  outboxReady,
  registerExecutor,
  subscribeOutbox,
} from "./outbox";
import { applyOps, PendingOp } from "./overlay";
import { isNetworkError } from "@/utils/network";
import { retryDelay } from "@/utils/retry";
import {
  applyConstraints,
  Constraint,
  docToRow,
  eventAffects,
  evaluateRows,
  getLimit,
  isPlainOrdered,
  makeComparator,
  mapFields,
  rowToDoc,
  toColumn,
  toField,
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
  /** Jadval snapshot'i (oflayn o'qish uchun) saqlansin — scope'siz kolleksiyalar */
  snapshot?: boolean;
  /** Yuborilmagan oflayn yozuvlar natijaga qo'shilsin */
  offline?: boolean;
}

/** Jadval snapshot'ining kesh kaliti (filtrsiz watch to'liq jadvalni saqlaydi) */
const snapshotKey = (schema: Schema, table: string) => `snap:${schema}.${table}`;

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
  let attempt = 0; // ketma-ket muvaffaqiyatsiz yuklashlar soni
  let failedLoad = false;

  const plain = isPlainOrdered(constraints);
  const compare = makeComparator(constraints);
  const snapKey = opts.snapshot ? snapshotKey(schema, table) : null;
  const coll = opts.offline ? `${schema}.${table}` : null;

  /** Server/kesh qatorlari + yuborilmagan oflayn o'zgarishlar */
  const view = (): T[] => {
    const pending = coll ? getOps(coll) : [];
    return pending.length ? applyOps(rows, pending, constraints) : rows;
  };

  const emit = () => {
    if (!active) return;
    onRows(view());
    // Faqat to'liq (filtrsiz) server javobi snapshot bo'la oladi
    if (snapKey && plain && loaded) cacheWrite(snapKey, rows);
  };

  const load = async () => {
    try {
      const raw = await fetchRows(table, server, schema);
      if (!active) return;
      rows = raw.map(toDoc);
      loaded = true;
      failedLoad = false;
      attempt = 0;
      emit();
    } catch (error) {
      if (!active) return;
      failedLoad = true;
      // Kirilmagan holatda (anon) ruxsat xatosi kutiladi: kirgandan keyin qayta yuklanadi (pastda)
      const { data: s } = await supabase.auth.getSession();
      if (!active) return;
      if (s.session) {
        // Vaqtinchalik xato (masalan migratsiyadan keyin PostgREST sxema keshi hali yangilanmagan,
        // tarmoq uzilishi): oshib boruvchi kutish bilan qayta uriniladi, aks holda ilova qayta
        // ochilguncha bo'sh qoladi (ReferenceData har kolleksiya uchun bitta watch ochadi).
        const delay = retryDelay(attempt++);
        if (delay !== null) {
          console.warn(`watch ${table}: yuklash xatosi, ${delay} ms dan keyin qayta uriniladi`, error);
          if (timer) clearTimeout(timer);
          timer = setTimeout(load, delay);
        } else {
          console.error(`Error watching ${table}:`, error);
        }
      } else {
        console.warn(`watch ${table}: tizimga kirilmagan, kirgandan keyin qayta yuklanadi`);
      }
      // Keshdan ko'rsatilgan ma'lumot bo'lsa saqlaymiz; aks holda ekranlar "loading" da qolmasin
      if (!loaded) {
        const v = view();
        if (v.length > 0) onRows(v);
        else onFailure();
      }
    }
  };

  const scheduleLoad = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(load, 150);
  };

  // Snapshot'dan darhol ko'rsatish (server javobi kelguncha yoki internet yo'qligida)
  if (snapKey) {
    Promise.all([cacheRead(snapKey), outboxReady]).then(([snap]) => {
      if (active && !loaded && snap) {
        rows = plain ? ([...snap] as T[]).sort(compare) : evaluateRows(snap as T[], constraints);
        onRows(view());
      }
    });
  }
  load();

  // Internet qaytganda yuklanmay qolgan watch qayta urinadi; yuborilgan oflayn yozuvlar refetch qilinadi
  const unsubNet = subscribeConnectivity((on) => {
    if (on && active && (!loaded || failedLoad)) {
      attempt = 0;
      scheduleLoad();
    }
  });
  const unsubOutbox = coll
    ? subscribeOutbox(() => {
        if (!active) return;
        const v = view();
        if (loaded || rows.length > 0 || v.length > 0) onRows(v);
      })
    : () => {};
  const unsubSettled = coll
    ? onOpSettled((c) => {
        if (c === coll && active) scheduleLoad();
      })
    : () => {};

  // Login'dan oldin ochilgan watch (masalan chat ro'yxati) kirgandan keyin o'zi yangilansin
  const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN") {
      attempt = 0;
      scheduleLoad();
    }
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
          if (hadSubscribed || !loaded) scheduleLoad();
          hadSubscribed = true;
        }
      });
  }

  return () => {
    active = false;
    if (timer) clearTimeout(timer);
    authSub.subscription.unsubscribe();
    unsubNet();
    unsubOutbox();
    unsubSettled();
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
  /** Internet yo'qligida yozuvlar navbatga tushadi va ulanganda yuboriladi (scope'siz kolleksiyalar) */
  offline?: boolean;
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
  // Snapshot (oflayn o'qish) va oflayn yozuv faqat scope'siz kolleksiyalarda
  const snapshot = !scope;
  const coll = `${schema}.${table}`;
  const canOverlay = snapshot && !!opts.offline;
  const watchOpts: WatchOptions = {
    realtime: opts.realtime,
    schema,
    columns: adapter?.columns,
    snapshot,
    offline: canOverlay,
  };
  const q = () => tableOf(schema, table);

  const scoped = (constraints: Constraint[]): Constraint[] =>
    scope ? [whereConstraint(scope.column, "==", scope.value), ...constraints] : constraints;

  const strip = (doc: any) => {
    if (scope) delete doc[scope.column];
    return doc;
  };

  const toDoc = (row: Record<string, any>): any =>
    adapter ? adapter.fromRow(row) : rowToDoc<any>(row);

  /** Oxirgi server snapshot'i (oflayn o'qish uchun) */
  const snapshotDocs = async (): Promise<any[] | undefined> =>
    snapshot ? cacheRead(snapshotKey(schema, table)) : undefined;

  /** Yuborilmagan oflayn o'zgarishlarni hujjatlar ustiga qo'llash */
  const withPending = async (docs: any[], constraints?: Constraint[]): Promise<any[]> => {
    if (!canOverlay) return docs;
    await outboxReady;
    return applyOps(docs, getOps(coll), constraints);
  };

  // ─── Serverga yozish (onlayn yo'l va navbat executor'i bir xil kodni ishlatadi) ───

  /** Idempotent: qayta yuborilsa (javob yo'qolgan bo'lsa) dublikat yaratmaydi */
  const insertRow = async (row: Record<string, any>): Promise<void> => {
    const { error } = await q().upsert(row, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw error;
  };

  const updateDoc = async (id: string, data: Partial<Omit<T, "id">>): Promise<void> => {
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
  };

  const deleteDoc = async (id: string): Promise<void> => {
    const { error } = await q().delete().eq("id", id);
    if (error) throw error;
  };

  const setDoc = async (id: string, data: Partial<T>): Promise<void> => {
    if (adapter) {
      // Upsert yarim qator yozib qo'yishi mumkin (majburiy ko'p tilli ustunlar) — create/update ishlating
      throw new Error(`db.${table}.set() qo'llab-quvvatlanmaydi: create() yoki update() ishlating`);
    }
    const row: Record<string, any> = { ...docToRow(data as any), id };
    if (scope) row[scope.column] = scope.value;
    const { error } = await q().upsert(row, { onConflict: "id" });
    if (error) throw error;
  };

  if (canOverlay) {
    registerExecutor(coll, async (op: PendingOp) => {
      switch (op.kind) {
        case "create": return insertRow(op.row ?? {});
        case "update": return updateDoc(op.id, (op.data ?? {}) as any);
        case "delete": return deleteDoc(op.id);
        case "set": return setDoc(op.id, (op.data ?? {}) as any);
      }
    });
  }

  /**
   * Yozish: navbatda yuborilmagan o'zgarish bor yoki internet yo'q bo'lsa — darhol navbatga (tartib
   * buzilmasin); aks holda serverga, tarmoq xatosi bo'lsa navbatga. Boshqa xatolar chaqiruvchiga qaytadi.
   */
  const mutate = async (op: Omit<PendingOp, "opId" | "ts">, run: () => Promise<void>): Promise<void> => {
    await outboxReady;
    if (hasPending() || !isOnline()) return outboxEnqueue(op);
    try {
      await run();
    } catch (e) {
      if (!isNetworkError(e)) throw e;
      await outboxEnqueue(op);
    }
  };

  /** Server so'rovi tarmoq xatosi bilan tugasa — snapshot'dan; snapshot yo'q bo'lsa xato qaytadi */
  async function fromSnapshotOnNetworkError<R>(e: unknown, local: (snap: any[]) => R): Promise<R> {
    const snap = isNetworkError(e) ? await snapshotDocs() : undefined;
    if (!snap) throw e;
    return local(snap);
  }

  return {
    list: async (...constraints: Constraint[]): Promise<T[]> => {
      const all = scoped(constraints);
      let docs: any[];
      try {
        const rows = await fetchRows(table, mapFields(all, adapter?.columns), schema);
        docs = rows.map(toDoc);
      } catch (e) {
        docs = await fromSnapshotOnNetworkError(e, (snap) => evaluateRows(snap, all));
      }
      docs = await withPending(docs, all);
      return docs.map((d) => strip({ ...d }) as T);
    },

    get: async (id: string): Promise<T | null> => {
      let doc: any | null;
      try {
        const { data, error } = await q().select("*").eq("id", id).maybeSingle();
        if (error) throw error;
        doc = data ? toDoc(data) : null;
      } catch (e) {
        doc = await fromSnapshotOnNetworkError(e, (snap) => snap.find((r) => r.id === id) ?? null);
      }
      const merged = await withPending(doc ? [doc] : [], undefined);
      const found = merged.find((r) => r.id === id);
      return found ? (strip({ ...found }) as T) : null;
    },

    create: async (data: Omit<T, "id">): Promise<string> => {
      const row = adapter ? adapter.toRow(data as Partial<T>) : docToRow(data as any);
      if (scope) row[scope.column] = scope.value;
      if (!canOverlay) {
        const { data: res, error } = await q().insert(row).select("id").single();
        if (error) throw error;
        return res.id as string;
      }
      // Id mijozda yaratiladi: oflayn yaratilgan yozuvga ham darhol havola qilish mumkin (buyurtma → mijoz)
      const id: string = row.id ?? uuidv4();
      row.id = id;
      await mutate({ coll, kind: "create", id, data: toDoc(row), row }, () => insertRow(row));
      return id;
    },

    update: async (id: string, data: Partial<Omit<T, "id">>): Promise<void> => {
      if (!canOverlay) return updateDoc(id, data);
      await mutate({ coll, kind: "update", id, data: data as any }, () => updateDoc(id, data));
    },

    delete: async (id: string): Promise<void> => {
      if (!canOverlay) return deleteDoc(id);
      await mutate({ coll, kind: "delete", id }, () => deleteDoc(id));
    },

    // Firestore setDoc(merge) kabi: yo'q bo'lsa yaratadi, bo'lsa faqat berilgan maydonlarni yangilaydi
    set: async (id: string, data: Partial<T>): Promise<void> => {
      if (!canOverlay) return setDoc(id, data);
      await mutate({ coll, kind: "set", id, data: data as any }, () => setDoc(id, data));
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
      const col = toColumn(field);
      const localSum = async (): Promise<number | null> => {
        const snap = await snapshotDocs();
        if (!snap) return null;
        const docs = await withPending(evaluateRows(snap, all), all);
        return docs.reduce((acc, d) => acc + (Number(d[toField(col)]) || 0), 0);
      };
      // Yuborilmagan oflayn yozuvlar bo'lsa server yig'indisi eskirgan — mahalliy hisob (snapshot bor bo'lsa)
      if (canOverlay && hasPending()) {
        const local = await localSum();
        if (local !== null) return local;
      }
      try {
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
        return rows.reduce((acc, r) => acc + (Number(r[col]) || 0), 0);
      } catch (e) {
        const local = isNetworkError(e) ? await localSum() : null;
        if (local === null) throw e;
        return local;
      }
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
  lots: createCollection<ProductLot>("lots", undefined, { schema: "public", offline: true }),
  orders: createCollection<Order>("orders", undefined, { offline: true }),
  products: createCollection<Product>("products", undefined, {
    schema: "public",
    adapter: productAdapter(),
    offline: true,
  }),
  regions: createCollection<Region>("regions"),
  districts: createCollection<District>("districts"),
  customers: createCollection<Customer>("customers", undefined, { offline: true }),
  tags: createCollection<Tag>("tags", undefined, { schema: "public", offline: true }),
  rates: createCollection<Rate>("rates"),
  lost_products: createCollection<LostProduct>("lost_products", undefined, {
    schema: "public",
    offline: true,
  }),
  leads: createCollection<Lead>("leads"),
  lead_chats: createCollection<LeadChat>("lead_chats"),
  // Sub-collections
  lead_messages: createSubCollection<LeadMessage>("lead_messages", "chat_id"),
  faqs: createCollection<FAQ>("faqs", undefined, { schema: "public", adapter: faqAdapter }),
  settings: createCollection<any>("settings"),
  lot_expenses: createCollection<LotExpense>("lot_expenses", undefined, {
    schema: "public",
    offline: true,
  }),
};

export default db;

/**
 * Leadni tasdiqlash (`crm.confirm_lead`): bitta tranzaksiyada mijoz (customerId null bo'lsa
 * leaddan yaratiladi), har item uchun buyurtma va lead → 'confirmed'.
 * Xato Postgres exception message bilan keladi (`utils/leads.ts: confirmErrorMessage`).
 */
export async function confirmLead(args: ConfirmArgs): Promise<{
  customer_id: string;
  order_ids: string[];
}> {
  const { data, error } = await supabase.rpc("confirm_lead", {
    p_lead_id: args.leadId,
    p_customer_id: args.customerId, // null — yangi mijoz ('' emas)
    p_lot_id: args.lotId,
    p_delivery_price: args.deliveryPrice,
    p_item_prices: args.itemPrices,
  });
  if (error) throw error;
  const res = (data ?? {}) as { customer_id?: string; order_ids?: string[] };
  return { customer_id: res.customer_id ?? "", order_ids: res.order_ids ?? [] };
}

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
