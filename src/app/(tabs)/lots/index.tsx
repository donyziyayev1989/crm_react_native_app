import Card from "@/components/Card";
import Loading from "@/components/Loading";
import { useSwipeableRows } from "@/hooks/useSwipeableRows";
import { useRefData } from "@/providers/ReferenceData";
import db, { where } from "@/services/database";
import { formatDate } from "@/utils/format";
import { lostPercent } from "@/utils/lots";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";

const Lots = () => {
  const { lots, loading } = useRefData();
  const router = useRouter();
  const { closeRow, registerRow } = useSwipeableRows();
  const [orderCounts, setOrderCounts] = useState<Record<string, number>>({});

  // Har lot uchun bitta aggregate read (sum). Ilgari BARCHA orders watch qilinardi.
  // Eslatma: product_count string bo'lib saqlangan hujjatlar sum ga kirmaydi.
  // Faqat focus'da va lotlar TO'PLAMI o'zgarganda qayta so'raladi (har snapshot'da emas).
  const lotIdsKey = useMemo(() => lots.map((l) => l.id).join(","), [lots]);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const ids = lotIdsKey ? lotIdsKey.split(",") : [];
      Promise.all(
        ids.map(async (id) => {
          const total = await db.orders
            .sum("product_count", where("lotId", "==", id))
            .catch(() => 0);
          return [id, total] as const;
        }),
      ).then((entries) => {
        if (!cancelled) setOrderCounts(Object.fromEntries(entries));
      });
      return () => {
        cancelled = true;
      };
    }, [lotIdsKey]),
  );

  const enrichedLots = useMemo(
    () => lots.map((lot) => ({ ...lot, order_count: orderCounts[lot.id] ?? 0 })),
    [lots, orderCounts],
  );

  const renderRightPanel = (item: { id: string }) => {
    return (
      <View className="flex-row z-50">
        <Pressable
          onPress={() => {
            closeRow(item.id);
            router.push({
              pathname: "/lots/dashboard/[lotId]",
              params: { lotId: item.id },
            });
          }}
          className="bg-blue-400 w-16 h-full flex items-center justify-center"
        >
          <MaterialIcons name="analytics" size={22} color="white" />
        </Pressable>
        <Pressable
          onPress={() => {
            closeRow(item.id);
            router.push({
              pathname: "/lots/edit/[lotId]",
              params: { lotId: item.id },
            });
          }}
          className="bg-slate-300 w-16 h-full flex items-center justify-center"
        >
          <MaterialIcons name="edit" size={22} color="white" />
        </Pressable>
      </View>
    );
  };

  if (loading) return <Loading />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          headerTitle: "Partiyalar",
          headerRight: () => (
            <Pressable
              onPress={() => router.push("/lots/addLot" as any)}
              className="p-3"
            >
              <MaterialIcons name="add-circle" size={28} color="#6366f1" />
            </Pressable>
          ),
        }}
      />
      <View className="flex-1">
        <FlatList
          data={enrichedLots}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 100 }}
          ListEmptyComponent={() => (
            <View className="items-center mt-20">
              <MaterialIcons name="inventory" size={48} color="gray" />
              <Text className="text-gray-500 mt-2">Partiyalar mavjud emas</Text>
              <Pressable
                onPress={() => router.push("/lots/addLot" as any)}
                className="mt-4 bg-indigo-500 px-6 py-3 rounded-xl"
              >
                <Text className="text-white font-semibold">
                  Partiya qo'shish
                </Text>
              </Pressable>
            </View>
          )}
          renderItem={({ item }) => (
            <View className="bg-white rounded-2xl overflow-hidden shadow-sm shadow-slate-400/30">
              <ReanimatedSwipeable
                ref={registerRow(item.id)}
                onSwipeableWillOpen={() => closeRow(item.id)}
                renderRightActions={() => renderRightPanel(item)}
              >
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/lots/[lotId]",
                      params: { lotId: item.id },
                    })
                  }
                >
                  <Card>
                    <View className="flex-row justify-between mb-1">
                      <Text className="font-semibold text-base">
                        {item.name}
                      </Text>
                      <View className="flex-row items-center gap-1">
                        <MaterialIcons
                          name="calendar-today"
                          size={14}
                          color="#6b7280"
                        />
                        <Text className="text-gray-500 text-sm">
                          {formatDate(item.date)}
                        </Text>
                      </View>
                    </View>
                    <View className="flex-row justify-between mt-1">
                      <View className="flex-row items-center gap-1">
                        <MaterialIcons
                          name="inventory"
                          size={14}
                          color="#6366f1"
                        />
                        <Text className="text-sm text-gray-600">
                          Tovar:{" "}
                          <Text className="font-semibold text-gray-800">
                            {item.product_count}
                          </Text>
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-1">
                        <MaterialIcons
                          name="remove-circle-outline"
                          size={14}
                          color="#ef4444"
                        />
                        <Text className="text-sm text-gray-600">
                          Yo'qotilgan:{" "}
                          <Text className="font-semibold text-red-500">
                            {item.lost_products || 0} ( {lostPercent(item)}% )
                          </Text>
                        </Text>
                      </View>
                    </View>
                    {/* Qoldiq va jami buyurtmalar soni */}
                    <View className="flex-row justify-between mt-1">
                      <View className="flex-row items-center gap-1">
                        <MaterialIcons
                          name="assignment-turned-in"
                          size={14}
                          color="#6366f1"
                        />
                        <Text className="text-sm text-gray-600">
                          Qoldiq:{" "}
                          <Text className="font-semibold text-gray-800">
                            {item.product_count - (item.lost_products || 0)}
                          </Text>
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-1">
                        <MaterialIcons
                          name="shopping-cart"
                          size={14}
                          color="#6366f1"
                        />
                        <Text className="text-sm text-gray-600">
                          Jami buyurtmalar:{" "}
                          <Text
                            className={`font-semibold ${
                              item.order_count -
                                item.product_count +
                                (item.lost_products || 0) >
                              0
                                ? "text-red-500"
                                : "text-gray-800"
                            }`}
                          >
                            {item.order_count || 0}
                          </Text>
                        </Text>
                      </View>
                    </View>
                  </Card>
                </Pressable>
              </ReanimatedSwipeable>
            </View>
          )}
        />
      </View>
    </GestureHandlerRootView>
  );
};

export default Lots;
