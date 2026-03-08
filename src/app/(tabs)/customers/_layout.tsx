import { Stack } from 'expo-router'
import React from 'react'

const CustomerLayout = () => {
  return (
    <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ title: 'Customers', headerShown: true }} />
        <Stack.Screen name="[customerId]" options={{ title: 'Customer Detail', headerShown: true }} />
    </Stack>
  )
}

export default CustomerLayout