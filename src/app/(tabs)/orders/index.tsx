import Card from "@/components/Card";
import { Order } from "@/interfaces";
import db, { orderBy } from "@/services/database";
import { formatDate } from "@/utils/format";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";

const Orders = () => {
  const [orders, setOrders] = useState<(Order & { id: string })[]>([]);
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      const data = await db.orders.list(orderBy("date", "desc"));
      setOrders(data as (Order & { id: string })[]);
      setLoading(false);
    };
    fetchOrders();
  }, []);

  return (
    <View className="flex-1">
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 8, gap: 8 }}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/orders/${item.id}`)}>
            <Card>
              <View className="flex-row justify-between mb-1">
                <Text className="font-semibold text-base">{item.name}</Text>
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
                  <MaterialIcons name="inventory" size={14} color="#6366f1" />
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
                      {item.lost_products}
                    </Text>
                  </Text>
                </View>
              </View>
            </Card>
          </Pressable>
        )}
      />
    </View>
  );
};

export default Orders;
