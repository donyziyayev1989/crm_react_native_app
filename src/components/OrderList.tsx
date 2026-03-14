import OrderCard from "@/components/OrderCard";
import { Customer, Order, Product, ProductLot, User } from "@/interfaces";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { formatPhone } from "@utils/format";
import React, { useMemo, useState } from "react";
import { Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";

type GroupBy = "none" | "region" | "product" | "lot";

interface OrderListProps {
  orders: (Order & { id: string })[];
  customers: (Customer & { id: string })[];
  products: (Product & { id: string })[];
  lots: (ProductLot & { id: string })[];
  users: (User & { id: string })[];
  onEdit: (order: Order & { id: string }) => void;
  onDelete: (order: Order & { id: string }) => void;
  onCall: (phone: string) => void;
  onTelegram: (
    identifier: string,
    message?: string,
    chatData?: { chatId: string; title: string },
  ) => void;
  onOrderPress?: (id: string) => void;
  ListHeaderComponent?: React.ComponentType<any> | React.ReactElement | null;
  ListEmptyComponent?: React.ComponentType<any> | React.ReactElement | null;
  ListFooterComponent?: React.ComponentType<any> | React.ReactElement | null;
}

const OrderList: React.FC<OrderListProps> = ({
  orders,
  customers,
  products,
  lots,
  users,
  onEdit,
  onDelete,
  onCall,
  onTelegram,
  onOrderPress,
  ListHeaderComponent,
  ListEmptyComponent,
  ListFooterComponent,
}) => {
  const [groupBy, setGroupBy] = useState<GroupBy>("none");

  // --- Maps for quick access ---
  const customersMap = useMemo(() => {
    const map: Record<string, Customer & { id: string }> = {};
    customers.forEach((c) => (map[c.id!] = c));
    return map;
  }, [customers]);

  const productsMap = useMemo(() => {
    const map: Record<string, string> = {};
    products.forEach((p) => (map[p.id!] = p.name));
    return map;
  }, [products]);

  const lotsMap = useMemo(() => {
    const map: Record<string, string> = {};
    lots.forEach((l) => (map[l.id!] = l.name));
    return map;
  }, [lots]);

  const usersMap = useMemo(() => {
    const map: Record<string, string> = {};
    users.forEach((u) => (map[u.id!] = u.name));
    return map;
  }, [users]);

  // --- Grouping Logic ---
  const sections = useMemo(() => {
    if (groupBy === "none") {
      return [{ title: "", data: orders }];
    }

    const groups: Record<string, (Order & { id: string })[]> = {};

    orders.forEach((order) => {
      let key = "";
      if (groupBy === "region") {
        key = order.region_name || "Mavjud emas";
      } else if (groupBy === "product") {
        key = productsMap[order.product_id] || "Noma'lum mahsulot";
      } else if (groupBy === "lot") {
        key = lotsMap[order.lotId] || "Partiya aniqlanmadi";
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(order);
    });

    return Object.keys(groups)
      .sort()
      .map((key) => ({
        title: key,
        data: groups[key],
      }));
  }, [orders, groupBy, productsMap, lotsMap]);

  const renderRightPanel = (item: Order & { id: string }) => {
    const customer = customersMap[item.customer_id];
    const phone = customer?.phone || "";
    return (
      <View className="bg-white flex-col overflow-hidden rounded-r-2xl border-l border-slate-400">
        <View className="flex-row h-1/2">
          <Pressable
            onPress={() => onEdit(item)}
            className="aspect-square bg-slate-400 flex items-center justify-center"
          >
            <MaterialIcons name="edit" size={20} color="white" />
          </Pressable>
          <Pressable
            onPress={() => onDelete(item)}
            className="aspect-square bg-red-400 flex items-center justify-center"
          >
            <MaterialIcons name="delete" size={20} color="white" />
          </Pressable>
        </View>
        <View className="flex-row h-1/2">
          <Pressable
            onPress={() => onCall(phone)}
            className="aspect-square bg-green-400 flex items-center justify-center"
          >
            <MaterialIcons name="phone" size={22} color="white" />
          </Pressable>
          <Pressable
            onPress={() =>
              onTelegram(customer?.telegram_id || phone, undefined, {
                chatId: customer?.id || "",
                title: customer?.name || "",
              })
            }
            className="aspect-square bg-blue-400 flex items-center justify-center"
          >
            <MaterialIcons name="telegram" size={22} color="white" />
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.groupPicker}>
        <Text style={styles.groupLabel}>Guruhlash:</Text>
        <View style={styles.chipRow}>
          {(["none", "region", "product", "lot"] as const).map((g) => (
            <Pressable
              key={g}
              onPress={() => setGroupBy(g)}
              style={[styles.chip, groupBy === g && styles.chipActive]}
            >
              <Text
                style={[
                  styles.chipText,
                  groupBy === g && styles.chipTextActive,
                ]}
              >
                {g === "none"
                  ? "Yo'q"
                  : g === "region"
                    ? "Viloyat"
                    : g === "product"
                      ? "Mahsulot"
                      : "Partiya"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        ListFooterComponent={ListFooterComponent}
        stickySectionHeadersEnabled={true}
        style={{ backgroundColor: "#F2F2F2" }}
        renderSectionHeader={({ section: { title } }) =>
          title ? (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{title}</Text>
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>
                  {sections.find((s) => s.title === title)?.data.length}
                </Text>
              </View>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const customer = customersMap[item.customer_id];
          return (
            <View
              style={styles.itemWrapper}
              className="shadow-sm shadow-slate-400/30"
            >
              <ReanimatedSwipeable
                renderRightActions={() => renderRightPanel(item)}
              >
                <Pressable onPress={() => onOrderPress?.(item.id)}>
                  <OrderCard
                    item={item}
                    title={customer?.name || "Noma'lum"}
                    subtitle={formatPhone(customer?.phone || "")}
                    productName={
                      productsMap[item.product_id] || "Noma'lum mahsulot"
                    }
                    userName={usersMap[item.user_id] || "Noma'lum"}
                  />
                </Pressable>
              </ReanimatedSwipeable>
            </View>
          );
        }}
      />
    </GestureHandlerRootView>
  );
};

export default OrderList;

const styles = StyleSheet.create({
  groupPicker: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  groupLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
    marginRight: 10,
  },
  chipRow: {
    flexDirection: "row",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  chipActive: {
    backgroundColor: "#6366f1",
    borderColor: "#6366f1",
  },
  chipText: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "500",
  },
  chipTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  listContent: {
    padding: 12,
    paddingBottom: 100,
  },
  sectionHeader: {
    backgroundColor: "#f9fafb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#6366f1",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
    textTransform: "uppercase",
  },
  sectionBadge: {
    backgroundColor: "#e0e7ff",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sectionBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4338ca",
  },
  itemWrapper: {
    marginBottom: 10,
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
  },
});
