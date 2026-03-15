import LostProductModal from "@/components/LostProductModal";
import OrderList from "@/components/OrderList";
import OrderModal from "@/components/OrderModal";
import LotMapView from "@/components/LotMapView";
import { Customer, Order, Product, ProductLot, User } from "@/interfaces";
import db, { where } from "@/services/database";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { callPhone, openTelegram } from "@utils/actions";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  useEffect(() => {
    if (!lotId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [
          lotData,
          ordersData,
          customersData,
          productsData,
          regionsData,
          usersData,
        ] = await Promise.all([
          db.lots.get(lotId),
          db.orders.list(where("lotId", "==", lotId)),
          db.customers.list(),
          db.products.list(),
          db.regions.list(),
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
        setLoading(false);
      }
    };
    fetchData();
    console.log(orders);
  }, [lotId]);

  const handleSuccess = (order: Order & { id: string }, isEdit: boolean) => {
    if (isEdit) {
      setOrders((prev) => prev.map((l) => (l.id === order.id ? order : l)));
    } else {
      setOrders((prev) => [...prev, order]);
    }
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
              <Pressable
                onPress={() => setViewMode(viewMode === "list" ? "map" : "list")}
                className="p-3"
              >
                <MaterialIcons
                  name={viewMode === "list" ? "map" : "list"}
                  size={24}
                  color="#6366f1"
                />
              </Pressable>
              <Pressable onPress={() => setAddLostModal(true)} className="p-3">
                <MaterialIcons
                  name="remove-circle-outline"
                  size={24}
                  color="#ef4444"
                />
              </Pressable>
            </View>
          ),
        }}
      />

      {viewMode === "list" ? (
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
      ) : (
        <LotMapView
          orders={orders}
          customers={customers}
          products={products}
          users={users}
          onOrderPress={(id) => {
            router.push({
              pathname: "/orders/[orderId]",
              params: { orderId: id },
            });
          }}
        />
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
});
