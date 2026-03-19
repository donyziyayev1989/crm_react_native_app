import Card from "@/components/Card";
import OrderCard from "@/components/OrderCard";
import OrderModal from "@/components/OrderModal";
import db, { where } from "@/services/database";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Customer, Order } from "@interfaces/index";
import { openTelegram } from "@utils/actions";
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
  const [orders, setOrders] = useState<(Order & { id: string })[]>([]);
  const [productsMap, setProductsMap] = useState<
    Record<string, { name: string; price: number }>
  >({});
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
  const [lotsMap, setLotsMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [addLineModal, setAddLineModal] = useState(false);

  useEffect(() => {
    if (!customerId) return;

    setLoading(true);

    const unsubCustomer = db.customers.watch((data) => {
      const found = data.find((c) => c.id === customerId);
      if (found) {
        setCustomer(found);
      } else {
        setCustomer(null);
      }
    }, where("__name__", "==", customerId));

    const unsubProducts = db.products.watch((data) => {
      const pMap: Record<string, { name: string; price: number }> = {};
      data.forEach((p) => {
        if (p.id) pMap[p.id] = { name: p.name, price: p.price };
      });
      setProductsMap(pMap);
    });

    const unsubUsers = db.users.watch((data) => {
      const uMap: Record<string, string> = {};
      data.forEach((u) => {
        if (u.id) uMap[u.id] = u.name;
      });
      setUsersMap(uMap);
    });

    const unsubOrders = db.orders.watch(
      async (data) => {
        const sortedOrders = data as (Order & { id: string })[];
        sortedOrders.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        );
        setOrders(sortedOrders);

        // Partiyalarni (Lots) nomlarini olamiz
        const uniqueLotIds = [
          ...new Set(sortedOrders.map((o) => o.lotId).filter(Boolean)),
        ] as string[];
        const lots = await Promise.all(
          uniqueLotIds.map((id) => db.lots.get(id)),
        );
        const lMap: Record<string, string> = {};
        lots.forEach((l) => {
          if (l?.id) lMap[l.id] = l.name;
        });
        setLotsMap(lMap);
        setLoading(false);
      },
      where("customer_id", "==", customerId),
    );

    return () => {
      unsubCustomer();
      unsubProducts();
      unsubUsers();
      unsubOrders();
    };
  }, [customerId]);

  console.log(customer);
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
            <Pressable onPress={() => router.back()} className="p-2">
              <MaterialIcons name="arrow-back" size={24} color={tintColor} />
            </Pressable>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.container}>
        <Card>
          <View style={styles.row}>
            <Text style={styles.label}>Ism:</Text>
            <Text style={styles.value}>{customer.name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Telefon:</Text>
            <Text style={styles.value}>{customer.phone}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Viloyat:</Text>
            <Text style={styles.value}>{customer.region_name}</Text>
          </View>
          {customer.district_name ? (
            <View style={styles.row}>
              <Text style={styles.label}>Tuman:</Text>
              <Text style={styles.value}>{customer.district_name}</Text>
            </View>
          ) : null}
          <View style={styles.row}>
            <Text style={styles.label}>Reyting:</Text>
            <Text style={styles.value}>{customer.rates ?? "—"}</Text>
          </View>
          {customer.telegram_id ? (
            <View style={styles.row}>
              <Text style={styles.label}>Telegram:</Text>
              <View className="flex-1 flex-row items-center justify-between">
                <Text style={styles.value}>{customer.telegram_id}</Text>
                <Pressable
                  onPress={() =>
                    openTelegram(customer.telegram_id, undefined, {
                      chatId: customerId!,
                      title: customer.name,
                    })
                  }
                  className="bg-blue-500 p-1.5 rounded-full"
                >
                  <MaterialIcons name="telegram" size={20} color="white" />
                </Pressable>
              </View>
            </View>
          ) : null}
          {customer.location && (
            <View style={styles.row}>
              <Text style={styles.label}>Lokatsiya:</Text>
              <Pressable
                onPress={() => {
                  const url = `https://www.google.com/maps/search/?api=1&query=${customer.location?.lat},${customer.location?.lng}`;
                  require("react-native").Linking.openURL(url);
                }}
              >
                <Text
                  style={[
                    styles.value,
                    { color: "#6366f1", fontWeight: "700" },
                  ]}
                >
                  Xaritada ko'rish
                </Text>
              </Pressable>
            </View>
          )}
          {customer.note ? (
            <View style={styles.row}>
              <Text style={styles.label}>Izoh:</Text>
              <Text style={styles.value}>{customer.note}</Text>
            </View>
          ) : null}
        </Card>

        {/* Orders List */}
        <View style={styles.section}>
          <View className="flex-row items-center justify-between mb-2 px-1">
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
              Xaridlar tarixi
            </Text>
            <Pressable
              onPress={() => setAddLineModal(true)}
              className="bg-indigo-50 p-2 rounded-full"
            >
              <MaterialIcons name="add" size={20} color="#6366f1" />
            </Pressable>
          </View>
          {orders.length === 0 ? (
            <Text style={styles.emptyText}>Xaridlar mavjud emas</Text>
          ) : (
            orders.map((line) => (
              <View key={line.id} style={styles.lineCard}>
                <OrderCard
                  item={line}
                  title={lotsMap[line.lotId || ""] || "Partiya aniqlanmadi"}
                  productName={
                    productsMap[line.product_id]?.name || "Noma'lum mahsulot"
                  }
                  userName={usersMap[line.user_id]}
                />
              </View>
            ))
          )}
        </View>

        <OrderModal
          visible={addLineModal}
          onClose={() => setAddLineModal(false)}
          onSuccess={async (order: any, isEdit: boolean) => {
            if (order.lotId && !lotsMap[order.lotId]) {
              try {
                const lotData = await db.lots.get(order.lotId);
                if (lotData?.name) {
                  setLotsMap((prev) => ({
                    ...prev,
                    [order.lotId]: lotData.name,
                  }));
                }
              } catch (err) {
                console.error("Failed to fetch lot info", err);
              }
            }

            if (isEdit) {
              setOrders((prev) =>
                prev.map((l) => (l.id === order.id ? order : l)),
              );
            } else {
              setOrders((prev) => [order, ...prev]);
            }
          }}
          initialCustomer={customer ? { ...customer, id: customerId } : null}
        />
      </ScrollView>
    </>
  );
};

export default CustomerDetail;

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  notFound: { color: "#9ca3af", fontSize: 16 },
  container: { padding: 8, gap: 4 },
  row: {
    flexDirection: "row",
    paddingVertical: 4,
    gap: 10,
    borderBottomColor: "#f3f4f6",
  },
  label: { fontSize: 14, color: "#6b7280", fontWeight: "600", width: "25%" },
  value: { fontSize: 14, color: "#111827", flex: 1 },
  section: { marginTop: 16 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 8,
    marginLeft: 4,
  },
  emptyText: {
    textAlign: "center",
    color: "#9ca3af",
    marginTop: 20,
    fontSize: 14,
  },
  lineCard: {
    marginBottom: 8,
  },
});
