import { LotExpense, ProductLot } from "@/interfaces";
import db from "@/services/database";
import { formatSum } from "@/utils/format";
import React, { useEffect, useState } from "react";
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

interface LotExpenseModalProps {
  visible: boolean;
  onClose: () => void;
  lotId: string;
  lot: (ProductLot & { id: string }) | null;
  onSuccess?: (newExpense: LotExpense) => void;
  editExpense?: LotExpense | null;
}

const LotExpenseModal = ({
  visible,
  onClose,
  lotId,
  lot,
  onSuccess,
  editExpense,
}: LotExpenseModalProps) => {
  const [name, setName] = useState("");
  const [count, setCount] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editExpense) {
      setName(editExpense.name);
      setCount(String(editExpense.count));
      setPricePerUnit(String(editExpense.price_per_unit));
    } else {
      setName("");
      setCount("");
      setPricePerUnit("");
    }
  }, [editExpense, visible]);

  const handleSave = async () => {
    if (!name.trim() || !count || !pricePerUnit) {
      Alert.alert("Xato", "Barcha maydonlarni to'ldiring");
      return;
    }

    setSaving(true);
    const numCount = Number(count);
    const numPrice = Number(pricePerUnit);
    const totalPrice = numCount * numPrice;

    const expenseData: Omit<LotExpense, "id"> = {
      lotId,
      name: name.trim(),
      count: numCount,
      price_per_unit: numPrice,
      total_price: totalPrice,
      date: new Date().toISOString(),
      timestamp: Date.now(),
    };

    try {
      if (editExpense?.id) {
        await db.lot_expenses.update(editExpense.id, expenseData);
        if (onSuccess) onSuccess({ id: editExpense.id, ...expenseData });
      } else {
        const id = await db.lot_expenses.create(expenseData);
        if (onSuccess) onSuccess({ id, ...expenseData });
      }
      onClose();
    } catch (e) {
      console.error(e);
      Alert.alert("Xato", "Saqlashda xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <CustomModal
      visible={visible}
      onClose={onClose}
      modalTitle={editExpense ? "Xarajatni tahrirlash" : "Xarajat qo'shish"}
    >
      <ScrollView>
        <Text style={styles.label}>Xarajat nomi</Text>
        <TextInput
          style={styles.input}
          placeholder="Masalan: Logistika, Bojxona..."
          value={name}
          onChangeText={setName}
        />

        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Miqdori (kg/dona)</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              keyboardType="numeric"
              value={count}
              onChangeText={setCount}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Birlik narxi</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              keyboardType="numeric"
              value={pricePerUnit}
              onChangeText={setPricePerUnit}
            />
          </View>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Jami summa:</Text>
          <Text style={styles.totalValue}>
            {formatSum(Number(count) * Number(pricePerUnit))}
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Bekor qilish</Text>
          </Pressable>
          <Pressable
            style={[styles.saveBtn, saving && { opacity: 0.7 }]}
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
  );
};

export default LotExpenseModal;

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4b5563",
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  totalLabel: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
    marginBottom: 12,
  },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
  },
  cancelBtnText: {
    color: "#4b5563",
    fontWeight: "600",
  },
  saveBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#6366f1",
    alignItems: "center",
  },
  saveBtnText: {
    color: "#fff",
    fontWeight: "600",
  },
});
