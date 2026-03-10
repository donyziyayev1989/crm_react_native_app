import { Stack } from 'expo-router';
import React from 'react';

const Layout = () => {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="index" options={{ title: 'Buyurtmalar' }} />
      <Stack.Screen name="[orderId]" options={{ title: 'Buyurtma tafsiloti' }} />
    </Stack>
  );
};

export default Layout;
