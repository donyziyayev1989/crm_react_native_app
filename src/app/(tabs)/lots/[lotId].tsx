import LostProductModal from "@/components/LostProductModal";
import OrderList from "@/components/OrderList";
import OrderModal from "@/components/OrderModal";
import { Customer, Order, Product, ProductLot, User } from "@/interfaces";
import db, { where } from "@/services/database";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { callPhone, openTelegram } from "@utils/actions";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
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
  const [loading, setLoading] = useState(true);

  const [addLineModal, setAddLineModal] = useState(false);
  const [editLine, setEditLine] = useState<(Order & { id: string }) | null>(
    null,
  );
  const [addLostModal, setAddLostModal] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const fetchData = useCallback(
    async (silent = false) => {
      if (!lotId) return;
      if (!silent) setLoading(true);
      try {
        const [lotData, ordersData, customersData, productsData, usersData] =
          await Promise.all([
            db.lots.get(lotId),
            db.orders.list(where("lotId", "==", lotId)),
            db.customers.list(),
            db.products.list(),
            db.users.list(),
          ]);
        setLot(lotData as ProductLot & { id: string });
        setOrders(ordersData as (Order & { id: string })[]);
        setCustomers(customersData as (Customer & { id: string })[]);
        setProducts(productsData as (Product & { id: string })[]);
        setUsers(usersData as (User & { id: string })[]);
      } catch (e) {
        console.error(e);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [lotId],
  );

  useFocusEffect(
    useCallback(() => {
      fetchData(orders.length > 0);
    }, [fetchData, orders.length]),
  );

  const handleSuccess = (order: Order & { id: string }, isEdit: boolean) => {
    if (isEdit) {
      setOrders((prev) => prev.map((l) => (l.id === order.id ? order : l)));
    } else {
      setOrders((prev) => [...prev, order]);
    }
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
            setOrders((prev) => prev.filter((l) => l.id !== order.id));
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

  const handleCustomerAdded = (customer: Customer & { id: string }) => {
    setCustomers((prev) => [...prev, customer]);
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
          title: lot?.name ?? "Partiya tafsiloti",
          headerRight: () => (
            <View className="flex-row items-center">
              {isSelectMode ? (
                <>
                  <Pressable
                    onPress={() => {
                      if (selectedIds.length > 0) {
                        openMap(selectedIds);
                        // Don't clear selection yet, let the user see them when they come back
                      } else {
                        Alert.alert("Xato", "Kamida bitta buyurtmani tanlang");
                      }
                    }}
                    className="p-3"
                  >
                    <MaterialIcons name="map" size={24} color="#10b981" />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setIsSelectMode(false);
                      setSelectedIds([]);
                    }}
                    className="p-3"
                  >
                    <MaterialIcons name="close" size={24} color="#ef4444" />
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable onPress={() => openMap()} className="p-3">
                    <MaterialIcons name="map" size={24} color="#6366f1" />
                  </Pressable>
                  <Pressable
                    onPress={() => setIsSelectMode(true)}
                    className="p-3"
                  >
                    <MaterialIcons name="checklist" size={24} color="#6366f1" />
                  </Pressable>
                </>
              )}
            </View>
          ),
        }}
      />

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
        onOrderPress={(id) => {
          router.push({
            pathname: "/orders/[orderId]",
            params: { orderId: id },
          });
        }}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <MaterialIcons name="inbox" size={40} color="#d1d5db" />
            <Text style={styles.emptyText}>
              Bu partiyada buyurtmalar mavjud emas
            </Text>
          </View>
        )}
        ListHeaderComponent={() => (
          <View className="flex-row items-center gap-3 mb-3">
            <Pressable
              onPress={() => setAddLostModal(true)}
              style={styles.btn}
              className="flex-1 bg-danger"
            >
              <MaterialIcons
                name="remove-circle-outline"
                size={20}
                color="#fff"
              />
              <Text style={styles.btnText}>Yo'qotilgan</Text>
            </Pressable>
            <Pressable
              style={styles.btn}
              className="p-3 flex-1 bg-primary"
              onPress={() => {
                setEditLine(null);
                setAddLineModal(true);
              }}
            >
              <MaterialIcons name="add" size={20} color="#fff" />
              <Text style={styles.btnText}>Buyurtma qo'shish</Text>
            </Pressable>
          </View>
        )}
      />
      <OrderModal
        visible={addLineModal}
        onClose={() => {
          setAddLineModal(false);
          setEditLine(null);
        }}
        lotId={lotId as string}
        editLine={editLine}
        onSuccess={handleSuccess}
        onCustomerAdded={handleCustomerAdded}
      />

      <LostProductModal
        visible={addLostModal}
        onClose={() => setAddLostModal(false)}
        lotId={lotId as string}
        lot={lot}
        onSuccess={(newLost, newTotal) => {
          if (lot) {
            setLot({ ...lot, lost_products: newTotal });
          }
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
    padding: 14,
    gap: 8,
    marginTop: 8,
  },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
