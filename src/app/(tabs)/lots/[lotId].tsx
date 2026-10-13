import LostProductModal from "@/components/LostProductModal";
import LotExpenseModal from "@/components/LotExpenseModal";
import OrderList from "@/components/OrderList";
import OrderModal from "@/components/OrderModal";
import {
  Customer,
  LostProduct,
  LotExpense,
  Order,
  Product,
  ProductLot,
  User,
} from "@/interfaces";
import db, { orderBy, where } from "@/services/database";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { callPhone, openTelegram } from "@utils/actions";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

/**
 * Lot Detail View (Partiya tafsiloti)
 */
const OrderDetail = () => {
  const { lotId } = useLocalSearchParams<{ lotId: string }>();
  const router = useRouter();

  const [lot, setLot] = useState<(ProductLot & { id: string }) | null>(null);
  const [orders, setOrders] = useState<(Order & { id: string })[]>([]);
  const [customers, setCustomers] = useState<(Customer & { id: string })[]>([]);
  const [products, setProducts] = useState<(Product & { id: string })[]>([]);
  const [users, setUsers] = useState<(User & { id: string })[]>([]);
  const [expenses, setExpenses] = useState<(LotExpense & { id: string })[]>([]);
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
    );

    const unsubCustomers = db.customers.watch((data) => {
      setCustomers(data as (Customer & { id: string })[]);
    });

    const unsubProducts = db.products.watch((data) => {
      setProducts(data as (Product & { id: string })[]);
    });

    const unsubUsers = db.users.watch((data) => {
      setUsers(data as (User & { id: string })[]);
    });

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
      unsubCustomers();
      unsubProducts();
      unsubUsers();
      unsubExpenses();
      unsubLost();
    };
  }, [lotId]);

  const handleSuccess = (order: Order & { id: string }, isEdit: boolean) => {
    // Handled by watch()
  };

  const openMap = (ids?: string[]) => {
    router.push({
      pathname: "/lots/[lotId]/map",
      params: {
        lotId,
        selectedIds: ids ? ids.join(",") : "",
      },
    });
  };

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

  const totalExpenses = useMemo(
    () =>
      (expenses || []).reduce(
        (sum: number, item: LotExpense) => sum + (item.total_price || 0),
        0,
      ),
    [expenses],
  );

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
        <ScrollView
          style={{ flex: 1, backgroundColor: "#F2F2F2" }}
          contentContainerStyle={{ padding: 12 }}
        >
          <View style={styles.expenseSummary}>
            <Text style={styles.summaryLabel}>Jami xarajat:</Text>
            <Text style={styles.summaryValue}>
              {totalExpenses.toLocaleString()} so'm
            </Text>
          </View>

          <Pressable
            style={[
              styles.btn,
              { backgroundColor: "#10b981", marginBottom: 16 },
            ]}
            onPress={() => {
              setEditExpense(null);
              setAddExpenseModal(true);
            }}
          >
            <MaterialIcons name="add-circle" size={20} color="#fff" />
            <Text style={styles.btnText}>Xarajat qo'shish</Text>
          </Pressable>

          {expenses.length === 0 ? (
            <View style={styles.empty}>
              <MaterialIcons name="payments" size={40} color="#d1d5db" />
              <Text style={styles.emptyText}>Hozircha xarajatlar yo'q</Text>
            </View>
          ) : (
            expenses.map((ex) => (
              <View key={ex.id} style={styles.expenseItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.expenseName}>{ex.name}</Text>
                  <Text style={styles.expenseDetail}>
                    {ex.count} ta x {ex.price_per_unit.toLocaleString()} so'm
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.expenseTotal}>
                    {ex.total_price.toLocaleString()} so'm
                  </Text>
                  <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
                    <Pressable
                      onPress={() => {
                        setEditExpense(ex);
                        setAddExpenseModal(true);
                      }}
                    >
                      <MaterialIcons name="edit" size={18} color="#6366f1" />
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        Alert.alert("O'chirish", "O'chirilsinmi?", [
                          { text: "Yo'q" },
                          {
                            text: "Ha",
                            onPress: async () => {
                              await db.lot_expenses.delete(ex.id);
                            },
                          },
                        ]);
                      }}
                    >
                      <MaterialIcons name="delete" size={18} color="#ef4444" />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      ) : (
        <ScrollView
          style={{ flex: 1, backgroundColor: "#F2F2F2" }}
          contentContainerStyle={{ padding: 12 }}
        >
          <View style={[styles.expenseSummary, { borderColor: "#ef4444" }]}>
            <Text style={styles.summaryLabel}>Jami yo'qotilgan:</Text>
            <Text style={[styles.summaryValue, { color: "#ef4444" }]}>
              {lot?.lost_products || 0} dona
            </Text>
          </View>

          <Pressable
            style={[
              styles.btn,
              { backgroundColor: "#ef4444", marginBottom: 16 },
            ]}
            onPress={() => {
              setEditLost(null);
              setAddLostModal(true);
            }}
          >
            <MaterialIcons name="remove-circle" size={20} color="#fff" />
            <Text style={styles.btnText}>Yo'qotilgan qo'shish</Text>
          </Pressable>

          {lost.length === 0 ? (
            <View style={styles.empty}>
              <MaterialIcons
                name="remove-shopping-cart"
                size={40}
                color="#d1d5db"
              />
              <Text style={styles.emptyText}>Hozircha yo'qotishlar yo'q</Text>
            </View>
          ) : (
            lost.map((ls) => (
              <View key={ls.id} style={styles.expenseItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.expenseName}>{ls.count} dona</Text>
                  <Text style={styles.expenseDetail}>{ls.date}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
                    <Pressable
                      onPress={() => {
                        setEditLost(ls);
                        setAddLostModal(true);
                      }}
                    >
                      <MaterialIcons name="edit" size={18} color="#6366f1" />
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        Alert.alert("O'chirish", "O'chirilsinmi?", [
                          { text: "Yo'q" },
                          {
                            text: "Ha",
                            onPress: async () => {
                              try {
                                await db.lost_products.delete(ls.id);
                                // Recalculate lot total
                                const newLost = lost.filter(
                                  (e) => e.id !== ls.id,
                                );
                                const newTotal = newLost.reduce(
                                  (sum, item) => sum + (item.count || 0),
                                  0,
                                );
                                await db.lots.update(lotId as string, {
                                  lost_products: newTotal,
                                });
                              } catch (e) {
                                Alert.alert(
                                  "Xato",
                                  "O'chirishda xatolik yuz berdi",
                                );
                              }
                            },
                          },
                        ]);
                      }}
                    >
                      <MaterialIcons name="delete" size={18} color="#ef4444" />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <OrderModal
        visible={addLineModal}
        onClose={() => {
          setAddLineModal(false);
          setEditLine(null);
        }}
        lotId={lotId as string}
        editLine={editLine}
        onSuccess={handleSuccess}
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
        onSuccess={(newLost, newTotal) => {
          // Handled by watch()
        }}
      />

      <LotExpenseModal
        visible={addExpenseModal}
        onClose={() => setAddExpenseModal(false)}
        lotId={lotId as string}
        lot={lot}
        editExpense={editExpense}
        onSuccess={() => {
          // Handled by watch()
        }}
      />
    </View>
  );
};

export default OrderDetail;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
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
  expenseSummary: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  summaryLabel: { fontSize: 14, color: "#6b7280", fontWeight: "500" },
  summaryValue: { fontSize: 18, fontWeight: "700", color: "#6366f1" },
  expenseItem: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  expenseName: { fontSize: 16, fontWeight: "600", color: "#111827" },
  expenseDetail: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  expenseTotal: { fontSize: 15, fontWeight: "700", color: "#111827" },
});
