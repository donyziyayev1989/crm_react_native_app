import Card from "@/components/Card";
import db, { orderBy } from "@/services/database";
import { chatEvents } from "@/utils/chat_events";
import { formatPhone } from "@/utils/format";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Customer, Lead, LeadChat } from "@interfaces/index";
import { Stack } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const Messages = () => {
  const [chats, setChats] = useState<LeadChat[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    // 1. Lead chats watch
    const unsubChats = db.lead_chats.watch(
      (data) => {
        setChats(data);
        setLoading(false);
      },
      orderBy("last_timestamp", "desc"),
    );

    // 2. Customers watch (for names)
    const unsubCustomers = db.customers.watch(setCustomers);

    // 3. Leads watch (for names)
    const unsubLeads = db.leads.watch(setLeads);

    return () => {
      unsubChats();
      unsubCustomers();
      unsubLeads();
    };
  }, []);

  const nameMap = useMemo(() => {
    const map: Record<
      string,
      { name: string; identifier: string; phone: string }
    > = {};
    customers.forEach((c) => {
      if (c.id)
        map[c.id] = {
          name: c.name,
          identifier: c.telegram_id || c.phone,
          phone: c.phone,
        };
    });
    leads.forEach((l) => {
      if (l.id)
        map[l.id] = {
          name: l.name,
          identifier: l.telegram_id || l.phone,
          phone: l.phone,
        };
    });
    return map;
  }, [customers, leads]);

  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats;

    const query = searchQuery.toLowerCase().trim();
    return chats.filter((chat) => {
      const target = nameMap[chat.id || chat.lead_id];
      if (!target) return false;

      const nameMatch = target.name.toLowerCase().includes(query);
      const phoneMatch = target.phone
        .replace(/\D/g, "")
        .includes(query.replace(/\D/g, ""));
      const originalPhoneMatch = target.phone.includes(query);

      return nameMatch || phoneMatch || originalPhoneMatch;
    });
  }, [chats, searchQuery, nameMap]);

  const renderChatItem = ({ item }: { item: LeadChat }) => {
    const target = nameMap[item.id || item.lead_id] || {
      name: "Noma'lum foydalanuvchi",
      identifier: "",
    };
    const hasUnread = (item.unread_count || 0) > 0;

    return (
      <Pressable
        style={styles.borderDotted}
        onPress={() =>
          chatEvents.emit({
            chatId: item.id || item.lead_id,
            title: target.name,
            targetIdentifier: target.identifier,
          })
        }
      >
        <Card
          className={`py-3 ${
            hasUnread ? "bg-blue-50 border-l-4 border-blue-500" : ""
          }`}
        >
          <View className="flex-row justify-between items-start">
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text
                  className={`text-lg ${
                    hasUnread
                      ? "font-bold text-blue-900"
                      : "font-semibold text-gray-900"
                  }`}
                >
                  {target.name}
                </Text>
                <Text className="text-sm text-gray-400 font-normal">
                  {formatPhone(target.phone)}
                </Text>
              </View>
              <Text
                numberOfLines={1}
                className={`mt-1 ${
                  hasUnread ? "text-blue-500 font-medium" : "text-gray-200"
                }`}
              >
                {item.last_message || "Xabar yo'q"}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-sm text-muted">
                {item.last_timestamp
                  ? new Date(item.last_timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : ""}
              </Text>
              {hasUnread && (
                <View className="bg-red-500 rounded-full px-2 py-1 mt-3">
                  <Text className="text-white text-[10px] font-bold">
                    {item.unread_count}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Card>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={styles.searchContainer}>
            <MaterialIcons name="search" size={22} color="#9ca3af" />
            <TextInput
              placeholder="Ism yoki telefon raqami bo'yicha qidirish..."
              placeholderTextColor="#9ca3af"
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery("")}>
                <MaterialIcons name="close" size={20} color="#9ca3af" />
              </Pressable>
            )}
          </View>
          <FlatList
            data={filteredChats}
            renderItem={renderChatItem}
            keyExtractor={(item) => item.id || item.lead_id}
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center mt-20">
                <MaterialIcons
                  name="chat-bubble-outline"
                  size={64}
                  color="#d1d5db"
                />
                <Text className="text-gray-400 mt-4 text-lg">
                  {searchQuery ? "Natija topilmadi" : "Xabarlar mavjud emas"}
                </Text>
              </View>
            }
          />
        </View>
      )}
    </SafeAreaView>
  );
};

export default Messages;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  borderDotted: {
    borderBottomWidth: 1,
    borderColor: "#e5e7eb",
    borderStyle: "dotted",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    margin: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    height: 48,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
    height: "100%",
  },
});
