import { Alert, Linking, Platform } from "react-native";
import { supabase } from "@/supabase/client";
import { chatEvents } from "./chat_events";

export const callPhone = async (phone: string) => {
  const url = `tel:+${phone.replace(/\D/g, "")}`;

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
      // Bot orqali xabar yuborish: token serverda (Edge Function), ilovada emas
      const { error } = await supabase.functions.invoke("send-telegram", {
        body: { chat_id: idStr, text: message },
      });

      if (error) {
        // Bot orqali xato bersa, deep linkni sinab ko'ramiz
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
  } catch {
    Alert.alert("Xatolik", "Telegram bilan bog'lanishda xatolik yuz berdi");
  }
};
