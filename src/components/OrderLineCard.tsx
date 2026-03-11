import Card from "@/components/Card";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { OrderLine } from "@interfaces/index";
import { formatDate, formatMoney } from "@utils/format";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

export interface OrderLineCardProps {
  item: OrderLine & { id: string };
  title: string;
  subtitle?: string;
  topIconName?: keyof typeof MaterialIcons.glyphMap;
  productName: string;
}

const OrderLineCard: React.FC<OrderLineCardProps> = ({
  item,
  title,
  subtitle,
  topIconName = "person",
  productName,
}) => {
  return (
    <Card>
      {/* Hedear: Title and status */}
      <View className="flex-row justify-between items-center mb-2">
        <View style={styles.infoItem}>
          <MaterialIcons name={topIconName} size={16} color="#6b7280" />
          <View className="flex flex-row gap-2">
            <Text className="font-semibold text-primary">{title}</Text>
            {!!subtitle && <Text style={styles.phoneText}>({subtitle})</Text>}
          </View>
        </View>
        <Text
          style={[
            styles.stateBadge,
            item.state === "done"
              ? styles.stateDone
              : item.state === "cancel"
                ? styles.stateCancel
                : item.state === "reschedule"
                  ? styles.stateReschedule
                  : styles.stateNew,
          ]}
        >
          {item.state === "done"
            ? "Bajarildi"
            : item.state === "cancel"
              ? "Bekor"
              : item.state === "reschedule"
                ? "Boshqa partiyaga"
                : "Yangi"}
        </Text>
      </View>

      {/* Product Name */}
      <View className="flex-row items-center justify-between mb-1">
        <View style={styles.infoItem}>
          <MaterialIcons name="shopping-bag" size={16} color="#6b7280" />
          <Text style={styles.infoText}>{productName}</Text>
        </View>
      </View>

      {/* Product Price calculation */}
      <View className="flex-row gap-2 mb-1">
        <View className="flex-row items-center">
          <MaterialIcons
            name="attach-money"
            size={16}
            color="#6b7280"
            className="mr-1"
          />
          <Text className="font-semibold">
            {formatMoney(item.product_price)}
          </Text>
          <Text className="text-muted"> so'm</Text>
        </View>
        <View className="flex-row items-center">
          <Text className="text-black"> x {item.product_count}</Text>
          <Text className="text-muted"> dona = </Text>
          <Text className="font-semibold">
            {formatMoney(item.product_price * item.product_count)} so'm
          </Text>
        </View>
      </View>

      {/* Delivery Price calculation */}
      <View className="flex-row items-center">
        <MaterialIcons
          name="local-shipping"
          size={16}
          color="#6b7280"
          className="mr-1"
        />
        <Text className="font-semibold">
          {formatMoney(item.delivery_price)}
        </Text>
        <Text className="text-muted"> so'm</Text>
        <Text className="text-black"> x {item.product_count}</Text>
        <Text className="text-muted"> dona = </Text>
        <Text className="font-semibold">
          {formatMoney(item.delivery_price * item.product_count)} so'm
        </Text>
      </View>

      {/* Footer: User and Date */}
      <View
        className="flex-row gap-2 items-center justify-between mt-2 pt-2"
        style={styles.borderTop}
      >
        <View className="flex-1">
          <Text className="font-semibold">
            Ma'sul: <Text className="text-muted font-normal">Doniyor</Text>
          </Text>
        </View>

        <View className="flex-row items-center gap-1">
          <MaterialIcons name="event-available" size={16} color="#6b7280" />
          <Text>{formatDate(item.date)}</Text>
        </View>
      </View>
      {!!item.note && (
        <Text className="text-gray-500 text-sm mt-1">
          <Text className="font-semibold">Izoh:</Text> {item.note}
        </Text>
      )}
    </Card>
  );
};

export default OrderLineCard;

const styles = StyleSheet.create({
  infoItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  infoText: { fontSize: 15, color: "#6b7280" },
  phoneText: { fontSize: 15, color: "#6b7280" },
  stateBadge: {
    fontSize: 11,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
    overflow: "hidden",
  },
  stateNew: { backgroundColor: "#dbeafe", color: "#1d4ed8" },
  stateDone: { backgroundColor: "#dcfce7", color: "#15803d" },
  stateCancel: { backgroundColor: "#fee2e2", color: "#b91c1c" },
  stateReschedule: { backgroundColor: "#f97316", color: "#fff" },
  borderTop: {
    borderTopColor: "#999999",
    borderTopWidth: 1,
    borderStyle: "dashed",
  },
});
