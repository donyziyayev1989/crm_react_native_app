import OrderCard from "@/components/OrderCard";
import { Customer, Order, Product, ProductLot, User } from "@/interfaces";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { formatPhone } from "@utils/format";
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import GroupPicker, { GroupBy } from "./GroupPicker";

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
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  ListHeaderComponent?: React.ComponentType<any> | React.ReactElement | null;
  ListEmptyComponent?: React.ComponentType<any> | React.ReactElement | null;
  ListFooterComponent?: React.ComponentType<any> | React.ReactElement | null;
}

interface OrderItemProps {
  item: Order & { id: string };
  customer: (Customer & { id: string }) | undefined;
  productName: string;
  userName: string;
  isSelected: boolean;
  selectable: boolean;
  toggleSelection: (id: string) => void;
  onEdit: OrderListProps["onEdit"];
  onDelete: OrderListProps["onDelete"];
  onCall: OrderListProps["onCall"];
  onTelegram: OrderListProps["onTelegram"];
  onOrderPress?: OrderListProps["onOrderPress"];
}

// Modul darajasida: komponent ichida yaratilsa har renderda yangi tip bo'lib,
// memo ishlamaydi va barcha qatorlar qayta mount bo'ladi.
const OrderItem = React.memo(function OrderItem({
  item,
  customer,
  productName,
  userName,
  isSelected,
  selectable,
  toggleSelection,
  onEdit,
  onDelete,
  onCall,
  onTelegram,
  onOrderPress,
}: OrderItemProps) {
  const phone = customer?.phone || "";

  const renderRightPanel = () => (
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

  return (
    <View className="mb-3">
      <View style={styles.itemRow}>
        {selectable && (
          <Pressable
            onPress={() => toggleSelection(item.id)}
            style={styles.checkboxContainer}
          >
            <MaterialIcons
              name={isSelected ? "check-box" : "check-box-outline-blank"}
              size={24}
              color={isSelected ? "#6366f1" : "#9ca3af"}
            />
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <ReanimatedSwipeable
            renderRightActions={renderRightPanel}
            enabled={!selectable}
          >
            <Pressable
              onPress={() => {
                if (selectable) {
                  toggleSelection(item.id);
                } else {
                  onOrderPress?.(item.id);
                }
              }}
            >
              <OrderCard
                item={item}
                title={customer?.name || "Noma'lum"}
                subtitle={formatPhone(phone)}
                productName={productName}
                className={isSelected ? "bg-indigo-500/10" : ""}
                userName={userName}
              />
            </Pressable>
          </ReanimatedSwipeable>
        </View>
      </View>
    </View>
  );
});

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
  selectable,
  selectedIds = [],
  onSelectionChange,
  ListHeaderComponent,
  ListEmptyComponent,
  ListFooterComponent,
}) => {
  const [groupBy, setGroupBy] = useState<GroupBy>(null);

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

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggleSelection = useCallback(
    (id: string) => {
      if (selectedSet.has(id)) {
        onSelectionChange?.(selectedIds.filter((x) => x !== id));
      } else {
        onSelectionChange?.([...selectedIds, id]);
      }
    },
    [selectedIds, selectedSet, onSelectionChange],
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View className="flex-row items-center gap-2 mb-3">
            <View className="flex-1">
              <GroupPicker value={groupBy} onChange={setGroupBy} />
            </View>
            {ListHeaderComponent &&
              (React.isValidElement(ListHeaderComponent) ? (
                ListHeaderComponent
              ) : (
                <ListHeaderComponent />
              ))}
          </View>
        }
        ListEmptyComponent={ListEmptyComponent}
        ListFooterComponent={ListFooterComponent}
        stickySectionHeadersEnabled={true}
        style={{ backgroundColor: "#F2F2F2" }}
        renderSectionHeader={({ section }) =>
          section.title ? (
            <View style={styles.sectionHeader} className="bg-indigo-200">
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text className="ml-2 font-bold">({section.data.length} ta)</Text>

              <View
                style={styles.sectionBadge}
                className="bg-indigo-500 ml-auto"
              >
                <Text style={styles.sectionBadgeText}>
                  {section.data.reduce(
                    (acc, item) => acc + (Number(item.product_count) || 0),
                    0,
                  )}
                </Text>
              </View>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <OrderItem
            item={item}
            customer={customersMap[item.customer_id]}
            productName={productsMap[item.product_id] || "Noma'lum mahsulot"}
            userName={usersMap[item.user_id] || "Noma'lum"}
            isSelected={selectedSet.has(item.id)}
            selectable={!!selectable}
            toggleSelection={toggleSelection}
            onEdit={onEdit}
            onDelete={onDelete}
            onCall={onCall}
            onTelegram={onTelegram}
            onOrderPress={onOrderPress}
          />
        )}
      />
    </GestureHandlerRootView>
  );
};

export default OrderList;

const styles = StyleSheet.create({
  groupLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
    marginRight: 15,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
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
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sectionBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },
  itemWrapper: {
    marginBottom: 10,
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkboxContainer: {
    paddingLeft: 12,
    paddingRight: 4,
    justifyContent: "center",
    alignItems: "center",
  },
});
