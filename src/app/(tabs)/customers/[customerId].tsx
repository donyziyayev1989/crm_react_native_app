import db from "@/services/database";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Customer } from "@interfaces/index";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const CustomerDetail = () => {
  const { customerId } = useLocalSearchParams<{ customerId: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customerId) return;
    db.customers.get(customerId).then((data) => {
      setCustomer(data);
      setLoading(false);
    });
  }, [customerId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!customer) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>Mijoz topilmadi</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: customer.name,
          headerTitleAlign: "center",
          headerLeft: ({ tintColor }) => (
            <Pressable onPress={() => router.back()}>
              <MaterialIcons name="arrow-back" size={24} color={tintColor} />
            </Pressable>
          ),
          headerRight: ({ tintColor }) => (
            <Pressable>
              <MaterialIcons name="edit" size={24} color={tintColor} />
            </Pressable>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.row}>
          <Text style={styles.label}>Ism</Text>
          <Text style={styles.value}>{customer.name}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Telefon</Text>
          <Text style={styles.value}>{customer.phone}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Viloyat</Text>
          <Text style={styles.value}>{customer.region_name}</Text>
        </View>
        {customer.district_name ? (
          <View style={styles.row}>
            <Text style={styles.label}>Tuman</Text>
            <Text style={styles.value}>{customer.district_name}</Text>
          </View>
        ) : null}
        <View style={styles.row}>
          <Text style={styles.label}>Reyting</Text>
          <Text style={styles.value}>{customer.rates ?? "—"}</Text>
        </View>
        {customer.note ? (
          <View style={styles.row}>
            <Text style={styles.label}>Izoh</Text>
            <Text style={styles.value}>{customer.note}</Text>
          </View>
        ) : null}
      </ScrollView>
    </>
  );
};

export default CustomerDetail;

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  notFound: { color: "#9ca3af", fontSize: 16 },
  container: { padding: 20, gap: 4 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  label: { fontSize: 14, color: "#6b7280", fontWeight: "600" },
  value: { fontSize: 14, color: "#111827", flex: 1, textAlign: "right" },
});
