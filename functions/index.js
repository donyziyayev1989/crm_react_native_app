const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

admin.initializeApp();

const db = admin.firestore();

// BOT Tokenini .env faylidan yoki Firebase Config orqali olish
const BOT_TOKEN = process.env.EXPO_CRM_APP_TELEGRAM_BOT_TOKEN;
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

/**
 * Telegramga xabar yuborish helper-funksiyasi
 */
async function sendMessage(chatId, text, extra = {}) {
  try {
    await axios.post(`${TG_API}/sendMessage`, {
      chat_id: chatId,
      text: text,
      ...extra,
    });
  } catch (err) {
    console.error("SendMessage Error:", err.response?.data || err.message);
  }
}

/**
 * Koordinatalardan viloyat va tuman nomini aniqlash (OSM Nominatim)
 */
async function getAddressDetails(lat, lng) {
  try {
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/reverse`,
      {
        params: {
          format: "jsonv2",
          lat: lat,
          lon: lng,
          "accept-language": "uz",
        },
        headers: {
          "User-Agent": "CRM-App-Bot",
        },
      },
    );

    const address = response.data.address;

    let region =
      address.state ||
      address.province ||
      address.region ||
      address.city ||
      address.town ||
      address.county ||
      address.municipality ||
      "Noma'lum viloyat";

    const district = (
      address.city_district ||
      address.county ||
      address.district ||
      address.town ||
      address.city ||
      address.village ||
      address.suburb ||
      "Noma'lum tuman"
    )
      .replace(/ tumani| tuman/gi, "")
      .trim();

    // ─── Uzbekistan Region Mapping (Normalize for CRM) ────────────────────────
    const r = region.toLowerCase();

    if (r.includes("toshkent")) {
      // Toshkent shahri vs viloyati farqlash
      // Agar 'city' maydoni "Toshkent" bo'lsa yoki 'state_district' bo'lmasa ko'pincha bu shahar
      if (
        address.city === "Toshkent" ||
        (!r.includes("viloyat") && !r.includes("region"))
      ) {
        region = "Toshkent shahri";
      } else {
        region = "Toshkent viloyati";
      }
    } else if (r.includes("andijon")) region = "Andijon";
    else if (r.includes("buxoro")) region = "Buxoro";
    else if (
      r.includes("fargona") ||
      r.includes("farg'ona") ||
      r.includes("fergana")
    )
      region = "Farg'ona";
    else if (r.includes("jizzax")) region = "Jizzax";
    else if (r.includes("xorazm")) region = "Xorazm";
    else if (r.includes("namangan")) region = "Namangan";
    else if (r.includes("navoiy")) region = "Navoiy";
    else if (r.includes("qashqadaryo") || r.includes("kashkadarya"))
      region = "Qashqadaryo";
    else if (r.includes("qoraqalpog") || r.includes("karakalpak"))
      region = "Qoraqalpog'iston Respublikasi";
    else if (r.includes("samarqand")) region = "Samarqand";
    else if (r.includes("sirdaryo")) region = "Sirdaryo";
    else if (r.includes("surxondaryo")) region = "Surxondaryo";

    return { region, district };
  } catch (err) {
    return { region: "Noma'lum viloyat", district: "Noma'lum tuman" };
  }
}

/**
 * Telegram callback_query-ga javob berish
 */
async function answerCallbackQuery(callbackQueryId, text = "") {
  try {
    await axios.post(`${TG_API}/answerCallbackQuery`, {
      callback_query_id: callbackQueryId,
      text: text,
    });
  } catch (err) {
    console.error(
      "AnswerCallbackQuery Error:",
      err.response?.data || err.message,
    );
  }
}

const MAIN_MENU = {
  reply_markup: {
    keyboard: [
      [{ text: "🛍 Buyurtma qilish" }],
      [{ text: "❓ Eng ko'p beriladigan savollar" }],
      [{ text: "ℹ️ Biz haqimizda" }],
    ],
    resize_keyboard: true,
  },
};

let faqCache = null;
let lastFaqUpdate = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour cache

/**
 * FAQ larni keshdan yoki bazadan olish
 */
async function getCachedFaqs() {
  const now = Date.now();
  if (faqCache && now - lastFaqUpdate < CACHE_TTL) {
    return faqCache;
  }

  try {
    const snapshots = await db
      .collection("faqs")
      .orderBy("createdAt", "desc")
      .limit(30)
      .get();
    faqCache = snapshots.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    lastFaqUpdate = now;
    return faqCache;
  } catch (err) {
    console.error("GetFaqs Error:", err.message);
    return faqCache || []; // Xatolik bo'lsa eski keshni yoki bo'sh massiv qaytarish
  }
}

exports.telegramWebhook = functions.https.onRequest(async (req, res) => {
  const update = req.body;

  // 1. Callback Query handled (FAQ interaction)
  if (update && update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message.chat.id;
    const data = cb.data; // e.g. "faq_id"

    if (data.startsWith("faq_")) {
      const faqId = data.replace("faq_", "");
      const faqs = await getCachedFaqs();
      const faq = faqs.find((f) => f.id === faqId);

      if (faq) {
        await sendMessage(chatId, `❓ *${faq.question}*\n\n✅ ${faq.answer}`, {
          parse_mode: "Markdown",
        });
      } else {
        await sendMessage(chatId, "Kechirasiz, bu savolga javob topilmadi.");
      }
    }
    await answerCallbackQuery(cb.id);
    return res.status(200).send("ok");
  }

  if (!update || !update.message) {
    return res.status(200).send("ok");
  }

  const { message } = update;
  const chatId = message.chat.id;
  const text = message.text;
  const contact = message.contact;
  const location = message.location;
  const telegramId = message.from.id.toString();

  // 1. Session (holat) ni aniqlash
  const sessionRef = db.collection("bot_sessions").doc(chatId.toString());
  const sessionSnap = await sessionRef.get();
  const sessionData = sessionSnap.exists
    ? sessionSnap.data()
    : { step: "start" };

  // ─── COMMANDS: /start, /help ───────────────────────────────────────────
  if (text === "/start") {
    await sessionRef.set({ step: "start" });
    await sendMessage(
      chatId,
      "Assalomu alaykum! Bizning botimizga xush kelibsiz. Iltimos, kerakli bo'limni tanlang:",
      MAIN_MENU,
    );
    return res.status(200).send("ok");
  }

  if (text === "/help") {
    await sendMessage(
      chatId,
      "Sizga qanday yordam bera olamiz?\n\n- Buyurtma berish uchun '🛍 Buyurtma qilish' tugmasini bosing.\n- Biz haqimizda bilish uchun 'ℹ️ Biz haqimizda' tugmasini bosing.\n- Savollarga javob olish uchun '❓ Eng ko'p beriladigan savollar' tugmasini bosing.",
      MAIN_MENU,
    );
    return res.status(200).send("ok");
  }

  // ─── MAIN MENU BUTTONS ─────────────────────────────────────────────────
  if (text === "🛍 Buyurtma qilish") {
    await sessionRef.set({ step: "request_contact" });
    await sendMessage(
      chatId,
      "Buyurtma berish uchun telefon raqamingizni yuboring (Pastdagi tugmani bosing):",
      {
        reply_markup: {
          keyboard: [
            [{ text: "📞 Telefon raqamni yuborish", request_contact: true }],
            [{ text: "⬅️ Orqaga" }],
          ],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      },
    );
    return res.status(200).send("ok");
  }

  if (text === "ℹ️ Biz haqimizda") {
    let info = "";
    try {
      const snap = await db.collection("settings").doc("about_us").get();
      if (snap.exists) {
        info = snap.data().text;
      }
    } catch (e) {
      console.error("Fetch about_us error:", e);
    }
    await sendMessage(chatId, info, MAIN_MENU);
    return res.status(200).send("ok");
  }

  if (text === "❓ Eng ko'p beriladigan savollar") {
    const faqs = await getCachedFaqs();
    if (faqs.length === 0) {
      await sendMessage(chatId, "Hozircha savollar yo'q.", MAIN_MENU);
    } else {
      let messageText = "❓ *Tez-tez beriladigan savollar*\n\n";
      const inlineButtons = [];
      let currentRow = [];

      faqs.forEach((faq, index) => {
        const num = index + 1;
        messageText += `*${num}.* ${faq.question}\n\n`;

        currentRow.push({
          text: num.toString(),
          callback_data: `faq_${faq.id}`,
        });

        // Add 5 buttons per row
        if (currentRow.length === 5) {
          inlineButtons.push(currentRow);
          currentRow = [];
        }
      });

      if (currentRow.length > 0) {
        inlineButtons.push(currentRow);
      }

      messageText += "*Javobni ko'rish uchun tegishli raqamni bosing:*";

      await sendMessage(chatId, messageText, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: inlineButtons,
        },
      });
    }
    return res.status(200).send("ok");
  }

  if (text === "⬅️ Orqaga") {
    await sessionRef.set({ step: "start" });
    await sendMessage(chatId, "Asosiy menyuga qaytdingiz:", MAIN_MENU);
    return res.status(200).send("ok");
  }

  // ─── Step 1: Contact Qabul qilish ───────────────────────────────────────────
  if (contact && sessionData.step === "request_contact") {
    let phoneNumber = contact.phone_number.replace(/\D/g, ""); // Faqat raqamlar
    if (!phoneNumber.startsWith("+")) {
      phoneNumber = "+" + phoneNumber;
    }

    await sessionRef.set({
      step: "request_name",
      phoneNumber,
      telegram_id: telegramId,
      first_name: message.from.first_name || "",
    });

    await sendMessage(
      chatId,
      "Rahmat! Iltimos, ismingizni yozib yuboring (Siz bilan muloqot qilish uchun):",
      {
        reply_markup: { remove_keyboard: true },
      },
    );
    return res.status(200).send("ok");
  }

  // ─── Step 2: Ism Qabul qilish ───────────────────────────────────────────────
  if (text && sessionData.step === "request_name") {
    // Ismni saqlash
    await sessionRef.update({
      name: text,
      step: "request_product",
    });

    // Mahsulotlarni bazadan olish
    const productsSnap = await db
      .collection("products")
      .where("active", "==", true)
      .get();
    const products = productsSnap.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name,
    }));

    if (products.length === 0) {
      await sessionRef.update({ step: "request_count" });
      await sendMessage(
        chatId,
        "Rahmat! Nechta kurka jo'jasi (dona) buyurtma qilmoqchisiz? (Faqat raqam yozing):",
        {
          reply_markup: { remove_keyboard: true },
        },
      );
    } else {
      const keyboard = products.map((p) => [{ text: p.name }]);
      await sendMessage(
        chatId,
        "Qaysi mahsulotni sotib olmoqchisiz? Tanlang:",
        {
          reply_markup: {
            keyboard: keyboard,
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        },
      );
    }
    return res.status(200).send("ok");
  }

  // ─── Step 2.5: Mahsulot Tanlash ──────────────────────────────────────────────
  if (text && sessionData.step === "request_product") {
    // Tanlangan mahsulotni tekshirish
    const productsSnap = await db
      .collection("products")
      .where("name", "==", text)
      .limit(1)
      .get();

    if (productsSnap.empty) {
      return sendMessage(chatId, "Iltimos, ro'yxatdagilardan birini tanlang:");
    }

    const productDoc = productsSnap.docs[0];
    await sessionRef.update({
      step: "request_count",
      product_id: productDoc.id,
      product_name: productDoc.data().name,
    });

    await sendMessage(
      chatId,
      `Ajoyib tanlov! Nechta ${productDoc.data().name} (dona) buyurtma qilmoqchisiz? (Faqat raqam yozing):`,
      {
        reply_markup: { remove_keyboard: true },
      },
    );
    return res.status(200).send("ok");
  }

  // ─── Step 3: Product Count Qabul qilish ─────────────────────────────────────
  if (text && sessionData.step === "request_count") {
    const count = parseInt(text);
    if (isNaN(count)) {
      await sendMessage(chatId, "Iltimos, faqat raqam kiriting (Masalan: 50):");
      return res.status(200).send("ok");
    }

    await sessionRef.update({
      step: "request_location",
      product_count: count,
    });

    await sendMessage(
      chatId,
      "Rahmat! Endi hozir turgan manzilingizni (lokatsiya) yuboring (Pastdagi tugmani bosing):",
      {
        reply_markup: {
          keyboard: [
            [{ text: "📍 Lokatsiyani yuborish", request_location: true }],
          ],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      },
    );
    return res.status(200).send("ok");
  }

  // ─── Step 4: Location Qabul qilish (Oxirgi step) ─────────────────────────────
  if (location && sessionData.step === "request_location") {
    // Manzil tafsilotlarini aniqlash
    let region = "Noma'lum";
    let district = "Noma'lum";

    const details = await getAddressDetails(
      location.latitude,
      location.longitude,
    );
    region = details.region;
    district = details.district;

    // Yangi Lead (Potentsial mijoz) yaratish
    const newLead = {
      name: sessionData.name || "Noma'lum",
      phone: sessionData.phoneNumber,
      telegram_id: sessionData.telegram_id,
      product_id: sessionData.product_id || null,
      product_name: sessionData.product_name || "Noma'lum mahsulot",
      product_count: sessionData.product_count || 0,
      region_name: region,
      district_name: district,
      location: {
        lat: location.latitude,
        lng: location.longitude,
      },
      date: new Date().toISOString(),
      state: "new",
      note: "Bot orqali",
    };

    await db.collection("leads").add(newLead);
    await sessionRef.delete();

    await sendMessage(
      chatId,
      `🎉 Rahmat! Buyurtmangiz qabul qilindi. Tez orada operatorlarimiz siz bilan bog'lanishadi.`,
      MAIN_MENU,
    );
    return res.status(200).send("ok");
  }

  // ─── Chat Muloqoti (Existing Lead/Customer or Fallback) ──────────────────
  if (text && (!sessionSnap.exists || sessionData.step === "start")) {
    // 1. Avval lead-lar orasidan qidiramiz
    let targetSnap = await db
      .collection("leads")
      .where("telegram_id", "==", telegramId)
      .limit(1)
      .get();

    // 2. Agar lead topilmasa, mijozlar (customers) orasidan qidiramiz
    if (targetSnap.empty) {
      targetSnap = await db
        .collection("customers")
        .where("telegram_id", "==", telegramId)
        .limit(1)
        .get();
    }

    if (!targetSnap.empty) {
      const targetDoc = targetSnap.docs[0];
      const targetId = targetDoc.id;

      // 1. Chat konteynerini yangilash (Parent Doc)
      await db
        .collection("lead_chats")
        .doc(targetId)
        .set(
          {
            lead_id: targetId,
            last_message: text,
            last_timestamp: new Date().toISOString(),
            unread_count: admin.firestore.FieldValue.increment(1),
          },
          { merge: true },
        );

      // 2. Sub-collectionga xabar qo'shish
      await db
        .collection("lead_chats")
        .doc(targetId)
        .collection("messages")
        .add({
          text: text,
          sender: "customer",
          timestamp: new Date().toISOString(),
        });
      return res.status(200).send("ok");
    } else {
      // If no session and no lead/customer, show main menu
      await sendMessage(chatId, "Iltimos, menyudan foydalaning:", MAIN_MENU);
      return res.status(200).send("ok");
    }
  }

  res.status(200).send("ok");
});
