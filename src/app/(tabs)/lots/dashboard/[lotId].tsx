import Card from "@/components/Card";
import LostProductModal from "@/components/LostProductModal";
import LotExpenseModal from "@/components/LotExpenseModal";
import OrderModal from "@/components/OrderModal";
import { LostProduct, LotExpense, Order, ProductLot } from "@/interfaces";
import db, { orderBy, where } from "@/services/database";
import { formatDate, formatMoney } from "@/utils/format";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

/**
 * OrderDashboard (Partiya Dashbordi)
 * Partiyadagi barcha xaridlar va yo'qotishlar hisoboti
 */
const OrderDashboard = () => {
  const { lotId } = useLocalSearchParams<{ lotId: string }>();
  const [lot, setLot] = useState<(ProductLot & { id: string }) | null>(null);
  const [orders, setOrders] = useState<(Order & { id: string })[]>([]);
  const [lostProducts, setLostProducts] = useState<
    (LostProduct & { id: string })[]
  >([]);
  const [expenses, setExpenses] = useState<(LotExpense & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [addLostModal, setAddLostModal] = useState(false);
  const [addLineModal, setAddLineModal] = useState(false);
  const [editOrder, setEditOrder] = useState<(Order & { id: string }) | null>(
    null,
  );
  const [addExpenseModal, setAddExpenseModal] = useState(false);

  useEffect(() => {
    if (!lotId) return;
    setLoading(true);

    const unsubLot = db.lots.watch(
      (data) => {
        const found = data.find((l) => l.id === lotId);
        if (found) setLot(found as ProductLot & { id: string });
      },
      where("__name__", "==", lotId),
    );

    const unsubOrders = db.orders.watch(
      (data) => {
        setOrders(data as (Order & { id: string })[]);
      },
      where("lotId", "==", lotId),
      orderBy("date", "asc"),
    );

    const unsubLost = db.lost_products.watch(
      (data) => {
        setLostProducts(
          (data as (LostProduct & { id: string })[]).sort(
            (a, b) => a.timestamp - b.timestamp,
          ),
        );
        setLoading(false);
      },
      where("lotId", "==", lotId),
      orderBy("timestamp", "asc"),
    );
    const unsubExpenses = db.lot_expenses.watch(
      (data) => {
        setExpenses(
          (data as (LotExpense & { id: string })[]).sort(
            (a, b) => b.timestamp - a.timestamp,
          ),
        );
      },
      where("lotId", "==", lotId),
    );

    return () => {
      unsubLot();
      unsubOrders();
      unsubLost();
      unsubExpenses();
    };
  }, [lotId]);

  const stats = useMemo(() => {
    let totalCount = 0;
    let totalSum = 0;
    let doneCount = 0;
    let doneSum = 0;
    let cancelCount = 0;
    let cancelSum = 0;

    const parseNum = (val: any) => {
      if (typeof val === "number") return val;
      if (typeof val === "string")
        return parseFloat(val.replace(/\s/g, "")) || 0;
      return 0;
    };

    orders.forEach((order) => {
      const pCount = parseNum(order.product_count);
      const pPrice = parseNum(order.product_price);
      const lineTotal = pCount * pPrice;

      totalCount += pCount;
      totalSum += lineTotal;

      if (order.state === "done") {
        doneCount += pCount;
        doneSum += lineTotal;
      } else if (order.state === "cancel") {
        cancelCount += pCount;
        cancelSum += lineTotal;
      }
    });

    const lostCount = lostProducts.reduce((sum, lp) => sum + lp.count, 0);
    const totalExpenses = expenses.reduce(
      (sum, ex) => sum + (ex.total_price || 0),
      0,
    );
    const netProfit = doneSum - totalExpenses;

    return {
      totalCount,
      totalSum,
      doneCount,
      doneSum,
      cancelCount,
      cancelSum,
      lostCount,
      totalExpenses,
      netProfit,
    };
  }, [orders, lostProducts, expenses]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: lot?.name || "Partiya Dashboard",
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <Card className="mb-4">
          <Text className="text-center text-lg font-bold mb-1 ">
            Tovarlar soni
          </Text>
          <View className="w-full flex-row p-2 justify-between items-center border-b border-slate-300 border-dashed">
            <Text className="font-semibold text-primary">Jami tovarlar:</Text>
            <Text className="font-bold text-md">
              {lot?.product_count}{" "}
              <Text className="font-normal text-xs text-gray-500">dona</Text>
            </Text>
          </View>
          <View className="flex-row p-2 justify-between items-center border-b border-slate-300 border-dashed">
            <Text className="font-semibold text-danger">
              Yo'qotilgan tovarlar
            </Text>
            <Text className="font-bold text-md text-danger">
              {stats.lostCount}{" "}
              <Text className="font-normal text-xs text-gray-500">dona</Text>
            </Text>
          </View>
          <View className="flex-row p-2 justify-between items-center ">
            <Text className="font-semibold">Qolgan tovarlar</Text>
            <Text className="font-bold text-md">
              {lot?.product_count - stats.lostCount}{" "}
              <Text className="font-normal text-xs text-gray-500">dona</Text>
            </Text>
          </View>
        </Card>
        <Card className="mb-4">
          <Text className="text-center text-lg font-bold mb-1 ">
            Buyurtmalar
          </Text>
          <View className="w-full flex-row p-2 justify-between items-center border-b border-slate-300 border-dashed">
            <Text className="font-semibold text-primary">
              Jami buyurtmalar:
            </Text>
            <Text className="font-bold text-md">
              {stats.totalCount}{" "}
              <Text className="font-normal text-xs text-gray-500">dona</Text>
            </Text>
          </View>

          <View className="flex-row p-2 justify-between items-center">
            <Text className="font-semibold ">Buyurtma olish uchun miqdor:</Text>
            <Text
              className={`font-bold text-md ${
                lot?.product_count - stats.lostCount - stats.totalCount === 0
                  ? "text-slate-600"
                  : lot?.product_count - stats.lostCount - stats.totalCount > 0
                    ? "text-green-600"
                    : "text-red-600"
              }`}
            >
              {lot?.product_count - stats.lostCount - stats.totalCount}{" "}
              <Text className="font-normal text-xs text-gray-500">dona</Text>
            </Text>
          </View>
        </Card>
        <Card className="mb-4">
          <Text className="text-center text-lg font-bold mb-1 ">Moliya</Text>
          <View className="flex-row p-2 justify-between items-center border-b border-slate-300 border-dashed">
            <Text className="font-semibold text-indigo-600 mb-1">
              Sotilgan:
            </Text>
            <Text className="font-bold text-md">
              {formatMoney(stats.doneSum)}{" "}
              <Text className="font-normal text-xs text-gray-500">so'm</Text>
            </Text>
            <Text className="text-xs text-gray-500">
              {stats.doneCount} dona
            </Text>
          </View>
          <View className="flex-row p-2 justify-between items-center border-b border-slate-300 border-dashed">
            <Text className="font-semibold text-red-600 mb-1">
              Jami xarajat:
            </Text>
            <Text className="font-bold text-md">
              {formatMoney(stats.totalExpenses)}{" "}
              <Text className="font-normal text-xs text-gray-500">so'm</Text>
            </Text>
          </View>
          <View className="flex-row p-2 justify-between items-center">
            <Text className="font-semibold text-green-600 mb-1">
              Sof foyda:
            </Text>
            <Text className="font-bold text-md">
              {formatMoney(stats.netProfit)}{" "}
              <Text className="font-normal text-xs text-gray-500">so'm</Text>
            </Text>
          </View>
        </Card>

        {/* ── Yo'qotilgan tovarlar jadvali ── */}
        <Card className="mb-4">
          <View className="flex-row justify-between items-center mb-3">
            <Text style={[styles.cardTitle, { marginBottom: 0 }]}>
              Yo'qotilgan tovarlar
            </Text>
            <Pressable
              onPress={() => setAddLostModal(true)}
              className="bg-indigo-50 p-2 rounded-full"
            >
              <MaterialIcons name="add" size={20} color="#6366f1" />
            </Pressable>
          </View>
          {lostProducts.length === 0 ? (
            <Text style={styles.emptyText}>
              Yo'qotilgan tovarlar mavjud emas.
            </Text>
          ) : (
            <View style={styles.table}>
              <View style={styles.tableHead}>
                <Text style={[styles.headCell, { flex: 2 }]}>Sana</Text>
                <Text
                  style={[styles.headCell, { flex: 1, textAlign: "right" }]}
                >
                  Miqdor
                </Text>
              </View>
              {lostProducts.map((lp, index) => (
                <View
                  key={lp.id}
                  style={[
                    styles.tableRow,
                    index === lostProducts.length - 1 && {
                      borderBottomWidth: 0,
                    },
                  ]}
                >
                  <Text style={[styles.cell, { flex: 2 }]}>
                    {formatDate(lp.date)}
                  </Text>
                  <Text
                    style={[
                      styles.cell,
                      {
                        flex: 1,
                        textAlign: "right",
                        fontWeight: "600",
                        color: "#ef4444",
                      },
                    ]}
                  >
                    {lp.count} dona
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* ── Xarajatlar jadvali ── */}
        <Card className="mb-4">
          <View className="flex-row justify-between items-center mb-3">
            <Text style={[styles.cardTitle, { marginBottom: 0 }]}>
              Partiya xarajatlari
            </Text>
            <Pressable
              onPress={() => setAddExpenseModal(true)}
              className="bg-green-50 p-2 rounded-full"
            >
              <MaterialIcons name="add" size={20} color="#10b981" />
            </Pressable>
          </View>
          {expenses.length === 0 ? (
            <Text style={styles.emptyText}>Xarajatlar mavjud emas.</Text>
          ) : (
            <View style={styles.table}>
              <View style={styles.tableHead}>
                <Text style={[styles.headCell, { flex: 2 }]}>Nomi</Text>
                <Text
                  style={[styles.headCell, { flex: 1.5, textAlign: "right" }]}
                >
                  Summa
                </Text>
              </View>
              {expenses.map((ex, index) => (
                <View
                  key={ex.id}
                  style={[
                    styles.tableRow,
                    index === expenses.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <View style={{ flex: 2 }}>
                    <Text style={styles.cell} numberOfLines={1}>
                      {ex.name}
                    </Text>
                    <Text style={{ fontSize: 11, color: "#6b7280" }}>
                      {ex.count} x {formatMoney(ex.price_per_unit)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.cell,
                      {
                        flex: 1.5,
                        textAlign: "right",
                        fontWeight: "600",
                        color: "#ef4444",
                      },
                    ]}
                  >
                    {formatMoney(ex.total_price)} so'm
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* ── Buyurtmalar jadvali ── */}
        <Card className="overflow-x-auto min-w-[360px]">
          <View className="flex-row justify-between items-center mb-3">
            <Text style={[styles.cardTitle, { marginBottom: 0 }]}>
              Tovarlar taqsimoti
            </Text>
            <Pressable
              onPress={() => setAddLineModal(true)}
              className="bg-indigo-50 p-2 rounded-full"
            >
              <MaterialIcons name="add" size={20} color="#6366f1" />
            </Pressable>
          </View>
          {orders.length === 0 ? (
            <Text style={styles.emptyText}>
              Partiyaga tegishli buyurtmalar mavjud emas.
            </Text>
          ) : (
            <View style={styles.table}>
              <View style={styles.tableHead}>
                <Text style={{ width: 24 }}>№</Text>
                <Text style={[styles.headCell, { flex: 1.5 }]}>Viloyat</Text>
                <Text
                  style={[styles.headCell, { flex: 1, textAlign: "center" }]}
                >
                  Miqdor
                </Text>
                <Text
                  style={[styles.headCell, { flex: 1.5, textAlign: "center" }]}
                >
                  Narx
                </Text>
                <Text
                  style={[styles.headCell, { flex: 1.5, textAlign: "right" }]}
                >
                  Yetkazish
                </Text>
                <Text
                  style={[styles.headCell, { flex: 1.5, textAlign: "right" }]}
                >
                  Status
                </Text>
              </View>
              {orders.map((order, index) => (
                <Pressable
                  key={order.id}
                  onPress={() => {
                    setEditOrder(order);
                    setAddLineModal(true);
                  }}
                  style={[
                    styles.tableRow,
                    index === orders.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <Text style={{ width: 24 }} numberOfLines={2}>
                    {index + 1}
                  </Text>
                  <Text
                    style={[
                      styles.cell,
                      { flex: 1.5, textTransform: "capitalize" },
                    ]}
                    numberOfLines={1}
                  >
                    {order.region_name}
                  </Text>
                  <Text
                    style={[
                      styles.cell,
                      { flex: 1, textAlign: "center", fontWeight: "600" },
                    ]}
                  >
                    {order.product_count}
                  </Text>
                  <Text
                    style={[styles.cell, { flex: 1.5, textAlign: "right" }]}
                  >
                    {formatMoney(order.product_price)}
                  </Text>
                  <Text
                    style={[
                      styles.cell,
                      { flex: 1.5, textAlign: "right", color: "#6b7280" },
                    ]}
                  >
                    {formatMoney(order.delivery_price)}
                  </Text>
                  <Text
                    style={[
                      styles.cell,
                      { flex: 1.5, textAlign: "right", color: "#6b7280" },
                    ]}
                  >
                    {order.state === "new" ? (
                      <MaterialIcons
                        name="add-circle"
                        size={20}
                        color="#6366f1"
                      />
                    ) : order.state === "done" ? (
                      <MaterialIcons
                        name="check-circle"
                        size={20}
                        color="#28a745"
                      />
                    ) : order.state === "cancel" ? (
                      <MaterialIcons name="cancel" size={20} color="#ef4444" />
                    ) : order.state === "reschedule" ? (
                      <MaterialIcons name="update" size={20} color="#ffc107" />
                    ) : null}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </Card>

        <View style={{ height: 40 }} />

        <LostProductModal
          visible={addLostModal}
          onClose={() => setAddLostModal(false)}
          lotId={lotId as string}
          lot={lot}
        />

        <OrderModal
          visible={addLineModal}
          onClose={() => {
            setAddLineModal(false);
            setEditOrder(null);
          }}
          lotId={lotId as string}
          editLine={editOrder}
        />

        <LotExpenseModal
          visible={addExpenseModal}
          onClose={() => setAddExpenseModal(false)}
          lotId={lotId as string}
          lot={lot}
        />
      </ScrollView>
    </>
  );
};

export default OrderDashboard;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { padding: 16 },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 12,
  },
  emptyText: {
    color: "#6b7280",
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 12,
  },
  table: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
    marginLeft: -16,
    marginRight: -16,
  },
  tableHead: {
    flexDirection: "row",
    backgroundColor: "#f9fafb",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  headCell: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4b5563",
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  cell: { fontSize: 13, color: "#111827" },
});
