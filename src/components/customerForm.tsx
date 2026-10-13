import Input from "@/components/Input";
import PhoneInput from "@/components/PhoneInput";
import Select from "@/components/Select";
import { auth } from "@/firebase/firebase";
import db, { where } from "@/services/database";
import { formatPhone } from "@/utils/format";
import { Customer, District, ProductLot, Region } from "@interfaces/index";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
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
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);

  // ─── Data States ──────────────────────────────────────────────────────────
  const [regionsData, setRegionsData] = useState<(Region & { id: string })[]>(
    [],
  );
  const [districtsData, setDistrictsData] = useState<District[]>([]);
  const [lotsData, setLotsData] = useState<(ProductLot & { id: string })[]>([]);
  const [tagsData, setTagsData] = useState<{ name: string; id: string }[]>([]);

  // ─── Realtime Subscriptions ───────────────────────────────────────────────
  useEffect(() => {
    // Regions
    const unsubRegions = db.regions.watch(setRegionsData as any);
    // Lots
    const unsubLots = db.lots.watch(setLotsData as any);
    // Tags
    const unsubTags = db.tags.watch(setTagsData as any);

    return () => {
      unsubRegions();
      unsubLots();
      unsubTags();
    };
  }, []);

  // Districts subscription (Filtered by region)
  useEffect(() => {
    if (selectedRegionId) {
      const unsubDistricts = db.districts.watch(
        setDistrictsData as any,
        where("regionId", "==", selectedRegionId),
      );
      return unsubDistricts;
    } else {
      setDistrictsData([]);
    }
  }, [selectedRegionId]);

  // Viloyatlar yuklanganda yoki initialData o'zgarganda ID ni aniqlash
  useEffect(() => {
    if (regionsData.length > 0 && initialData?.region_name) {
      const val = initialData.region_name.trim();
      const normalize = (s: string) => s.toLowerCase().replace(/['` ]/g, "");
      const normalizedValue = normalize(val);

      let found = regionsData.find(
        (d) => d.id === val || normalize(d.name || "") === normalizedValue,
      );

      // Qo'shimcha fuzzy matching (ayniqsa Toshkent uchun)
      if (!found && normalizedValue === "toshkent") {
        found = regionsData.find((d) => d.id === "toshkent_sh");
      }

      if (found) {
        setSelectedRegionId(found.id!);
      }
    }
  }, [regionsData, initialData?.region_name]);

  // ─── Select options ───────────────────────────────────────────────────────
  const regions = useMemo(
    () =>
      (regionsData ?? []).map((d) => ({
        label: d.name,
        value: d.id,
      })),
    [regionsData],
  );

  const districts = useMemo(
    () => (districtsData ?? []).map((d) => ({ label: d.name, value: d.name })),
    [districtsData],
  );

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

      // Dublikatni tekshirish (Bir nechta formatda qidiramiz)
      const digits = cleanedData.phone;
      const phoneQueries = [digits];
      if (digits.length === 9) {
        phoneQueries.push(`+998 ${digits}`);
        phoneQueries.push("998" + digits);
      } else if (digits.length === 12 && digits.startsWith("998")) {
        phoneQueries.push(`+998 ${digits.slice(3)}`);
        phoneQueries.push(digits.slice(3));
      }
      
      const uniqueQueries = [...new Set(phoneQueries)];
      const existingCustomers = await db.customers.list(
        where("phone", "in", uniqueQueries),
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
              const normalize = (s: string) =>
                s.toLowerCase().replace(/['` ]/g, "");
              const normalizedValue = normalize(value || "");
              let foundDoc = (regionsData ?? []).find(
                (d) =>
                  d.id === value || normalize(d.name || "") === normalizedValue,
              );

              // Toshkent uchun fuzzy match
              if (!foundDoc && normalizedValue === "toshkent") {
                foundDoc = (regionsData ?? []).find(
                  (d) => d.id === "toshkent_sh",
                );
              }

              const currentId = foundDoc?.id || "";

              return (
                <Select
                  data={regions}
                  placeholder="Viloyatni tanlang"
                  searchPlaceholder="Qidirish..."
                  value={currentId || selectedRegionId}
                  errors={errors}
                  isInModal={isInModal}
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
                isInModal={isInModal}
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
