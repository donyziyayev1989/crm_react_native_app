import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAddress, getAddressDetails } from "../_shared/geo.ts";
import { buildFaqList, buildFaqAnswer, normalizeContactPhone } from "../_shared/menu.ts";

test("Toshkent shahri vs viloyati", () => {
  assert.equal(normalizeAddress({ state: "Toshkent", city: "Toshkent" }).region, "Toshkent shahri");
  assert.equal(normalizeAddress({ state: "Toshkent viloyati" }).region, "Toshkent viloyati");
});

test("viloyat nomlari normallashadi", () => {
  assert.equal(normalizeAddress({ state: "Fergana Region" }).region, "Farg'ona");
  assert.equal(normalizeAddress({ state: "Samarqand viloyati" }).region, "Samarqand");
  assert.equal(normalizeAddress({ state: "Republic of Karakalpakstan" }).region, "Qoraqalpog'iston Respublikasi");
  assert.equal(normalizeAddress({ state: "Qashqadaryo viloyati" }).region, "Qashqadaryo");
});

test("tuman nomidan 'tumani' olib tashlanadi", () => {
  assert.equal(normalizeAddress({ state: "Andijon viloyati", county: "Asaka tumani" }).district, "Asaka");
  // asl index.js bilan bir xil: UNKNOWN_DISTRICT dan ' tuman' qirqiladi
  assert.equal(normalizeAddress({}).district, "Noma'lum");
  assert.equal(normalizeAddress({}).region, "Noma'lum viloyat");
});

test("getAddressDetails xatoda 'Noma'lum' qaytaradi", async () => {
  const bad = () => Promise.reject(new Error("net"));
  assert.deepEqual(await getAddressDetails(1, 2, bad), {
    region: "Noma'lum viloyat",
    district: "Noma'lum tuman",
  });
});

test("getAddressDetails javobni normallashtiradi", async () => {
  let seen;
  const ok = (url) => {
    seen = String(url);
    return Promise.resolve({ ok: true, json: async () => ({ address: { state: "Namangan viloyati", county: "Chust tumani" } }) });
  };
  assert.deepEqual(await getAddressDetails(41.1, 71.2, ok, "http://x"), { region: "Namangan", district: "Chust" });
  assert.match(seen, /lat=41\.1&lon=71\.2/);
});

test("FAQ ro'yxati 5 tadan qatorlanadi", () => {
  const faqs = Array.from({ length: 7 }, (_, i) => ({ id: `id${i}`, question: `Q${i}`, answer: `A${i}` }));
  const { text, extra } = buildFaqList(faqs);
  assert.equal(extra.reply_markup.inline_keyboard.length, 2);
  assert.equal(extra.reply_markup.inline_keyboard[0].length, 5);
  assert.equal(extra.reply_markup.inline_keyboard[1][1].callback_data, "faq_id6");
  assert.match(text, /\*7\.\* Q6/);
  assert.equal(buildFaqAnswer(faqs[0]), "❓ *Q0*\n\n✅ A0");
});

test("telefon +998... ko'rinishiga keladi", () => {
  assert.equal(normalizeContactPhone("998 90 123-45-67"), "+998901234567");
  assert.equal(normalizeContactPhone("+998901234567"), "+998901234567");
});

// ─── Handler fake klientlar bilan: lead source/items va public.products ─────
function fakeClient(resolve) {
  const calls = [];
  return {
    calls,
    from(table) {
      const q = { table, ops: [] };
      calls.push(q);
      const b = new Proxy(
        {},
        {
          get(_, m) {
            if (m === "then") {
              return (ok, bad) => Promise.resolve(resolve(q)).then(ok, bad);
            }
            return (...args) => {
              q.ops.push([m, ...args]);
              return b;
            };
          },
        },
      );
      return b;
    },
  };
}

// Butun buyurtma oqimi (fake klientlar bilan); yozilgan leadlarni qaytaradi.
async function botFlow(product) {
  const { createHandler } = await import("../_shared/bot.ts");
  let session = null;
  const leads = [];
  const crm = fakeClient((q) => {
    const has = (m) => q.ops.find((o) => o[0] === m);
    if (q.table === "bot_sessions") {
      if (has("upsert")) session = has("upsert")[1].data;
      else if (has("delete")) session = null;
      else return { data: session ? { data: session } : null, error: null };
      return { error: null };
    }
    if (q.table === "leads") {
      leads.push(has("insert")[1]);
      return { error: null };
    }
    return { data: null, error: null };
  });
  // maybeSingle so'rovi uchun bitta obyekt, ro'yxat uchun massiv
  const pubSingle = fakeClient((q) =>
    q.ops.some((o) => o[0] === "maybeSingle") ? { data: product, error: null } : { data: [product], error: null },
  );
  const sent = [];
  const handler = createHandler({
    crm,
    pub: pubSingle,
    sendMessage: async (chatId, text, extra) => void sent.push({ text, extra }),
    answerCallbackQuery: async () => {},
    geocode: async () => ({ region: "Namangan", district: "Chust" }),
    webhookSecret: "s",
    log: () => {},
  });
  const post = (m) =>
    handler(
      new Request("http://x/", {
        method: "POST",
        headers: { "x-telegram-bot-api-secret-token": "s" },
        body: JSON.stringify({ message: { chat: { id: 1 }, from: { id: 2, first_name: "A" }, ...m } }),
      }),
    );
  await post({ text: "🛍 Buyurtma qilish" });
  await post({ contact: { phone_number: "998901234567" } });
  await post({ text: "Vali" });
  assert.deepEqual(sent.at(-1).extra.reply_markup.keyboard, [[{ text: "Kurka jo'ja" }]]);
  await post({ text: "Kurka jo'ja" });
  await post({ text: "50" });
  await post({ location: { latitude: 41.5, longitude: 71.2 } });
  return { leads, crm, pubSingle };
}

test("bot: lead source=telegram + items, mahsulotlar public.products dan (published)", async () => {
  const { leads, crm, pubSingle } = await botFlow({ id: "p1", price: 120000, name: "Kurka jo'ja" });

  assert.equal(leads.length, 1);
  assert.equal(leads[0].source, "telegram");
  assert.deepEqual(leads[0].items, [{ product_id: "p1", name: "Kurka jo'ja", price: 120000, quantity: 50 }]);
  assert.equal(leads[0].total, 6000000);
  assert.equal(leads[0].has_unpriced, false);
  assert.equal(leads[0].product_id, "p1");
  assert.equal(leads[0].product_count, 50);
  // mahsulotlar faqat public sxemadan va faqat published
  assert.ok(pubSingle.calls.length >= 2);
  for (const q of pubSingle.calls) {
    assert.equal(q.table, "products");
    assert.ok(q.ops.some((o) => o[0] === "eq" && o[1] === "published" && o[2] === true));
  }
  assert.ok(!crm.calls.some((q) => q.table === "products"));
});

test("bot: narxsiz mahsulot -> total 0, has_unpriced true (Narx kelishiladi)", async () => {
  const { leads } = await botFlow({ id: "p2", price: null, name: "Kurka jo'ja" });
  assert.equal(leads.length, 1);
  assert.deepEqual(leads[0].items, [{ product_id: "p2", name: "Kurka jo'ja", price: null, quantity: 50 }]);
  assert.equal(leads[0].total, 0);
  assert.equal(leads[0].has_unpriced, true);
});
