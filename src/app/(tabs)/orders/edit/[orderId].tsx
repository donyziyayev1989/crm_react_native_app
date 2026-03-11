import OrderForm from "@/components/OrderForm";
import { Order } from "@/interfaces";
import db from "@/services/database";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

const EditOrder = () => {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orderId) {
      db.orders.get(orderId).then((data) => {
        setOrder(data as Order);
        setLoading(false);
      });
    }
  }, [orderId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <Stack.Screen options={{ title: "Buyurtmani tahrirlash" }} />
      {order && (
        <OrderForm
          initialData={order}
          onSuccess={() => router.back()}
          onCancel={() => router.back()}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
});

export default EditOrder;
