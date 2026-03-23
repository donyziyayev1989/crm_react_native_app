import { useRouter } from "expo-router";
import { LeadMessage } from "@/interfaces";
import db, { orderBy } from "@/services/database";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { openTelegram as openTelegramUtil } from "@utils/actions";
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

interface TelegramChatProps {
  chatId: string; // Document ID for lead_chats
  title?: string;
  targetIdentifier: string; // phone or telegram_id for bot
  onClose?: () => void;
  headerHeight?: number;
}

const TelegramChat = ({
  chatId,
  title,
  targetIdentifier,
  onClose,
  headerHeight = 0,
}: TelegramChatProps) => {
  const router = useRouter();
  const [history, setHistory] = useState<LeadMessage[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [isCustomer, setIsCustomer] = useState<boolean | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!chatId) return;

    // Reset unread count when chat is opened
    db.lead_chats
      .set(chatId, { unread_count: 0, lead_id: chatId })
      .catch(console.error);

    // Realtime watch xabarlar uchun
    const unsubscribe = db.lead_messages(chatId).watch(
      (msgs) => {
        setHistory(msgs);

        // Oxirgi xabar mijozdan bo'lsa unread_count ni 0 qilish
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg && lastMsg.sender === "customer") {
          db.lead_chats
            .set(chatId, { unread_count: 0, lead_id: chatId })
            .catch(console.error);
        }

        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      },
      orderBy("timestamp", "asc"),
    );

    return () => unsubscribe();
  }, [chatId]);

  useEffect(() => {
    if (!chatId) return;
    db.customers.get(chatId).then((doc) => setIsCustomer(!!doc));
  }, [chatId]);

  const handleSendMessage = async () => {
    if (!message.trim() || !chatId) return;

    setSending(true);
    const now = new Date().toISOString();
    try {
      // 1. Telegram bot orqali yuborish
      await openTelegramUtil(targetIdentifier, message);

      // 2. Chat konteynerini yangilash
      await db.lead_chats.set(chatId, {
        lead_id: chatId,
        last_message: message,
        last_timestamp: now,
      });

      // 3. Xabarni saqlash
      await db.lead_messages(chatId).create({
        text: message,
        sender: "operator",
        timestamp: now,
      });

      setMessage("");
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={headerHeight}
      style={styles.container}
    >
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <MaterialIcons name="telegram" size={24} color="#0088cc" />
          <Text style={styles.headerTitle}>{title || "Telegram Chat"}</Text>
          {isCustomer !== null && (
            <Pressable
              onPress={() => {
                onClose?.();
                router.push(
                  isCustomer ? `/customers/${chatId}` : `/leads/${chatId}`
                );
              }}
              className="p-1"
            >
              <MaterialIcons name="info-outline" size={22} color="#94a3b8" />
            </Pressable>
          )}
        </View>
        {onClose && (
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <MaterialIcons name="close" size={24} color="#6b7280" />
          </Pressable>
        )}
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.history}
        contentContainerStyle={styles.historyContent}
        onContentSizeChange={() =>
          scrollViewRef.current?.scrollToEnd({ animated: true })
        }
      >
        {history.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons
              name="chat-bubble-outline"
              size={48}
              color="#d1d5db"
            />
            <Text style={styles.emptyText}>Muloqotni boshlang</Text>
          </View>
        ) : (
          history.map((msg) => (
            <View
              key={msg.id}
              style={[
                styles.messageBubble,
                msg.sender === "operator"
                  ? styles.myMessage
                  : styles.theirMessage,
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  msg.sender === "operator" ? styles.myText : styles.theirText,
                ]}
              >
                {msg.text}
              </Text>
              <Text
                style={[
                  styles.timestamp,
                  msg.sender === "operator" ? styles.myTime : styles.theirTime,
                ]}
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

      <View style={styles.inputArea}>
        <TextInput
          multiline
          style={styles.input}
          placeholder="Xabaringizni yozing..."
          value={message}
          onChangeText={setMessage}
        />
        <Pressable
          onPress={handleSendMessage}
          disabled={sending || !message.trim()}
          style={[
            styles.sendBtn,
            (sending || !message.trim()) && styles.disabledBtn,
          ]}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <MaterialIcons name="send" size={24} color="#fff" />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
};

export default TelegramChat;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f4f6",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  closeBtn: {
    padding: 4,
  },
  history: {
    flex: 1,
  },
  historyContent: {
    padding: 16,
    gap: 12,
  },
  empty: {
    alignItems: "center",
    marginTop: 40,
  },
  emptyText: {
    color: "#9ca3af",
    marginTop: 8,
  },
  messageBubble: {
    maxWidth: "85%",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  myMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#0088cc",
    borderBottomRightRadius: 2,
  },
  theirMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    borderBottomLeftRadius: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  messageText: {
    fontSize: 15,
  },
  myText: {
    color: "#fff",
  },
  theirText: {
    color: "#1f2937",
  },
  timestamp: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: "flex-end",
  },
  myTime: {
    color: "rgba(255,255,255,0.7)",
  },
  theirTime: {
    color: "#9ca3af",
  },
  inputArea: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  input: {
    flex: 1,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 40,
    maxHeight: 120,
    fontSize: 15,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#0088cc",
    justifyContent: "center",
    alignItems: "center",
  },
  disabledBtn: {
    backgroundColor: "#d1d5db",
  },
});
