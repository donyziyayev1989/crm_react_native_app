import { Lead, LeadMessage } from "@/interfaces";
import db, { orderBy } from "@/services/database";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useHeaderHeight } from "@react-navigation/elements";
import { openTelegram } from "@utils/actions";
import { Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LeadChatScreen() {
  const { leadId } = useLocalSearchParams<{ leadId: string }>();
  const headerHeight = useHeaderHeight();
  const [lead, setLead] = useState<Lead | null>(null);
  const [history, setHistory] = useState<LeadMessage[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!leadId) return;

    // 1. Lead ma'lumotlarini yuklash
    db.leads
      .get(leadId)
      .then(setLead)
      .finally(() => setLoading(false));

    // 2. Xabarlarni realtime kuzatish
    const unsubscribe = db.lead_messages(leadId).watch(
      (msgs) => {
        setHistory(msgs);
        // Yangi xabar kelganda pastga scroll qilish
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      },
      orderBy("timestamp", "asc"),
    );

    return () => unsubscribe();
  }, [leadId]);

  // fetchLeadAndHistory removed as it is now handled by watch and useEffect cleanup

  const handleSendMessage = async () => {
    if (!lead || !message.trim() || !leadId) return;

    setSending(true);
    const now = new Date().toISOString();
    try {
      // 1. Telegram bot orqali yuborish
      await openTelegram(lead.telegram_id || lead.phone, message);

      // 2. Chat konteynerini yangilash (oxirgi xabar ma'lumotlari)
      try {
        await db.lead_chats.update(leadId, {
          last_message: message,
          last_timestamp: now,
        });
      } catch (err) {
        // Agar chat hujjati hali mavjud bo'lmasa, uni yaratamiz
        await db.lead_chats.update(leadId, {
          lead_id: leadId,
          last_message: message,
          last_timestamp: now,
        } as any);
      }

      // 3. Sub-collectionga xabarni saqlash
      const newMessage: Omit<LeadMessage, "id"> = {
        text: message,
        sender: "operator",
        timestamp: now,
      };

      const msgId = await db.lead_messages(leadId).create(newMessage);
      // setHistory removed as 'watch' listener will handle it automatically
      setMessage("");

      // Avtomatik scroll pastga
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (e) {
      console.error(e);
      Alert.alert("Xato", "Xabar yuborishda xatolik yuz berdi");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#6366f1" size="large" />
      </View>
    );
  }

  if (!lead) {
    return (
      <View style={styles.center}>
        <Text>Murojaat topilmadi</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "padding"}
      keyboardVerticalOffset={headerHeight}
      style={styles.container}
    >
      <SafeAreaView edges={["bottom"]} style={{ flex: 1 }}>
        <Stack.Screen
          options={{
            title: lead.name,
            headerBackTitle: "Orqaga",
          }}
        />

        <ScrollView
          ref={scrollViewRef}
          className="flex-1 p-4"
          contentContainerStyle={{ gap: 12, paddingBottom: 20 }}
          onContentSizeChange={() =>
            scrollViewRef.current?.scrollToEnd({ animated: true })
          }
        >
          {history.length === 0 ? (
            <View className="items-center mt-10">
              <MaterialIcons
                name="chat-bubble-outline"
                size={48}
                color="#d1d5db"
              />
              <Text className="text-gray-400 mt-2">Muloqotni boshlang</Text>
            </View>
          ) : (
            history.map((msg) => (
              <View
                key={msg.id}
                className={`max-w-[85%] p-3 flex-col rounded-3xl ${
                  msg.sender === "operator"
                    ? "bg-blue-500 self-end rounded-tr-none"
                    : "bg-white self-start rounded-tl-none shadow-sm"
                }`}
              >
                <Text
                  className={`text-[16px] ${
                    msg.sender === "operator" ? "text-white" : "text-gray-800"
                  }`}
                >
                  {msg.text}
                </Text>
                <Text
                  className={`text-[12px] leading-none mt-1 ml-auto pl-10 ${
                    msg.sender === "operator" ? "text-white/60" : "text-muted"
                  }`}
                >
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            ))
          )}
        </ScrollView>

        <View className="p-4 bg-white border-t border-gray-100 flex-row gap-3 items-end">
          <TextInput
            multiline
            className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl p-4 min-h-[50px] max-h-[150px] text-gray-800"
            placeholder="Xabaringizni yozing..."
            value={message}
            onChangeText={setMessage}
          />

          <Pressable
            onPress={handleSendMessage}
            disabled={sending || !message.trim()}
            className={`w-14 h-14 flex rounded-full justify-center items-center  ${
              sending || !message.trim() ? "bg-gray-300" : "bg-blue-500"
            }`}
          >
            {sending ? (
              <ActivityIndicator size="small" />
            ) : (
              <MaterialIcons name="send" size={24} color="white" />
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
