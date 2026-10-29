import Loading from "@/components/Loading";
import LotMapView from "@/components/LotMapView";
import { Order, WithId } from "@/interfaces";
import { useRefData } from "@/providers/ReferenceData";
import db, { where } from "@/services/database";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

const LotMapScreen = () => {
  const { lotId, selectedIds } = useLocalSearchParams<{
    lotId: string;
    selectedIds?: string;
  }>();
  const router = useRouter();
  const { customers, products } = useRefData();

  const [orders, setOrders] = useState<WithId<Order>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!lotId) return;
    const ids =
      selectedIds && selectedIds.trim() !== "" ? selectedIds.split(",") : [];

    // Watch orders in real-time
    const unsubscribe = db.orders.watch((allOrders) => {
      let filtered = allOrders as WithId<Order>[];
      if (ids.length > 0) {
        filtered = filtered.filter((o) => ids.includes(o.id));
      }
      setOrders(filtered);
      setLoading(false);
    }, where("lotId", "==", lotId));

    return () => unsubscribe();
  }, [lotId, selectedIds]);

  if (loading) return <Loading />;

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
});
