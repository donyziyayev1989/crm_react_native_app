import OrderList from "@/components/OrderList";
import OrderModal from "@/components/OrderModal";
import { Customer, Order, Product, ProductLot, User } from "@/interfaces";
import db, { orderBy } from "@/services/database";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { callPhone, openTelegram } from "@utils/actions";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";

/**
 * Barcha Buyurtmalar ro'yxati (Buyurtmalar tab-i uchun)
 */
const AllOrders = () => {
  const [orders, setOrders] = useState<(Order & { id: string })[]>([]);
  const [customers, setCustomers] = useState<(Customer & { id: string })[]>([]);
  const [products, setProducts] = useState<(Product & { id: string })[]>([]);
  const [users, setUsers] = useState<(User & { id: string })[]>([]);
  const [lots, setLots] = useState<(ProductLot & { id: string })[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const [editLine, setEditLine] = useState<(Order & { id: string }) | null>(
    null,
  );
  const [addLineModal, setAddLineModal] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ordersData, customersData, productsData, usersData, lotsData] =
        await Promise.all([
          db.orders.list(orderBy("date", "desc")),
          db.customers.list(),
          db.products.list(),
          db.users.list(),
          db.lots.list(),
        ]);
      setOrders(ordersData as (Order & { id: string })[]);
      setCustomers(customersData as (Customer & { id: string })[]);
      setProducts(productsData as (Product & { id: string })[]);
      setUsers(usersData as (User & { id: string })[]);
      setLots(lotsData as (ProductLot & { id: string })[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, []),
  );

  const handleDelete = (order: Order & { id: string }) => {
    Alert.alert("O'chirish", "Bu buyurtmani o'chirishni xohlaysizmi?", [
      { text: "Bekor qilish", style: "cancel" },
      {
        text: "O'chirish",
        style: "destructive",
        onPress: async () => {
          try {
            await db.orders.delete(order.id);
            setOrders((prev) => prev.filter((o) => o.id !== order.id));
          } catch {
            Alert.alert("Xato", "Buyurtmani o'chirishda xatolik yuz berdi");
          }
        },
      },
    ]);
  };

  if (loading && orders.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

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
      />

      <OrderModal
        visible={addLineModal}
        onClose={() => {
          setAddLineModal(false);
          setEditLine(null);
        }}
        editLine={editLine}
        onSuccess={() => fetchData()}
      />
    </View>
  );
};

export default AllOrders;
