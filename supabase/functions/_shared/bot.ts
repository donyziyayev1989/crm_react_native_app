// Telegram webhook mantiqi. Deno ham, Node ham ishlata oladi: tashqi bog'liqliklar `deps` orqali beriladi.
// Xatti-harakat functions/index.js (Firebase) bilan bir xil; yaxshilanishlar: secret_token tekshiruvi,
// har doim 200, faqat active mahsulotlar.

import {
  BTN_ABOUT,
  BTN_BACK,
  BTN_FAQ,
  BTN_ORDER,
  buildFaqAnswer,
  buildFaqList,
  CONTACT_KEYBOARD,
  CONTACT_PROMPT,
  type Faq,
  HELP_TEXT,
  LEAD_DONE_TEXT,
  LOCATION_KEYBOARD,
  LOCATION_PROMPT,
  MAIN_MENU,
  normalizeContactPhone,
  REMOVE_KEYBOARD,
  WELCOME_TEXT,
} from "./menu.ts";
import type { AddressDetails } from "./geo.ts";

/** supabase-js `client.schema("crm")` ga mos minimal tur (testlarda ham shu beriladi). */
// deno-lint-ignore no-explicit-any
export type CrmClient = any;

export interface BotDeps {
  crm: CrmClient;
  /** `supabase.schema("public")`: umumiy products va faqs shu yerdan o'qiladi. */
  pub: CrmClient;
  sendMessage: (chatId: number | string, text: string, extra?: Record<string, unknown>) => Promise<void>;
  answerCallbackQuery: (id: string, text?: string) => Promise<void>;
  geocode: (lat: number, lng: number) => Promise<AddressDetails>;
  /** Majburiy: sozlanmagan bo'lsa barcha so'rovlar 401 bilan rad etiladi. */
  webhookSecret: string | undefined;
  now?: () => number;
  log?: (...args: unknown[]) => void;
}

const FAQ_CACHE_TTL = 60 * 60 * 1000; // 1 soat

type Session = Record<string, unknown> & { step?: string };

export function createHandler(deps: BotDeps) {
  const { crm, pub, sendMessage, answerCallbackQuery, geocode } = deps;
  const now = deps.now ?? Date.now;
  const log = deps.log ?? console.error;

  let faqCache: Faq[] | null = null;
  let lastFaqUpdate = 0;

  async function getCachedFaqs(): Promise<Faq[]> {
    if (faqCache && now() - lastFaqUpdate < FAQ_CACHE_TTL) return faqCache;
    try {
      const { data, error } = await pub
        .from("faqs")
        .select("id, question:question->>uz, answer:answer->>uz")
        .eq("published", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      faqCache = data as Faq[];
      lastFaqUpdate = now();
      return faqCache;
    } catch (err) {
      log("GetFaqs Error:", (err as Error).message);
      return faqCache || [];
    }
  }

  async function getSession(chatId: string): Promise<{ exists: boolean; data: Session }> {
    const { data, error } = await crm.from("bot_sessions").select("data").eq("chat_id", chatId).maybeSingle();
    if (error) throw error;
    return data ? { exists: true, data: data.data as Session } : { exists: false, data: { step: "start" } };
  }

  async function setSession(chatId: string, data: Session) {
    const { error } = await crm
      .from("bot_sessions")
      .upsert({ chat_id: chatId, data, updated_at: new Date(now()).toISOString() });
    if (error) throw error;
  }

  async function deleteSession(chatId: string) {
    const { error } = await crm.from("bot_sessions").delete().eq("chat_id", chatId);
    if (error) throw error;
  }

  // deno-lint-ignore no-explicit-any
  async function handleUpdate(update: any) {
    // 1. Callback query (FAQ)
    if (update?.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message.chat.id;
      const data: string = cb.data ?? "";

      if (data.startsWith("faq_")) {
        const faqId = data.replace("faq_", "");
        const faqs = await getCachedFaqs();
        const faq = faqs.find((f) => f.id === faqId);
        if (faq) {
          await sendMessage(chatId, buildFaqAnswer(faq), { parse_mode: "Markdown" });
        } else {
          await sendMessage(chatId, "Kechirasiz, bu savolga javob topilmadi.");
        }
      }
      await answerCallbackQuery(cb.id);
      return;
    }

    if (!update?.message) return;

    const message = update.message;
    const chatId = message.chat.id;
    const chatKey = String(chatId);
    const text: string | undefined = message.text;
    const contact = message.contact;
    const location = message.location;
    const telegramId = String(message.from.id);

    const session = await getSession(chatKey);
    const sessionData = session.data;

    // ─── Komandalar ──────────────────────────────────────────────────────
    if (text === "/start") {
      await setSession(chatKey, { step: "start" });
      await sendMessage(chatId, WELCOME_TEXT, MAIN_MENU);
      return;
    }

    if (text === "/help") {
      await sendMessage(chatId, HELP_TEXT, MAIN_MENU);
      return;
    }

    // ─── Asosiy menyu ────────────────────────────────────────────────────
    if (text === BTN_ORDER) {
      await setSession(chatKey, { step: "request_contact" });
      await sendMessage(chatId, CONTACT_PROMPT, CONTACT_KEYBOARD);
      return;
    }

    if (text === BTN_ABOUT) {
      let info = "";
      try {
        const { data, error } = await crm.from("settings").select("text").eq("id", "about_us").maybeSingle();
        if (error) throw error;
        if (data) info = data.text ?? "";
      } catch (e) {
        log("Fetch about_us error:", e);
      }
      await sendMessage(chatId, info, MAIN_MENU);
      return;
    }

    if (text === BTN_FAQ) {
      const faqs = await getCachedFaqs();
      if (faqs.length === 0) {
        await sendMessage(chatId, "Hozircha savollar yo'q.", MAIN_MENU);
      } else {
        const { text: msg, extra } = buildFaqList(faqs);
        await sendMessage(chatId, msg, extra);
      }
      return;
    }

    if (text === BTN_BACK) {
      await setSession(chatKey, { step: "start" });
      await sendMessage(chatId, "Asosiy menyuga qaytdingiz:", MAIN_MENU);
      return;
    }

    // ─── 1: Kontakt ──────────────────────────────────────────────────────
    if (contact && sessionData.step === "request_contact") {
      await setSession(chatKey, {
        step: "request_name",
        phoneNumber: normalizeContactPhone(contact.phone_number),
        telegram_id: telegramId,
        first_name: message.from.first_name || "",
      });
      await sendMessage(
        chatId,
        "Rahmat! Iltimos, ismingizni yozib yuboring (Siz bilan muloqot qilish uchun):",
        REMOVE_KEYBOARD,
      );
      return;
    }

    // ─── 2: Ism ──────────────────────────────────────────────────────────
    if (text && sessionData.step === "request_name") {
      const { data: products, error } = await pub
        .from("products")
        .select("id, price, name:name->>uz")
        .eq("published", true)
        .order("sort_order", { ascending: true })
        .order("name->>uz", { ascending: true });
      if (error) throw error;

      if (!products || products.length === 0) {
        await setSession(chatKey, { ...sessionData, name: text, step: "request_count" });
        await sendMessage(
          chatId,
          "Rahmat! Nechta kurka jo'jasi (dona) buyurtma qilmoqchisiz? (Faqat raqam yozing):",
          REMOVE_KEYBOARD,
        );
      } else {
        await setSession(chatKey, { ...sessionData, name: text, step: "request_product" });
        await sendMessage(chatId, "Qaysi mahsulotni sotib olmoqchisiz? Tanlang:", {
          reply_markup: {
            keyboard: products.map((p: { name: string }) => [{ text: p.name }]),
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        });
      }
      return;
    }

    // ─── 2.5: Mahsulot ───────────────────────────────────────────────────
    if (text && sessionData.step === "request_product") {
      const { data: product, error } = await pub
        .from("products")
        .select("id, price, name:name->>uz")
        .eq("published", true)
        .eq("name->>uz", text)
        .limit(1)
        .maybeSingle();
      if (error) throw error;

      if (!product) {
        await sendMessage(chatId, "Iltimos, ro'yxatdagilardan birini tanlang:");
        return;
      }

      await setSession(chatKey, {
        ...sessionData,
        step: "request_count",
        product_id: product.id,
        product_name: product.name,
        product_price: product.price ?? null,
      });
      await sendMessage(
        chatId,
        `Ajoyib tanlov! Nechta ${product.name} (dona) buyurtma qilmoqchisiz? (Faqat raqam yozing):`,
        REMOVE_KEYBOARD,
      );
      return;
    }

    // ─── 3: Soni ─────────────────────────────────────────────────────────
    if (text && sessionData.step === "request_count") {
      const count = parseInt(text);
      if (isNaN(count)) {
        await sendMessage(chatId, "Iltimos, faqat raqam kiriting (Masalan: 50):");
        return;
      }
      await setSession(chatKey, { ...sessionData, step: "request_location", product_count: count });
      await sendMessage(chatId, LOCATION_PROMPT, LOCATION_KEYBOARD);
      return;
    }

    // ─── 4: Lokatsiya (oxirgi) ───────────────────────────────────────────
    if (location && sessionData.step === "request_location") {
      const { region, district } = await geocode(location.latitude, location.longitude);

      const productId = (sessionData.product_id as string) || null;
      const productCount = (sessionData.product_count as number) || 0;
      const productName = (sessionData.product_name as string) || "Noma'lum mahsulot";
      const price = productId ? ((sessionData.product_price as number | null) ?? null) : null;
      const items = productId
        ? [{
          product_id: productId,
          name: productName,
          price,
          quantity: productCount,
        }]
        : [];
      // Sayt leadlari kabi: narxsiz (yoki mahsulotsiz) bo'lsa "Narx kelishiladi", jami 0
      const total = price == null ? 0 : price * productCount;
      const hasUnpriced = price == null;

      const { error } = await crm.from("leads").insert({
        source: "telegram",
        items,
        total,
        has_unpriced: hasUnpriced,
        name: (sessionData.name as string) || "Noma'lum",
        phone: sessionData.phoneNumber,
        telegram_id: sessionData.telegram_id,
        product_id: productId,
        product_name: productName,
        product_count: productCount,
        region_name: region,
        district_name: district,
        location: { lat: location.latitude, lng: location.longitude },
        date: new Date(now()).toISOString(),
        state: "new",
        note: "Bot orqali",
      });
      if (error) throw error;

      await deleteSession(chatKey);
      await sendMessage(chatId, LEAD_DONE_TEXT, MAIN_MENU);
      return;
    }

    // ─── Chat muloqoti (mavjud lead/mijoz) yoki fallback ─────────────────
    if (text && (!session.exists || sessionData.step === "start")) {
      let targetId: string | null = null;

      const lead = await crm.from("leads").select("id").eq("telegram_id", telegramId).limit(1).maybeSingle();
      if (lead.error) throw lead.error;
      if (lead.data) {
        targetId = lead.data.id;
      } else {
        const customer = await crm
          .from("customers")
          .select("id")
          .eq("telegram_id", telegramId)
          .limit(1)
          .maybeSingle();
        if (customer.error) throw customer.error;
        if (customer.data) targetId = customer.data.id;
      }

      if (targetId) {
        const { error } = await crm.rpc("bot_append_customer_message", { p_chat_id: targetId, p_text: text });
        if (error) throw error;
      } else {
        await sendMessage(chatId, "Iltimos, menyudan foydalaning:", MAIN_MENU);
      }
    }
  }

  /** Edge Function kirish nuqtasi: har doim 200 (secret noto'g'ri bo'lsa 401). */
  return async function handler(req: Request): Promise<Response> {
    const secret = deps.webhookSecret;
    if (!secret || req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
      return new Response("unauthorized", { status: 401 });
    }
    try {
      const update = await req.json();
      await handleUpdate(update);
    } catch (err) {
      log("telegramWebhook error:", err);
    }
    return new Response("ok", { status: 200 });
  };
}
