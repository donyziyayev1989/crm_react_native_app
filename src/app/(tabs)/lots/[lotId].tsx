import LostProductModal from "@/components/LostProductModal";
import LotExpenseList from "@/components/LotExpenseList";
import LotExpenseModal from "@/components/LotExpenseModal";
import LotLostList from "@/components/LotLostList";
import OrderList from "@/components/OrderList";
import OrderModal from "@/components/OrderModal";
import { LostProduct, LotExpense, Order, ProductLot, WithId } from "@/interfaces";
import { useRefData } from "@/providers/ReferenceData";
import db, { orderBy, where } from "@/services/database";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { callPhone, openTelegram } from "@utils/actions";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

/**
 * Lot Detail View (Partiya tafsiloti)
 */
const OrderDetail = () => {
  const { lotId } = useLocalSearchParams<{ lotId: string }>();
  const router = useRouter();

  const { customers, products, users } = useRefData();
  const [lot, setLot] = useState<WithId<ProductLot> | null>(null);
  const [orders, setOrders] = useState<WithId<Order>[]>([]);
  const [expenses, setExpenses] = useState<WithId<LotExpense>[]>([]);
  const [activeTab, setActiveTab] = useState<"orders" | "expenses" | "lost">(
    "orders",
  );
  const [lost, setLost] = useState<(LostProduct & { id: string })[]>([]);

  const [addLineModal, setAddLineModal] = useState(false);
  const [editLine, setEditLine] = useState<(Order & { id: string }) | null>(
    null,
  );
  const [addLostModal, setAddLostModal] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [addExpenseModal, setAddExpenseModal] = useState(false);
  const [editExpense, setEditExpense] = useState<
    (LotExpense & { id: string }) | null
  >(null);
  const [editLost, setEditLost] = useState<
    (LostProduct & { id: string }) | null
  >(null);

  React.useEffect(() => {
    if (!lotId) return;

    const unsubLot = db.lots.watchDoc(lotId, setLot);

    const unsubOrders = db.orders.watch(
      (data) => {
        setOrders(data as WithId<Order>[]);
      },
      where("lotId", "==", lotId),
    );

    const unsubExpenses = db.lot_expenses.watch(
      (data) => {
        setExpenses(data as (LotExpense & { id: string })[]);
      },
      where("lotId", "==", lotId),
      orderBy("timestamp", "desc"),
    );

    const unsubLost = db.lost_products.watch(
      (data) => {
        setLost(data as (LostProduct & { id: string })[]);
      },
      where("lotId", "==", lotId),
      orderBy("timestamp", "desc"),
    );

    return () => {
      unsubLot();
      unsubOrders();
      unsubExpenses();
      unsubLost();
    };
  }, [lotId]);

  const openMap = useCallback(
    (ids?: string[]) => {
      router.push({
        pathname: "/lots/[lotId]/map",
        params: {
          lotId,
          selectedIds: ids ? ids.join(",") : "",
        },
      });
    },
    [router, lotId],
  );

  const handleDelete = (order: Order & { id: string }) => {
    Alert.alert("O'chirish", "Bu buyurtmani o'chirishni xohlaysizmi?", [
      { text: "Bekor", style: "cancel" },
      {
        text: "O'chirish",
        style: "destructive",
        onPress: async () => {
          try {
            await db.orders.delete(order.id);
          } catch {
            Alert.alert("Xato", "O'chirishda xatolik yuz berdi");
          }
        },
      },
    ]);
  };

  const openEditModal = (line: Order & { id: string }) => {
    setEditLine(line);
    setAddLineModal(true);
  };

  const handleOrderPress = useCallback(
    (id: string) => {
      router.push({
        pathname: "/orders/[orderId]",
        params: { orderId: id },
      });
    },
    [router],
  );

  const renderEmptyOrders = useCallback(
    () => (
      <View style={styles.empty}>
        <MaterialIcons name="inbox" size={40} color="#d1d5db" />
        <Text style={styles.emptyText}>
          Bu partiyada buyurtmalar mavjud emas
        </Text>
      </View>
    ),
    [],
  );

  const mapView = useCallback(
    () => (
      <View className="flex-row items-center gap-2">
        {isSelectMode ? (
          <>
            <Pressable
              onPress={() => {
                if (selectedIds.length > 0) {
                  openMap(selectedIds);
                } else {
                  Alert.alert("Xato", "Kamida bitta buyurtmani tanlang");
                }
              }}
              disabled={selectedIds.length === 0}
              style={styles.btn}
              className={
                selectedIds.length === 0 ? " bg-slate-300" : " bg-success"
              }
            >
              <MaterialIcons name="map" size={20} color="#fff" />
            </Pressable>
            <Pressable
              onPress={() => {
                setIsSelectMode(false);
                setSelectedIds([]);
              }}
              style={styles.btn}
              className=" bg-danger items-center"
            >
              <MaterialIcons name="close" size={20} color="#fff" />
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              onPress={() => openMap()}
              style={styles.btn}
              className=" bg-primary items-center"
            >
              <MaterialIcons name="map" size={20} color="#fff" />
            </Pressable>
            <Pressable
              onPress={() => setIsSelectMode(true)}
              style={styles.btn}
              className=" bg-slate-400 items-center"
            >
              <MaterialIcons name="checklist" size={20} color="#fff" />
            </Pressable>
          </>
        )}
      </View>
    ),
    [isSelectMode, selectedIds, openMap],
  );

  const renderOrdersHeader = useCallback(
    () => (
      <>
        {mapView()}
        <Pressable
          style={styles.btn}
          className=" bg-primary items-center"
          onPress={() => {
            setEditLine(null);
            setAddLineModal(true);
          }}
        >
          <MaterialIcons name="add" size={20} color="#fff" />
          <Text style={styles.btnText}></Text>
        </Pressable>
      </>
    ),
    [mapView],
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: lot?.name ?? "Partiya tafsiloti",
        }}
      />

      <View style={styles.tabBar}>
        <Pressable
          onPress={() => setActiveTab("orders")}
          style={[styles.tabItem, activeTab === "orders" && styles.activeTab]}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "orders" && styles.activeTabText,
            ]}
          >
            Buyurtmalar ({orders.length})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab("expenses")}
          style={[styles.tabItem, activeTab === "expenses" && styles.activeTab]}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "expenses" && styles.activeTabText,
            ]}
          >
            Xarajatlar ({expenses.length})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab("lost")}
          style={[styles.tabItem, activeTab === "lost" && styles.activeTab]}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "lost" && styles.activeTabText,
            ]}
          >
            Yo'qotilgan ({lost.length})
          </Text>
        </Pressable>
      </View>

      {activeTab === "orders" ? (
        <OrderList
          orders={orders}
          customers={customers}
          products={products}
          lots={lot ? [lot] : []}
          users={users}
          onEdit={openEditModal}
          onDelete={handleDelete}
          onCall={callPhone}
          onTelegram={openTelegram}
          selectable={isSelectMode}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onOrderPress={handleOrderPress}
          ListEmptyComponent={renderEmptyOrders}
          ListHeaderComponent={renderOrdersHeader}
        />
      ) : activeTab === "expenses" ? (
        <LotExpenseList
          expenses={expenses}
          onAdd={() => {
            setEditExpense(null);
            setAddExpenseModal(true);
          }}
          onEdit={(ex) => {
            setEditExpense(ex);
            setAddExpenseModal(true);
          }}
        />
      ) : (
        <LotLostList
          lotId={lotId as string}
          lot={lot}
          items={lost}
          onAdd={() => {
            setEditLost(null);
            setAddLostModal(true);
          }}
          onEdit={(ls) => {
            setEditLost(ls);
            setAddLostModal(true);
          }}
        />
      )}

      {/* Ro'yxatlar watch() orqali yangilanadi — onSuccess kerak emas */}
      <OrderModal
        visible={addLineModal}
        onClose={() => {
          setAddLineModal(false);
          setEditLine(null);
        }}
        lotId={lotId as string}
        editLine={editLine}
      />

      <LostProductModal
        visible={addLostModal}
        onClose={() => {
          setAddLostModal(false);
          setEditLost(null);
        }}
        lotId={lotId as string}
        lot={lot}
        editLost={editLost}
      />

      <LotExpenseModal
        visible={addExpenseModal}
        onClose={() => setAddExpenseModal(false)}
        lotId={lotId as string}
        lot={lot}
        editExpense={editExpense}
      />
    </View>
  );
};

export default OrderDetail;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText: { color: "#9ca3af", fontSize: 14 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 12,
  },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomColor: "#6366f1",
  },
  tabText: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
  activeTabText: {
    color: "#6366f1",
    fontWeight: "600",
  },
});
