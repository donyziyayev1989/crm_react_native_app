import Card from "@/components/Card";
import SimpleCrudScreen from "@/components/SimpleCrudScreen";
import { Tag, WithId } from "@/interfaces";
import { useRefData } from "@/providers/ReferenceData";
import db from "@/services/database";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type TagFormValues = { name: string };
const emptyForm: TagFormValues = { name: "" };

export default function TagsScreen() {
  const router = useRouter();
  const { tags, loading } = useRefData();

  return (
    <SimpleCrudScreen<WithId<Tag>, TagFormValues>
      title="Teglar"
      items={tags}
      loading={loading}
      emptyForm={emptyForm}
      fields={[
        {
          name: "name",
          placeholder: "Teg nomi",
          required: true,
          requiredMessage: "Teg nomi majburiy",
        },
      ]}
      toForm={(t) => ({ name: t.name })}
      fromForm={(v) => ({ name: v.name })}
      collection={db.tags}
      modalTitle={(e) => (e ? "Tegni tahrirlash" : "Yangi teg")}
      deleteMessage="Haqiqatdan ham bu tegni o'chirmoqchimisiz?"
      ListEmptyComponent={
        <View style={styles.empty}>
          <MaterialIcons name="label-off" size={56} color="#d1d5db" />
          <Text style={styles.emptyText}>Hech qanday teg mavjud emas</Text>
          <Text style={styles.emptySubText}>
            Yangi teg qo'shish uchun + tugmasini bosing
          </Text>
        </View>
      }
      renderItem={(item, { edit, remove }) => (
        <Card className="mb-3" style={styles.boxShadow}>
          <View className="flex-row justify-between items-center">
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/customers/search_results",
                  params: { tagId: item.id, tagName: item.name },
                })
              }
              className="flex-row items-center flex-1 gap-3 py-1"
            >
              <View style={styles.tagBadge}>
                <MaterialIcons name="label" size={18} color="#6366f1" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-gray-800">{item.name}</Text>
                <Text className="text-xs text-indigo-500 mt-0.5">Mijozlarni ko'rish →</Text>
              </View>
            </Pressable>
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
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    gap: 8,
  },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#6b7280", marginTop: 8 },
  emptySubText: { fontSize: 13, color: "#9ca3af", textAlign: "center" },
  tagBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#eef2ff",
    justifyContent: "center",
    alignItems: "center",
  },
  boxShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
});
