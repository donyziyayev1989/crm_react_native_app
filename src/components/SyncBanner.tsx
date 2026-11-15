import { isOnline, subscribeConnectivity } from "@/services/connectivity";
import { clearFailed, getFailed, pendingCount, subscribeOutbox } from "@/services/outbox";
import { MaterialIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Ulanish va oflayn navbat holati: internet yo'qligi, yuborilmagan o'zgarishlar soni va
 * serverga qabul qilinmagan (xato) o'zgarishlar. Hammasi joyida bo'lsa ko'rinmaydi.
 */
export default function SyncBanner() {
  const insets = useSafeAreaInsets();
  const [online, setOnline] = useState(isOnline());
  const [pending, setPending] = useState(pendingCount());
  const [failed, setFailed] = useState(getFailed().length);

  useEffect(() => {
    const unsubNet = subscribeConnectivity(setOnline);
    const unsubBox = subscribeOutbox(() => {
      setPending(pendingCount());
      setFailed(getFailed().length);
    });
    return () => {
      unsubNet();
      unsubBox();
    };
  }, []);

  if (online && pending === 0 && failed === 0) return null;

  const showFailed = () => {
    const list = getFailed();
    Alert.alert(
      "Yuborilmagan o'zgarishlar",
      `${list.length} ta o'zgarish serverga qabul qilinmadi:\n\n` +
        list.slice(0, 5).map((f) => `• ${f.coll.split(".")[1]}: ${f.error}`).join("\n"),
      [{ text: "Tozalash", style: "destructive", onPress: clearFailed }, { text: "Yopish" }],
    );
  };

  let text: string;
  let bg = "#b45309";
  let icon: React.ComponentProps<typeof MaterialIcons>["name"] = "cloud-off";
  if (failed > 0 && online && pending === 0) {
    text = `${failed} ta o'zgarish yuborilmadi — ko'rish uchun bosing`;
    bg = "#b91c1c";
    icon = "error-outline";
  } else if (!online) {
    text =
      pending > 0
        ? `Internet yo'q — ${pending} ta o'zgarish qurilmada saqlangan`
        : "Internet yo'q — ma'lumotlar qurilmadan ko'rsatilmoqda";
  } else {
    text = `${pending} ta o'zgarish yuborilmoqda...`;
    bg = "#1d4ed8";
    icon = "sync";
  }

  return (
    <Pressable
      onPress={failed > 0 ? showFailed : undefined}
      style={[styles.bar, { backgroundColor: bg, paddingBottom: 6, bottom: Math.max(insets.bottom, 0) + 64 }]}
    >
      <MaterialIcons name={icon} size={16} color="#fff" />
      <Text style={styles.text}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 6,
    borderRadius: 10,
    opacity: 0.95,
  },
  text: { color: "#fff", fontSize: 12, fontWeight: "600", flexShrink: 1 },
});
