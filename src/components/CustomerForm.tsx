import Input from "@/components/Input";
import PhoneInput from "@/components/PhoneInput";
import RegionDistrictSelect from "@/components/RegionDistrictSelect";
import Select from "@/components/Select";
import { auth } from "@/firebase/firebase";
import { useRefData } from "@/providers/ReferenceData";
import db, { where } from "@/services/database";
import { formatPhone } from "@/utils/format";
import { digitsOnly, phoneVariants } from "@/utils/phone";
import { Customer } from "@interfaces/index";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
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
import { Rating } from "react-native-ratings";

interface CustomerFormProps {
  onSuccess?: (customerId: string, customerData: Customer) => void;
  onCancel?: () => void;
  initialData?: Customer & { id?: string };
  hideOrders?: boolean;
  isInModal?: boolean;
}

const CustomerForm = ({
  onSuccess,
  onCancel,
  initialData,
  hideOrders,
  isInModal,
}: CustomerFormProps) => {
  const router = useRouter();

  // Reference ma'lumotlar ilova darajasidagi provider'dan
  const { lots: lotsData, tags: tagsData } = useRefData();

  // ─── Select options ───────────────────────────────────────────────────────
  const lots = useMemo(
    () =>
      (lotsData ?? []).map((d) => ({
        label: d.name,
        value: d.id,
      })),
    [lotsData],
  );

  const tags = useMemo(
    () =>
      (tagsData ?? []).map((d) => ({
        label: d.name,
        value: d.id,
      })),
    [tagsData],
  );

  const {
    control,
    handleSubmit,
    setValue,
    watch,
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
        phone: digitsOnly(data.phone),
      };

      // Dublikatni tekshirish (bazadagi barcha yozuv variantlari bo'yicha)
      const existingCustomers = await db.customers.list(
        where("phone", "in", phoneVariants(cleanedData.phone)),
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
              validate: (val) => {
                // PhoneInput "+998 " + unmasked digits saqlaydi
                // unmasked = faqat raqamlar (9 ta): "901234567"
                // natija: "+998 901234567"
                const digits = (val || "").replace(/\D/g, "");
                if (digits.length !== 12) {
                  return "Noto'g'ri telefon raqami";
                }
                return true;
              },
            }}
            render={({ field: { onChange, value } }) => (
              <PhoneInput
                name="phone"
                value={value}
                errors={errors}
                onChange={onChange}
                placeholder="__ ___-__-__"
              />
            )}
          />
          {errors.phone && (
            <Text style={styles.errorText}>
              {errors.phone.message as string}
            </Text>
          )}
        </View>

        {/* Region + District (formada ID emas, nom saqlanadi) */}
        <Controller
          control={control}
          name="region_name"
          rules={{ required: "Viloyat kiritilishi shart" }}
          render={({ field: { onChange, value } }) => (
            <RegionDistrictSelect
              regionName={value || ""}
              districtName={watch("district_name") || ""}
              isInModal={isInModal}
              labelStyle={styles.label}
              fieldStyle={styles.fieldGroup}
              errorTextStyle={styles.errorText}
              regionError={errors.region_name?.message as string | undefined}
              onChange={({ region_name, district_name }) => {
                onChange(region_name);
                setValue("district_name", district_name);
              }}
            />
          )}
        />

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
                  isInModal={isInModal}
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
                isInModal={isInModal}
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
