import Card from "@/components/Card";
import { Customer, Order, Product, User, ProductLot } from "@/interfaces";
import { formatDate, formatMoney, formatPhone } from "@utils/format";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { callPhone } from "@utils/actions";

interface OrderDetailViewProps {
  order: Order & { id: string };
  customer?: Customer | null;
  product?: Product | null;
  user?: User | null;
  lot?: ProductLot | null;
}

const OrderDetailView: React.FC<OrderDetailViewProps> = ({
  order,
  customer,
  product,
  user,
  lot,
}) => {
  return (
    <Card>
      <View style={styles.row}>
        <Text style={styles.label}>Mijoz:</Text>
        <Text style={styles.value}>{customer?.name || "—"}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Telefon:</Text>
        <Pressable onPress={() => callPhone(customer?.phone || "")}>
          <Text style={[styles.value, { color: "#6366f1" }]}>
            {customer?.phone ? formatPhone(customer.phone) : "—"}
          </Text>
        </Pressable>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Viloyat:</Text>
        <Text style={styles.value}>
          {order.region_name || customer?.region_name || "—"}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Partiya:</Text>
        <Text style={styles.value}>{lot?.name || "—"}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Mahsulot:</Text>
        <Text style={styles.value}>{product?.name || "—"}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Miqdor:</Text>
        <Text style={styles.value}>{order.product_count} dona</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Narx:</Text>
        <Text style={styles.value}>{formatMoney(order.product_price)} so'm</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Yetkazish:</Text>
        <Text style={styles.value}>{formatMoney(order.delivery_price)} so'm</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Jami:</Text>
        <Text style={[styles.value, { fontWeight: "bold" }]}>
          {formatMoney(
            order.product_count * order.product_price + order.delivery_price
          )}{" "}
          so'm
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Holat:</Text>
        <Text style={[styles.value, { color: getStatusColor(order.state) }]}>
          {order.state === "new"
            ? "Yangi"
            : order.state === "done"
            ? "Bajarildi"
            : order.state === "cancel"
            ? "Bekor qilindi"
            : order.state === "reschedule"
            ? "Reschedule"
            : order.state}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Sana:</Text>
        <Text style={styles.value}>{formatDate(order.date)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Xodim:</Text>
        <Text style={styles.value}>{user?.name || "—"}</Text>
      </View>
      {order.note ? (
        <View style={styles.row}>
          <Text style={styles.label}>Izoh:</Text>
          <Text style={styles.value}>{order.note}</Text>
        </View>
      ) : null}
    </Card>
  );
};

const getStatusColor = (state: string) => {
  switch (state) {
    case "done":
      return "#28a745";
    case "cancel":
      return "#dc3545";
    case "reschedule":
      return "#ffc107";
    default:
      return "#6366f1";
  }
};

export default OrderDetailView;

const styles = StyleSheet.create({
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
});
