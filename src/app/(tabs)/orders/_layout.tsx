import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Link, Stack } from "expo-router";
import React from "react";

const Layout = () => {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen
        name="index"
        options={{
          title: "Buyurtmalar",
          headerRight: () => (
            <Link href="/orders/addOrder" className="text-primary p-2">
              <MaterialIcons name="add" size={24} color="#6366f1" />
            </Link>
          ),
        }}
      />
      <Stack.Screen
        name="[orderId]"
        options={{
          title: "Buyurtma tafsiloti",
          headerRight: () => (
            <Link href="/" className="text-danger p-3">
              <MaterialIcons name="remove-circle-outline" size={24} />
            </Link>
          ),
        }}
      />
      <Stack.Screen name="addOrder" options={{ title: "Yangi buyurtma" }} />
      <Stack.Screen
        name="edit/[orderId]"
        options={{ title: "Buyurtmani tahrirlash" }}
      />
    </Stack>
  );
};

export default Layout;
