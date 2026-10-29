import GlobalChat from "@/components/GlobalChat";
import { ReferenceDataProvider } from "@/providers/ReferenceData";
import { Stack } from "expo-router";
import "./globals.css";

export default function RootLayout() {
  return (
    <ReferenceDataProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <GlobalChat />
    </ReferenceDataProvider>
  );
}
