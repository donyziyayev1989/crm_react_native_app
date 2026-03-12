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

    // O'zbekiston uchun OSM maydonlarini filtrlash
    const region =
      address.state || address.province || address.region || "Noma'lum viloyat";
    const district =
      address.city_district ||
      address.county ||
      address.town ||
      address.city ||
      address.village ||
      "Noma'lum tuman";

    return { region, district };
  } catch (err) {
    console.error("Geocoding Error:", err.message);
    return { region: "Noma'lum viloyat", district: "Noma'lum tuman" };
  }
}

exports.telegramWebhook = functions.https.onRequest(async (req, res) => {
  const update = req.body;

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

  // ─── START: Salomlashish ──────────────────────────────────────────────────
  if (text === "/start") {
    await sessionRef.set({ step: "request_contact" });
    await sendMessage(
      chatId,
      "Assalomu alaykum! Buyurtma berish uchun telefon raqamingizni yuboring (Pastdagi tugmani bosing):",
      {
        reply_markup: {
          keyboard: [
            [{ text: "📞 Telefon raqamni yuborish", request_contact: true }],
          ],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      },
    );
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
    await sessionRef.update({
      step: "request_location",
      name: text,
    });

    await sendMessage(
      chatId,
      `Salom, ${text}! Endi hozir turgan manzilingizni (lokatsiya) yuboring:`,
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

  // ─── Step 3: Location Qabul qilish ──────────────────────────────────────────
  if (location && sessionData.step === "request_location") {
    await sessionRef.update({
      step: "request_count",
      location: {
        lat: location.latitude,
        lng: location.longitude,
      },
    });

    await sendMessage(
      chatId,
      "Manzil qabul qilindi. Nechta kurka jo'jasi (dona) buyurtma qilmoqchisiz? (Faqat raqam yozing):",
      {
        reply_markup: { remove_keyboard: true },
      },
    );
    return res.status(200).send("ok");
  }

  // ─── Step 4: Product Count Qabul qilish ─────────────────────────────────────
  if (text && sessionData.step === "request_count") {
    const count = parseInt(text);
    if (isNaN(count)) {
      await sendMessage(chatId, "Iltimos, faqat raqam kiriting (Masalan: 50):");
      return res.status(200).send("ok");
    }

    // Manzil tafsilotlarini aniqlash
    let region = "Noma'lum";
    let district = "Noma'lum";

    if (sessionData.location) {
      const details = await getAddressDetails(
        sessionData.location.lat,
        sessionData.location.lng,
      );
      region = details.region;
      district = details.district;
    }

    // Yangi Lead (Potentsial mijoz) yaratish
    const newLead = {
      name: sessionData.name || "Noma'lum",
      phone: sessionData.phoneNumber,
      telegram_id: sessionData.telegram_id,
      product_count: count,
      region_name: region,
      district_name: district,
      location: sessionData.location || null,
      date: new Date().toISOString(),
      status: "new",
      note: "Bot orqali",
    };

    await db.collection("leads").add(newLead);
    await sessionRef.delete();

    await sendMessage(
      chatId,
      `🎉 Rahmat! ${count} dona kurka jojasi uchun buyurtmangiz qabul qilindi. Tez orada operatorlarimiz siz bilan bog'lanishadi.`,
    );
    return res.status(200).send("ok");
  }

  // ─── Chat Muloqoti (Existing Lead) ──────────────────────────────────────────
  if (text && (!sessionSnap.exists || sessionData.step === "start")) {
    const leadsSnap = await db
      .collection("leads")
      .where("telegram_id", "==", telegramId)
      .limit(1)
      .get();

    if (!leadsSnap.empty) {
      const lead = leadsSnap.docs[0];
      const leadId = lead.id;

      // 1. Chat konteynerini yangilash (Parent Doc)
      await db.collection("lead_chats").doc(leadId).set(
        {
          lead_id: leadId,
          last_message: text,
          last_timestamp: new Date().toISOString(),
        },
        { merge: true },
      );

      // 2. Sub-collectionga xabar qo'shish
      await db.collection("lead_chats").doc(leadId).collection("messages").add({
        text: text,
        sender: "customer",
        timestamp: new Date().toISOString(),
      });
      return res.status(200).send("ok");
    }
  }

  res.status(200).send("ok");
});
