import Card from "@/components/Card";
import db, { orderBy } from "@/services/database";
import { chatEvents } from "@/utils/chat_events";
import { formatPhone } from "@/utils/format";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Customer, Lead, LeadChat } from "@interfaces/index";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const Messages = () => {
  const [chats, setChats] = useState<LeadChat[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

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

  const renderChatItem = ({ item }: { item: LeadChat }) => {
    const target = nameMap[item.id || item.lead_id] || {
      name: "Noma'lum foydalanuvchi",
      identifier: "",
    };
    const hasUnread = (item.unread_count || 0) > 0;

    return (
      <Pressable
        className="rounded-xl overflow-hidden"
        style={styles.boxShadow}
        onPress={() =>
          chatEvents.emit({
            chatId: item.id || item.lead_id,
            title: target.name,
            targetIdentifier: target.identifier,
          })
        }
      >
        <Card
          className={`rounded-xl ${
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
    <View style={styles.container}>
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <FlatList
          data={chats}
          renderItem={renderChatItem}
          keyExtractor={(item) => item.id || item.lead_id}
          contentContainerStyle={{ padding: 12, gap: 10 }}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center mt-20">
              <MaterialIcons
                name="chat-bubble-outline"
                size={64}
                color="#d1d5db"
              />
              <Text className="text-gray-400 mt-4 text-lg">
                Xabarlar mavjud emas
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

export default Messages;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  boxShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
});
