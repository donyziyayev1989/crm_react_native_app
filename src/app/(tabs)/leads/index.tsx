import Card from "@/components/Card";
import ConfirmLeadModal from "@/components/ConfirmLeadModal";
import { Lead, WithId } from "@/interfaces";
import db, { orderBy } from "@/services/database";
import {
  canConfirmLead,
  leadItems,
  leadStateLabel,
  sourceLabel,
} from "@/utils/leads";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { callPhone } from "@utils/actions";
import { formatDate, formatPhone, formatSum } from "@utils/format";
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
  const [leads, setLeads] = useState<WithId<Lead>[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<WithId<Lead> | null>(null);

  useEffect(() => {
    const unsubscribe = db.leads.watch(
      (data) => {
        setLeads(data as WithId<Lead>[]);
        setLoading(false);
      },
      // date aralash formatda (YYYY-MM-DD va to'liq ISO): tartib raqam bo'yicha
      orderBy("number", "desc"),
    );

    return () => unsubscribe();
  }, []);

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
        renderItem={({ item }) => {
          const items = leadItems(item);
          const isTelegram = !!item.telegram_id;
          return (
            <Card className="mb-3 shadow-sm shadow-slate-400/30">
              <View className="flex-col justify-between items-start">
                <View className="flex-row items-center gap-2 mb-1">
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {sourceLabel(item.source)}
                    </Text>
                  </View>
                  {item.number != null && (
                    <Text className="text-xs text-gray-500">
                      #{item.number}
                    </Text>
                  )}
                  <Text className="text-xs text-gray-500">
                    {leadStateLabel(item.state)}
                  </Text>
                </View>
                <View className="flex-row items-center gap-2 justify-between w-full">
                  <View className="flex-row items-center gap-2 flex-1">
                    <MaterialIcons name="person" size={24} color="#777" />
                    <Text className="text-lg font-bold text-gray-800">
                      {item.name}
                    </Text>
                  </View>
                  <Text className="text-gray-500">
                    {formatPhone(item.phone)}
                  </Text>
                </View>
                {items.length === 0 ? (
                  <Text className="text-indigo-600 font-bold mt-1">
                    {"Noma'lum mahsulot"}
                  </Text>
                ) : (
                  items.map((it, idx) => (
                    <View
                      key={`${it.product_id}-${idx}`}
                      className="flex-row items-center gap-2 justify-between w-full mt-1"
                    >
                      <View className="flex-row items-center gap-2 flex-1">
                        <MaterialIcons
                          name="check-circle-outline"
                          size={20}
                          color="#6366f1"
                        />
                        <Text className="text-indigo-600 font-bold">
                          {it.name || "Noma'lum mahsulot"}
                        </Text>
                      </View>
                      <Text className="text-blue-500 font-semibold">
                        {it.quantity} dona
                      </Text>
                    </View>
                  ))
                )}
                {item.total != null && (
                  <Text className="text-gray-800 font-semibold mt-1">
                    {item.has_unpriced && Number(item.total) === 0
                      ? "Narx kelishiladi"
                      : `Jami: ${formatSum(item.total)}${item.has_unpriced ? " + narx kelishiladi" : ""}`}
                  </Text>
                )}
                <View className="flex-row items-center gap-2 justify-between w-full mt-1">
                  {item.region_name ? (
                    <Text className="text-sm text-gray-400 flex-1">
                      📍 {item.region_name}
                      {item.district_name ? `, ${item.district_name}` : ""}
                    </Text>
                  ) : (
                    <View />
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
                  <MaterialIcons
                    name={isTelegram ? "telegram" : "info-outline"}
                    size={20}
                    color="white"
                  />
                </Pressable>
                {canConfirmLead(item) && (
                  <>
                    <Pressable
                      onPress={() => setConfirming(item)}
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
                  </>
                )}
              </View>
            </Card>
          );
        }}
      />

      <ConfirmLeadModal
        visible={!!confirming}
        lead={confirming}
        onClose={() => setConfirming(null)}
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
  badge: {
    backgroundColor: "#eef2ff",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { color: "#4f46e5", fontSize: 12, fontWeight: "600" },
});

export default Leads;
