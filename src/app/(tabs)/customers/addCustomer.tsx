import CustomerForm from "@/components/CustomerForm";
import { useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";

const AddCustomer = () => {
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: "#fff", padding: 20 }}>
      <CustomerForm
        onSuccess={() => router.back()}
        onCancel={() => router.back()}
      />
    </View>
  );
};

export default AddCustomer;
