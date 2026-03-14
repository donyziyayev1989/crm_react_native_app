import Input from "@/components/Input";
import PhoneInput from "@/components/PhoneInput";
import Select from "@/components/Select";
import { auth } from "@/firebase/firebase";
import db, { database, where } from "@/services/database";
import { formatPhone } from "@/utils/format";
import { Customer, District } from "@interfaces/index";
import { useRouter } from "expo-router";
import { collection, query } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
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
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  // ─── Regions ──────────────────────────────────────────────────────────────
  const [regionsSnap] = useCollectionOnce(
    collection(database, "regions") as any,
  );
  // Viloyatlar yuklanganda yoki initialData o'zgarganda ID ni aniqlash
  useEffect(() => {
    if (regionsSnap && initialData?.region_name) {
      const val = initialData.region_name.trim();
      const normalize = (s: string) => s.toLowerCase().replace(/['` ]/g, "");
      const normalizedValue = normalize(val);
      
      let found = regionsSnap.docs.find(
        (d) =>
          d.id === val ||
          normalize(d.data()?.name || "") === normalizedValue
      );

      // Qo'shimcha fuzzy matching (ayniqsa Toshkent uchun)
      if (!found && normalizedValue === "toshkent") {
        found = regionsSnap.docs.find((d) => d.id === "toshkent_sh");
      }

      if (found) {
        setSelectedRegionId(found.id);
      }
    }
  }, [regionsSnap, initialData?.region_name]);

  // ─── Districts (Flat collection query) ────────────────────────────────────
  const districtsQuery = useMemo(
    () =>
      selectedRegionId
        ? query(
            collection(database, "districts"),
            where("regionId", "==", selectedRegionId),
          )
        : null,
    [selectedRegionId],
  );
  const [districtsData] = useCollectionData<District>(districtsQuery as any, {
    initialValue: [],
  });

  // ─── Lots (Partiyalar) ────────────────────────────────────────────────────
  const [lotsSnap] = useCollectionOnce(collection(database, "lots") as any);

  // ─── Tags ─────────────────────────────────────────────────────────────────
  const [tagsSnap] = useCollectionOnce(collection(database, "tags") as any);

  // ─── Select options ───────────────────────────────────────────────────────
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

  const lots = useMemo(
    () =>
      (lotsSnap?.docs ?? []).map((d) => ({
        label: d.data().name as string,
        value: d.id,
      })),
    [lotsSnap],
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
      telegram_id: initialData?.telegram_id || "",
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

      const userId = initialData?.user_id || auth.currentUser?.uid || "";
      if (initialData?.id) {
        await db.customers.update(initialData.id, {
          ...cleanedData,
          user_id: userId,
        });
        if (onSuccess) {
          onSuccess(initialData.id, cleanedData);
        } else {
          Alert.alert("Muvaffaqiyat", "Mijoz yangilandi");
        }
      } else {
        const newId = await db.customers.create({
          ...cleanedData,
          user_id: auth.currentUser?.uid || "",
        });
        if (onSuccess) {
          onSuccess(newId, cleanedData);
        } else {
          Alert.alert("Muvaffaqiyat", "Mijoz yaratildi");
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
            <Text style={styles.errorText}>
              {errors.phone.message as string}
            </Text>
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
            render={({ field: { onChange, value } }) => {
              // Formadagi nomga qarab Select uchun ID ni aniqlaymiz
              const normalize = (s: string) => s.toLowerCase().replace(/['` ]/g, "");
              const normalizedValue = normalize(value || "");
              let foundDoc = (regionsSnap?.docs ?? []).find(
                (d) => 
                  d.id === value || 
                  normalize(d.data()?.name || "") === normalizedValue
              );

              // Toshkent uchun fuzzy match
              if (!foundDoc && normalizedValue === "toshkent") {
                foundDoc = (regionsSnap?.docs ?? []).find((d) => d.id === "toshkent_sh");
              }

              const currentId = foundDoc?.id || "";

              return (
                <Select
                  data={regions}
                  placeholder="Viloyatni tanlang"
                  searchPlaceholder="Qidirish..."
                  value={currentId || selectedRegionId}
                  errors={errors}
                  onChange={(val) => {
                    setSelectedRegionId(val);
                    // Formada ID emas, nomini saqlaymiz (Lead va CRM mosligi uchun)
                    const regionName =
                      regions.find((r) => r.value === val)?.label || val;
                    onChange(regionName);
                    setValue("district_name", ""); // region o'zgarganda tuman resetlanadi
                  }}
                  search={true}
                  maxHeight={300}
                />
              );
            }}
          />
          {errors.region_name && (
            <Text style={styles.errorText}>
              {errors.region_name.message as string}
            </Text>
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
                data={districts}
                placeholder="Tumanni tanlang"
                searchPlaceholder="Qidirish..."
                search={true}
                maxHeight={300}
                value={value}
                onChange={(val) => {
                  onChange(val);
                }}
              />
            )}
          />
        </View>

        {/* Lots (Partiyalar) */}
        {!hideOrders && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Partiyalar</Text>
            <Controller
              control={control}
              name="order_ids" // Hamon order_ids nomida saqlaymiz DB muvofiqligi uchun
              render={({ field: { onChange, value } }) => (
                <Select
                  data={lots}
                  placeholder="Partiyalar"
                  searchPlaceholder="Qidirish..."
                  maxHeight={300}
                  value={value}
                  multiSelect={true}
                  onChange={(val: string[]) => {
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
                data={tags}
                placeholder="Taglar"
                searchPlaceholder="Qidirish..."
                maxHeight={300}
                value={value}
                multiSelect={true}
                onChange={(val: string[]) => {
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
            render={({ field: { onChange, value } }) => (
              <Rating
                type="star"
                ratingCount={10}
                imageSize={32}
                showRating={false}
                startingValue={value || 0}
                style={{ marginRight: "auto" }}
                onFinishRating={onChange}
              />
            )}
          />
        </View>

        {/* Telegram ID */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Telegram ID</Text>
          <Controller
            control={control}
            name="telegram_id"
            render={({ field: { onChange, value } }) => (
              <Input
                name="telegram_id"
                value={value ?? ""}
                errors={errors}
                onChange={onChange}
                placeholder="Telegram ID yoki username..."
              />
            )}
          />
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

        <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
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
  fieldGroup: { marginBottom: 16 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  errorText: { marginTop: 4, fontSize: 12, color: "#ef4444" },
  errorLabel: { color: "#ef4444" },
  saveBtn: {
    backgroundColor: "#6366f1",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
