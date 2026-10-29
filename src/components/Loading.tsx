import React from "react";
import { ActivityIndicator, View } from "react-native";

/** Ekran markazidagi spinner. Har ekranda takrorlangan styles.center + ActivityIndicator o'rniga. */
const Loading = ({ color = "#6366f1" }: { color?: string }) => (
  <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
    <ActivityIndicator size="large" color={color} />
  </View>
);

export default Loading;
