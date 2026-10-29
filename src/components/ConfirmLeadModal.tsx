import { Lead, WithId } from "@/interfaces";
import { useRefData } from "@/providers/ReferenceData";
import { confirmLead } from "@/services/database";
import { formatPhone } from "@/utils/format";
import {
  buildConfirmArgs,
  confirmErrorMessage,
  findCustomerMatches,
  leadItems,
} from "@/utils/leads";
import { phonesMatch } from "@/utils/phone";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
import CustomModal from "./CustomModal";
import Select from "./Select";

interface Props {
  visible: boolean;
  lead: WithId<Lead> | null;
  onClose: () => void;
}

const MAX_MATCHES = 5;

/**
 * Leadni tasdiqlash: mavjud mijozni tanlash yoki "Yangi mijoz", partiya, yetkazish narxi va
 * narxsiz mahsulotlar narxi → `crm.confirm_lead` (mijoz + buyurtmalar bitta tranzaksiyada).
 * Lead ro'yxati o'z watch'i orqali yangilanadi.
 */
const ConfirmLeadModal = ({ visible, lead, onClose }: Props) => {
  const router = useRouter();
  const { customers, customersById, lots } = useRefData();

  const [query, setQuery] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [lotId, setLotId] = useState("");
  const [deliveryPrice, setDeliveryPrice] = useState("");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Forma har ochilishda bir marta to'ldiriladi (customers yangilansa tanlov buzilmasin)
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!visible || !lead) {
      initializedRef.current = false;
      return;
    }
    if (initializedRef.current) return;
    initializedRef.current = true;
    // Telefon aynan bitta mijozga mos kelsa — oldindan tanlanadi
    const byPhone = lead.phone ? customers.filter((c) => phonesMatch(c.phone, lead.phone)) : [];
    setCustomerId(byPhone.length === 1 ? byPhone[0].id : null);
    setQuery("");
    setLotId("");
    setDeliveryPrice("");
    setPrices({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, lead]);

  const items = useMemo(() => (lead ? leadItems(lead) : []), [lead]);
  const unpriced = items.filter((i) => i.price == null);

  const lotOptions = useMemo(
    () =>
      [...lots]
        .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
        .map((l) => ({ label: l.name, value: l.id })),
    [lots],
  );

  const options = useMemo(() => {
    const matches = findCustomerMatches(customers, query).slice(0, MAX_MATCHES);
    const selected = customerId ? customersById[customerId] : undefined;
    return selected && !matches.some((c) => c.id === selected.id)
      ? [selected, ...matches]
      : matches;
  }, [customers, customersById, query, customerId]);

  const submit = async () => {
    if (!lead || saving) return;
    const built = buildConfirmArgs(lead, { customerId, lotId, deliveryPrice, prices });
    if (!built.ok) {
      Alert.alert("Xato", built.error);
      return;
    }
    setSaving(true);
    try {
      const res = await confirmLead(built.args);
      onClose();
      Alert.alert("Muvaffaqiyatli", "Mijoz va buyurtma yaratildi");
      const firstOrder = res.order_ids[0];
      if (firstOrder) {
        router.push({ pathname: "/orders/[orderId]", params: { orderId: firstOrder } });
      }
    } catch (err) {
      Alert.alert("Xato", confirmErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const optionRow = (key: string, selected: boolean, title: string, subtitle: string, onPress: () => void) => (
    <Pressable
      key={key}
      onPress={onPress}
      style={[styles.option, selected && styles.optionSelected]}
    >
      <MaterialIcons
        name={selected ? "radio-button-checked" : "radio-button-unchecked"}
        size={20}
        color={selected ? "#6366f1" : "#9ca3af"}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.optionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.optionSub}>{subtitle}</Text> : null}
      </View>
    </Pressable>
  );

  return (
    <CustomModal visible={visible} onClose={onClose} modalTitle="Murojaatni tasdiqlash">
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Mijoz</Text>
        {optionRow(
          "new",
          customerId === null,
          "Yangi mijoz",
          lead ? `${lead.name} · ${formatPhone(lead.phone)}` : "",
          () => setCustomerId(null),
        )}
        <TextInput
          style={[styles.input, { marginTop: 8 }]}
          placeholder="Mijozni qidirish (ism yoki telefon)"
          placeholderTextColor="#9ca3af"
          value={query}
          onChangeText={setQuery}
        />
        {options.map((c) =>
          optionRow(c.id, customerId === c.id, c.name, formatPhone(c.phone), () =>
            setCustomerId(c.id),
          ),
        )}

        <Text style={styles.label}>Partiya</Text>
        <Select
          data={lotOptions}
          placeholder="Partiyani tanlang"
          searchPlaceholder="Qidirish..."
          search
          maxHeight={280}
          value={lotId || null}
          isInModal
          onChange={(v) => setLotId(v ?? "")}
        />

        <Text style={styles.label}>Yetkazib berish narxi</Text>
        <TextInput
          style={styles.input}
          placeholder="0"
          placeholderTextColor="#9ca3af"
          keyboardType="numeric"
          value={deliveryPrice}
          onChangeText={setDeliveryPrice}
        />

        {unpriced.map((item) => (
          <View key={item.product_id}>
            <Text style={styles.label}>
              {item.name} × {item.quantity} — narxi
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Narxini kiriting"
              placeholderTextColor="#9ca3af"
              keyboardType="numeric"
              value={prices[item.product_id] ?? ""}
              onChangeText={(v) => setPrices((p) => ({ ...p, [item.product_id]: v }))}
            />
          </View>
        ))}

        <View style={styles.buttons}>
          <Pressable onPress={onClose} style={[styles.button, styles.cancel]}>
            <Text style={styles.cancelText}>Bekor qilish</Text>
          </Pressable>
          <Pressable
            onPress={submit}
            disabled={saving}
            style={[styles.button, styles.submit, saving && { opacity: 0.6 }]}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>Tasdiqlash</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </CustomModal>
  );
};

export default ConfirmLeadModal;

const styles = StyleSheet.create({
  label: {
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
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#f3f4f6",
    borderRadius: 10,
    marginTop: 6,
  },
  optionSelected: { borderColor: "#6366f1", backgroundColor: "#eef2ff" },
  optionTitle: { fontSize: 14, fontWeight: "600", color: "#111827" },
  optionSub: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  buttons: { flexDirection: "row", gap: 12, marginTop: 20, marginBottom: 12 },
  button: { flex: 1, padding: 16, borderRadius: 12, alignItems: "center" },
  cancel: { backgroundColor: "#f1f5f9" },
  cancelText: { fontWeight: "700", color: "#475569" },
  submit: { backgroundColor: "#6366f1" },
  submitText: { fontWeight: "700", color: "#fff" },
});
