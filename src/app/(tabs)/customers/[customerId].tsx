import Card from "@/components/Card";
import OrderLineCard from "@/components/OrderLineCard";
import OrderLineModal from "@/components/OrderLineModal";
import db, { database } from "@/services/database";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Customer, OrderLine } from "@interfaces/index";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { collectionGroup, getDocs, query, where } from "firebase/firestore";
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
  const [orderLines, setOrderLines] = useState<
    (OrderLine & { id: string; orderId: string })[]
  >([]);
  const [productsMap, setProductsMap] = useState<
    Record<string, { name: string; price: number }>
  >({});
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
  const [ordersMap, setOrdersMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [addLineModal, setAddLineModal] = useState(false);

  useEffect(() => {
    if (!customerId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. collectionGroup query — barcha orders/*/order_lines ichidan
        //    customer_id bo'yicha bitta so'rovda topadi
        const q = query(
          collectionGroup(database, "order_lines"),
          where("customer_id", "==", customerId),
        );

        const [customerData, productsData, usersData, linesSnapshot] =
          await Promise.all([
            db.customers.get(customerId),
            db.products.list(),
            db.users.list(),
            getDocs(q),
          ]);

        if (!customerData) {
          setCustomer(null);
          return;
        }
        setCustomer(customerData);
        // 2. Order line larni map qilamiz (orderId ni parent path dan olamiz)
        const customerLines = linesSnapshot.docs.map((d) => {
          const orderId = d.ref.parent.parent?.id ?? "";
          return { id: d.id, orderId, ...d.data() } as OrderLine & {
            id: string;
            orderId: string;
          };
        });
        // Sanasi bo'yicha kamayish tartibida saralash
        customerLines.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        );
        setOrderLines(customerLines);
        // 3. Mahsulotlar map
        const pMap: Record<string, { name: string; price: number }> = {};
        productsData.forEach((p) => {
          if (p.id) {
            pMap[p.id] = { name: p.name, price: p.price };
          }
        });
        setProductsMap(pMap);

        // 3.1 Users map
        const uMap: Record<string, string> = {};
        usersData.forEach((u) => {
          if (u.id) uMap[u.id] = u.name;
        });
        setUsersMap(uMap);

        // 4. Faqat kerakli orderlar nomlarini olamiz
        const uniqueOrderIds = [
          ...new Set(customerLines.map((l) => l.orderId)),
        ];
        const orders = await Promise.all(
          uniqueOrderIds.map((id) => db.orders.get(id)),
        );
        const oMap: Record<string, string> = {};
        orders.forEach((o) => {
          if (o?.id) oMap[o.id] = o.name;
        });
        setOrdersMap(oMap);
      } catch (error) {
        console.error("Error fetching customer detail data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
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
          {customer.note ? (
            <View style={styles.row}>
              <Text style={styles.label}>Izoh:</Text>
              <Text style={styles.value}>{customer.note}</Text>
            </View>
          ) : null}
        </Card>

        {/* Order lines */}
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
          {orderLines.length === 0 ? (
            <Text style={styles.emptyText}>Xaridlar mavjud emas</Text>
          ) : (
            orderLines.map((line) => (
              <View key={line.id} style={styles.lineCard}>
                <OrderLineCard
                  item={line}
                  title={ordersMap[line.orderId] || "Noma'lum buyurtma"}
                  topIconName="assignment"
                  productName={
                    productsMap[line.product_id]?.name || "Noma'lum mahsulot"
                  }
                  userName={usersMap[line.user_id]}
                />
              </View>
            ))
          )}
        </View>

        <OrderLineModal
          visible={addLineModal}
          onClose={() => setAddLineModal(false)}
          onSuccess={async (line: any, isEdit: boolean) => {
            const extendedLine = {
              ...line,
              orderId: line.orderId || "",
            };

            if (extendedLine.orderId && !ordersMap[extendedLine.orderId]) {
              try {
                const orderData = await db.orders.get(extendedLine.orderId);
                if (orderData?.name) {
                  setOrdersMap((prev) => ({
                    ...prev,
                    [extendedLine.orderId]: orderData.name,
                  }));
                }
              } catch (err) {
                console.error("Failed to fetch order info", err);
              }
            }

            if (isEdit) {
              setOrderLines((prev) =>
                prev.map((l) => (l.id === line.id ? extendedLine : l)),
              );
            } else {
              setOrderLines((prev) => [extendedLine, ...prev]);
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
  lineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  orderName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  lineInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: "#4b5563",
  },
  lineFooter: {
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    paddingTop: 8,
    marginTop: 4,
  },
  priceInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6366f1",
  },
  dateText: {
    fontSize: 12,
    color: "#9ca3af",
  },
  stateBadge: {
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    overflow: "hidden",
  },
  stateNew: { backgroundColor: "#dbeafe", color: "#1d4ed8" },
  stateDone: { backgroundColor: "#dcfce7", color: "#15803d" },
  stateCancel: { backgroundColor: "#fee2e2", color: "#b91c1c" },
  stateReschedule: { backgroundColor: "#ffedd5", color: "#ea580c" },
});
