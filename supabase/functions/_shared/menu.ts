// Bot matnlari va klaviaturalari (functions/index.js dan o'zgarishsiz).

export const BTN_ORDER = "🛍 Buyurtma qilish";
export const BTN_FAQ = "❓ Eng ko'p beriladigan savollar";
export const BTN_ABOUT = "ℹ️ Biz haqimizda";
export const BTN_BACK = "⬅️ Orqaga";

export const MAIN_MENU = {
  reply_markup: {
    keyboard: [[{ text: BTN_ORDER }], [{ text: BTN_FAQ }], [{ text: BTN_ABOUT }]],
    resize_keyboard: true,
  },
};

export const WELCOME_TEXT =
  "Assalomu alaykum! Bizning botimizga xush kelibsiz. Iltimos, kerakli bo'limni tanlang:";

export const HELP_TEXT =
  "Sizga qanday yordam bera olamiz?\n\n- Buyurtma berish uchun '🛍 Buyurtma qilish' tugmasini bosing.\n- Biz haqimizda bilish uchun 'ℹ️ Biz haqimizda' tugmasini bosing.\n- Savollarga javob olish uchun '❓ Eng ko'p beriladigan savollar' tugmasini bosing.";

export const CONTACT_PROMPT = "Buyurtma berish uchun telefon raqamingizni yuboring (Pastdagi tugmani bosing):";

export const CONTACT_KEYBOARD = {
  reply_markup: {
    keyboard: [[{ text: "📞 Telefon raqamni yuborish", request_contact: true }], [{ text: BTN_BACK }]],
    resize_keyboard: true,
    one_time_keyboard: true,
  },
};

export const LOCATION_PROMPT =
  "Rahmat! Endi hozir turgan manzilingizni (lokatsiya) yuboring (Pastdagi tugmani bosing):";

export const LOCATION_KEYBOARD = {
  reply_markup: {
    keyboard: [[{ text: "📍 Lokatsiyani yuborish", request_location: true }]],
    resize_keyboard: true,
    one_time_keyboard: true,
  },
};

export const REMOVE_KEYBOARD = { reply_markup: { remove_keyboard: true } };

export const LEAD_DONE_TEXT =
  "🎉 Rahmat! Buyurtmangiz qabul qilindi. Tez orada operatorlarimiz siz bilan bog'lanishadi.";

export interface Faq {
  id: string;
  question: string;
  answer: string;
}

/** FAQ ro'yxati matni va 5 tadan qatorlangan inline tugmalar. */
export function buildFaqList(faqs: Faq[]) {
  let text = "❓ *Tez-tez beriladigan savollar*\n\n";
  const rows: { text: string; callback_data: string }[][] = [];
  let row: { text: string; callback_data: string }[] = [];

  faqs.forEach((faq, index) => {
    const num = index + 1;
    text += `*${num}.* ${faq.question}\n\n`;
    row.push({ text: String(num), callback_data: `faq_${faq.id}` });
    if (row.length === 5) {
      rows.push(row);
      row = [];
    }
  });
  if (row.length > 0) rows.push(row);

  text += "*Javobni ko'rish uchun tegishli raqamni bosing:*";
  return { text, extra: { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } } };
}

export const buildFaqAnswer = (faq: Faq) => `❓ *${faq.question}*\n\n✅ ${faq.answer}`;

/** Telegram contact.phone_number → "+998..." */
export function normalizeContactPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return "+" + digits;
}
