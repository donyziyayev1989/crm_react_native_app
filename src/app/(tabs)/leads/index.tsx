import Card from "@/components/Card";
import { Lead } from "@/interfaces";
import db, { orderBy } from "@/services/database";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { callPhone } from "@utils/actions";
import { formatDate, formatPhone } from "@utils/format";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

/**
 * Yangi Leadlar (Murojaatlar) ro'yxati
 */
const Leads = () => {
  const router = useRouter();
  const [leads, setLeads] = useState<(Lead & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = db.leads.watch(
      (data) => {
        setLeads(data as (Lead & { id: string })[]);
        setLoading(false);
      },
      orderBy("date", "desc"),
    );

    return () => unsubscribe();
  }, []);

  const handleConfirm = async (lead: Lead & { id: string }) => {
    // ... same as before
    Alert.alert(
      "Tasdiqlash",
      "Bu murojaatdan mijoz va buyurtma yaratilsinmi?",
      [
        { text: "Bekor qilish", style: "cancel" },
        {
          text: "Tasdiqlash",
          onPress: async () => {
            try {
              // Mijoz yaratish
              const customerId = await db.customers.create({
                name: lead.name,
                phone: lead.phone,
                telegram_id: lead.telegram_id,
                region_name: "Noma'lum",
                tag_ids: [],
                order_ids: [],
                rates: 0,
                note: lead.note || "",
                user_id: "",
              });

              // Buyurtma yaratish
              await db.orders.create({
                customer_id: customerId,
                product_count: lead.product_count,
                lotId: "",
                date: new Date().toISOString(),
                product_id: "",
                product_price: 0,
                delivery_price: 0,
                region_name: "Noma'lum",
                rate: 0,
                state: "new",
                user_id: "",
              });

              // Leadni o'chirish
              await db.leads.delete(lead.id);
              Alert.alert("Muvaffaqiyatli", "Mijoz va buyurtma yaratildi.");
            } catch (err) {
              Alert.alert("Xato", "Mijoz yaratishda xatolik yuz berdi.");
            }
          },
        },
      ],
    );
  };

  const handleReject = async (id: string) => {
    Alert.alert("Rad etish", "Bu murojaatni bekor qilmoqchimisiz?", [
      { text: "Yo'q", style: "cancel" },
      {
        text: "Ha",
        style: "destructive",
        onPress: async () => {
          await db.leads.update(id, { state: "rejected" });
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#6366f1" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{ title: "Yangi murojaatlar", headerShown: true }}
      />
      <FlatList
        data={leads}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <MaterialIcons name="inbox" size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>
              Hozircha yangi murojaatlar yo'q
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <Card className="mb-3 shadow-sm shadow-slate-400/30">
            <View className="flex-row justify-between items-start">
              <View>
                <Text className="text-lg font-bold text-gray-800">
                  {item.name}
                </Text>
                <Text className="text-gray-500">{formatPhone(item.phone)}</Text>
                <Text className="text-indigo-600 font-semibold mt-1">
                  {item.product_count} dona buyurtma
                </Text>
              </View>
              <Text className="text-xs text-gray-400">
                {formatDate(item.date)}
              </Text>
            </View>

            <View className="flex-row gap-2 mt-4">
              <Pressable
                onPress={() => callPhone(item.phone)}
                className="flex-1 bg-green-500 p-3 rounded-xl flex-row justify-center items-center gap-2"
              >
                <MaterialIcons name="phone" size={20} color="white" />
              </Pressable>

              <Pressable
                onPress={() => router.push(`/(tabs)/leads/${item.id}` as any)}
                className="flex-1 bg-blue-400 p-3 rounded-xl flex-row justify-center items-center gap-2"
              >
                <MaterialIcons name="telegram" size={20} color="white" />
              </Pressable>
              <Pressable
                onPress={() => handleConfirm(item)}
                className="flex-1 border border-green-500 p-3 rounded-xl flex-row justify-center items-center gap-2"
              >
                <MaterialIcons name="check" size={20} color="green" />
              </Pressable>
              <Pressable
                onPress={() => handleReject(item.id)}
                className="flex-1 border border-red-400 p-3 rounded-xl flex-row justify-center items-center gap-2"
              >
                <MaterialIcons name="close" size={20} color="#f87171" />
              </Pressable>
            </View>
          </Card>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { padding: 16 },
  empty: { alignItems: "center", marginTop: 100 },
  emptyText: { color: "#9ca3af", marginTop: 8 },
});

export default Leads;
