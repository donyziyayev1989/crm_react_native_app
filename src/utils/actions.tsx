import { Alert, Linking, Platform } from "react-native";
import { chatEvents } from "./chat_events";

export const callPhone = async (phone: string) => {
  let cleaned = phone.replace(/\D/g, "");
  if (!cleaned.startsWith("+")) {
    cleaned = "+" + cleaned;
  }
  const url = `tel:${cleaned}`;

  if (Platform.OS === "web") {
    window.location.href = url;
    return;
  }

  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert("Xatolik", "Qo'ng'iroq qilib bo'lmadi");
  }
};

const BOT_TOKEN = process.env.EXPO_PUBLIC_BOT_TOKEN;

export const openTelegram = async (
  identifier: string | number | undefined,
  message: string = "Salom! Siz bilan CRM orqali bog'lanishmoqda.",
  chatData?: { chatId: string; title: string },
) => {
  if (!identifier) {
    Alert.alert("Xatolik", "Telegram ma'mulotlari mavjud emas");
    return;
  }

  // --- In-App Chat Trigger ---
  if (chatData) {
    chatEvents.emit({
      chatId: chatData.chatId,
      title: chatData.title,
      targetIdentifier: String(identifier),
    });
    return;
  }
  // ---------------------------

  // Bo'shliqlarni va @ belgisini olib tashlaymiz, faqat raqamli yoki username formatini olish uchun
  const rawId = String(identifier).trim().replace("@", "");
  const idStr = rawId.replace(/\s/g, ""); // Bo'shliqlarni olib tashlaymiz
  const isNumeric = /^\+?\d+$/.test(idStr);

  try {
    // 1. Agar foydalanuvchi ID bo'lsa (numeric va 998 bilan boshlanmasa)
    if (isNumeric && !idStr.startsWith("998") && idStr.length > 7) {
      if (!BOT_TOKEN) {
        // Token yo'q bo'lsa, deep link orqali ochishga harakat qilamiz
        const url = `tg://user?id=${idStr}`;
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
        } else {
          await Linking.openURL(`https://t.me/user?id=${idStr}`);
        }
        return;
      }

      // Bot orqali xabar yuborish (ID orqali bog'lanishning eng ishonchli yo'li)
      const apiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: idStr, text: message }),
      });

      if (!response.ok) {
        // Agar bot orqali xato bersa, deep linkni sinab ko'ramiz
        await Linking.openURL(`tg://user?id=${idStr}`);
      }
      return;
    }

    // 2. Agar telefon raqami bo'lsa
    if (isNumeric && (idStr.startsWith("998") || idStr.length <= 13)) {
      const phone = idStr.startsWith("+") ? idStr : "+" + idStr;
      const url = `https://t.me/${phone}`;

      if (Platform.OS === "web") {
        window.open(url, "_blank");
      } else {
        await Linking.openURL(url);
      }
      return;
    }

    // 3. Username bo'lsa
    const url = `https://t.me/${idStr}`;
    if (Platform.OS === "web") {
      window.open(url, "_blank");
    } else {
      await Linking.openURL(url);
    }
  } catch (err) {
    Alert.alert("Xatolik", "Telegram bilan bog'lanishda xatolik yuz berdi");
  }
};
