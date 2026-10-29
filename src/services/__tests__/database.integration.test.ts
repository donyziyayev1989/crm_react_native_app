/**
 * Adapter integratsiya testi — LOKAL Supabase stekka qarshi (migratsiyalar 0001-0008 qo'llangan).
 * Ishga tushirish:
 *   SUPABASE_TEST_URL=http://127.0.0.1:55321 SUPABASE_TEST_ANON_KEY=... SUPABASE_TEST_SERVICE_KEY=... npx jest database.integration
 * Muhit o'zgaruvchilari bo'lmasa o'tkazib yuboriladi. Faqat 127.0.0.1/localhost ga yozadi.
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_TEST_URL;
const ANON = process.env.SUPABASE_TEST_ANON_KEY;
const SERVICE = process.env.SUPABASE_TEST_SERVICE_KEY;
const enabled = !!(URL && ANON && SERVICE && /127\.0\.0\.1|localhost/.test(URL));
const d = enabled ? describe : describe.skip;

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

const waitFor = async (cond: () => boolean, ms = 8000) => {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error("waitFor timeout");
    await new Promise((r) => setTimeout(r, 50));
  }
};

d("db adapter (lokal Supabase)", () => {
  let db: typeof import("../database").default;
  let q: typeof import("../database");
  let supabase: typeof import("../../supabase/client").supabase;
  let admin: any;
  const tag = `it${Date.now()}`;
  const email = `${tag}@test.local`;

  beforeAll(async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = URL;
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = ANON;
    admin = createClient(URL!, SERVICE!, { auth: { persistSession: false } });
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: "test-pass-123",
      email_confirm: true,
    });
    if (error) throw error;
    await admin.from("profiles").insert({ id: data.user!.id, role: "operator", name: "IT User" });

    q = require("../database");
    db = q.default;
    supabase = require("../../supabase/client").supabase;
    const { error: e2 } = await supabase.auth.signInWithPassword({ email, password: "test-pass-123" });
    if (e2) throw e2;
  }, 30000);

  afterAll(async () => {
    await admin.schema("crm").from("lots").delete().like("name", `${tag}%`);
    await admin.schema("crm").from("customers").delete().like("name", `${tag}%`);
    await admin.schema("crm").from("lead_chats").delete().like("id", `${tag}%`);
    await admin.schema("crm").from("faqs").delete().like("question", `${tag}%`);
    await admin.schema("crm").from("settings").delete().like("id", `${tag}%`);
    await supabase?.auth.signOut();
    const { data } = await admin.auth.admin.listUsers();
    const u = data.users.find((x: any) => x.email === email);
    if (u) await admin.auth.admin.deleteUser(u.id);
    await supabase?.removeAllChannels();
  }, 30000);

  it("create/get/update/delete va camelCase maydonlar", async () => {
    const lotId = await db.lots.create({ name: `${tag}-lot`, date: "2026-10-01", product_count: 100, lost_products: 0 });
    const got = await db.lots.get(lotId);
    expect(got).toMatchObject({ id: lotId, name: `${tag}-lot`, product_count: 100 });

    await db.lots.update(lotId, { product_count: 120 });
    expect((await db.lots.get(lotId))!.product_count).toBe(120);

    const lostId = await db.lost_products.create({ lotId, count: 3, date: "2026-10-02", timestamp: 1730000000000 });
    const lost = await db.lost_products.list(q.where("lotId", "==", lotId));
    expect(lost).toEqual([expect.objectContaining({ id: lostId, lotId, count: 3, timestamp: 1730000000000 })]);

    await db.lost_products.delete(lostId);
    expect(await db.lost_products.get(lostId)).toBeNull();
    await db.lots.delete(lotId);
    expect(await db.lots.get(lotId)).toBeNull();
  });

  it("set upsert (merge) va settings", async () => {
    const id = `${tag}-about`;
    await db.settings.set(id, { text: "bir", updatedAt: "x" } as any);
    await db.settings.set(id, { text: "ikki" } as any);
    expect(await db.settings.get(id)).toMatchObject({ id, text: "ikki", updatedAt: "x" });
  });

  it("list 1000 dan ko'p qatorni sahifalab oladi", async () => {
    const rows = Array.from({ length: 1150 }, (_, i) => ({
      name: `${tag}-c${String(i).padStart(4, "0")}`,
      phone: `+99890${String(i).padStart(7, "0")}`,
    }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await admin.schema("crm").from("customers").insert(rows.slice(i, i + 500));
      if (error) throw error;
    }
    const all = await db.customers.list(q.orderBy("name", "asc"));
    const mine = all.filter((c) => c.name.startsWith(tag));
    expect(mine).toHaveLength(1150);
    expect(new Set(mine.map((c: any) => c.id)).size).toBe(1150);
  }, 60000);

  it("bo'sh user_id ('') null sifatida saqlanadi (ilova shunday yuboradi)", async () => {
    const id = await db.customers.create({
      name: `${tag}-empty`, region_name: "R", phone: "+998900000000", user_id: "",
      tag_ids: [], note: "", rates: 0, order_ids: [],
    } as any);
    expect((await db.customers.get(id))!.user_id).toBeNull();
  });

  it("prefiks qidiruv, in, array-contains, limit", async () => {
    const id = await db.customers.create({
      name: `${tag}-Ali`, region_name: "Toshkent", phone: "+998901112233",
      tag_ids: ["t1", "t2"], note: "", rates: 0, order_ids: ["L9"],
    } as any);
    const pre = await db.customers.list(q.where("name", ">=", `${tag}-al`), q.where("name", "<=", `${tag}-al`), q.limit(20));
    expect(pre.map((c: any) => c.id)).toContain(id);
    expect((await db.customers.list(q.where("phone", "in", ["+998901112233", "x"]))).map((c: any) => c.id)).toEqual([id]);
    expect((await db.customers.list(q.where("tag_ids", "array-contains", "t2"))).map((c: any) => c.id)).toEqual([id]);
    expect((await db.customers.list(q.where("order_ids", "array-contains", "L9"))).map((c: any) => c.id)).toEqual([id]);
    expect(await db.customers.list(q.orderBy("name"), q.limit(3))).toHaveLength(3);
  });

  it("sum RPC", async () => {
    const lotId = await db.lots.create({ name: `${tag}-sum`, date: "2026-10-01", product_count: 0, lost_products: 0 });
    for (const n of [10, 15]) {
      await db.orders.create({
        lotId, customer_id: "c", product_id: "p", product_count: n, product_price: 1, region_name: "r",
        date: "2026-10-01", rate: 0, state: "new", delivery_price: 0,
      } as any);
    }
    expect(await db.orders.sum("product_count", q.where("lotId", "==", lotId))).toBe(25);
    await admin.schema("crm").from("orders").delete().eq("lot_id", lotId);
    await db.lots.delete(lotId);
  });

  it("watch (filtrsiz) Realtime orqali xotirada yangilanadi; watchDoc; unsubscribe", async () => {
    let latest: any[] = [];
    const unsub = db.faqs.watch((rows) => (latest = rows), q.orderBy("created_at" as any, "asc"));
    await waitFor(() => latest !== undefined);
    await new Promise((r) => setTimeout(r, 1500)); // kanal ulanishi

    const id = await db.faqs.create({ question: `${tag}-q1`, answer: "a", createdAt: "2026-10-01" } as any);
    await waitFor(() => latest.some((f) => f.id === id));

    let doc: any = undefined;
    const unsubDoc = db.faqs.watchDoc(id, (x) => (doc = x));
    await waitFor(() => doc && doc.question === `${tag}-q1`);
    await db.faqs.update(id, { question: `${tag}-q2` });
    await waitFor(() => doc.question === `${tag}-q2`);
    await waitFor(() => latest.find((f) => f.id === id)?.question === `${tag}-q2`);

    await db.faqs.delete(id);
    await waitFor(() => doc === null);
    await waitFor(() => !latest.some((f) => f.id === id));
    unsub();
    unsubDoc();
  }, 30000);

  it("lead_messages sub-kolleksiya: chat_id yashirin, scope bo'yicha", async () => {
    const chatId = `${tag}-chat`;
    await db.lead_chats.set(chatId, { lead_id: chatId, unread_count: 0 });
    const m = db.lead_messages(chatId);
    const id = await m.create({ text: "salom", sender: "operator", timestamp: "2026-10-01T10:00:00Z" });
    const list = await m.list(q.orderBy("timestamp", "asc"));
    expect(list).toEqual([expect.objectContaining({ id, text: "salom", sender: "operator" })]);
    expect(list[0]).not.toHaveProperty("chat_id");

    let seen: any[] = [];
    const un = m.watch((rows) => (seen = rows), q.orderBy("timestamp", "asc"));
    await waitFor(() => seen.length === 1);
    await new Promise((r) => setTimeout(r, 1500));
    await admin.schema("crm").rpc("bot_append_customer_message", { p_chat_id: chatId, p_text: "mijoz" });
    await waitFor(() => seen.length === 2);
    expect(seen[1]).toMatchObject({ sender: "customer", text: "mijoz" });
    expect((await db.lead_chats.get(chatId))!.unread_count).toBe(1);
    un();
  }, 30000);

  it("RLS: staff bo'lmagan va anonim kirish rad etiladi; users view faqat staffga", async () => {
    const anon = createClient(URL!, ANON!, { auth: { persistSession: false } });
    const { data } = await anon.schema("crm").from("lots").select("*");
    expect(data ?? []).toEqual([]);
    const users = await db.users.list();
    expect(users.some((u: any) => u.email === email)).toBe(true);
  });
});
