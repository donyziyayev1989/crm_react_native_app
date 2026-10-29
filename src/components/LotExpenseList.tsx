import { LotExpense, WithId } from "@/interfaces";
import db from "@/services/database";
import { formatSum } from "@/utils/format";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React, { useMemo } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

interface Props {
  expenses: WithId<LotExpense>[];
  onAdd: () => void;
  onEdit: (expense: WithId<LotExpense>) => void;
}

/** Partiya xarajatlari ro'yxati (lots/[lotId] "Xarajatlar" tabi) */
const LotExpenseList = ({ expenses, onAdd, onEdit }: Props) => {
  const total = useMemo(
    () => expenses.reduce((sum, e) => sum + (e.total_price || 0), 0),
    [expenses],
  );

  const confirmDelete = (id: string) =>
    Alert.alert("O'chirish", "O'chirilsinmi?", [
      { text: "Yo'q" },
      {
        text: "Ha",
        onPress: async () => {
          try {
            await db.lot_expenses.delete(id);
          } catch {
            Alert.alert("Xato", "O'chirishda xatolik yuz berdi");
          }
        },
      },
    ]);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 12 }}>
      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>Jami xarajat:</Text>
        <Text style={styles.summaryValue}>{formatSum(total)}</Text>
      </View>

      <Pressable style={[styles.btn, { backgroundColor: "#10b981" }]} onPress={onAdd}>
        <MaterialIcons name="add-circle" size={20} color="#fff" />
        <Text style={styles.btnText}>Xarajat qo'shish</Text>
      </Pressable>

      {expenses.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="payments" size={40} color="#d1d5db" />
          <Text style={styles.emptyText}>Hozircha xarajatlar yo'q</Text>
        </View>
      ) : (
        expenses.map((ex) => (
          <View key={ex.id} style={styles.item}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{ex.name}</Text>
              <Text style={styles.itemDetail}>
                {ex.count} ta x {formatSum(ex.price_per_unit)}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.itemTotal}>{formatSum(ex.total_price)}</Text>
              <View style={styles.actions}>
                <Pressable onPress={() => onEdit(ex)}>
                  <MaterialIcons name="edit" size={18} color="#6366f1" />
                </Pressable>
                <Pressable onPress={() => confirmDelete(ex.id)}>
                  <MaterialIcons name="delete" size={18} color="#ef4444" />
                </Pressable>
              </View>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
};

export default LotExpenseList;

/** LotLostList bilan umumiy stillar */
export const lotListStyles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#F2F2F2" },
  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText: { color: "#9ca3af", fontSize: 14 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  summary: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  summaryLabel: { fontSize: 14, color: "#6b7280", fontWeight: "500" },
  summaryValue: { fontSize: 18, fontWeight: "700", color: "#6366f1" },
  item: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  itemName: { fontSize: 16, fontWeight: "600", color: "#111827" },
  itemDetail: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  itemTotal: { fontSize: 15, fontWeight: "700", color: "#111827" },
  actions: { flexDirection: "row", gap: 12, marginTop: 4 },
});

const styles = lotListStyles;
