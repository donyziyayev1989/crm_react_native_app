import Input from "@/components/Input";
import PhoneInput from "@/components/PhoneInput";
import Select from "@/components/Select";
import { auth } from "@/firebase/firebase";
import db, { database, subDistricts, where } from "@/services/database";
import { formatPhone } from "@/utils/format";
import { Customer, District } from "@interfaces/index";
import { useRouter } from "expo-router";
import { collection } from "firebase/firestore";
import React, { useMemo, useState } from "react";
import {
  useCollectionData,
  useCollectionOnce,
} from "react-firebase-hooks/firestore";
import { Controller, useForm } from "react-hook-form";
import { Rating } from "react-native-ratings";

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

interface CustomerFormProps {
  onSuccess?: (customerId: string, customerData: Customer) => void;
  onCancel?: () => void;
  initialData?: Customer & { id?: string };
  hideOrders?: boolean;
}

const CustomerForm = ({
  onSuccess,
  onCancel,
  initialData,
  hideOrders,
}: CustomerFormProps) => {
  const router = useRouter();
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(
    initialData?.region_name || null,
  );

  // ─── Regions: snapshot orqali doc.id ni olamiz ──────────────────────────────
  // useCollectionDataOnce region nomini qaytaradi, lekin document ID ni bermaydi.
  // useCollectionOnce esa snapshot.docs dan doc.id ni o'qishga imkon beradi.
  // Bu muhim: selectedRegionId = "fargona" (doc ID) bo'lishi kerak,
  // aks holda subDistricts.ref("Farg'ona") → regions/Farg'ona/districts (noto'g'ri path!)
  const [regionsSnap] = useCollectionOnce(
    collection(database, "regions") as any,
  );

  // ─── Districts: region tanlanganda subcollection dan real-time yuklanadi ───
  // useCollectionData — query o'zgarganda avtomatik qayta subscribe bo'ladi
  const districtsQuery = useMemo(
    () => (selectedRegionId ? subDistricts.ref(selectedRegionId) : null),
    [selectedRegionId],
  );
  const [districtsData] = useCollectionData<District>(districtsQuery as any, {
    initialValue: [],
  });

  // ─── Orders: snapshot → doc.id ni value sifatida ishlatamiz ────────────────
  // useCollectionData id bermaydi → hamma order value:'' → tanlaganda hamma tanlanadi!
  const [ordersSnap] = useCollectionOnce(collection(database, "orders") as any);

  // ─── Tags: snapshot → doc.id ─────────────────────────────────────────────
  const [tagsSnap] = useCollectionOnce(collection(database, "tags") as any);

  // ─── Select uchun formatlangan ro'yxatlar ─────────────────────────────────
  // Region: label = doc.name, value = doc.id ("fargona", "andijon", ...)
  const regions = useMemo(
    () =>
      (regionsSnap?.docs ?? []).map((d) => ({
        label: d.data().name as string,
        value: d.id,
      })),
    [regionsSnap],
  );
  const districts = useMemo(
    () => (districtsData ?? []).map((d) => ({ label: d.name, value: d.name })),
    [districtsData],
  );
  const orders = useMemo(
    () =>
      (ordersSnap?.docs ?? []).map((d) => ({
        label: d.data().name as string,
        value: d.id,
      })),
    [ordersSnap],
  );
  const tags = useMemo(
    () =>
      (tagsSnap?.docs ?? []).map((d) => ({
        label: d.data().name as string,
        value: d.id,
      })),
    [tagsSnap],
  );

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<Customer>({
    defaultValues: {
      name: initialData?.name || "",
      phone: formatPhone(initialData?.phone) || "",
      region_name: initialData?.region_name || "",
      order_ids: initialData?.order_ids || [],
      district_name: initialData?.district_name || "",
      tag_ids: initialData?.tag_ids || [],
      note: initialData?.note || "",
      user_id: initialData?.user_id || "",
      rates: initialData?.rates || 0,
    },
  });

  const onSubmit = async (data: Customer) => {
    try {
      const cleanedData = {
        ...data,
        phone: data.phone.replace(/\D/g, ""),
      };

      // Check uniqueness
      const existingCustomers = await db.customers.list(
        where("phone", "==", cleanedData.phone),
      );
      const duplicate = existingCustomers.find((c) => c.id !== initialData?.id);

      if (duplicate) {
        Alert.alert(
          "Mavjud mijoz",
          "Ushbu telefon raqamli mijoz allaqachon mavjud! Mijoz sahifasiga o'tasizmi?",
          [
            { text: "Yo'q", style: "cancel" },
            {
              text: "Ha",
              onPress: () => {
                if (onCancel) onCancel();
                router.push(`/(tabs)/customers/${duplicate.id}`);
              },
            },
          ],
        );
        return;
      }

      if (initialData?.id) {
        await db.customers.update(initialData.id, {
          ...cleanedData,
          user_id: cleanedData.user_id || auth.currentUser?.uid || "",
        });
        if (onSuccess) {
          onSuccess(initialData.id, cleanedData);
        } else {
          Alert.alert("Mijoz yangilandi");
        }
      } else {
        const newId = await db.customers.create({
          ...cleanedData,
          user_id: auth.currentUser?.uid || "",
        });
        if (onSuccess) {
          onSuccess(newId, cleanedData);
        } else {
          Alert.alert("Mijoz yaratildi");
        }
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Xatolik", "Saqlashda xatolik yuz berdi");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "padding"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 100}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={{ gap: 4 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Name */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Ism</Text>
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, value } }) => (
              <Input
                name="name"
                value={value}
                errors={errors}
                onChange={onChange}
                placeholder="Mijoz ismi"
              />
            )}
          />
        </View>

        {/* Mobile */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, errors.phone && styles.errorLabel]}>
            Telefon
          </Text>
          <Controller
            control={control}
            name="phone"
            rules={{
              required: "Telefon kiritilishi shart",
              pattern: {
                value: /^\+998 [0-9]{2} [0-9]{3} [0-9]{2} [0-9]{2}$/,
                message: "Noto'g'ri telefon raqami",
              },
            }}
            render={({ field: { onChange, value } }) => (
              <PhoneInput
                name="phone"
                value={value}
                errors={errors}
                onChange={onChange}
                placeholder="+998 __ ___-__-__"
              />
            )}
          />
          {errors.phone && (
            <Text style={styles.errorText}>{errors.phone.message}</Text>
          )}
        </View>

        {/* Region */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, errors.region_name && styles.errorLabel]}>
            Viloyat
          </Text>
          <Controller
            control={control}
            name="region_name"
            rules={{ required: "Viloyat kiritilishi shart" }}
            render={({ field: { onChange, value } }) => (
              <Select
                data={regions}
                name="region_name"
                placeholder="Viloyatni tanlang"
                searchPlaceholder="Qidirish..."
                value={value}
                errors={errors}
                onChange={(val) => {
                  setSelectedRegionId(val);
                  onChange(val);
                  setValue("district_name", ""); // region o'zgarganda tuman resetlanadi
                }}
                search={true}
                maxHeight={300}
              />
            )}
          />
          {errors.region_name && (
            <Text style={styles.errorText}>{errors.region_name.message}</Text>
          )}
        </View>

        {/* District */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Tuman</Text>
          <Controller
            control={control}
            name="district_name"
            render={({ field: { onChange, value } }) => (
              <Select
                name="district_name"
                data={districts}
                errors={errors}
                placeholder="Tumanni tanlang"
                searchPlaceholder="Qidirish..."
                search={true}
                maxHeight={300}
                value={value}
                onChange={(val) => {
                  onChange(val);
                  setValue("district_name", val as string);
                }}
              />
            )}
          />
        </View>

        {/* Orders */}
        {!hideOrders && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Buyurtmalar</Text>
            <Controller
              control={control}
              name="order_ids"
              render={({ field: { onChange, value } }) => (
                <Select
                  name="order_ids"
                  data={orders}
                  errors={errors}
                  placeholder="Buyurtmalar"
                  searchPlaceholder="Qidirish..."
                  maxHeight={300}
                  value={value}
                  multiSelect={true}
                  onChange={(val) => {
                    onChange(val);
                  }}
                />
              )}
            />
          </View>
        )}

        {/* Tags */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Taglar</Text>
          <Controller
            control={control}
            name="tag_ids"
            render={({ field: { onChange, value } }) => (
              <Select
                name="tag_ids"
                data={tags}
                errors={errors}
                placeholder="Taglar"
                searchPlaceholder="Qidirish..."
                maxHeight={300}
                value={value}
                multiSelect={true}
                onChange={(val) => {
                  onChange(val);
                }}
              />
            )}
          />
        </View>

        {/* Rate */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Reyting</Text>
          <Controller
            control={control}
            name="rates"
            rules={{
              min: { value: 0, message: "Minimal 0" },
            }}
            render={({ field: { onChange, value } }) => (
              <Rating
                type="star"
                ratingCount={10}
                imageSize={32}
                showRating={false}
                ratingBackgroundColor="red"
                startingValue={0}
                style={{
                  marginRight: "auto",
                }}
                onFinishRating={onChange}
              />
            )}
          />
          {errors.rates && (
            <Text style={styles.errorText}>{errors.rates.message}</Text>
          )}
        </View>

        {/* Note */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Izoh</Text>
          <Controller
            control={control}
            name="note"
            render={({ field: { onChange, value } }) => (
              <Input
                name="note"
                value={value}
                errors={errors}
                onChange={onChange}
                placeholder="Qo'shimcha izoh..."
                multiline={true}
              />
            )}
          />
        </View>

        {/* Save button (bottom) */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {onCancel && (
            <Pressable
              style={[styles.saveBtn, { flex: 1, backgroundColor: "#f3f4f6" }]}
              onPress={onCancel}
            >
              <Text style={[styles.saveBtnText, { color: "#374151" }]}>
                Bekor
              </Text>
            </Pressable>
          )}
          <Pressable
            style={[styles.saveBtn, { flex: 1 }]}
            onPress={handleSubmit(onSubmit)}
          >
            <Text style={styles.saveBtnText}>Saqlash</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default CustomerForm;

const styles = StyleSheet.create({
  headerBtn: {
    paddingHorizontal: 12,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#fff",
  },
  inputError: {
    borderColor: "#ef4444",
  },
  errorText: {
    marginTop: 4,
    fontSize: 12,
    color: "#ef4444",
  },
  errorLabel: {
    color: "#ef4444",
  },
  saveBtn: {
    marginTop: 8,
    backgroundColor: "#6366f1",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
