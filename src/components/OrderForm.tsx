import Input from "@/components/Input";
import { Order } from "@/interfaces";
import db from "@/services/database";
import { formatDate } from "@/utils/format";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

interface OrderFormProps {
  onSuccess?: (orderId: string) => void;
  onCancel?: () => void;
  initialData?: Order;
}

const OrderForm = ({ onSuccess, onCancel, initialData }: OrderFormProps) => {
  const [showDatePicker, setShowDatePicker] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Order>({
    defaultValues: {
      name: initialData?.name || "",
      date: initialData?.date || new Date().toISOString(),
      product_count: initialData?.product_count || 0,
    },
  });

  const onSubmit = async (data: Order) => {
    try {
      // Ensure numeric values are numbers
      const cleanedData = {
        ...data,
        product_count: Number(data.product_count),
      };

      if (initialData?.id) {
        await db.orders.update(initialData.id, cleanedData);
        Alert.alert("Muvaffaqiyat", "Buyurtma yangilandi");
        if (onSuccess) onSuccess(initialData.id);
      } else {
        const newId = await db.orders.create(cleanedData);
        Alert.alert("Muvaffaqiyat", "Yangi buyurtma yaratildi");
        if (onSuccess) onSuccess(newId);
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Xatolik", "Saqlashda xatolik yuz berdi");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 80}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Name */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Buyurtma Nomi (Soni)</Text>
          <Controller
            control={control}
            name="name"
            rules={{ required: "Nomi kiritilishi shart" }}
            render={({ field: { onChange, value } }) => (
              <Input
                name="name"
                value={value}
                errors={errors}
                onChange={onChange}
                placeholder="Masalan: 400 (Yangi)"
              />
            )}
          />
          {errors.name && (
            <Text style={styles.errorText}>{errors.name.message}</Text>
          )}
        </View>

        {/* Product Count */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Jami Tovar Soni</Text>
          <Controller
            control={control}
            name="product_count"
            render={({ field: { onChange, value } }) => (
              <Input
                name="product_count"
                value={value.toString()}
                errors={errors}
                onChange={(text) => onChange(text.replace(/[^0-9]/g, ""))}
                placeholder="0"
                keyboardType="numeric"
              />
            )}
          />
        </View>

        {/* Date */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Sana</Text>
          <Controller
            control={control}
            name="date"
            render={({ field: { onChange, value } }) => (
              <>
                <Pressable
                  onPress={() => setShowDatePicker(true)}
                  style={styles.dateButton}
                >
                  <Text style={styles.dateButtonText}>
                    {formatDate(value) || "Sana tanlang"}
                  </Text>
                </Pressable>
                {showDatePicker && (
                  <DateTimePicker
                    value={new Date(value)}
                    mode="date"
                    display={Platform.OS === "ios" ? "inline" : "default"}
                    onChange={(event, selectedDate) => {
                      setShowDatePicker(false);
                      if (selectedDate) {
                        onChange(selectedDate.toISOString());
                      }
                    }}
                  />
                )}
              </>
            )}
          />
        </View>

        <View style={styles.buttonContainer}>
          {onCancel && (
            <Pressable
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
            >
              <Text style={styles.cancelButtonText}>Bekor qilish</Text>
            </Pressable>
          )}
          <Pressable
            style={[styles.button, styles.saveButton]}
            onPress={handleSubmit(onSubmit)}
          >
            <Text style={styles.saveButtonText}>Saqlash</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default OrderForm;

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  saveButton: {
    backgroundColor: "#6366f1",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  cancelButton: {
    backgroundColor: "#f3f4f6",
  },
  cancelButtonText: {
    color: "#374151",
    fontSize: 16,
    fontWeight: "600",
  },
  dateButton: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#fff",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1.41,
  },
  dateButtonText: {
    fontSize: 15,
    color: "#111827",
  },
});
