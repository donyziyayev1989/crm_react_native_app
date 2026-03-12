import { Stack } from "expo-router";
import React from "react";

const Layout = () => {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen
        name="index"
        options={{
          title: "Yangi murojaatlar",
        }}
      />
    </Stack>
  );
};

export default Layout;
