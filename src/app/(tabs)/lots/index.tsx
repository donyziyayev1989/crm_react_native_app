import Card from "@/components/Card";
import { Order, ProductLot } from "@/interfaces";
import db, { orderBy } from "@/services/database";
import { formatDate } from "@/utils/format";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";

const Lots = () => {
  const [lots, setLots] = useState<(ProductLot & { id: string })[]>([]);
  const [orders, setOrders] = useState<(Order & { id: string })[]>([]);
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const rowRefs = useRef(new Map<string, any>());
  const prevOpenedRow = useRef<string | null>(null);

  const closeRow = (id: string) => {
    if (prevOpenedRow.current !== null && prevOpenedRow.current !== id) {
      const row = rowRefs.current.get(prevOpenedRow.current);
      if (row) row.close();
    }
    prevOpenedRow.current = id;
  };

  useEffect(() => {
    const unsubLots = db.lots.watch(
      (data) => {
        setLots(data as (ProductLot & { id: string })[]);
        setLoading(false);
      },
      orderBy("date", "desc"),
    );

    const unsubOrders = db.orders.watch((data) => {
      setOrders(data as (Order & { id: string })[]);
    });

    return () => {
      unsubLots();
      unsubOrders();
    };
  }, []);

  const enrichedLots = useMemo(() => {
    const counts = orders.reduce(
      (acc, order) => {
        if (order.lotId) {
          acc[order.lotId] =
            (acc[order.lotId] || 0) + (order.product_count || 0);
        }
        return acc;
      },
      {} as Record<string, number>,
    );

    return lots.map((lot) => ({
      ...lot,
      order_count: counts[lot.id] || 0,
    }));
  }, [lots, orders]);

  const handleDelete = (id: string) => {
    Alert.alert("O'chirish", "Haqiqatan ham bu partiyani o'chirmoqchimisiz?", [
      { text: "Bekor qilish", style: "cancel" },
      {
        text: "O'chirish",
        style: "destructive",
        onPress: async () => {
          try {
            setLots((prev) => prev.filter((o) => o.id !== id));
            await db.lots.delete(id);
          } catch (error) {
            Alert.alert("Xato", "Partiyani o'chirishda xatolik yuz berdi");
          }
        },
      },
    ]);
  };

  const renderRightPanel = (item: ProductLot & { id: string }) => {
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

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

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
                ref={
                  ((ref: any) => {
                    if (ref) rowRefs.current.set(item.id, ref);
                    else rowRefs.current.delete(item.id);
                  }) as any
                }
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
                            {item.lost_products || 0} ({" "}
                            {item.product_count
                              ? (
                                  ((item.lost_products || 0) * 100) /
                                  item.product_count
                                ).toFixed(1)
                              : 0}
                            % )
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
                                item.lost_products >
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
