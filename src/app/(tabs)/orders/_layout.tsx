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
            <Link href="/lots/addLot" className="text-link p-3">
              <MaterialIcons name="add" size={24} color="#6366f1" />
            </Link>
          ),
        }}
      />
      <Stack.Screen
        name="[orderId]"
        options={{
          title: "Buyurtma tafsiloti",
        }}
      />
    </Stack>
  );
};

export default Layout;
