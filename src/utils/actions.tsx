import { Alert, Linking, Platform } from "react-native";


export const callPhone = async (phone: string) => {
  const url = `tel:${phone}`;

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

export const openTelegram = async (username: string) => {
  const url = `https://t.me/${username}`;

  if (Platform.OS === "web") {
    window.location.href = url;
    return;
  }

  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert("Xatolik", "Telegram ochilmadi");
  }
};
