import { LostProduct, ProductLot } from "@/interfaces";
import db, { where } from "@/services/database";
import React, { useState } from "react";
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

interface LostProductModalProps {
  visible: boolean;
  onClose: () => void;
  lotId: string;
  lot: (ProductLot & { id: string }) | null;
  editLost?: (LostProduct & { id: string }) | null;
  onSuccess?: (
    newLostProduct: LostProduct & { id: string },
    newTotal: number,
  ) => void;
}

const LostProductModal: React.FC<LostProductModalProps> = ({
  visible,
  onClose,
  lotId,
  lot,
  editLost,
  onSuccess,
}) => {
  const [lostForm, setLostForm] = React.useState({
    count: "",
    date: new Date().toISOString().split("T")[0],
  });
  const [savingLost, setSavingLost] = useState(false);

  React.useEffect(() => {
    if (visible) {
      if (editLost) {
        setLostForm({
          count: editLost.count.toString(),
          date: editLost.date,
        });
      } else {
        setLostForm({
          count: "",
          date: new Date().toISOString().split("T")[0],
        });
      }
    }
  }, [visible, editLost]);

  const handleSaveLostProduct = async () => {
    if (!lostForm.count || isNaN(Number(lostForm.count))) {
      Alert.alert("Xato", "To'g'ri miqdor kiriting");
      return;
    }
    setSavingLost(true);
    try {
      const countNum = Number(lostForm.count);

      let newId = editLost?.id || "";
      const data: Omit<LostProduct, "id"> = {
        lotId: lotId,
        count: countNum,
        date: lostForm.date,
        timestamp: editLost?.timestamp || Date.now(),
      };

      if (editLost) {
        await db.lost_products.update(editLost.id, data);
      } else {
        newId = await db.lost_products.create(data);
      }

      // Partiyadagi umumiy yo'qotishlarni qayta hisoblash
      // Bu yerda barcha yo'qotilganlarni qayta yig'ib chiqish aniqroq bo'ladi
      const allLost = await db.lost_products.list(where("lotId", "==", lotId));
      const newLostTotal = allLost.reduce(
        (sum, item) => sum + (item.count || 0),
        0,
      );

      await db.lots.update(lotId, {
        lost_products: newLostTotal,
      });

      if (onSuccess) {
        onSuccess({ id: newId, ...data }, newLostTotal);
      }
      onClose();
    } catch (e) {
      console.error(e);
      Alert.alert("Xato", "Saqlashda xatolik yuz berdi");
    } finally {
      setSavingLost(false);
    }
  };

  return (
    <CustomModal
      visible={visible}
      onClose={onClose}
      modalTitle={
        editLost
          ? "Yo'qotilgan tovarni tahrirlash"
          : "Yo'qotilgan tovar qo'shish"
      }
    >
      <View className="flex-row mb-3 items-center gap-2">
        <Text className="text-gray-600">Jami yo'qotishlar:</Text>
        <Text className="text-xl font-bold text-red-500">
          {lot?.lost_products || 0} dona
        </Text>
        <Text className="ms-2 text-gray-500">
          ({" "}
          {lot?.product_count
            ? (((lot.lost_products || 0) * 100) / lot.product_count).toFixed(1)
            : 0}{" "}
          % )
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.fieldLabel}>Miqdor</Text>
        <TextInput
          style={styles.input}
          placeholder="0"
          keyboardType="numeric"
          value={lostForm.count}
          onChangeText={(v) => setLostForm((f) => ({ ...f, count: v }))}
        />

        <Text style={styles.fieldLabel}>Sana (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          placeholder="2026-03-31"
          value={lostForm.date}
          onChangeText={(v) => setLostForm((f) => ({ ...f, date: v }))}
        />

        <View style={styles.btnRow}>
          <Pressable
            style={[styles.saveBtn, styles.cancelBtn]}
            onPress={onClose}
            disabled={savingLost}
          >
            <Text style={styles.cancelBtnText}>Bekor qilish</Text>
          </Pressable>

          <Pressable
            style={[styles.saveBtn, savingLost && { opacity: 0.6 }]}
            onPress={handleSaveLostProduct}
            disabled={savingLost}
          >
            {savingLost ? (
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

export default LostProductModal;

const styles = StyleSheet.create({
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4b5563",
    marginTop: 12,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#111827",
    backgroundColor: "#f9fafb",
  },
  btnRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  saveBtn: {
    backgroundColor: "#6366f1",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    flexGrow: 1,
  },
  cancelBtn: {
    backgroundColor: "#f3f4f6",
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  cancelBtnText: {
    color: "#4b5563",
    fontSize: 16,
    fontWeight: "600",
  },
});
