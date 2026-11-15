import { supabase } from "@/supabase/client";
import { notificationRoute } from "@/utils/notification_route";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/**
 * Yangi lead (sayt / Telegram bot) push bildirishnomalari.
 * Server: `crm.notify_new_lead` trigger -> Edge Function `notify-lead` -> Expo Push.
 * Bu yerda: ruxsat so'rash, Expo token olish, uni `crm.register_push_token` bilan bog'lash,
 * ilova ochiq paytda bildirishnomani ko'rsatish va bosilganda lead ekranini ochish.
 */
const TOKEN_KEY = "crm-push-token:v1";
const supported = Platform.OS !== "web";

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function ensureChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("leads", {
    name: "Yangi buyurtmalar",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#6366f1",
  });
}

/** Ruxsat so'raydi, tokenni oladi va serverga yozadi. Xato bo'lsa jimgina `null` (ilova ishiga xalaqit bermaydi). */
export async function registerForPush(): Promise<string | null> {
  if (!supported || !Device.isDevice) return null; // emulyatorda push yo'q
  try {
    await ensureChannel();

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== "granted") return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);

    const { error } = await supabase.rpc("register_push_token", {
      p_token: token,
      p_platform: Platform.OS,
    });
    if (error) throw error;
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return token;
  } catch (e) {
    console.warn("Push ro'yxatdan o'tmadi:", e);
    return null;
  }
}

/** Chiqishda (sessiya hali amal qilganda) chaqiriladi: bu qurilmaga boshqa xodimning leadlari kelmasin */
export async function unregisterPush(): Promise<void> {
  if (!supported) return;
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return;
    // Internet sust bo'lsa chiqish kechikmasin
    await Promise.race([
      supabase.rpc("unregister_push_token", { p_token: token }),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    // oflayn bo'lsa token serverda qoladi; keyingi kirishda register_push_token uni yangi foydalanuvchiga o'tkazadi
  }
}

/** Bildirishnoma bosilganda `navigate(route)` chaqiriladi. Qaytgan funksiya listener'ni o'chiradi. */
export function listenForTaps(navigate: (route: string) => void): () => void {
  if (!supported) return () => {};

  const open = (response: Notifications.NotificationResponse | null) => {
    const route = notificationRoute(response?.notification.request.content.data);
    if (route) navigate(route);
  };

  // Ilova bildirishnoma bosilib ochilgan bo'lsa (yopiq holatdan)
  Notifications.getLastNotificationResponseAsync().then((r) => {
    if (r) open(r);
  });
  const sub = Notifications.addNotificationResponseReceivedListener(open);
  return () => sub.remove();
}
