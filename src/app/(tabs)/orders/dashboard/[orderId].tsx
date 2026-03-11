import Card from "@/components/Card";
import LostProductModal from "@/components/LostProductModal";
import OrderLineModal from "@/components/OrderLineModal";
import { LostProduct, Order, OrderLine } from "@/interfaces";
import db, {
  orderBy,
  subLostProducts,
  subOrderLines,
} from "@/services/database";
import { formatDate, formatMoney } from "@/utils/format";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const OrderDashboard = () => {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const [order, setOrder] = useState<(Order & { id: string }) | null>(null);
  const [orderLines, setOrderLines] = useState<(OrderLine & { id: string })[]>(
    [],
  );
  const [lostProducts, setLostProducts] = useState<
    (LostProduct & { id: string })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [addLostModal, setAddLostModal] = useState(false);
  const [addLineModal, setAddLineModal] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [orderData, linesData, lostData, productsData] =
          await Promise.all([
            db.orders.get(orderId),
            subOrderLines.list(orderId),
            subLostProducts.list(orderId, orderBy("timestamp", "asc")),
            db.products.list(),
          ]);
        setOrder(orderData as Order & { id: string });
        setOrderLines(linesData as (OrderLine & { id: string })[]);
        setLostProducts(lostData as (LostProduct & { id: string })[]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [orderId]);

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

    orderLines.forEach((line) => {
      const pCount = parseNum(line.product_count);
      const pPrice = parseNum(line.product_price);
      const lineTotal = pCount * pPrice;

      totalCount += pCount;
      totalSum += lineTotal;

      if (line.state === "done") {
        doneCount += pCount;
        doneSum += lineTotal;
      } else if (line.state === "cancel") {
        cancelCount += pCount;
        cancelSum += lineTotal;
      }
    });

    const lostCount = lostProducts.reduce((sum, lp) => sum + lp.count, 0);

    return {
      totalCount,
      totalSum,
      doneCount,
      doneSum,
      cancelCount,
      cancelSum,
      lostCount,
    };
  }, [orderLines, lostProducts]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  const handleLineSuccess = (
    line: OrderLine & { id: string },
    isEdit: boolean,
  ) => {
    if (isEdit) {
      setOrderLines((prev) => prev.map((l) => (l.id === line.id ? line : l)));
    } else {
      setOrderLines((prev) => [...prev, line]);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View className="flex-row flex-wrap">
        <View className="w-1/2 flex-row mb-3 px-1">
          <Card className="w-full">
            <Text className="font-semibold text-primary mb-1">Jami:</Text>
            <Text className="font-bold text-md">
              {formatMoney(stats.totalSum)}{" "}
              <Text className="font-normal text-xs text-gray-500">so'm</Text>
            </Text>
            <Text className="text-xs text-gray-500 mb-1">
              {stats.totalCount} dona
            </Text>
          </Card>
        </View>
        <View className="w-1/2 flex-row mb-3 px-1">
          <Card className="w-full">
            <Text className="font-semibold text-danger mb-1">Yo'qotilgan:</Text>
            <Text className="font-bold text-md">
              {stats.lostCount}{" "}
              <Text className="font-normal text-xs text-gray-500">dona</Text>
            </Text>
          </Card>
        </View>
        <View className="w-1/2 flex-row mb-3 px-1">
          <Card className="w-full">
            <Text className="font-semibold text-success mb-1">
              Yetkazilgan:
            </Text>
            <Text className="font-bold text-md">
              {formatMoney(stats.doneSum)}{" "}
              <Text className="font-normal text-xs text-gray-500">so'm</Text>
            </Text>
            <Text className="text-xs text-gray-500">
              {stats.doneCount} dona
            </Text>
          </Card>
        </View>
        <View className="w-1/2 flex-row mb-3 px-1">
          <Card className="w-full">
            <Text className="font-semibold text-warning">Bekor qilingan:</Text>
            <Text className="text-xs text-gray-500">
              {stats.cancelCount} dona
            </Text>
          </Card>
        </View>
      </View>
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
              <Text style={[styles.headCell, { flex: 1, textAlign: "right" }]}>
                Miqdor
              </Text>
            </View>
            {lostProducts.map((lp, index) => (
              <View
                key={lp.id}
                style={[
                  styles.tableRow,
                  index === lostProducts.length - 1 && { borderBottomWidth: 0 },
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

      {/* ── Buyurtmalar (OrderLines) jadvali ── */}
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
        {orderLines.length === 0 ? (
          <Text style={styles.emptyText}>
            Buyurtmaga tegishli tovarlar mavjud emas.
          </Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHead}>
              <Text style={{ width: 24 }}>№</Text>
              <Text style={[styles.headCell, { flex: 1.5 }]}>Viloyat</Text>
              <Text style={[styles.headCell, { flex: 1, textAlign: "center" }]}>
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
            {orderLines.map((line, index) => (
              <View
                key={line.id}
                style={[
                  styles.tableRow,
                  index === orderLines.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <Text style={{ width: 24 }} numberOfLines={2}>
                  {index + 1}
                  {/* {getProductName(line.product_id)} */}
                </Text>
                <Text
                  style={[
                    styles.cell,
                    { flex: 1.5, textTransform: "capitalize" },
                  ]}
                  numberOfLines={1}
                >
                  {line.region_name}
                </Text>
                <Text
                  style={[
                    styles.cell,
                    { flex: 1, textAlign: "center", fontWeight: "600" },
                  ]}
                >
                  {line.product_count}
                </Text>
                <Text style={[styles.cell, { flex: 1.5, textAlign: "right" }]}>
                  {formatMoney(line.product_price)}
                </Text>
                <Text
                  style={[
                    styles.cell,
                    { flex: 1.5, textAlign: "right", color: "#6b7280" },
                  ]}
                >
                  {formatMoney(line.delivery_price)}
                </Text>
                <Text
                  style={[
                    styles.cell,
                    { flex: 1.5, textAlign: "right", color: "#6b7280" },
                  ]}
                >
                  {line.state === "new" ? (
                    <MaterialIcons
                      name="add-circle"
                      size={20}
                      color="#6366f1"
                    />
                  ) : line.state === "done" ? (
                    <MaterialIcons
                      name="check-circle"
                      size={20}
                      color="#28a745"
                    />
                  ) : line.state === "cancel" ? (
                    <MaterialIcons name="cancel" size={20} color="#ef4444" />
                  ) : line.state === "reschedule" ? (
                    <MaterialIcons name="update" size={20} color="#ffc107" />
                  ) : null}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      <View style={{ height: 40 }} />

      <LostProductModal
        visible={addLostModal}
        onClose={() => setAddLostModal(false)}
        orderId={orderId as string}
        order={order}
        onSuccess={(newLost, newTotal) => {
          if (order) {
            setOrder({ ...order, lost_products: newTotal });
          }
          setLostProducts((prev) =>
            [...prev, newLost].sort((a, b) => a.timestamp - b.timestamp),
          );
        }}
      />

      <OrderLineModal
        visible={addLineModal}
        onClose={() => setAddLineModal(false)}
        orderId={orderId as string}
        onSuccess={handleLineSuccess}
      />
    </ScrollView>
  );
};

export default OrderDashboard;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { padding: 16 },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 16,
  },
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
  cell: {
    fontSize: 13,
    color: "#111827",
  },
});
