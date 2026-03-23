import Card from "@/components/Card";
import CustomModal from "@/components/CustomModal";
import { Product } from "@/interfaces";
import db, { orderBy } from "@/services/database";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Stack } from "expo-router";
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

type ProductFormValues = {
  name: string;
  price: string;
  description: string;
};

export default function ProductsScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const { control, handleSubmit, reset, setValue } = useForm<ProductFormValues>(
    {
      defaultValues: {
        name: "",
        price: "",
        description: "",
      },
    },
  );

  useEffect(() => {
    const unsubscribe = db.products.watch(
      (data) => {
        setProducts(data);
        setLoading(false);
      },
      orderBy("name", "asc"),
    );
    return () => unsubscribe();
  }, []);

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setValue("name", product.name);
    setValue("price", product.price.toString());
    setValue("description", product.description || "");
    setModalVisible(true);
  };

  const onSubmit = async (values: ProductFormValues) => {
    const productData: Omit<Product, "id"> = {
      name: values.name,
      price: parseFloat(values.price),
      description: values.description,
      active: editingProduct ? editingProduct.active : true,
      updatedAt: new Date(),
    };

    try {
      if (editingProduct?.id) {
        await db.products.update(editingProduct.id, productData);
      } else {
        await db.products.create({
          ...productData,
          createdAt: new Date(),
        } as any);
      }
      setModalVisible(false);
      reset();
      setEditingProduct(null);
    } catch (e) {
      Alert.alert("Xato", "Saqlashda xatolik yuz berdi");
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      "O'chirish",
      "Haqiqatdan ham bu mahsulotni o'chirmoqchimisiz?",
      [
        { text: "Yo'q", style: "cancel" },
        {
          text: "Ha",
          style: "destructive",
          onPress: async () => {
            try {
              await db.products.delete(id);
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
      <Stack.Screen options={{ title: "Mahsulotlar" }} />

      <FlatList
        data={products}
        keyExtractor={(item) => item.id!}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <Card className="mb-3" style={styles.boxShadow}>
            <View className="flex-row justify-between items-center">
              <View className="flex-1">
                <Text className="text-lg font-bold text-gray-800">
                  {item.name}
                </Text>
                <Text className="text-gray-500">
                  {item.description || "Tavsif yo'q"}
                </Text>
                <Text className="text-indigo-600 font-bold mt-1">
                  {item.price.toLocaleString()} so'm
                </Text>
              </View>
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

      <Pressable
        onPress={() => {
          reset();
          setEditingProduct(null);
          setModalVisible(true);
        }}
        className="absolute bottom-6 right-6 w-14 h-14 bg-indigo-600 rounded-full justify-center items-center shadow-lg"
      >
        <MaterialIcons name="add" size={32} color="white" />
      </Pressable>

      <CustomModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        modalTitle={editingProduct ? "Tahrirlash" : "Yangi mahsulot"}
        contentContainerStyle={{ justifyContent: "flex-end" }}
      >
        <Controller
          control={control}
          name="name"
          rules={{ required: true }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              placeholder="Nomi"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              className="bg-gray-50 p-4 rounded-xl mb-3 border border-gray-200"
            />
          )}
        />

        <Controller
          control={control}
          name="price"
          rules={{ required: true }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              placeholder="Narxi"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              keyboardType="numeric"
              className="bg-gray-50 p-4 rounded-xl mb-3 border border-gray-200"
            />
          )}
        />

        <Controller
          control={control}
          name="description"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              placeholder="Tavsif (ixtiyoriy)"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              multiline
              className="bg-gray-50 p-4 rounded-xl mb-4 border border-gray-200 min-h-[100px]"
            />
          )}
        />

        <View className="flex-row gap-3 mt-2">
          <Pressable
            onPress={() => setModalVisible(false)}
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  boxShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
});
