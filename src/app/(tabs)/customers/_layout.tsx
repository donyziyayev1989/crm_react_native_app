import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Link, Stack } from "expo-router";
import React from "react";
import { View } from "react-native";

const CustomerLayout = () => {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="index"
        options={{
          title: "Customers",
          headerShown: true,
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Link href="/customers/route" style={{ padding: 8 }}>
                <MaterialIcons name="directions" size={24} color="#6366f1" />
              </Link>
              <Link href="/customers/addCustomer" style={{ padding: 8 }}>
                <MaterialIcons name="add" size={24} color="#6366f1" />
              </Link>
            </View>
          ),
        }}
      />
      <Stack.Screen
        name="[customerId]"
        options={{ title: "Customer Detail", headerShown: true }}
      />
      <Stack.Screen
        name="edit/[customerId]"
        options={{ title: "Mijozni tahrirlash", headerShown: true }}
      />
      <Stack.Screen
        name="addCustomer"
        options={{
          title: "Add Customer",
          headerShown: true,
          headerLeft: () => (
            <Link href="/customers/" className="text-primary p-2">
              <MaterialIcons name="arrow-back" size={24} />
            </Link>
          ),
        }}
      />
      <Stack.Screen
        name="search_results"
        options={{ title: "Qidiruv natijalari", headerShown: true }}
      />
    </Stack>
  );
};

export default CustomerLayout;
