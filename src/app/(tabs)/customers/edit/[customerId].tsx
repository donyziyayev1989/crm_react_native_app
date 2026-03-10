import CustomerForm from "@/components/CustomerForm";
import db from "@/services/database";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Customer } from "@interfaces/index";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

const EditCustomer = () => {
  const { customerId } = useLocalSearchParams<{ customerId: string }>();
  const router = useRouter();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customerId) return;
    db.customers.get(customerId).then((data) => {
      setCustomer(data);
      setLoading(false);
    });
  }, [customerId]);

  return (
    <>
      <Stack.Screen
        options={{
          title: "Mijozni tahrirlash",
          headerShown: true,
          headerLeft: ({ tintColor }) => (
            <MaterialIcons
              name="arrow-back"
              size={24}
              color={tintColor}
              onPress={() => router.back()}
              style={{ marginRight: 16 }}
            />
          ),
        }}
      />
      <View style={{ flex: 1, backgroundColor: "#fff" }}>
        {loading ? (
          <View
            style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
          >
            <ActivityIndicator size="large" color="#6366f1" />
          </View>
        ) : customer ? (
          <CustomerForm
            initialData={customer}
            onSuccess={() => router.back()}
            onCancel={() => router.back()}
          />
        ) : (
          <View
            style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
          >
            <MaterialIcons name="error-outline" size={48} color="#9ca3af" />
          </View>
        )}
      </View>
    </>
  );
};

export default EditCustomer;
