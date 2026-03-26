import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Link, Stack } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export default function Index() {
  return (
    <ScrollView style={styles.container}>
      <Stack.Screen
        options={{
          title: "Bosh sahifa",
          headerTitleAlign: "center",
          headerRight: () => (
            <Link href="/profile" asChild>
              <Pressable className="p-3">
                <MaterialIcons
                  name="account-circle"
                  size={24}
                  color="#6b7280"
                />
              </Pressable>
            </Link>
          ),
        }}
      />
      <View style={styles.grid}>
        <Link href="/leads" asChild>
          <Pressable style={styles.card}>
            <MaterialIcons name="bolt" size={32} color="#f59e0b" />
            <Text style={styles.cardText}>Yangi Leadlar</Text>
          </Pressable>
        </Link>
        <Link href="/products" asChild>
          <Pressable style={styles.card}>
            <MaterialIcons name="shopping-bag" size={32} color="#6366f1" />
            <Text style={styles.cardText}>Mahsulotlar</Text>
          </Pressable>
        </Link>
        <Link href="/customers" asChild>
          <Pressable style={styles.card}>
            <MaterialIcons name="people" size={32} color="#10b981" />
            <Text style={styles.cardText}>Mijozlar</Text>
          </Pressable>
        </Link>
        <Link href="/faqt" asChild>
          <Pressable style={styles.card}>
            <MaterialIcons name="help-outline" size={32} color="#6b7280" />
            <Text style={styles.cardText}>FAQ</Text>
          </Pressable>
        </Link>
        <Link href="/about-us" asChild>
          <Pressable style={styles.card}>
            <MaterialIcons name="info-outline" size={32} color="#6b7280" />
            <Text style={styles.cardText}>Biz haqimizda</Text>
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
  statsContainer: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  statLabel: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
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
