import CustomModal from "@/components/CustomModal";
import Loading from "@/components/Loading";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Link, Stack } from "expo-router";
import React, { useState } from "react";
import {
  Controller,
  DefaultValues,
  FieldValues,
  Path,
  useForm,
} from "react-hook-form";
import { Alert, FlatList, Pressable, Text, TextInput, View } from "react-native";

export interface CrudField<F> {
  name: keyof F & string;
  placeholder: string;
  keyboardType?: "numeric" | "default";
  multiline?: boolean;
  required?: boolean;
  requiredMessage?: string;
}

interface SimpleCrudScreenProps<T extends { id?: string }, F extends FieldValues> {
  title: string;
  items: T[];
  loading: boolean;
  fields: CrudField<F>[];
  emptyForm: F;
  toForm: (item: T) => F;
  fromForm: (values: F, editing: T | null) => Omit<T, "id">;
  collection: {
    create: (data: Omit<T, "id">) => Promise<string>;
    update: (id: string, data: Partial<Omit<T, "id">>) => Promise<void>;
    delete: (id: string) => Promise<void>;
  };
  renderItem: (
    item: T,
    actions: { edit: () => void; remove: () => void },
  ) => React.ReactNode;
  modalTitle: (editing: T | null) => string;
  deleteMessage: string;
  ListEmptyComponent?: React.ReactElement | null;
}

/**
 * Oddiy ro'yxat + qo'shish/tahrirlash modal + o'chirish. products va tags ekranlari
 * uchun umumiy skelet; ro'yxat elementi ko'rinishi renderItem orqali beriladi.
 */
function SimpleCrudScreen<T extends { id?: string }, F extends FieldValues>({
  title,
  items,
  loading,
  fields,
  emptyForm,
  toForm,
  fromForm,
  collection,
  renderItem,
  modalTitle,
  deleteMessage,
  ListEmptyComponent,
}: SimpleCrudScreenProps<T, F>) {
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const { control, handleSubmit, reset } = useForm<F>({
    defaultValues: emptyForm as DefaultValues<F>,
  });

  const openCreate = () => {
    reset(emptyForm);
    setEditing(null);
    setModalVisible(true);
  };
  const openEdit = (item: T) => {
    reset(toForm(item));
    setEditing(item);
    setModalVisible(true);
  };
  const close = () => {
    setModalVisible(false);
    reset(emptyForm);
    setEditing(null);
  };

  const onSubmit = async (values: F) => {
    try {
      const data = fromForm(values, editing);
      if (editing?.id) await collection.update(editing.id, data);
      else await collection.create(data);
      close();
    } catch {
      Alert.alert("Xato", "Saqlashda xatolik yuz berdi");
    }
  };

  const confirmDelete = (id: string) =>
    Alert.alert("O'chirish", deleteMessage, [
      { text: "Yo'q", style: "cancel" },
      {
        text: "Ha",
        style: "destructive",
        onPress: async () => {
          try {
            await collection.delete(id);
          } catch {
            Alert.alert("Xato", "O'chirishda xatolik yuz berdi");
          }
        },
      },
    ]);

  if (loading) return <Loading />;

  return (
    <View className="flex-1 bg-gray-50">
      <Stack.Screen
        options={{
          title,
          headerLeft: () => (
            <Link href="/" asChild>
              <Pressable className="p-3">
                <MaterialIcons name="arrow-back" size={24} color="#6b7280" />
              </Pressable>
            </Link>
          ),
        }}
      />

      {items.length === 0 && ListEmptyComponent ? (
        ListEmptyComponent
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id!}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <>
              {renderItem(item, {
                edit: () => openEdit(item),
                remove: () => confirmDelete(item.id!),
              })}
            </>
          )}
        />
      )}

      <Pressable
        onPress={openCreate}
        className="absolute bottom-6 right-6 w-14 h-14 bg-indigo-600 rounded-full justify-center items-center shadow-lg"
      >
        <MaterialIcons name="add" size={32} color="white" />
      </Pressable>

      <CustomModal
        visible={modalVisible}
        onClose={close}
        modalTitle={modalTitle(editing)}
        contentContainerStyle={{ justifyContent: "flex-end" }}
      >
        {fields.map((field) => (
          <Controller
            key={field.name}
            control={control}
            name={field.name as Path<F>}
            rules={
              field.required
                ? { required: field.requiredMessage ?? true }
                : undefined
            }
            render={({ field: { onChange, onBlur, value }, fieldState }) => (
              <>
                <TextInput
                  placeholder={field.placeholder}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value as string}
                  keyboardType={field.keyboardType}
                  multiline={field.multiline}
                  className={`bg-gray-50 p-4 rounded-xl mb-3 border ${
                    fieldState.error ? "border-red-400" : "border-gray-200"
                  } ${field.multiline ? "min-h-[100px]" : ""}`}
                />
                {fieldState.error && field.requiredMessage ? (
                  <Text className="text-red-500 text-xs mb-3 -mt-2 ml-1">
                    {field.requiredMessage}
                  </Text>
                ) : null}
              </>
            )}
          />
        ))}

        <View className="flex-row gap-3 mt-2">
          <Pressable onPress={close} className="flex-1 p-4 bg-slate-100 rounded-xl">
            <Text className="text-center font-bold text-slate-600">Bekor qilish</Text>
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

export default SimpleCrudScreen;
