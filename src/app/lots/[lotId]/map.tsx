import LotMapView from "@/components/LotMapView";
import { Customer, Order, Product, ProductLot, User } from "@/interfaces";
import db, { where } from "@/services/database";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

const LotMapScreen = () => {
  const { lotId, selectedIds } = useLocalSearchParams<{
    lotId: string;
    selectedIds?: string;
  }>();
  const router = useRouter();

  const [orders, setOrders] = useState<(Order & { id: string })[]>([]);
  const [customers, setCustomers] = useState<(Customer & { id: string })[]>([]);
  const [products, setProducts] = useState<(Product & { id: string })[]>([]);
  const [users, setUsers] = useState<(User & { id: string })[]>([]);
  const [lots, setLots] = useState<(ProductLot & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!lotId) return;
    try {
      const ids =
        selectedIds && selectedIds.trim() !== "" ? selectedIds.split(",") : [];

      const [ordersData, customersData, productsData, usersData, lotsData] =
        await Promise.all([
          db.orders.list(where("lotId", "==", lotId)),
          db.customers.list(),
          db.products.list(),
          db.users.list(),
          db.lots.list(),
        ]);

      let filteredOrders = ordersData as (Order & { id: string })[];
      if (ids.length > 0) {
        filteredOrders = filteredOrders.filter((o) => ids.includes(o.id));
      }

      setOrders(filteredOrders);
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

  useEffect(() => {
    fetchData();
  }, [lotId, selectedIds]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <LotMapView
        orders={orders}
        customers={customers}
        products={products}
        users={users}
        lots={lots}
        onUpdate={fetchData}
        onOrderPress={(id) => {
          router.push({
            pathname: "/orders/[orderId]",
            params: { orderId: id },
          });
        }}
      />
    </View>
  );
};

export default LotMapScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  backBtnText: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "500",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
});
