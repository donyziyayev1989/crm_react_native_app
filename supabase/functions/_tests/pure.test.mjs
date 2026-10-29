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
