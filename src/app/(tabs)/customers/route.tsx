import db from "@/services/database";
import { RouteService } from "@/services/routeService";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Customer } from "@interfaces/index";
import { Stack } from "expo-router";
import React, { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const RoutePlanning = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [optimizedRoute, setOptimizedRoute] = useState<Customer[]>([]);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const data = await db.customers.list();
        // Faqat lokatsiyasi bor mijozlarni ko'rsatamiz
        setCustomers(data.filter((c) => c.location));
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchCustomers();
  }, []);

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const handleCreateRoute = () => {
    const selectedCustomers = customers.filter((c) => selectedIds.has(c.id!));
    if (selectedCustomers.length === 0) {
      Alert.alert("Xato", "Kamida bitta mijozni tanlang");
      return;
    }

    // Taxminiy boshlang'ich nuqta (masalan, Toshkent markazi yoki haydovchining joyi)
    // Real ilovada bu haydovchining joriy GPS koordinatasi bo'lishi kerak
    const startPos = { lat: 41.2995, lng: 69.2401 };

    const optimized = RouteService.optimizeRoute(selectedCustomers, startPos);
    setOptimizedRoute(optimized);
  };

  const openInGoogleMaps = () => {
    const url = RouteService.getGoogleMapsUrl(optimizedRoute);
    if (url) {
      Linking.openURL(url);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: "Yo'nalishni rejalashtirish", headerShown: true }} />

      {optimizedRoute.length === 0 ? (
        <>
          <Text style={styles.title}>Mijozlarni tanlang ({customers.length} tadan {selectedIds.size} tasi tanlandi)</Text>
          <FlatList
            data={customers}
            keyExtractor={(item) => item.id!}
            renderItem={({ item }) => (
              <Pressable
                style={[
                  styles.customerItem,
                  selectedIds.has(item.id!) && styles.customerItemSelected,
                ]}
                onPress={() => toggleSelection(item.id!)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.customerName}>{item.name}</Text>
                  <Text style={styles.customerDetail}>
                    {item.district_name}, {item.region_name}
                  </Text>
                </View>
                {selectedIds.has(item.id!) && (
                  <MaterialIcons name="check-circle" size={24} color="#6366f1" />
                )}
              </Pressable>
            )}
            contentContainerStyle={{ paddingBottom: 80 }}
          />

          <View style={styles.bottomBar}>
            <Pressable
              style={[styles.button, selectedIds.size === 0 && styles.buttonDisabled]}
              onPress={handleCreateRoute}
              disabled={selectedIds.size === 0}
            >
              <Text style={styles.buttonText}>Yo'nalishni hisoblash</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Tavsiya etilgan tartib:</Text>
          <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
            {optimizedRoute.map((item, index) => (
              <View key={item.id} style={styles.routeItem}>
                <View style={styles.routeNumber}>
                  <Text style={styles.routeNumberText}>{index + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.customerName}>{item.name}</Text>
                  <Text style={styles.customerDetail}>
                    {item.district_name}, {item.region_name}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.bottomBar}>
            <Pressable style={[styles.button, { backgroundColor: '#f3f4f6', marginBottom: 8 }]} onPress={() => setOptimizedRoute([])}>
              <Text style={[styles.buttonText, { color: '#374151' }]}>Qayta tanlash</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={openInGoogleMaps}>
              <Text style={styles.buttonText}>Google Maps-da ochish</Text>
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

export default RoutePlanning;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb", padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 16, color: "#111827" },
  customerItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  customerItemSelected: {
    borderColor: "#6366f1",
    backgroundColor: "#f5f3ff",
  },
  customerName: { fontSize: 16, fontWeight: "600", color: "#111827" },
  customerDetail: { fontSize: 14, color: "#6b7280", marginTop: 2 },
  routeItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  routeNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#6366f1",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  routeNumberText: { color: "#fff", fontWeight: "700" },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  button: {
    backgroundColor: "#6366f1",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonDisabled: { backgroundColor: "#9ca3af" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
