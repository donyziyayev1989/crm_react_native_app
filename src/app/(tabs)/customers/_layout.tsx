import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Link, Stack } from "expo-router";
import React from "react";

const CustomerLayout = () => {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="index"
        options={{
          title: "Mijozlar",
          headerShown: true,
          headerRight: () => (
            <Link href="/customers/addCustomer" className="p-3">
              <MaterialIcons name="add-circle" size={28} color="#6366f1" />
            </Link>
          ),
        }}
      />
      <Stack.Screen
        name="[customerId]"
        options={{ title: "Mijoz ma'lumotlari", headerShown: true }}
      />
      <Stack.Screen
        name="edit/[customerId]"
        options={{ title: "Mijozni tahrirlash", headerShown: true }}
      />
      <Stack.Screen
        name="addCustomer"
        options={{
          title: "Mijoz qo'shish",
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
