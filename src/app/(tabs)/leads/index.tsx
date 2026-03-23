import Card from "@/components/Card";
import { Lead } from "@/interfaces";
import db, { orderBy } from "@/services/database";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { callPhone } from "@utils/actions";
import { formatDate, formatPhone } from "@utils/format";
import { Link, Stack, useRouter } from "expo-router";
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
    Alert.alert(
      "Tasdiqlash",
      "Bu murojaatdan mijoz va buyurtma yaratilsinmi?",
      [
        { text: "Bekor qilish", style: "cancel" },
        {
          text: "Tasdiqlash",
          onPress: async () => {
            try {
              // Mahsulot narxini olish
              let productPrice = 0;
              if (lead.product_id) {
                const product = await db.products.get(lead.product_id);
                if (product) {
                  productPrice = product.price;
                }
              }

              // Mijoz yaratish
              const customerId = await db.customers.create({
                name: lead.name,
                phone: lead.phone,
                telegram_id: lead.telegram_id,
                region_name: lead.region_name || "Noma'lum",
                district_name: lead.district_name || "Noma'lum",
                location: lead.location,
                tag_ids: [],
                order_ids: [],
                rates: 0,
                note: lead.note || "Telegram bot orqali",
                user_id: "",
              });

              console.log("Customer created with ID:", customerId);

              // Buyurtma yaratish
              const orderId = await db.orders.create({
                customer_id: customerId,
                product_count: lead.product_count,
                lotId: "",
                date: new Date().toISOString(),
                product_id: lead.product_id || "",
                product_price: productPrice,
                delivery_price: 0,
                region_name: lead.region_name || "Noma'lum",
                location: lead.location,
                rate: 0,
                state: "new",
                user_id: "",
                total: productPrice * lead.product_count,
              } as any);

              console.log("Order created with ID:", orderId);

              // Leadni o'chirish
              await db.leads.delete(lead.id);
              Alert.alert("Muvaffaqiyatli", "Mijoz va buyurtma yaratildi.");
              router.push(`/orders/${orderId}` as any);
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
        options={{
          title: "Yangi murojaatlar",
          headerLeft: () => (
            <Link href="/" asChild>
              <Pressable className="p-3">
                <MaterialIcons name="arrow-back" size={24} color="#6b7280" />
              </Pressable>
            </Link>
          ),
        }}
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
            <View className="flex-col justify-between items-start">
              <View className="flex-row items-center gap-2 justify-between w-full">
                <View className="flex-row items-center gap-2">
                  <MaterialIcons name="person" size={24} color="#777" />
                  <Text className="text-lg font-bold text-gray-800">
                    {item.name}
                  </Text>
                </View>
                <Text className="text-gray-500">{formatPhone(item.phone)}</Text>
              </View>
              <View className="flex-row items-center gap-2 justify-between w-full">
                <View className="flex-row items-center gap-2">
                  <MaterialIcons
                    name="check-circle-outline"
                    size={20}
                    color="#6366f1"
                  />
                  <Text className="text-indigo-600 font-bold">
                    {item.product_name || "Noma'lum mahsulot"}
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Text className="text-blue-500 font-semibold mt-1">
                    {item.product_count} dona
                  </Text>
                </View>
              </View>
              <View className="flex-row items-center gap-2 justify-between w-full mt-1">
                {item.region_name && (
                  <Text className="text-sm text-gray-400">
                    📍 {item.region_name}, {item.district_name}
                  </Text>
                )}
                <Text className="text-sm text-muted">
                  {formatDate(item.date)}
                </Text>
              </View>
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
