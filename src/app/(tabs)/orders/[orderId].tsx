import Card from "@/components/Card";
import CustomerForm from "@/components/CustomerForm";
import Select from "@/components/Select";
import { Customer, Order, OrderLine, Product, Region } from "@/interfaces";
import db, { subOrderLines } from "@/services/database";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { callPhone, openTelegram } from "@utils/actions";
import { formatDate, formatMoney, formatPhone } from "@utils/format";
import { Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { Rating } from "react-native-ratings";
// ─── Order Line Form State ─────────────────────────────────────────────────────
const emptyForm = {
  customer_id: "",
  region_name: "",
  product_id: "",
  product_count: "",
  product_price: "",
  rate: "",
  state: "new",
  delivery_price: "",
  note: "",
};

const OrderDetail = () => {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  const [order, setOrder] = useState<(Order & { id: string }) | null>(null);
  const [orderLines, setOrderLines] = useState<(OrderLine & { id: string })[]>(
    [],
  );
  const [customers, setCustomers] = useState<(Customer & { id: string })[]>([]);
  const [products, setProducts] = useState<(Product & { id: string })[]>([]);
  const [regions, setRegions] = useState<(Region & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  // Order line qo'shish / tahrirlash modal
  const [addLineModal, setAddLineModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editLine, setEditLine] = useState<(OrderLine & { id: string }) | null>(
    null,
  );

  // Mijoz qo'shish modal (order line modal ichida)
  const [addCustomerModal, setAddCustomerModal] = useState(false);

  // ─── Fetch order + lines + reference data ────────────────────────────────────
  useEffect(() => {
    if (!orderId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [orderData, linesData, customersData, productsData, regionsData] =
          await Promise.all([
            db.orders.get(orderId),
            subOrderLines.list(orderId),
            db.customers.list(),
            db.products.list(),
            db.regions.list(),
          ]);
        setOrder(orderData as Order & { id: string });
        setOrderLines(linesData as (OrderLine & { id: string })[]);
        setCustomers(customersData as (Customer & { id: string })[]);
        setProducts(productsData as (Product & { id: string })[]);
        setRegions(regionsData as (Region & { id: string })[]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [orderId]);

  // ─── Select options ───────────────────────────────────────────────────────────
  const customerOptions = useMemo(
    () =>
      customers.map((c) => ({ label: `${c.name} (${c.phone})`, value: c.id! })),
    [customers],
  );
  const productOptions = useMemo(
    () => products.map((p) => ({ label: p.name, value: p.id! })),
    [products],
  );
  const regionOptions = useMemo(
    () => regions.map((r) => ({ label: r.name, value: r.id! })),
    [regions],
  );

  // ─── Save / Update order line ────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.customer_id || !form.product_id || !form.product_count) {
      Alert.alert("Xato", "Mijoz, mahsulot va miqdor to'ldirilishi shart");
      return;
    }
    setSaving(true);
    try {
      const lineData: Omit<OrderLine, "id"> = {
        customer_id: form.customer_id,
        region_name: form.region_name || "",
        product_id: form.product_id,
        product_count: Number(form.product_count),
        product_price: Number(form.product_price) || 0,
        rate: Number(form.rate) || 0,
        state: form.state || "new",
        delivery_price: Number(form.delivery_price) || 0,
        date: editLine?.date ?? new Date().toISOString(),
        user_id: editLine?.user_id ?? "",
        note: form.note || "",
      };

      if (editLine) {
        // ─── Tahrirlash rejimi ───────────────────────────────────────────────
        await subOrderLines.update(orderId!, editLine.id, lineData);
        setOrderLines((prev) =>
          prev.map((l) => (l.id === editLine.id ? { ...l, ...lineData } : l)),
        );
      } else {
        // ─── Yangi qo'shish rejimi ───────────────────────────────────────────
        const newId = await subOrderLines.create(orderId!, lineData);
        setOrderLines((prev) => [
          ...prev,
          { id: newId, ...lineData } as OrderLine & { id: string },
        ]);
      }

      setForm(emptyForm);
      setEditLine(null);
      setAddLineModal(false);
    } catch (e) {
      Alert.alert("Xato", "Saqlashda xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setForm(emptyForm);
    setEditLine(null);
    setAddLineModal(false);
  };

  // ─── Delete order line ───────────────────────────────────────────────────────
  const handleDelete = (line: OrderLine & { id: string }) => {
    Alert.alert(
      "O'chirishni tasdiqlang",
      "Bu buyurtma satrini o'chirishni xohlaysizmi?",
      [
        { text: "Bekor", style: "cancel" },
        {
          text: "O'chirish",
          style: "destructive",
          onPress: async () => {
            try {
              await subOrderLines.delete(orderId!, line.id);
              setOrderLines((prev) => prev.filter((l) => l.id !== line.id));
            } catch {
              Alert.alert("Xato", "O'chirishda xatolik yuz berdi");
            }
          },
        },
      ],
    );
  };

  // ─── Open edit modal with pre-filled form ────────────────────────────────────
  const openEditModal = (line: OrderLine & { id: string }) => {
    setEditLine(line);
    setForm({
      customer_id: line.customer_id,
      region_name: line.region_name || "",
      product_id: line.product_id,
      product_count: String(line.product_count),
      product_price: String(line.product_price),
      rate: String(line.rate),
      state: line.state,
      delivery_price: String(line.delivery_price),
      note: line.note || "",
    });
    setAddLineModal(true);
  };

  // ─── Yangi mijoz qo'shilgandan keyin avtomatik tanlash ───────────────────────
  const handleCustomerCreated = (
    customerId: string,
    customerData: Customer,
  ) => {
    // Yangi mijozni tasdiqlangan ID bilan state ga qo'shamiz
    const newCustomer = { id: customerId, ...customerData };
    setCustomers((prev) => [...prev, newCustomer]);

    // Mijoz yaratilgandan so'ng, uni va uning viloyatini avtomatik tanlaymiz
    setForm((f) => ({
      ...f,
      customer_id: customerId,
      region_name: customerData.region_name || f.region_name,
    }));

    // Mijoz qo'shish modalini yopamiz
    setAddCustomerModal(false);
  };

  const getCustomerName = (id: string) =>
    customers.find((c) => c.id === id)?.name ?? id;
  const getCustomerPhone = (id: string) =>
    customers.find((c) => c.id === id)?.phone ?? "";
  const getProductName = (id: string) =>
    products.find((p) => p.id === id)?.name ?? id;
  const getRegionName = (id: string) =>
    regions.find((r) => r.id === id)?.name ?? id;

  // ─── Sorted Order Lines for Grouping ─────────────────────────────────────────
  const sortedOrderLines = useMemo(() => {
    return [...orderLines].sort((a, b) => {
      const rA = getRegionName(a.region_name || "");
      const rB = getRegionName(b.region_name || "");
      if (rA < rB) return -1;
      if (rA > rB) return 1;
      return 0;
    });
  }, [orderLines, regions]);

  // ─── Swipeable row refs (must be before any early return) ────────────────────
  const rowRefs = useRef(new Map<string, any>());
  const prevOpenedRow = useRef<string | null>(null);
  const closeRow = (id: string) => {
    if (prevOpenedRow.current !== null && prevOpenedRow.current !== id) {
      const row = rowRefs.current.get(prevOpenedRow.current);
      if (row) row.close();
    }
    prevOpenedRow.current = id;
  };

  const renderRightPanel = (item: OrderLine & { id: string }) => {
    const phone = getCustomerPhone(item.customer_id);
    return (
      <View className="bg-white  rounded-r-2xl overflow-hidden d-flex items-center">
        <View className="flex-row z-2 h-16 my-auto">
          <Pressable
            onPress={() => openEditModal(item)}
            className="bg-slate-400 w-16 h-full flex items-center justify-center"
          >
            <MaterialIcons name="edit" size={22} color="white" />
          </Pressable>
          <Pressable
            onPress={() => handleDelete(item)}
            className="bg-red-400 w-16 h-full flex items-center justify-center"
          >
            <MaterialIcons name="delete-outline" size={22} color="white" />
          </Pressable>
          <Pressable
            onPress={() => callPhone(phone)}
            className="bg-green-500 w-16 h-full flex items-center justify-center"
          >
            <MaterialIcons name="phone" size={24} color="white" />
          </Pressable>
          <Pressable
            onPress={() => openTelegram(phone)}
            className="bg-blue-400 w-16 h-full flex items-center justify-center"
          >
            <MaterialIcons name="telegram" size={24} color="white" />
          </Pressable>
        </View>
      </View>
    );
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
      <Stack.Screen options={{ title: order?.name ?? "Buyurtma tafsiloti" }} />
      <GestureHandlerRootView style={{ flex: 1 }}>
        <FlatList
          data={sortedOrderLines}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={() => (
            <View style={styles.empty}>
              <MaterialIcons name="inbox" size={40} color="#d1d5db" />
              <Text style={styles.emptyText}>
                Hech qanday buyurtma satri yo'q
              </Text>
            </View>
          )}
          renderItem={({ item, index }) => {
            const regionName = getRegionName(item.region_name || "");
            const showHeader =
              index === 0 ||
              getRegionName(sortedOrderLines[index - 1].region_name || "") !==
                regionName;

            return (
              <View>
                {showHeader && (
                  <View className="mt-2 mb-3 flex-row items-center justify-between">
                    <Text className="uppercase font-semibold ">
                      {regionName || "Viloyat aniqlanmagan"}
                    </Text>
                    <Text>
                      {sortedOrderLines
                        .filter(
                          (li) =>
                            getRegionName(li.region_name || "") === regionName,
                        )
                        .reduce(
                          (acc, curr) => acc + curr.product_count,
                          0,
                        )}{" "}
                      <Text className="text-muted text-xs">dona mahsulot</Text>
                    </Text>
                  </View>
                )}
                <View className="mb-2 bg-white rounded-2xl">
                  <ReanimatedSwipeable
                    ref={
                      ((ref: any) => {
                        if (item.id) {
                          if (ref) rowRefs.current.set(item.id, ref);
                          else rowRefs.current.delete(item.id);
                        }
                      }) as any
                    }
                    onSwipeableWillOpen={() => item.id && closeRow(item.id)}
                    renderRightActions={() => renderRightPanel(item)}
                  >
                    <Card>
                      <View className="flex-row justify-between items-center mb-2">
                        <View style={styles.infoItem}>
                          <MaterialIcons
                            name="person"
                            size={16}
                            color="#6b7280"
                          />
                          <View className="flex flex-row gap-2">
                            <Text style={styles.infoText}>
                              {getCustomerName(item.customer_id)}
                            </Text>
                            <Text style={styles.phoneText}>
                              ({formatPhone(getCustomerPhone(item.customer_id))}
                              )
                            </Text>
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
                      <View className="flex-row items-center justify-between mb-1">
                        <View style={styles.infoItem}>
                          <MaterialIcons
                            name="shopping-bag"
                            size={16}
                            color="#6b7280"
                          />
                          <Text style={styles.infoText}>
                            {getProductName(item.product_id)}
                          </Text>
                        </View>
                      </View>
                      <View className="flex-row gap-2">
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
                          <Text className="text-black">
                            x {item.product_count}
                          </Text>
                          <Text className="text-muted"> dona = </Text>
                          <Text className="font-semibold">
                            {formatMoney(
                              item.product_price * item.product_count,
                            )}{" "}
                            so'm
                          </Text>
                        </View>
                      </View>
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
                        <Text className="text-black">
                          {" "}
                          x {item.product_count}
                        </Text>
                        <Text className="text-muted"> dona = </Text>
                        <Text className="font-semibold">
                          {formatMoney(
                            item.delivery_price * item.product_count,
                          )}{" "}
                          so'm
                        </Text>
                      </View>
                      <View
                        className="flex-row gap-2 items-center justify-between mt-2 pt-2"
                        style={styles.borderTop}
                      >
                        <View className="flex-1">
                          <Text>Ma'sul: Doniyor</Text>
                          {!!item.note && (
                            <Text className="text-gray-500 text-sm mt-1">
                              Izoh: {item.note}
                            </Text>
                          )}
                        </View>

                        <View className="flex-row items-center gap-1">
                          <MaterialIcons
                            name="event-available"
                            size={16}
                            color="#6b7280"
                          />
                          <Text>{formatDate(item.date)}</Text>
                        </View>
                      </View>
                    </Card>
                  </ReanimatedSwipeable>
                </View>
              </View>
            );
          }}
          ListFooterComponent={() => (
            <Pressable
              style={styles.addBtn}
              onPress={() => {
                setForm(emptyForm);
                setEditLine(null);
                setAddLineModal(true);
              }}
            >
              <MaterialIcons name="add" size={20} color="#fff" />
              <Text style={styles.addBtnText}>Buyurtma satri qo'shish</Text>
            </Pressable>
          )}
        />
      </GestureHandlerRootView>

      <Modal
        visible={addLineModal}
        animationType="slide"
        transparent
        onRequestClose={() => setAddLineModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, justifyContent: "flex-end" }}
        >
          <Pressable
            style={[StyleSheet.absoluteFill, styles.backdrop]}
            onPress={() => setAddLineModal(false)}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>
              {editLine
                ? "Buyurtma satrini tahrirlash"
                : "Yangi buyurtma satri"}
            </Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* ── Mijoz: Select + "+" tugmasi ── */}
              <Text style={styles.fieldLabel}>Mijoz</Text>
              <View style={styles.selectRow}>
                <View style={{ flex: 1 }}>
                  <Select
                    data={customerOptions}
                    placeholder="Mijozni tanlang"
                    searchPlaceholder="Qidirish..."
                    search
                    maxHeight={280}
                    value={form.customer_id || null}
                    onChange={(v) => {
                      const cust = customers.find((c) => c.id === v);
                      setForm((f) => ({
                        ...f,
                        customer_id: v,
                        region_name: cust?.region_name || f.region_name,
                      }));
                    }}
                  />
                </View>
                <Pressable
                  style={styles.addCustomerBtn}
                  onPress={() => setAddCustomerModal(true)}
                >
                  <MaterialIcons name="person-add" size={20} color="#fff" />
                </Pressable>
              </View>

              {/* ── Viloyat ── */}
              <Text style={styles.fieldLabel}>Viloyat</Text>
              <Select
                data={regionOptions}
                placeholder="Viloyatni tanlang"
                searchPlaceholder="Qidirish..."
                search={true}
                maxHeight={280}
                value={form.region_name || null}
                onChange={(v) => setForm((f) => ({ ...f, region_name: v }))}
              />

              {/* ── Mahsulot ── */}
              <Text style={styles.fieldLabel}>Mahsulot</Text>
              <Select
                data={productOptions}
                placeholder="Mahsulotni tanlang"
                searchPlaceholder="Qidirish..."
                search={false}
                maxHeight={280}
                value={form.product_id}
                onChange={(v) => {
                  const selectedProduct = products.find((p) => p.id === v);
                  setForm((f) => ({
                    ...f,
                    product_id: v,
                    product_price: selectedProduct
                      ? String(selectedProduct.price)
                      : f.product_price,
                  }));
                }}
              />

              {/* ── Mahsulot narxi ── */}
              <Text style={styles.fieldLabel}>Mahsulot narxi</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                keyboardType="numeric"
                value={form.product_price}
                onChangeText={(v) =>
                  setForm((f) => ({ ...f, product_price: v }))
                }
              />

              {/* ── Miqdor ── */}
              <Text style={styles.fieldLabel}>Miqdor</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                keyboardType="numeric"
                value={form.product_count}
                onChangeText={(v) =>
                  setForm((f) => ({ ...f, product_count: v }))
                }
              />
              {/* ── Yetkazish narxi ── */}
              <Text style={styles.fieldLabel}>Yetkazish narxi</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                keyboardType="numeric"
                value={form.delivery_price}
                onChangeText={(v) =>
                  setForm((f) => ({ ...f, delivery_price: v }))
                }
              />

              {/* ── (Reyting) ── */}
              <Text style={[styles.fieldLabel, { marginBottom: 15 }]}>
                Reyting
              </Text>
              <Rating
                type="star"
                ratingCount={10}
                imageSize={32}
                showRating={false}
                ratingBackgroundColor="red"
                startingValue={Number(form.rate) || 0}
                style={{
                  marginRight: "auto",
                }}
                onFinishRating={(v: number) =>
                  setForm((f) => ({ ...f, rate: String(v) }))
                }
              />

              {/* ── Izoh ── */}
              <Text style={styles.fieldLabel}>Izoh</Text>
              <TextInput
                style={[styles.input, { minHeight: 80 }]}
                placeholder="Izoh yozing..."
                multiline
                value={form.note}
                onChangeText={(v) => setForm((f) => ({ ...f, note: v }))}
              />

              {/* ── Holat ── */}
              <Text style={styles.fieldLabel}>Holat</Text>
              <View style={styles.stateRow}>
                {(["new", "done", "cancel", "reschedule"] as const).map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => setForm((f) => ({ ...f, state: s }))}
                    style={[
                      styles.stateBtn,
                      form.state === s && styles.stateBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.stateBtnText,
                        form.state === s && styles.stateBtnTextActive,
                      ]}
                    >
                      {s === "new"
                        ? "Yangi"
                        : s === "done"
                          ? "Bajarildi"
                          : s === "cancel"
                            ? "Bekor"
                            : s === "reschedule"
                              ? "Boshqa partiyaga"
                              : ""}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View className="flex flex-row flex-1 gap-2 mt-3">
                <Pressable
                  style={[styles.discardBtn]}
                  onPress={handleClose}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.discardBtnText}>Bekor qilish</Text>
                  )}
                </Pressable>

                <Pressable
                  style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveBtnText}>Saqlash</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={addCustomerModal}
        animationType="slide"
        transparent
        onRequestClose={() => setAddCustomerModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View style={styles.fullSheet}>
            <View style={styles.fullSheetHeader}>
              <Text style={styles.sheetTitle}>Yangi mijoz qo'shish</Text>
              <Pressable onPress={() => setAddCustomerModal(false)}>
                <MaterialIcons name="close" size={24} color="#6b7280" />
              </Pressable>
            </View>
            <CustomerForm
              onSuccess={handleCustomerCreated}
              onCancel={() => setAddCustomerModal(false)}
              hideOrders={true}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

export default OrderDetail;

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { padding: 12, paddingBottom: 32 },

  orderName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 4 },
  infoItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  infoText: { fontSize: 15, color: "#6b7280" },
  phoneText: { fontSize: 15, color: "#6b7280" },
  bold: { fontWeight: "700", color: "#111827" },

  sectionHeader: { marginBottom: 8 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  lineIndex: { fontSize: 13, fontWeight: "600", color: "#6b7280" },
  stateBadge: {
    fontSize: 11,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
  },
  stateNew: { backgroundColor: "#dbeafe", color: "#1d4ed8" },
  stateDone: { backgroundColor: "#dcfce7", color: "#15803d" },
  stateCancel: { backgroundColor: "#fee2e2", color: "#b91c1c" },
  stateReschedule: { backgroundColor: "#f97316", color: "#fff" },

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

  // Order line modal
  backdrop: { backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "90%",
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: "#d1d5db",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },

  // customer select row
  selectRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  addCustomerBtn: {
    backgroundColor: "#6366f1",
    borderRadius: 10,
    width: 46,
    height: 46,
    justifyContent: "center",
    alignItems: "center",
  },
  selectedHint: { fontSize: 12, color: "#10b981", marginTop: 4, marginLeft: 2 },
  borderTop: {
    borderTopColor: "#999999",
    borderTopWidth: 1,
    borderStyle: "dashed",
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
    marginBottom: 4,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#fff",
  },
  stateRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  stateBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  stateBtnActive: { backgroundColor: "#6366f1", borderColor: "#6366f1" },
  stateBtnText: {
    fontSize: 13,
    color: "#374151",
  },
  stateBtnTextActive: { color: "#fff", fontWeight: "600" },
  saveBtn: {
    backgroundColor: "#6366f1",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    flexGrow: 1,
  },
  discardBtn: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    flexGrow: 1,
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  discardBtnText: { color: "#777", fontSize: 16, fontWeight: "700" },

  // Add customer full modal
  fullSheet: {
    flex: 1,
    backgroundColor: "#fff",
    marginTop: 60,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  fullSheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
});
