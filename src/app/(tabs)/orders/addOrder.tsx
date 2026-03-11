import OrderForm from "@/components/OrderForm";
import { useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";

const AddOrder = () => {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <OrderForm
        onSuccess={() => router.back()}
        onCancel={() => router.back()}
      />
    </View>
  );
};

export default AddOrder;
