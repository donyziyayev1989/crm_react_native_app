import ProductLotForm from "@/components/ProductLotForm";
import { useRefData } from "@/providers/ReferenceData";
import { useRouter } from "expo-router";
import React from "react";
import { Text, View } from "react-native";

const AddLot = () => {
  const router = useRouter();
  const { isAdmin } = useRefData();

  // Partiyalar sayt bilan umumiy jadval: faqat admin yaratadi (RLS ham shuni tekshiradi)
  if (!isAdmin) {
    return (
      <View className="flex-1 justify-center items-center bg-white p-6">
        <Text className="text-gray-500 text-center">
          Faqat administrator tahrirlay oladi
        </Text>
      </View>
    );
  }

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
