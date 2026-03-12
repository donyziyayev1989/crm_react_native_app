import ProductLotForm from "@/components/ProductLotForm";
import OrderForm from "@/components/ProductLotForm";
import { ProductLot } from "@/interfaces";
import db from "@/services/database";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

/**
 * EditLot (Partiyani tahrirlash)
 */
const EditLot = () => {
  const { lotId } = useLocalSearchParams<{ lotId: string }>();
  const router = useRouter();
  const [lot, setLot] = useState<ProductLot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (lotId) {
      db.lots.get(lotId).then((data) => {
        setLot(data as ProductLot);
        setLoading(false);
      });
    }
  }, [lotId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <Stack.Screen options={{ title: "Partiyani tahrirlash" }} />
      {lot && (
        <ProductLotForm
          initialData={lot}
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

export default EditLot;
