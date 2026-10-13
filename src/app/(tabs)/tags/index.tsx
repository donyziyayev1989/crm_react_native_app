import Card from "@/components/Card";
import CustomModal from "@/components/CustomModal";
import { Tag } from "@/interfaces";
import db, { orderBy } from "@/services/database";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Link, Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type TagFormValues = {
  name: string;
};

export default function TagsScreen() {
  const router = useRouter();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);

  const { control, handleSubmit, reset, setValue } = useForm<TagFormValues>({
    defaultValues: {
      name: "",
    },
  });

  useEffect(() => {
    const unsubscribe = db.tags.watch(
      (data) => {
        setTags(data);
        setLoading(false);
      },
      orderBy("name", "asc"),
    );
    return () => unsubscribe();
  }, []);

  const handleEdit = (tag: Tag) => {
    setEditingTag(tag);
    setValue("name", tag.name);
    setModalVisible(true);
  };

  const onSubmit = async (values: TagFormValues) => {
    const tagData: Omit<Tag, "id"> = {
      name: values.name,
    };

    try {
      if (editingTag?.id) {
        await db.tags.update(editingTag.id, tagData);
      } else {
        await db.tags.create(tagData);
      }
      setModalVisible(false);
      reset();
      setEditingTag(null);
    } catch (e) {
      Alert.alert("Xato", "Saqlashda xatolik yuz berdi");
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      "O'chirish",
      "Haqiqatdan ham bu tegni o'chirmoqchimisiz?",
      [
        { text: "Yo'q", style: "cancel" },
        {
          text: "Ha",
          style: "destructive",
          onPress: async () => {
            try {
              await db.tags.delete(id);
            } catch (e) {
              Alert.alert("Xato", "O'chirishda xatolik yuz berdi");
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#6366f1" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Teglar",
          headerLeft: () => (
            <Link href="/" asChild>
              <Pressable className="p-3">
                <MaterialIcons name="arrow-back" size={24} color="#6b7280" />
              </Pressable>
            </Link>
          ),
        }}
      />

      {tags.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="label-off" size={56} color="#d1d5db" />
          <Text style={styles.emptyText}>Hech qanday teg mavjud emas</Text>
          <Text style={styles.emptySubText}>
            Yangi teg qo'shish uchun + tugmasini bosing
          </Text>
        </View>
      ) : (
        <FlatList
          data={tags}
          keyExtractor={(item) => item.id!}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
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
                    <Text className="text-base font-semibold text-gray-800">
                      {item.name}
                    </Text>
                    <Text className="text-xs text-indigo-500 mt-0.5">
                      Mijozlarni ko'rish →
                    </Text>
                  </View>
                </Pressable>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => handleEdit(item)}
                    className="p-2 bg-blue-50 rounded-full"
                  >
                    <MaterialIcons name="edit" size={20} color="#3b82f6" />
                  </Pressable>
                  <Pressable
                    onPress={() => handleDelete(item.id!)}
                    className="p-2 bg-red-50 rounded-full"
                  >
                    <MaterialIcons name="delete" size={20} color="#ef4444" />
                  </Pressable>
                </View>
              </View>
            </Card>
          )}
        />
      )}

      <Pressable
        onPress={() => {
          reset();
          setEditingTag(null);
          setModalVisible(true);
        }}
        className="absolute bottom-6 right-6 w-14 h-14 bg-indigo-600 rounded-full justify-center items-center shadow-lg"
      >
        <MaterialIcons name="add" size={32} color="white" />
      </Pressable>

      <CustomModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        modalTitle={editingTag ? "Tegni tahrirlash" : "Yangi teg"}
        contentContainerStyle={{ justifyContent: "flex-end" }}
      >
        <Controller
          control={control}
          name="name"
          rules={{ required: true }}
          render={({ field: { onChange, onBlur, value }, fieldState }) => (
            <>
              <TextInput
                placeholder="Teg nomi"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                className={`bg-gray-50 p-4 rounded-xl mb-3 border ${
                  fieldState.error ? "border-red-400" : "border-gray-200"
                }`}
              />
              {fieldState.error && (
                <Text className="text-red-500 text-xs mb-3 -mt-2 ml-1">
                  Teg nomi majburiy
                </Text>
              )}
            </>
          )}
        />

        <View className="flex-row gap-3 mt-2">
          <Pressable
            onPress={() => {
              setModalVisible(false);
              reset();
              setEditingTag(null);
            }}
            className="flex-1 p-4 bg-slate-100 rounded-xl"
          >
            <Text className="text-center font-bold text-slate-600">
              Bekor qilish
            </Text>
          </Pressable>
          <Pressable
            onPress={handleSubmit(onSubmit)}
            className="flex-1 p-4 bg-indigo-600 rounded-xl"
          >
            <Text className="text-center font-bold text-white">Saqlash</Text>
          </Pressable>
        </View>
      </CustomModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6b7280",
    marginTop: 8,
  },
  emptySubText: {
    fontSize: 13,
    color: "#9ca3af",
    textAlign: "center",
  },
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
