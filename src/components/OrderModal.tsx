import { auth } from "@/firebase/firebase";
import {
  Customer,
  District,
  Order,
  Product,
  ProductLot,
  Region,
} from "@/interfaces";
import db, { orderBy, where } from "@/services/database";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Rating } from "react-native-ratings";
import CustomModal from "./CustomModal";
import CustomerForm from "./CustomerForm";
import Select from "./Select";

/**
 * OrderModal (Buyurtma qo'shish va tahrirlash)
 * Bu modal orqali mijoz buyurtmalari (Order) yaratiladi va tahrirlanadi.
 */

const emptyForm = {
  lotId: "",
  customer_id: "",
  region_name: "",
  district_name: "",
  product_id: "",
  product_count: "",
  product_price: "",
  rate: "",
  state: "new",
  delivery_price: "",
  note: "",
};

interface OrderModalProps {
  visible: boolean;
  onClose: () => void;
  lotId?: string; // Bu amalda lotId (Partiya IDsi)
  editLine?: (Order & { id: string }) | null;
  onSuccess?: (order: Order & { id: string }, isEdit: boolean) => void;
  onCustomerAdded?: (customer: Customer & { id: string }) => void;
  initialCustomer?: (Customer & { id: string }) | null;
}

const OrderModal: React.FC<OrderModalProps> = ({
  visible,
  onClose,
  lotId,
  editLine,
  onSuccess,
  onCustomerAdded,
  initialCustomer,
}) => {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [addCustomerModal, setAddCustomerModal] = useState(false);

  const [customers, setCustomers] = useState<(Customer & { id: string })[]>([]);
  const [products, setProducts] = useState<(Product & { id: string })[]>([]);
  const [regions, setRegions] = useState<(Region & { id: string })[]>([]);
  const [districts, setDistricts] = useState<(District & { id: string })[]>([]);
  const [lots, setLots] = useState<(ProductLot & { id: string })[]>([]);

  const fetchDistrictsByRegionName = useCallback(
    async (regionName: string) => {
      if (!regionName) {
        setDistricts([]);
        return [];
      }
      const region = regions.find((r) => r.name.trim() === regionName.trim());
      if (region?.id) {
        const ds = (await db.districts.list(
          where("regionId", "==", region.id),
          orderBy("name", "asc"),
        )) as (District & { id: string })[];
        setDistricts(ds);
        return ds;
      }
      setDistricts([]);
      return [];
    },
    [regions],
  );

  const handleCustomerSelect = useCallback(
    async (customerId: string) => {
      const cust = customers.find((c) => c.id === customerId);
      if (!cust) {
        setForm((f) => ({ ...f, customer_id: customerId }));
        return;
      }

      // 1. Set Customer and Region first
      setForm((f) => ({
        ...f,
        customer_id: customerId,
        region_name: cust.region_name || f.region_name,
        district_name: "", // Reset district while loading new options
      }));

      // 2. Fetch and Wait for districts to be in state
      if (cust.region_name) {
        await fetchDistrictsByRegionName(cust.region_name);

        // 3. Now set the district (the Select component will now find it in its data)
        setForm((f) => ({
          ...f,
          district_name: cust.district_name || "",
        }));
      }
    },
    [customers, fetchDistrictsByRegionName],
  );

  useEffect(() => {
    if (visible) {
      const fetchData = async () => {
        try {
          const [customersData, productsData, regionsData, lotsData] =
            await Promise.all([
              db.customers.list(),
              db.products.list(),
              db.regions.list(),
              db.lots.list(orderBy("date", "desc")),
            ]);
          setCustomers(customersData as (Customer & { id: string })[]);
          setProducts(productsData as (Product & { id: string })[]);
          setRegions(regionsData as (Region & { id: string })[]);
          setLots(lotsData as (ProductLot & { id: string })[]);
        } catch (e) {
          console.error(e);
        }
      };
      fetchData();
    }
  }, [visible]);

  useEffect(() => {
    const init = async () => {
      if (!visible || regions.length === 0) return;

      if (editLine) {
        if (editLine.region_name) {
          await fetchDistrictsByRegionName(editLine.region_name);
        }
        setForm({
          lotId: editLine.lotId || "",
          customer_id: editLine.customer_id,
          region_name: editLine.region_name || "",
          district_name: editLine.district_name || "",
          product_id: editLine.product_id,
          product_count: String(editLine.product_count),
          product_price: String(editLine.product_price),
          rate: String(editLine.rate),
          state: editLine.state,
          delivery_price: String(editLine.delivery_price),
          note: editLine.note || "",
        });
      } else if (initialCustomer) {
        if (initialCustomer.region_name) {
          await fetchDistrictsByRegionName(initialCustomer.region_name);
        }
        setForm({
          ...emptyForm,
          lotId: lotId || "",
          customer_id: initialCustomer.id || "",
          region_name: initialCustomer.region_name || "",
          district_name: initialCustomer.district_name || "",
        });
      } else {
        setForm({ ...emptyForm, lotId: lotId || "" });
      }
    };
    init();
  }, [
    editLine,
    visible,
    initialCustomer,
    lotId,
    regions.length,
    fetchDistrictsByRegionName,
  ]);

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
    () => regions.map((r) => ({ label: r.name, value: r.name })),
    [regions],
  );
  const districtOptions = useMemo(
    () => districts.map((d) => ({ label: d.name, value: d.name })),
    [districts],
  );
  const lotOptions = useMemo(
    () => lots.map((o) => ({ label: o.name, value: o.id! })),
    [lots],
  );

  const handleSave = async () => {
    const targetLotId = lotId || form.lotId;
    if (!form.customer_id || !form.product_id || !form.product_count) {
      Alert.alert("Xato", "Mijoz, mahsulot va miqdor to'ldirilishi shart");
      return;
    }
    setSaving(true);
    try {
      const orderData: Omit<Order, "id"> = {
        lotId: targetLotId,
        customer_id: form.customer_id,
        region_name: form.region_name || "",
        district_name: form.district_name || "",
        product_id: form.product_id,
        product_count: Number(form.product_count),
        product_price: Number(form.product_price) || 0,
        rate: Number(form.rate) || 0,
        state: form.state || "new",
        delivery_price: Number(form.delivery_price) || 0,
        date: editLine?.date ?? new Date().toISOString(),
        user_id: editLine?.user_id || auth.currentUser?.uid || "",
        note: form.note || "",
      };

      let returnedId = "";
      if (editLine) {
        await db.orders.update(editLine.id, orderData);
        returnedId = editLine.id;
      } else {
        const newId = await db.orders.create(orderData);
        returnedId = newId;
      }

      setForm(emptyForm);
      if (onSuccess) {
        onSuccess(
          { id: returnedId, ...orderData } as Order & { id: string },
          !!editLine,
        );
      }
      onClose();
    } catch (e) {
      Alert.alert("Xato", "Saqlashda xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setForm(emptyForm);
    onClose();
  };

  const handleCustomerCreated = async (
    customerId: string,
    customerData: Customer,
  ) => {
    const newCustomer = { id: customerId, ...customerData };
    setCustomers((prev) => [...prev, newCustomer]);
    setForm((f) => ({
      ...f,
      customer_id: customerId,
      region_name: customerData.region_name || f.region_name,
      district_name: "", // Reset temporarily
    }));

    if (customerData.region_name) {
      await fetchDistrictsByRegionName(customerData.region_name);
      setForm((f) => ({
        ...f,
        district_name: customerData.district_name || f.district_name,
      }));
    }
    setAddCustomerModal(false);
    if (onCustomerAdded) {
      onCustomerAdded(newCustomer);
    }
  };

  return (
    <>
      <CustomModal
        visible={visible}
        onClose={handleClose}
        contentContainerStyle={{ justifyContent: "flex-end" }}
        modalTitle={editLine ? "Buyurtmani tahrirlash" : "Yangi buyurtma"}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Partiyani tanlash (agar lotId kelmasa) ── */}
          {!lotId && (
            <>
              <Text style={styles.fieldLabel}>Partiya (Lot)</Text>
              <Select
                data={lotOptions}
                placeholder="Partiyani tanlang"
                searchPlaceholder="Qidirish..."
                search={true}
                maxHeight={280}
                value={form.lotId || null}
                isInModal={true}
                onChange={(v) => setForm((f) => ({ ...f, lotId: v }))}
              />
            </>
          )}

          {/* ── Mijoz va Viloyat (agar initialCustomer berilmasa ko'rinadi) ── */}
          {!initialCustomer && (
            <>
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
                    isInModal={true}
                    onChange={handleCustomerSelect}
                  />
                </View>
                <Pressable
                  style={styles.addCustomerBtn}
                  onPress={() => setAddCustomerModal(true)}
                >
                  <MaterialIcons name="person-add" size={20} color="#fff" />
                </Pressable>
              </View>

              <Text style={styles.fieldLabel}>Viloyat</Text>
              <Select
                data={regionOptions}
                placeholder="Viloyatni tanlang"
                searchPlaceholder="Qidirish..."
                search={false}
                maxHeight={280}
                value={form.region_name || null}
                isInModal={true}
                onChange={async (v) => {
                  setForm((f) => ({ ...f, region_name: v, district_name: "" }));
                  // Fetch districts for selected region
                  await fetchDistrictsByRegionName(v);
                }}
              />

              <Text style={styles.fieldLabel}>Tuman</Text>
              <Select
                data={districtOptions}
                placeholder="Tumanni tanlang"
                searchPlaceholder="Qidirish..."
                search={false}
                maxHeight={280}
                value={form.district_name || null}
                isInModal={true}
                onChange={(v) => setForm((f) => ({ ...f, district_name: v }))}
              />
            </>
          )}

          {/* ── Mahsulot ── */}
          <Text style={styles.fieldLabel}>Mahsulot</Text>
          <Select
            data={productOptions}
            placeholder="Mahsulotni tanlang"
            searchPlaceholder="Qidirish..."
            search={false}
            maxHeight={280}
            value={form.product_id}
            isInModal={true}
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
            onChangeText={(v) => setForm((f) => ({ ...f, product_price: v }))}
          />

          {/* ── Miqdor ── */}
          <Text style={styles.fieldLabel}>Miqdor</Text>
          <TextInput
            style={styles.input}
            placeholder="0"
            keyboardType="numeric"
            value={form.product_count}
            onChangeText={(v) => setForm((f) => ({ ...f, product_count: v }))}
          />
          {/* ── Yetkazish narxi ── */}
          <Text style={styles.fieldLabel}>Yetkazish narxi</Text>
          <TextInput
            style={styles.input}
            placeholder="0"
            keyboardType="numeric"
            value={form.delivery_price}
            onChangeText={(v) => setForm((f) => ({ ...f, delivery_price: v }))}
          />

          {/* ── (Reyting) ── */}
          <Text style={[styles.fieldLabel, { marginBottom: 15 }]}>Reyting</Text>
          <Rating
            type="star"
            ratingCount={10}
            imageSize={32}
            showRating={false}
            startingValue={Number(form.rate) || 0}
            style={{ marginRight: "auto" }}
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
              style={styles.discardBtn}
              onPress={handleClose}
              disabled={saving}
            >
              <Text style={styles.discardBtnText}>Bekor qilish</Text>
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
      </CustomModal>

      {/* Customer Modal inside the Order Modal */}
      {!initialCustomer && (
        <CustomModal
          visible={addCustomerModal}
          onClose={() => setAddCustomerModal(false)}
          showBackdrop={false}
          showHandle={false}
          sheetStyle={styles.fullSheet}
          modalTitle="Yangi mijoz qo'shish"
        >
          <CustomerForm
            onSuccess={handleCustomerCreated}
            onCancel={() => setAddCustomerModal(true)}
            hideOrders={true}
            isInModal={true}
          />
        </CustomModal>
      )}
    </>
  );
};

export default OrderModal;

const styles = StyleSheet.create({
  selectRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  addCustomerBtn: {
    backgroundColor: "#6366f1",
    borderRadius: 10,
    width: 46,
    height: 46,
    justifyContent: "center",
    alignItems: "center",
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
  stateBtnText: { fontSize: 13, color: "#374151" },
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
  fullSheet: {
    flex: 1,
    backgroundColor: "#fff",
    marginTop: 60,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
});
