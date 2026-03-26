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

  useEffect(() => {
    if (!lotId) return;
    const ids =
      selectedIds && selectedIds.trim() !== "" ? selectedIds.split(",") : [];

    // Watch orders in real-time
    const unsubscribe = db.orders.watch((allOrders) => {
      let filtered = allOrders as (Order & { id: string })[];
      if (ids.length > 0) {
        filtered = filtered.filter((o) => ids.includes(o.id));
      }
      setOrders(filtered);
      setLoading(false);
    }, where("lotId", "==", lotId));

    // Fetch static data once
    const fetchOthers = async () => {
      try {
        const [customersData, productsData, usersData, lotsData] =
          await Promise.all([
            db.customers.list(),
            db.products.list(),
            db.users.list(),
            db.lots.list(),
          ]);
        setCustomers(customersData as any);
        setProducts(productsData as any);
        setUsers(usersData as any);
        setLots(lotsData as any);
      } catch (e) {
        console.error(e);
      }
    };
    fetchOthers();

    return () => unsubscribe();
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
