import Card from "@/components/Card";
import Loading from "@/components/Loading";
import OrderCard from "@/components/OrderCard";
import OrderModal from "@/components/OrderModal";
import { useRefData } from "@/providers/ReferenceData";
import db, { where } from "@/services/database";
import { formatPhone } from "@/utils/format";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Customer, Order, WithId } from "@interfaces/index";
import { openTelegram } from "@utils/actions";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const CustomerDetail = () => {
  const { customerId } = useLocalSearchParams<{ customerId: string }>();
  const { productsById, usersById, lotsById } = useRefData();
  const [customer, setCustomer] = useState<WithId<Customer> | null>(null);
  const [customerLoaded, setCustomerLoaded] = useState(false);
  const [orders, setOrders] = useState<WithId<Order>[]>([]);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [addLineModal, setAddLineModal] = useState(false);

  useEffect(() => {
    if (!customerId) return;

    const unsubCustomer = db.customers.watchDoc(customerId, (doc) => {
      setCustomer(doc);
      setCustomerLoaded(true);
    });

    // where + orderBy turli maydonlarda composite index talab qiladi — JS da saralaymiz
    const unsubOrders = db.orders.watch(
      (data) => {
        const sorted = [...(data as WithId<Order>[])].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        );
        setOrders(sorted);
        setOrdersLoaded(true);
      },
      where("customer_id", "==", customerId),
    );

    return () => {
      unsubCustomer();
      unsubOrders();
    };
  }, [customerId]);

  if (!customerLoaded || !ordersLoaded) return <Loading />;

  if (!customer) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>Mijoz topilmadi</Text>
      </View>
    );
  }

  const renderHeader = () => (
    <>
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
              <Pressable
                onPress={() =>
                  openTelegram(customer.telegram_id, undefined, {
                    chatId: customerId!,
                    title: customer.name,
                  })
                }
                className="rounded-full"
              >
                <MaterialIcons name="telegram" size={20} color="#0088cc" />
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
                style={[styles.value, { color: "#6366f1", fontWeight: "700" }]}
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

      {/* Orders Section Header */}
      <View style={[styles.section, { marginBottom: 8 }]}>
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
      </View>
    </>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: formatPhone(customer.phone),
          headerTitleAlign: "center",
          headerLeft: ({ tintColor }) => (
            <Pressable onPress={() => router.back()} className="p-2">
              <MaterialIcons name="arrow-back" size={24} color={tintColor} />
            </Pressable>
          ),
        }}
      />

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.container}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Xaridlar mavjud emas</Text>
        }
        renderItem={({ item: line }) => (
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/orders/[orderId]",
                params: {
                  orderId: line.id,
                  referral: "customer",
                  customerId: customerId,
                },
              })
            }
            style={styles.lineCard}
          >
            <OrderCard
              item={line}
              title={lotsById[line.lotId || ""]?.name || "Partiya aniqlanmadi"}
              productName={
                productsById[line.product_id]?.name || "Noma'lum mahsulot"
              }
              userName={usersById[line.user_id]?.name}
            />
          </Pressable>
        )}
        ListFooterComponent={
          <OrderModal
            visible={addLineModal}
            onClose={() => setAddLineModal(false)}
            initialCustomer={customer}
          />
        }
      />
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
