import Card from "@/components/Card";
import SimpleCrudScreen from "@/components/SimpleCrudScreen";
import { Product, WithId } from "@/interfaces";
import { useRefData } from "@/providers/ReferenceData";
import db from "@/services/database";
import { formatSum } from "@/utils/format";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type ProductFormValues = { name: string; price: string; description: string };
const emptyForm: ProductFormValues = { name: "", price: "", description: "" };

export default function ProductsScreen() {
  const { products, loading } = useRefData();

  return (
    <SimpleCrudScreen<WithId<Product>, ProductFormValues>
      title="Mahsulotlar"
      items={products}
      loading={loading}
      emptyForm={emptyForm}
      fields={[
        { name: "name", placeholder: "Nomi", required: true },
        { name: "price", placeholder: "Narxi", keyboardType: "numeric", required: true },
        { name: "description", placeholder: "Tavsif (ixtiyoriy)", multiline: true },
      ]}
      toForm={(p) => ({
        name: p.name,
        price: String(p.price),
        description: p.description || "",
      })}
      fromForm={(v, editing) => ({
        name: v.name,
        price: parseFloat(v.price),
        description: v.description,
        active: editing ? editing.active : true,
        updatedAt: new Date(),
        ...(editing ? {} : { createdAt: new Date() }),
      })}
      collection={db.products}
      modalTitle={(e) => (e ? "Tahrirlash" : "Yangi mahsulot")}
      deleteMessage="Haqiqatdan ham bu mahsulotni o'chirmoqchimisiz?"
      renderItem={(item, { edit, remove }) => (
        <Card className="mb-3" style={styles.boxShadow}>
          <View className="flex-row justify-between items-center">
            <View className="flex-1">
              <Text className="text-lg font-bold text-gray-800">{item.name}</Text>
              <Text className="text-gray-500">{item.description || "Tavsif yo'q"}</Text>
              <Text className="text-indigo-600 font-bold mt-1">{formatSum(item.price)}</Text>
            </View>
            <View className="flex-row gap-2">
              <Pressable onPress={edit} className="p-2 bg-blue-50 rounded-full">
                <MaterialIcons name="edit" size={20} color="#3b82f6" />
              </Pressable>
              <Pressable onPress={remove} className="p-2 bg-red-50 rounded-full">
                <MaterialIcons name="delete" size={20} color="#ef4444" />
              </Pressable>
            </View>
          </View>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  boxShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
});
