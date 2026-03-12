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
      ...extra
    });
  } catch (err) {
    console.error("SendMessage Error:", err.response?.data || err.message);
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
  const sessionData = sessionSnap.exists ? sessionSnap.data() : { step: "start" };

  // ─── START: Salomlashish ──────────────────────────────────────────────────
  if (text === "/start") {
    await sessionRef.set({ step: "request_contact" });
    await sendMessage(chatId, "Assalomu alaykum! Buyurtma berish uchun telefon raqamingizni yuboring (Pastdagi tugmani bosing):", {
      reply_markup: {
        keyboard: [[{ text: "📞 Telefon raqamni yuborish", request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
    return res.status(200).send("ok");
  }

  // ─── Step 1: Contact Qabul qilish ───────────────────────────────────────────
  if (contact && sessionData.step === "request_contact") {
    const phoneNumber = contact.phone_number.replace(/\D/g, ""); // Faqat raqamlar
    
    // Mijozni qidirish yoki yangi boshlash
    const customersRef = db.collection("customers");
    const q = await customersRef.where("phone", "==", phoneNumber).get();
    
    let customerId;
    if (!q.empty) {
      customerId = q.docs[0].id;
      // Agar bazada bo'lsa, ismini yangilashga so'ramaymiz desak ham bo'ladi, lekin barcha ma'lumotni so'rab olaylik.
    } else {
      // Yangi mijoz (vaqtincha ma'lumot bilan)
      const res = await customersRef.add({
        phone: phoneNumber,
        telegram_id: telegramId,
        name: message.from.first_name || "Mijoz",
        region_name: "Noma'lum", // Keyinroq to'ldiriladi
        tag_ids: [],
        order_ids: [],
        rates: 0,
        note: "Bot orqali yangi qo'shildi"
      });
      customerId = res.id;
    }

    await sessionRef.set({ step: "request_name", customerId, phoneNumber });
    await sendMessage(chatId, "Rahmat! Iltimos, ismingizni yozib yuboring (Siz bilan muloqot qilish uchun):", {
      reply_markup: { remove_keyboard: true }
    });
    return res.status(200).send("ok");
  }

  // ─── Step 2: Ism Qabul qilish ───────────────────────────────────────────────
  if (text && sessionData.step === "request_name") {
    await db.collection("customers").doc(sessionData.customerId).update({ name: text });
    
    await sessionRef.update({ step: "request_location" });
    await sendMessage(chatId, `Salom, ${text}! Endi hozir turgan manzilingizni (lokatsiya) yuboring:`, {
      reply_markup: {
        keyboard: [[{ text: "📍 Lokatsiyani yuborish", request_location: true }]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
    return res.status(200).send("ok");
  }

  // ─── Step 3: Location Qabul qilish ──────────────────────────────────────────
  if (location && sessionData.step === "request_location") {
    await db.collection("customers").doc(sessionData.customerId).update({
      location: {
        lat: location.latitude,
        lng: location.longitude,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }
    });

    await sessionRef.update({ step: "request_count" });
    await sendMessage(chatId, "Manzil qabul qilindi. Nechta kurka jojasi (shтук) buyurtma qilmoqchisiz? (Faqat raqam yozing):", {
      reply_markup: { remove_keyboard: true }
    });
    return res.status(200).send("ok");
  }

  // ─── Step 4: Product Count Qabul qilish ─────────────────────────────────────
  if (text && sessionData.step === "request_count") {
    const count = parseInt(text);
    if (isNaN(count)) {
      await sendMessage(chatId, "Iltimos, faqat raqam kiriting (Masalan: 50):");
      return res.status(200).send("ok");
    }

    // Yangi Buyurtma (Order) yaratish
    const newOrder = {
      name: `Bot Order: ${sessionData.phoneNumber}`,
      date: new Date().toISOString(),
      product_count: count,
      lost_products: 0,
      customer_id: sessionData.customerId // CRM-da ko'rinishi uchun
    };

    const orderRes = await db.collection("orders").add(newOrder);
    
    // Mijozning buyurtmalar ro'yxatiga ID ni qo'shamiz
    await db.collection("customers").doc(sessionData.customerId).update({
      order_ids: admin.firestore.FieldValue.arrayUnion(orderRes.id)
    });

    // Sessionni yakunlash
    await sessionRef.delete();

    await sendMessage(chatId, `🎉 Rahmat! ${count} dona kurka jojasi uchun buyurtmangiz qabul qilindi. Tez orada operatorlarimiz siz bilan bog'lanishadi.`);
    return res.status(200).send("ok");
  }

  // Standart javob (agar tushunarsiz narsa kelsa)
  res.status(200).send("ok");
});
