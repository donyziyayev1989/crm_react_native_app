import ProductLotForm from "@/components/ProductLotForm";
import { useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";

const AddLot = () => {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <ProductLotForm
        onSuccess={() => router.back()}
        onCancel={() => router.back()}
      />
    </View>
  );
};

export default AddLot;
