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
import PhoneInput from "./PhoneInput";
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
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);

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
      const region = regions.find(
        (r: Region) =>
          r.name.trim().toLowerCase() === regionName.trim().toLowerCase(),
      );
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

  const handlePhoneChange = useCallback(
    async (phone: string) => {
      // Normalizing phone (get last 9 digits for Uzbekistan matching)
      const digitsOnly = phone.replace(/\D/g, "");

      if (digitsOnly.length >= 9) {
        const last9Digits = digitsOnly.slice(-9);
        const found = customers.find((c: Customer & { id: string }) => {
          const cDigits = c.phone.replace(/\D/g, "");
          return cDigits.slice(-9) === last9Digits;
        });

        if (found) {
          let regId = "";
          if (found.region_name) {
            const reg = regions.find(
              (r) =>
                r.name.trim().toLowerCase() ===
                found.region_name.trim().toLowerCase(),
            );
            if (reg) {
              regId = reg.id!;
              setSelectedRegionId(regId);
              await fetchDistrictsByRegionName(reg.name);
            }
          }

          setForm((f: typeof emptyForm) => ({
            ...f,
            customer_phone: phone,
            customer_id: found.id!,
            customer_name: found.name,
            region_name: found.region_name || f.region_name,
            district_name: found.district_name || "",
          }));
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
    [customers, fetchDistrictsByRegionName, regions],
  );

  useEffect(() => {
    if (!visible) return;

    const unsubCustomers = db.customers.watch((data) => {
      setCustomers(data as (Customer & { id: string })[]);
    });

    const unsubProducts = db.products.watch((data) => {
      setProducts(data as (Product & { id: string })[]);
    });

    const unsubRegions = db.regions.watch((data) => {
      setRegions(data as (Region & { id: string })[]);
    });

    const unsubLots = db.lots.watch(
      (data) => {
        setLots(data as (ProductLot & { id: string })[]);
      },
      orderBy("date", "desc"),
    );

    return () => {
      unsubCustomers();
      unsubProducts();
      unsubRegions();
      unsubLots();
    };
  }, [visible]);

  useEffect(() => {
    const init = async () => {
      // Wait for both regions and customers to be loaded for a proper edit initializing
      if (
        !visible ||
        regions.length === 0 ||
        (editLine && customers.length === 0)
      )
        return;

      if (editLine) {
        if (editLine.region_name) {
          const reg = regions.find(
            (r) =>
              r.name.trim().toLowerCase() ===
              editLine.region_name!.trim().toLowerCase(),
          );
          if (reg) {
            setSelectedRegionId(reg.id!);
            await fetchDistrictsByRegionName(reg.name);
          }
        }

        const customer = customers.find(
          (c: Customer & { id: string }) => c.id === editLine.customer_id,
        );

        setForm({
          lotId: editLine.lotId || "",
          customer_id: editLine.customer_id,
          customer_phone: customer?.phone || "",
          customer_name: customer?.name || "",
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
          const reg = regions.find(
            (r) =>
              r.name.trim().toLowerCase() ===
              initialCustomer.region_name.trim().toLowerCase(),
          );
          if (reg) {
            setSelectedRegionId(reg.id!);
            await fetchDistrictsByRegionName(reg.name);
          }
        }
        setForm({
          ...emptyForm,
          lotId: lotId || "",
          customer_id: initialCustomer.id || "",
          customer_phone: initialCustomer.phone || "",
          customer_name: initialCustomer.name || "",
          region_name: initialCustomer.region_name || "",
          district_name: initialCustomer.district_name || "",
        });
      } else {
        setForm({ ...emptyForm, lotId: lotId || "" });
        setSelectedRegionId(null);
      }
    };
    init();
  }, [
    editLine,
    visible,
    initialCustomer,
    lotId,
    regions,
    customers,
    fetchDistrictsByRegionName,
  ]);

  const productOptions = useMemo(
    () => products.map((p: Product) => ({ label: p.name, value: p.id! })),
    [products],
  );
  const regionOptions = useMemo(
    () => regions.map((r: Region) => ({ label: r.name, value: r.id! })),
    [regions],
  );
  const districtOptions = useMemo(
    () => districts.map((d: District) => ({ label: d.name, value: d.name })),
    [districts],
  );
  const lotOptions = useMemo(
    () => lots.map((o: ProductLot) => ({ label: o.name, value: o.id! })),
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
        // Refresh local customers list if needed, or it will be refreshed on next mount
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
              <TextInput
                style={styles.input}
                placeholder="Mijoz ismini kiriting"
                value={form.customer_name}
                onChangeText={(v: string) =>
                  setForm((f: typeof emptyForm) => ({ ...f, customer_name: v }))
                }
              />

              <Text style={styles.fieldLabel}>Viloyat</Text>
              <Select
                data={regionOptions}
                placeholder="Viloyatni tanlang"
                searchPlaceholder="Qidirish..."
                search={false}
                maxHeight={280}
                value={selectedRegionId}
                isInModal={true}
                onChange={async (v: string) => {
                  const regName =
                    regions.find((r) => r.id === v)?.name || v;
                  setSelectedRegionId(v);
                  setForm((f: typeof emptyForm) => ({
                    ...f,
                    region_name: regName,
                    district_name: "",
                  }));
                  // Fetch districts for selected region
                  await fetchDistrictsByRegionName(regName);
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
                onChange={(v: string) =>
                  setForm((f: typeof emptyForm) => ({ ...f, district_name: v }))
                }
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
});
