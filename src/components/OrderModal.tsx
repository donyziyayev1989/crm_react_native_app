import { auth } from "@/firebase/firebase";
import { Customer, Order, WithId } from "@/interfaces";
import { useRefData } from "@/providers/ReferenceData";
import db from "@/services/database";
import { digitsOnly, phonesMatch } from "@/utils/phone";
import { districtsOfRegion, findDistrictName, findRegion } from "@/utils/regions";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import PhoneInput from "./PhoneInput";
import RegionDistrictSelect from "./RegionDistrictSelect";
import Select from "./Select";

/**
 * OrderModal (Buyurtma qo'shish va tahrirlash)
 * Bu modal orqali mijoz buyurtmalari (Order) yaratiladi va tahrirlanadi.
 */

const emptyForm = {
  lotId: "",
  customer_id: "",
  customer_phone: "",
  customer_name: "",
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
  initialCustomer?: (Customer & { id: string }) | null;
}

const OrderModal: React.FC<OrderModalProps> = ({
  visible,
  onClose,
  lotId,
  editLine,
  onSuccess,
  initialCustomer,
}) => {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filteredCustomers, setFilteredCustomers] = useState<WithId<Customer>[]>(
    [],
  );
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Reference ma'lumotlar ilova darajasidagi provider'dan (modal 6 joyda mount qilinadi)
  const { customers, products, regions, districts, lots } = useRefData();

  const selectCustomer = useCallback(
    (customer: WithId<Customer>) => {
      // Bazadagi nomni ro'yxatdagi rasmiy yozuvga keltiramiz
      const reg = findRegion(regions, customer.region_name);
      const regName = reg?.name ?? customer.region_name ?? "";
      const distName = reg
        ? findDistrictName(
            districtsOfRegion(districts, reg.id),
            customer.district_name,
          )
        : (customer.district_name ?? "");

      setForm((f) => ({
        ...f,
        customer_id: customer.id,
        customer_phone: customer.phone,
        customer_name: customer.name,
        region_name: regName || f.region_name,
        district_name: distName,
      }));
      setShowSuggestions(false);
    },
    [regions, districts],
  );

  const handlePhoneChange = useCallback(
    (phone: string) => {
      if (digitsOnly(phone).length >= 9) {
        const found = customers.find((c) => phonesMatch(c.phone, phone));
        if (found) {
          selectCustomer(found);
          return;
        }
      }

      // If not found or phone too short, just update phone and clear ID
      setForm((f: typeof emptyForm) => ({
        ...f,
        customer_phone: phone,
        customer_id: "",
      }));
    },
    [customers, selectCustomer],
  );

  const handleNameChange = useCallback(
    (val: string) => {
      setForm((f) => ({ ...f, customer_name: val }));
      if (val.trim().length >= 2) {
        const filtered = customers.filter((c) =>
          c.name.toLowerCase().includes(val.toLowerCase()),
        );
        setFilteredCustomers(filtered);
        setShowSuggestions(filtered.length > 0);
      } else {
        setShowSuggestions(false);
      }
    },
    [customers],
  );

  // Modal har ochilganda form faqat BIR marta to'ldiriladi. Aks holda customers/
  // regions snapshot'lari effektni qayta ishga tushirib, yozilgan ma'lumotni o'chiradi.
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!visible) initializedRef.current = false;
  }, [visible]);

  useEffect(() => {
    // Wait for both regions and customers to be loaded for a proper edit initializing
    if (
      !visible ||
      initializedRef.current ||
      regions.length === 0 ||
      (editLine && customers.length === 0)
    )
      return;
    initializedRef.current = true;

    // Bazadagi region nomini ro'yxatdagi rasmiy yozuvga keltirish
    const officialRegion = (name?: string) =>
      findRegion(regions, name)?.name ?? name ?? "";

    if (editLine) {
      const customer = customers.find((c) => c.id === editLine.customer_id);
      setForm({
        lotId: editLine.lotId || "",
        customer_id: editLine.customer_id,
        customer_phone: customer?.phone || "",
        customer_name: customer?.name || "",
        region_name: officialRegion(editLine.region_name),
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
      setForm({
        ...emptyForm,
        lotId: lotId || "",
        customer_id: initialCustomer.id || "",
        customer_phone: initialCustomer.phone || "",
        customer_name: initialCustomer.name || "",
        region_name: officialRegion(initialCustomer.region_name),
        district_name: initialCustomer.district_name || "",
      });
    } else {
      setForm({ ...emptyForm, lotId: lotId || "" });
    }
  }, [editLine, visible, initialCustomer, lotId, regions, customers]);

  const productOptions = useMemo(
    () => products.map((p) => ({ label: p.name, value: p.id })),
    [products],
  );
  const lotOptions = useMemo(
    () => lots.map((o) => ({ label: o.name, value: o.id })),
    [lots],
  );

  const handleSave = async () => {
    const targetLotId = lotId || form.lotId;
    if (
      !form.customer_phone ||
      !form.customer_name ||
      !form.product_id ||
      !form.product_count
    ) {
      Alert.alert(
        "Xato",
        "Mijoz telefoni, ismi, mahsulot va miqdor to'ldirilishi shart",
      );
      return;
    }
    setSaving(true);
    try {
      let finalCustomerId = form.customer_id;

      // If customer doesn't exist, create it
      if (!finalCustomerId) {
        const newCustomer: Omit<Customer, "id"> = {
          name: form.customer_name,
          phone: form.customer_phone,
          region_name: form.region_name || "",
          district_name: form.district_name || "",
          user_id: auth.currentUser?.uid || "",
          tag_ids: [],
          note: "",
          rates: 0,
          order_ids: [],
        };
        finalCustomerId = await db.customers.create(newCustomer);
      } else {
        // If customer exists but is missing region/district, update it
        const existing = customers.find((c) => c.id === finalCustomerId);
        if (existing) {
          const updates: Partial<Customer> = {};
          if (!existing.region_name && form.region_name) {
            updates.region_name = form.region_name;
          }
          if (!existing.district_name && form.district_name) {
            updates.district_name = form.district_name;
          }

          if (Object.keys(updates).length > 0) {
            await db.customers.update(finalCustomerId, updates);
          }
        }
      }

      const orderData: Omit<Order, "id"> = {
        lotId: targetLotId,
        customer_id: finalCustomerId,
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
    } catch {
      Alert.alert("Xato", "Saqlashda xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setForm(emptyForm);
    onClose();
  };

  return (
    <>
      <CustomModal
        visible={visible}
        onClose={handleClose}
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

          {/* ── Mijoz ma'lumotlari ── */}
          {!initialCustomer && (
            <>
              <Text style={styles.fieldLabel}>Mijoz Telefon raqami</Text>
              <PhoneInput
                name="customer_phone"
                value={form.customer_phone}
                onChange={handlePhoneChange}
              />

              <Text style={styles.fieldLabel}>Mijoz ismi</Text>
              <View style={{ zIndex: 999 }}>
                <TextInput
                  style={styles.input}
                  placeholder="Mijoz ismini kiriting"
                  value={form.customer_name}
                  onChangeText={handleNameChange}
                  onBlur={() =>
                    setTimeout(() => setShowSuggestions(false), 200)
                  }
                />
                {showSuggestions && (
                  <View style={styles.suggestionsContainer}>
                    <ScrollView
                      keyboardShouldPersistTaps="always"
                      style={{ maxHeight: 200 }}
                    >
                      {filteredCustomers.map((c) => (
                        <Pressable
                          key={c.id}
                          style={styles.suggestionItem}
                          onPress={() => selectCustomer(c)}
                        >
                          <Text style={styles.suggestionName}>{c.name}</Text>
                          <Text style={styles.suggestionPhone}>{c.phone}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              <RegionDistrictSelect
                regionName={form.region_name}
                districtName={form.district_name}
                isInModal
                search={false}
                labelStyle={styles.fieldLabel}
                onChange={(v) => setForm((f) => ({ ...f, ...v }))}
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

          <View
            style={{ flexDirection: "row", flex: 1, gap: 8, marginTop: 12 }}
          >
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

      {/* Modal removed as we now use inline inputs */}
    </>
  );
};

export default OrderModal;

const styles = StyleSheet.create({
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
  suggestionsContainer: {
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 1000,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  suggestionName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  suggestionPhone: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
});
