import LostProductModal from "@/components/LostProductModal";
import OrderLineCard from "@/components/OrderLineCard";
import OrderLineModal from "@/components/OrderLineModal";
import {
  Customer,
  Order,
  OrderLine,
  Product,
  Region,
  User,
} from "@/interfaces";
import db, { subOrderLines } from "@/services/database";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { callPhone, openTelegram } from "@utils/actions";
import { formatPhone } from "@utils/format";
import { Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
// ─── Order detail logikasi ─────────────────────────────────────────────────────

const OrderDetail = () => {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  const [order, setOrder] = useState<(Order & { id: string }) | null>(null);
  const [orderLines, setOrderLines] = useState<(OrderLine & { id: string })[]>(
    [],
  );
  const [customers, setCustomers] = useState<(Customer & { id: string })[]>([]);
  const [products, setProducts] = useState<(Product & { id: string })[]>([]);
  const [regions, setRegions] = useState<(Region & { id: string })[]>([]);
  const [users, setUsers] = useState<(User & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  // Order line qo'shish / tahrirlash modal
  const [addLineModal, setAddLineModal] = useState(false);
  const [editLine, setEditLine] = useState<(OrderLine & { id: string }) | null>(
    null,
  );

  // Yo'qotilgan tovarlar modal
  const [addLostModal, setAddLostModal] = useState(false);

  // ─── Fetch order + lines + reference data ────────────────────────────────────
  useEffect(() => {
    if (!orderId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [
          orderData,
          linesData,
          customersData,
          productsData,
          regionsData,
          usersData,
        ] = await Promise.all([
          db.orders.get(orderId),
          subOrderLines.list(orderId),
          db.customers.list(),
          db.products.list(),
          db.regions.list(),
          db.users.list(),
        ]);
        setOrder(orderData as Order & { id: string });
        setOrderLines(linesData as (OrderLine & { id: string })[]);
        setCustomers(customersData as (Customer & { id: string })[]);
        setProducts(productsData as (Product & { id: string })[]);
        setRegions(regionsData as (Region & { id: string })[]);
        setUsers(usersData as (User & { id: string })[]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [orderId]);

  const handleSuccess = (line: OrderLine & { id: string }, isEdit: boolean) => {
    if (isEdit) {
      setOrderLines((prev) => prev.map((l) => (l.id === line.id ? line : l)));
    } else {
      setOrderLines((prev) => [...prev, line]);
    }
  };

  // ─── Delete order line ───────────────────────────────────────────────────────
  const handleDelete = (line: OrderLine & { id: string }) => {
    Alert.alert(
      "O'chirishni tasdiqlang",
      "Bu buyurtmani o'chirishni xohlaysizmi?",
      [
        { text: "Bekor", style: "cancel" },
        {
          text: "O'chirish",
          style: "destructive",
          onPress: async () => {
            try {
              await subOrderLines.delete(orderId!, line.id);
              setOrderLines((prev) => prev.filter((l) => l.id !== line.id));
            } catch {
              Alert.alert("Xato", "O'chirishda xatolik yuz berdi");
            }
          },
        },
      ],
    );
  };

  // ─── Open edit modal with pre-filled form ────────────────────────────────────
  const openEditModal = (line: OrderLine & { id: string }) => {
    setEditLine(line);
    setAddLineModal(true);
  };

  const handleCustomerAdded = (customer: Customer & { id: string }) => {
    setCustomers((prev) => [...prev, customer]);
  };

  const getCustomerName = (id: string) =>
    customers.find((c) => c.id === id)?.name ?? id;
  const getCustomerPhone = (id: string) =>
    customers.find((c) => c.id === id)?.phone ?? "";
  const getProductName = (id: string) =>
    products.find((p) => p.id === id)?.name ?? id;
  const getRegionName = (id: string) =>
    regions.find((r) => r.id === id)?.name ?? id;

  // ─── Sorted Order Lines for Grouping ─────────────────────────────────────────
  const sortedOrderLines = useMemo(() => {
    return [...orderLines].sort((a, b) => {
      const rA = getRegionName(a.region_name || "");
      const rB = getRegionName(b.region_name || "");
      if (rA < rB) return -1;
      if (rA > rB) return 1;
      return 0;
    });
  }, [orderLines, regions]);

  const usersMap = useMemo(() => {
    const map: Record<string, string> = {};
    users.forEach((u) => {
      map[u.id!] = u.name;
    });
    return map;
  }, [users]);

  // ─── Swipeable row refs (must be before any early return) ────────────────────
  const rowRefs = useRef(new Map<string, any>());
  const prevOpenedRow = useRef<string | null>(null);
  const closeRow = (id: string) => {
    if (prevOpenedRow.current !== null && prevOpenedRow.current !== id) {
      const row = rowRefs.current.get(prevOpenedRow.current);
      if (row) row.close();
    }
    prevOpenedRow.current = id;
  };

  const renderRightPanel = (item: OrderLine & { id: string }) => {
    const phone = getCustomerPhone(item.customer_id);
    return (
      <View className="bg-white  rounded-r-2xl overflow-hidden d-flex items-center">
        <View className="flex-row z-2 h-16 my-auto">
          <Pressable
            onPress={() => openEditModal(item)}
            className="bg-slate-400 w-16 h-full flex items-center justify-center"
          >
            <MaterialIcons name="edit" size={22} color="white" />
          </Pressable>
          <Pressable
            onPress={() => handleDelete(item)}
            className="bg-red-400 w-16 h-full flex items-center justify-center"
          >
            <MaterialIcons name="delete-outline" size={22} color="white" />
          </Pressable>
          <Pressable
            onPress={() => callPhone(phone)}
            className="bg-green-500 w-16 h-full flex items-center justify-center"
          >
            <MaterialIcons name="phone" size={24} color="white" />
          </Pressable>
          <Pressable
            onPress={() => openTelegram(phone)}
            className="bg-blue-400 w-16 h-full flex items-center justify-center"
          >
            <MaterialIcons name="telegram" size={24} color="white" />
          </Pressable>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: order?.name ?? "Buyurtma tafsiloti",
          headerRight: () => (
            <Pressable
              onPress={() => setAddLostModal(true)}
              className="text-danger p-3"
            >
              <MaterialIcons
                name="remove-circle-outline"
                size={24}
                color="#ef4444"
              />
            </Pressable>
          ),
        }}
      />
      <GestureHandlerRootView style={{ flex: 1 }}>
        <FlatList
          data={sortedOrderLines}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={() => (
            <View style={styles.empty}>
              <MaterialIcons name="inbox" size={40} color="#d1d5db" />
              <Text style={styles.emptyText}>Hech qanday buyurtma yo'q</Text>
            </View>
          )}
          renderItem={({ item, index }) => {
            const regionName = getRegionName(item.region_name || "");
            const showHeader =
              index === 0 ||
              getRegionName(sortedOrderLines[index - 1].region_name || "") !==
                regionName;

            return (
              <View>
                {showHeader && (
                  <View className="mt-2 mb-3 flex-row items-center justify-between">
                    <Text className="uppercase font-semibold ">
                      {regionName || "Viloyat aniqlanmagan"}
                    </Text>
                    <Text>
                      {sortedOrderLines
                        .filter(
                          (li) =>
                            getRegionName(li.region_name || "") === regionName,
                        )
                        .reduce(
                          (acc, curr) => acc + curr.product_count,
                          0,
                        )}{" "}
                      <Text className="text-muted text-xs">dona mahsulot</Text>
                    </Text>
                  </View>
                )}
                <View className="mb-2 bg-white rounded-2xl">
                  <ReanimatedSwipeable
                    ref={
                      ((ref: any) => {
                        if (item.id) {
                          if (ref) rowRefs.current.set(item.id, ref);
                          else rowRefs.current.delete(item.id);
                        }
                      }) as any
                    }
                    onSwipeableWillOpen={() => item.id && closeRow(item.id)}
                    renderRightActions={() => renderRightPanel(item)}
                  >
                    <OrderLineCard
                      item={item}
                      title={getCustomerName(item.customer_id)}
                      subtitle={formatPhone(getCustomerPhone(item.customer_id))}
                      productName={getProductName(item.product_id)}
                      userName={usersMap[item.user_id]}
                    />
                  </ReanimatedSwipeable>
                </View>
              </View>
            );
          }}
          ListFooterComponent={() => (
            <Pressable
              style={styles.addBtn}
              onPress={() => {
                setEditLine(null);
                setAddLineModal(true);
              }}
            >
              <MaterialIcons name="add" size={20} color="#fff" />
              <Text style={styles.addBtnText}>Buyurtma qo'shish</Text>
            </Pressable>
          )}
        />
      </GestureHandlerRootView>

      <OrderLineModal
        visible={addLineModal}
        onClose={() => {
          setAddLineModal(false);
          setEditLine(null);
        }}
        orderId={orderId as string}
        editLine={editLine}
        onSuccess={handleSuccess}
        onCustomerAdded={handleCustomerAdded}
      />

      {/* ── Yo'qotilgan tovarlar qo'shish modali ── */}
      <LostProductModal
        visible={addLostModal}
        onClose={() => setAddLostModal(false)}
        orderId={orderId as string}
        order={order}
        onSuccess={(newLost, newTotal) => {
          if (order) {
            setOrder({ ...order, lost_products: newTotal });
          }
        }}
      />
    </View>
  );
};

export default OrderDetail;

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { padding: 12, paddingBottom: 32 },

  orderName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 4 },
  infoItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  infoText: { fontSize: 15, color: "#6b7280" },
  phoneText: { fontSize: 15, color: "#6b7280" },
  bold: { fontWeight: "700", color: "#111827" },

  sectionHeader: { marginBottom: 8 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  lineIndex: { fontSize: 13, fontWeight: "600", color: "#6b7280" },
  stateBadge: {
    fontSize: 11,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
  },
  stateNew: { backgroundColor: "#dbeafe", color: "#1d4ed8" },
  stateDone: { backgroundColor: "#dcfce7", color: "#15803d" },
  stateCancel: { backgroundColor: "#fee2e2", color: "#b91c1c" },
  stateReschedule: { backgroundColor: "#f97316", color: "#fff" },

  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText: { color: "#9ca3af", fontSize: 14 },

  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6366f1",
    borderRadius: 12,
    padding: 14,
    gap: 8,
    marginTop: 8,
  },
  addBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },

  borderTop: {
    borderTopColor: "#999999",
    borderTopWidth: 1,
    borderStyle: "dashed",
  },
  discardBtnText: { color: "#777", fontSize: 16, fontWeight: "700" },
});
