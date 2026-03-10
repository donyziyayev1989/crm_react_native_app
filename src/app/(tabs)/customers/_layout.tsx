import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Link, Stack } from "expo-router";
import React from "react";

const CustomerLayout = () => {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="index"
        options={{
          title: "Customers",
          headerShown: true,
          headerRight: () => (
            <Link href="/customers/addCustomer" className="text-primary p-2">
              <MaterialIcons name="add" size={24} />
            </Link>
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
