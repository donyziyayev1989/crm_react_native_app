import { LostProduct, ProductLot, WithId } from "@/interfaces";
import db from "@/services/database";
import { recalcLostTotal } from "@/services/lotStats";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { lotListStyles as styles } from "./LotExpenseList";

interface Props {
  lotId: string;
  lot: WithId<ProductLot> | null;
  items: WithId<LostProduct>[];
  onAdd: () => void;
  onEdit: (item: WithId<LostProduct>) => void;
}

/** Yo'qotilgan tovarlar ro'yxati (lots/[lotId] "Yo'qotilgan" tabi) */
const LotLostList = ({ lotId, lot, items, onAdd, onEdit }: Props) => {
  const confirmDelete = (id: string) =>
    Alert.alert("O'chirish", "O'chirilsinmi?", [
      { text: "Yo'q" },
      {
        text: "Ha",
        onPress: async () => {
          try {
            await db.lost_products.delete(id);
            await recalcLostTotal(lotId);
          } catch {
            Alert.alert("Xato", "O'chirishda xatolik yuz berdi");
          }
        },
      },
    ]);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 12 }}>
      <View style={[styles.summary, { borderColor: "#ef4444" }]}>
        <Text style={styles.summaryLabel}>Jami yo'qotilgan:</Text>
        <Text style={[styles.summaryValue, { color: "#ef4444" }]}>
          {lot?.lost_products || 0} dona
        </Text>
      </View>

      <Pressable style={[styles.btn, { backgroundColor: "#ef4444" }]} onPress={onAdd}>
        <MaterialIcons name="remove-circle" size={20} color="#fff" />
        <Text style={styles.btnText}>Yo'qotilgan qo'shish</Text>
      </Pressable>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="remove-shopping-cart" size={40} color="#d1d5db" />
          <Text style={styles.emptyText}>Hozircha yo'qotishlar yo'q</Text>
        </View>
      ) : (
        items.map((ls) => (
          <View key={ls.id} style={styles.item}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{ls.count} dona</Text>
              <Text style={styles.itemDetail}>{ls.date}</Text>
            </View>
            <View style={styles.actions}>
              <Pressable onPress={() => onEdit(ls)}>
                <MaterialIcons name="edit" size={18} color="#6366f1" />
              </Pressable>
              <Pressable onPress={() => confirmDelete(ls.id)}>
                <MaterialIcons name="delete" size={18} color="#ef4444" />
              </Pressable>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
};

export default LotLostList;
