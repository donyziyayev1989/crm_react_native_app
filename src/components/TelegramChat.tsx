import { auth } from "@/firebase/firebase";
import { LeadMessage, User } from "@/interfaces";
import db, { orderBy, where } from "@/services/database";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { openTelegram as openTelegramUtil } from "@utils/actions";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
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
  const [users, setUsers] = useState<Record<string, User>>({});
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
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
          scrollViewRef.current?.scrollToEnd();
        }, 0);
      },
      orderBy("timestamp", "asc"),
    );

    return () => unsubscribe();
  }, [chatId]);

  useEffect(() => {
    // Fetch users for avatars
    const unsubUsers = db.users.watch((allUsers) => {
      const usersMap: Record<string, User> = {};
      allUsers.forEach((u) => {
        if (u.id) usersMap[u.id] = u;
      });
      setUsers(usersMap);
    });
    return () => unsubUsers();
  }, []);

  useEffect(() => {
    if (!chatId) return;
    const unsub = db.customers.watch(
      (data) => {
        const found = data.find((c) => c.id === chatId);
        setIsCustomer(!!found);
      },
      where("__name__", "==", chatId),
    );
    return () => unsub();
  }, [chatId]);

  const handleSendMessage = async () => {
    if (!message.trim() || !chatId) return;

    setSending(true);
    const now = new Date().toISOString();
    try {
      // 1. Chat konteynerini yangilash
      await db.lead_chats.set(chatId, {
        lead_id: chatId,
        last_message: message,
        last_timestamp: now,
      });
      setMessage("");
      // 2. Xabarni Firestore-ga saqlash (Offline-first: bu qism har doim ishlaydi)
      await db.lead_messages(chatId).create({
        text: message,
        sender: "operator",
        timestamp: now,
        user_id: auth.currentUser?.uid,
      });

      // 3. Telegram bot orqali yuborishga harakat qilish
      // Eslatma: Agar offline bo'lsak, bu qism xato berishi mumkin,
      // lekin xabar baribir Firestore-da qoladi.
      try {
        await openTelegramUtil(targetIdentifier, message);
      } catch (tgErr) {
        console.log("Telegram API sending delayed (offline?):", tgErr);
      }

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (e) {
      Alert.alert("Xato", "Xabar yuborishda xatolik yuz berdi");
    } finally {
      setSending(false);
    }
  };

  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const messageDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );

    if (messageDate.getTime() === today.getTime()) return "Bugun";
    if (messageDate.getTime() === yesterday.getTime()) return "Kecha";

    const uzMonths = [
      "yanvar",
      "fevral",
      "mart",
      "aprel",
      "may",
      "iyun",
      "iyul",
      "avgust",
      "sentabr",
      "oktabr",
      "noyabr",
      "dekabr",
    ];

    const day = date.getDate();
    const month = uzMonths[date.getMonth()];
    const year = date.getFullYear();

    return year !== now.getFullYear()
      ? `${day} ${month} ${year}`
      : `${day} ${month}`;
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
                  isCustomer ? `/customers/${chatId}` : `/leads/${chatId}`,
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
          history.map((msg, index) => {
            const msgDate = new Date(msg.timestamp).toDateString();
            const prevMsgDate =
              index > 0
                ? new Date(history[index - 1].timestamp).toDateString()
                : null;
            const showDate = msgDate !== prevMsgDate;

            return (
              <React.Fragment key={msg.id}>
                {showDate && (
                  <View style={styles.dateDivider}>
                    <View style={styles.dateLabel}>
                      <Text style={styles.dateText}>
                        {formatDateLabel(msg.timestamp)}
                      </Text>
                    </View>
                  </View>
                )}
                <View
                  style={[
                    styles.messageContainer,
                    msg.sender === "operator"
                      ? styles.myContainer
                      : styles.theirContainer,
                  ]}
                >
                  {msg.sender === "operator" && (
                    <Pressable
                      onPress={() =>
                        msg.user_id &&
                        setSelectedUser(
                          users[msg.user_id] || {
                            name: "Noma'lum",
                            id: msg.user_id,
                            email: "",
                          },
                        )
                      }
                      style={styles.avatarContainer}
                    >
                      {msg.user_id && users[msg.user_id]?.photoURL ? (
                        <Image
                          source={{ uri: users[msg.user_id].photoURL! }}
                          style={styles.avatar}
                        />
                      ) : (
                        <View style={styles.avatarPlaceholder}>
                          <Text style={styles.avatarInitial}>
                            {msg.user_id && users[msg.user_id]
                              ? users[msg.user_id].name.charAt(0).toUpperCase()
                              : "O"}
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  )}
                  <View
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
                        msg.sender === "operator"
                          ? styles.myText
                          : styles.theirText,
                      ]}
                    >
                      {msg.text}
                    </Text>
                    <Text
                      style={[
                        styles.timestamp,
                        msg.sender === "operator"
                          ? styles.myTime
                          : styles.theirTime,
                      ]}
                    >
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                </View>
              </React.Fragment>
            );
          })
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

      <Modal
        visible={!!selectedUser}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedUser(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSelectedUser(null)}
        >
          <View style={styles.modalContent}>
            {selectedUser?.photoURL ? (
              <Image
                source={{ uri: selectedUser.photoURL }}
                style={styles.modalAvatar}
              />
            ) : (
              <View
                style={[
                  styles.avatarPlaceholder,
                  styles.modalAvatarPlaceholder,
                ]}
              >
                <Text style={styles.modalAvatarInitial}>
                  {selectedUser?.name?.charAt(0).toUpperCase() || "U"}
                </Text>
              </View>
            )}
            <Text style={styles.modalName}>{selectedUser?.name}</Text>
            <Text style={styles.modalEmail}>{selectedUser?.email}</Text>
            {selectedUser?.role && (
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>{selectedUser.role}</Text>
              </View>
            )}
            <Pressable
              style={styles.closeModalBtn}
              onPress={() => setSelectedUser(null)}
            >
              <Text style={styles.closeModalBtnText}>Yopish</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
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
  dateDivider: {
    alignItems: "center",
    marginVertical: 12,
  },
  dateLabel: {
    backgroundColor: "rgba(0,0,0,0.05)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dateText: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "600",
  },
  messageContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginVertical: 2,
  },
  myContainer: {
    flexDirection: "row-reverse",
    alignSelf: "flex-end",
  },
  theirContainer: {
    alignSelf: "flex-start",
  },
  avatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: "hidden",
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 14,
    color: "#4b5563",
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "80%",
    alignItems: "center",
    gap: 12,
  },
  modalAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  modalAvatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  modalAvatarInitial: {
    fontSize: 32,
    color: "#4b5563",
    fontWeight: "600",
  },
  modalName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  modalEmail: {
    fontSize: 14,
    color: "#6b7280",
  },
  roleBadge: {
    backgroundColor: "#dbeafe",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  closeModalBtn: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
  },
  closeModalBtnText: {
    color: "#374151",
    fontWeight: "600",
  },
});
