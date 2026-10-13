import OrderDetailView from "@/components/OrderDetailView";
import OrderModal from "@/components/OrderModal";
import { Customer, Order, Product, ProductLot, User } from "@/interfaces";
import db from "@/services/database";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { openTelegram } from "@utils/actions";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

/**
 * Buyurtma Tafsiloti sahifasi
 */
const OrderDetail = () => {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const [order, setOrder] = useState<(Order & { id: string }) | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [lot, setLot] = useState<ProductLot | null>(null);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!orderId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const orderData = await db.orders.get(orderId);
        if (orderData) {
          setOrder(orderData as Order & { id: string });
          const orderObj = orderData as Order;
          const [cust, prod, usr, lt] = await Promise.all([
            orderObj.customer_id
              ? db.customers.get(orderObj.customer_id)
              : Promise.resolve(null),
            orderObj.product_id
              ? db.products.get(orderObj.product_id)
              : Promise.resolve(null),
            orderObj.user_id
              ? db.users.get(orderObj.user_id)
              : Promise.resolve(null),
            orderObj.lotId
              ? db.lots.get(orderObj.lotId)
              : Promise.resolve(null),
          ]);
          setCustomer(cust);
          setProduct(prod);
          setUser(usr);
          setLot(lt);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [orderId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.center}>
        <Text>Buyurtma topilmadi</Text>
      </View>
    );
  }

  const { referral, customerId: refCustomerId } = useLocalSearchParams<{
    referral?: string;
    customerId?: string;
  }>();

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen
        options={{
          title: customer?.name || "Buyurtma",
          headerTitleAlign: "center",
          headerLeft: () => (
            <Pressable
              onPress={() => {
                if (referral === "customer" && refCustomerId) {
                  router.push(`/customers/${refCustomerId}`);
                } else if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace("/");
                }
              }}
              style={{ marginRight: 8 }}
            >
              <MaterialIcons name="arrow-back" size={24} color="#333" />
            </Pressable>
          ),
        }}
      />
      <View style={styles.content}>
        <OrderDetailView
          order={order}
          customer={customer}
          product={product}
          user={user}
          lot={lot}
        />

        <View style={styles.actions}>
          <Pressable
            style={styles.editBtn}
            onPress={() => setEditModalVisible(true)}
          >
            <MaterialIcons name="edit" size={20} color="#fff" />
            <Text style={styles.btnText}>Tahrirlash</Text>
          </Pressable>
          <Pressable
            style={[styles.telegramBtn, { backgroundColor: "#0088cc" }]}
            onPress={() =>
              openTelegram(
                customer?.telegram_id || customer?.phone || "",
                undefined,
                { chatId: customer?.id || "", title: customer?.name || "" },
              )
            }
          >
            <MaterialIcons name="telegram" size={20} color="#fff" />
            <Text style={styles.btnText}>Telegram</Text>
          </Pressable>
        </View>
      </View>

      <OrderModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        editLine={order}
        onSuccess={(updatedOrder) => {
          setOrder(updatedOrder);
          setEditModalVisible(false);
        }}
      />
    </ScrollView>
  );
};

export default OrderDetail;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { padding: 16 },
  row: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  label: {
    width: "35%",
    color: "#6b7280",
    fontWeight: "600",
    fontSize: 13,
    textTransform: "uppercase",
  },
  value: { flex: 1, color: "#111827", fontSize: 14, fontWeight: "500" },
  actions: { flexDirection: "row", marginTop: 20, gap: 12 },
  editBtn: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#6366f1",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  telegramBtn: {
    flex: 1,
    flexDirection: "row",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});
