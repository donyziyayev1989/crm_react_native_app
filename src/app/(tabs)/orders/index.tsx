import Loading from "@/components/Loading";
import OrderList from "@/components/OrderList";
import OrderModal from "@/components/OrderModal";
import { Order, WithId } from "@/interfaces";
import { useRefData } from "@/providers/ReferenceData";
import db, { limit, orderBy } from "@/services/database";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { callPhone, openTelegram } from "@utils/actions";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

const PAGE_SIZE = 50;

/**
 * Barcha Buyurtmalar ro'yxati (Buyurtmalar tab-i uchun)
 */
const AllOrders = () => {
  const [orders, setOrders] = useState<WithId<Order>[]>([]);
  const [limitCount, setLimitCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const { customers, products, users, lots } = useRefData();
  const router = useRouter();

  const [editLine, setEditLine] = useState<WithId<Order> | null>(null);
  const [addLineModal, setAddLineModal] = useState(false);

  // Oxirgi N buyurtma. "Yana yuklash" N ni oshiradi; watch keshdan ishlaydi.
  useEffect(() => {
    const unsub = db.orders.watch(
      (data) => {
        setOrders(data as WithId<Order>[]);
        setLoading(false);
      },
      orderBy("date", "desc"),
      limit(limitCount),
    );
    return unsub;
  }, [limitCount]);

  const handleDelete = (order: WithId<Order>) => {
    Alert.alert("O'chirish", "Bu buyurtmani o'chirishni xohlaysizmi?", [
      { text: "Bekor qilish", style: "cancel" },
      {
        text: "O'chirish",
        style: "destructive",
        onPress: async () => {
          try {
            await db.orders.delete(order.id);
          } catch {
            Alert.alert("Xato", "Buyurtmani o'chirishda xatolik yuz berdi");
          }
        },
      },
    ]);
  };

  if (loading) return <Loading />;

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          headerTitle: "Barcha xaridlar",
          headerRight: () => (
            <Pressable
              onPress={() => {
                setEditLine(null);
                setAddLineModal(true);
              }}
              className="p-3"
            >
              <MaterialIcons name="add-circle" size={28} color="#6366f1" />
            </Pressable>
          ),
        }}
      />

      <OrderList
        orders={orders}
        customers={customers}
        products={products}
        lots={lots}
        users={users}
        onEdit={(item) => {
          setEditLine(item);
          setAddLineModal(true);
        }}
        onDelete={handleDelete}
        onCall={callPhone}
        onTelegram={openTelegram}
        onOrderPress={(id) => {
          router.push({
            pathname: "/orders/[orderId]",
            params: { orderId: id },
          });
        }}
        ListFooterComponent={
          orders.length >= limitCount ? (
            <Pressable
              onPress={() => setLimitCount((n) => n + PAGE_SIZE)}
              className="self-center my-4 px-6 py-3 rounded-xl bg-indigo-100"
            >
              <Text className="text-indigo-700 font-semibold">Yana yuklash</Text>
            </Pressable>
          ) : null
        }
      />

      <OrderModal
        visible={addLineModal}
        onClose={() => {
          setAddLineModal(false);
          setEditLine(null);
        }}
        editLine={editLine}
      />
    </View>
  );
};

export default AllOrders;
