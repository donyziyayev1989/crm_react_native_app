import Card from "@/components/Card";
import { Order } from "@/interfaces";
import db, { orderBy } from "@/services/database";
import { formatDate } from "@/utils/format";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
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

const Orders = () => {
  const [orders, setOrders] = useState<(Order & { id: string })[]>([]);
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const rowRefs = useRef(new Map<string, any>());
  const prevOpenedRow = useRef<string | null>(null);

  const closeRow = (id: string) => {
    if (prevOpenedRow.current !== null && prevOpenedRow.current !== id) {
      const row = rowRefs.current.get(prevOpenedRow.current);
      if (row) row.close();
    }
    prevOpenedRow.current = id;
  };

  useFocusEffect(
    useCallback(() => {
      const fetchOrders = async () => {
        setLoading(true);
        const data = await db.orders.list(orderBy("date", "desc"));
        setOrders(data as (Order & { id: string })[]);
        setLoading(false);
      };
      fetchOrders();
    }, []),
  );

  const handleDelete = (id: string) => {
    Alert.alert("O'chirish", "Haqiqatan ham bu buyurtmani o'chirmoqchimisiz?", [
      { text: "Bekor qilish", style: "cancel" },
      {
        text: "O'chirish",
        style: "destructive",
        onPress: async () => {
          try {
            setOrders((prev) => prev.filter((o) => o.id !== id));
            await db.orders.delete(id);
          } catch (error) {
            Alert.alert("Xato", "Buyurtmani o'chirishda xatolik yuz berdi");
          }
        },
      },
    ]);
  };

  const renderRightPanel = (item: Order & { id: string }) => {
    return (
      <View className="flex-row z-50">
        <Pressable
          onPress={() => {
            closeRow(item.id);
            router.push(`/orders/dashboard/${item.id}`);
          }}
          className="bg-blue-400 w-16 h-full flex items-center justify-center"
        >
          <MaterialIcons name="analytics" size={22} color="white" />
        </Pressable>
        <Pressable
          onPress={() => {
            closeRow(item.id);
            router.push(`/orders/edit/${item.id}`);
          }}
          className="bg-slate-300 w-16 h-full flex items-center justify-center"
        >
          <MaterialIcons name="edit" size={22} color="white" />
        </Pressable>
        {/* <Pressable
          onPress={() => handleDelete(item.id)}
          className="bg-red-400 w-16 h-full flex items-center justify-center"
        >
          <MaterialIcons name="delete-outline" size={22} color="white" />
        </Pressable> */}
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
      <View className="flex-1">
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 8, gap: 8 }}
          renderItem={({ item }) => (
            <View className="bg-white rounded-2xl overflow-hidden">
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
                <Pressable onPress={() => router.push(`/orders/${item.id}`)}>
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

export default Orders;
