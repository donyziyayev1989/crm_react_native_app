// To'liq bot oqimi lokal Supabase (crm sxema) ga qarshi. Telegram API mock qilinadi.
// Ishga tushirish: SUPABASE_TEST_URL=http://127.0.0.1:55321 SUPABASE_TEST_SERVICE_KEY=... node --test "_tests/*.test.mjs"
// Agar env berilmasa, test o'tkazib yuboriladi. supabase-js topilmasa SUPABASE_JS_PATH (papka) bering.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createHandler } from "../_shared/bot.ts";

const url = process.env.SUPABASE_TEST_URL;
const key = process.env.SUPABASE_TEST_SERVICE_KEY;
const skip = !url || !key;

const SECRET = "test-secret";
const CHAT = 777000111;
const TG_ID = 555000222;

test("bot: buyurtma oqimi → lead, keyin chat xabari", { skip }, async (t) => {
  const req = createRequire((process.env.SUPABASE_JS_PATH ?? process.cwd()) + "/");
  const { createClient } = req("@supabase/supabase-js");
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const crm = sb.schema("crm");
  const pub = sb.schema("public");

  const sent = [];
  const handler = createHandler({
    crm,
    pub,
    sendMessage: async (chatId, text, extra) => void sent.push({ chatId, text, extra }),
    answerCallbackQuery: async () => {},
    geocode: async () => ({ region: "Namangan", district: "Chust" }),
    webhookSecret: SECRET,
    log: (...a) => console.error("[bot-log]", ...a),
  });

  const post = (body, secret = SECRET) =>
    handler(
      new Request("http://x/", {
        method: "POST",
        headers: { "x-telegram-bot-api-secret-token": secret, "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  const msg = (extra) => ({ message: { chat: { id: CHAT }, from: { id: TG_ID, first_name: "Ali" }, ...extra } });

  // tozalash + ma'lumot tayyorlash
  const cleanup = async () => {
    await crm.from("bot_sessions").delete().eq("chat_id", String(CHAT));
    await crm.from("lead_chats").delete().eq("lead_id", "bot-test-lead");
    await crm.from("leads").delete().eq("telegram_id", String(TG_ID));
    await pub.from("products").delete().like("id", "bot-test-%");
    await pub.from("faqs").delete().like("id", "bot-test-%");
    await crm.from("settings").delete().eq("id", "about_us");
  };
  await cleanup();
  t.after(cleanup);

  const loc = (v) => ({ uz: v, ru: v, en: v });
  const product = (id, name, published, price) => ({
    id,
    slug: loc(id),
    name: { uz: name, ru: name + " ru", en: name + " en" },
    summary: loc("s"),
    description: loc("d"),
    features: { uz: [], ru: [], en: [] },
    published,
    price,
  });
  const ins1 = await pub.from("products").insert([
    product("bot-test-a", "Kurka jo'ja", true, 15000),
    product("bot-test-b", "Yashirin", false, 1000),
  ]);
  assert.equal(ins1.error, null);
  const ins2 = await pub.from("faqs").insert([
    { id: "bot-test-f", question: { uz: "Yetkazish?", ru: "RU?", en: "EN?" }, answer: { uz: "Ha", ru: "Da", en: "Yes" }, published: true },
    { id: "bot-test-g", question: loc("Yashirin savol"), answer: loc("x"), published: false },
  ]);
  assert.equal(ins2.error, null);
  await crm.from("settings").insert({ id: "about_us", text: "Biz haqimizda matni" });

  // secret
  assert.equal((await post({}, "wrong")).status, 401);
  const noSecret = createHandler({ crm, pub, sendMessage() {}, answerCallbackQuery() {}, geocode() {}, webhookSecret: undefined });
  assert.equal((await noSecret(new Request("http://x/", { method: "POST", body: "{}" }))).status, 401);

  // buyurtma oqimi
  assert.equal((await post(msg({ text: "/start" }))).status, 200);
  assert.match(sent.at(-1).text, /xush kelibsiz/);

  await post(msg({ text: "🛍 Buyurtma qilish" }));
  await post(msg({ contact: { phone_number: "998901234567" } }));
  assert.match(sent.at(-1).text, /ismingizni/);

  await post(msg({ text: "Vali" }));
  const kb = sent.at(-1).extra.reply_markup.keyboard;
  // umumiy bazada boshqa published mahsulotlar ham bo'lishi mumkin
  const names = kb.map((r) => r[0].text);
  assert.ok(names.includes("Kurka jo'ja"));
  assert.ok(!names.includes("Yashirin")); // published=false chiqmaydi

  await post(msg({ text: "Yashirin" }));
  assert.match(sent.at(-1).text, /ro'yxatdagilardan/);
  await post(msg({ text: "Kurka jo'ja" }));
  assert.match(sent.at(-1).text, /Nechta Kurka jo'ja/);

  await post(msg({ text: "abc" }));
  assert.match(sent.at(-1).text, /faqat raqam/);
  await post(msg({ text: "50" }));
  assert.match(sent.at(-1).text, /lokatsiya/);

  await post(msg({ location: { latitude: 41.5, longitude: 71.2 } }));
  assert.match(sent.at(-1).text, /Buyurtmangiz qabul qilindi/);

  const { data: leads } = await crm.from("leads").select("*").eq("telegram_id", String(TG_ID));
  assert.equal(leads.length, 1);
  const lead = leads[0];
  assert.equal(lead.name, "Vali");
  assert.equal(lead.phone, "+998901234567");
  assert.equal(lead.product_id, "bot-test-a");
  assert.equal(Number(lead.product_count), 50);
  assert.equal(lead.source, "telegram");
  assert.equal(lead.items.length, 1);
  assert.equal(lead.items[0].product_id, "bot-test-a");
  assert.equal(lead.items[0].name, "Kurka jo'ja");
  assert.equal(Number(lead.items[0].price), 15000);
  assert.equal(lead.items[0].quantity, 50);
  assert.equal(Number(lead.total), 15000 * 50);
  assert.equal(lead.has_unpriced, false);
  assert.equal(lead.region_name, "Namangan");
  assert.equal(lead.district_name, "Chust");
  assert.deepEqual(lead.location, { lat: 41.5, lng: 71.2 });
  assert.equal(lead.state, "new");
  const { data: sess } = await crm.from("bot_sessions").select("*").eq("chat_id", String(CHAT));
  assert.equal(sess.length, 0);

  // FAQ + about
  await post(msg({ text: "❓ Eng ko'p beriladigan savollar" }));
  assert.match(sent.at(-1).text, /Yetkazish\?/);
  const faqBtns = sent.at(-1).extra.reply_markup.inline_keyboard.flat().map((b) => b.callback_data);
  assert.ok(faqBtns.includes("faq_bot-test-f"));
  assert.ok(!faqBtns.includes("faq_bot-test-g")); // published=false chiqmaydi
  await post({ callback_query: { id: "cb1", data: "faq_bot-test-f", message: { chat: { id: CHAT } } } });
  assert.match(sent.at(-1).text, /✅ Ha/);
  await post(msg({ text: "ℹ️ Biz haqimizda" }));
  assert.equal(sent.at(-1).text, "Biz haqimizda matni");

  // oddiy matn → lead chat (sessiya yo'q, lead bor)
  await post(msg({ text: "Salom, qachon keladi?" }));
  await post(msg({ text: "Yana savol" }));
  const { data: chat } = await crm.from("lead_chats").select("*").eq("id", lead.id).single();
  assert.equal(chat.unread_count, 2);
  assert.equal(chat.last_message, "Yana savol");
  const { data: msgs } = await crm.from("lead_messages").select("*").eq("chat_id", lead.id).order("timestamp");
  assert.deepEqual(msgs.map((m) => [m.sender, m.text]), [["customer", "Salom, qachon keladi?"], ["customer", "Yana savol"]]);

  // noma'lum foydalanuvchi → menyu
  await crm.from("leads").delete().eq("id", lead.id);
  await post(msg({ text: "Salom" }));
  assert.match(sent.at(-1).text, /menyudan foydalaning/);
  await crm.from("lead_chats").delete().eq("id", lead.id);
});
