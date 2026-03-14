import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Link } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
export default function Index() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.grid}>
        <Link href="/leads" asChild>
          <Pressable style={styles.card}>
            <MaterialIcons name="bolt" size={32} color="#f59e0b" />
            <Text style={styles.cardText}>Yangi Leadlar</Text>
          </Pressable>
        </Link>
        <Link href="/profile" asChild>
          <Pressable style={styles.card}>
            <MaterialIcons name="account-circle" size={32} color="#6b7280" />
            <Text style={styles.cardText}>Profil</Text>
          </Pressable>
        </Link>
        <Link href="/products" asChild>
          <Pressable style={styles.card}>
            <MaterialIcons name="inventory" size={32} color="#3b82f6" />
            <Text style={styles.cardText}>Mahsulotlar</Text>
          </Pressable>
        </Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  header: {
    padding: 24,
    paddingTop: 60,
    backgroundColor: "#fff",
  },
  welcome: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
    marginTop: 4,
  },
  grid: {
    padding: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  card: {
    width: "47%",
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
});
