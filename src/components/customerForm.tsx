import { Customer } from '@interfaces/Customer';
import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text, TextInput, View,
} from 'react-native';

interface CustomerFormProps {
  isEditing: boolean;
  onSubmit?: () => void;
  customerId: any;
}
const CustomerForm = ({ isEditing, onSubmit, customerId }: CustomerFormProps) => {

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Customer>({
    defaultValues: {
      id: Number(customerId),
      name: '',
      mobile: '',
      district: '',
      rate: 0,
      note: '',
    },
  });

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Name */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Ism</Text>
          <Controller
            control={control}
            name="name"
            rules={{ required: "Ism kiritilishi shart" }}
            render={({ field: { onChange, value } }) =>
              isEditing ? (
                <TextInput
                  style={[styles.input, errors.name && styles.inputError]}
                  value={value}
                  onChangeText={onChange}
                  placeholder="Mijoz ismi"
                  placeholderTextColor="#9ca3af"
                />
              ) : (
                <Text style={styles.valueText}>{value || '—'}</Text>
              )
            }
          />
          {errors.name && <Text style={styles.errorText}>{errors.name.message}</Text>}
        </View>

        {/* Mobile */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Telefon</Text>
          <Controller
            control={control}
            name="mobile"
            rules={{
              required: "Telefon kiritilishi shart",
              pattern: { value: /^\+?[0-9]{9,13}$/, message: "Noto'g'ri telefon raqami" },
            }}
            render={({ field: { onChange, value } }) =>
              isEditing ? (
                <TextInput
                  style={[styles.input, errors.mobile && styles.inputError]}
                  value={value}
                  onChangeText={onChange}
                  placeholder="+998901234567"
                  placeholderTextColor="#9ca3af"
                  keyboardType="phone-pad"
                />
              ) : (
                <Text style={styles.valueText}>{value || '—'}</Text>
              )
            }
          />
          {errors.mobile && <Text style={styles.errorText}>{errors.mobile.message}</Text>}
        </View>

        {/* District */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Tuman</Text>
          <Controller
            control={control}
            name="district"
            rules={{ required: "Tuman kiritilishi shart" }}
            render={({ field: { onChange, value } }) =>
              isEditing ? (
                <TextInput
                  style={[styles.input, errors.district && styles.inputError]}
                  value={value}
                  onChangeText={onChange}
                  placeholder="Tuman nomi"
                  placeholderTextColor="#9ca3af"
                />
              ) : (
                <Text style={styles.valueText}>{value || '—'}</Text>
              )
            }
          />
          {errors.district && <Text style={styles.errorText}>{errors.district.message}</Text>}
        </View>

        {/* Rate */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Reyting</Text>
          <Controller
            control={control}
            name="rate"
            rules={{
              required: "Reyting kiritilishi shart",
              min: { value: 0, message: "Minimal 0" },
              max: { value: 5, message: "Maksimal 5" },
            }}
            render={({ field: { onChange, value } }) =>
              isEditing ? (
                <TextInput
                  style={[styles.input, errors.rate && styles.inputError]}
                  value={String(value)}
                  onChangeText={(v) => onChange(Number(v))}
                  placeholder="0 - 5"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                />
              ) : (
                <Text style={styles.valueText}>{value ?? '—'}</Text>
              )
            }
          />
          {errors.rate && <Text style={styles.errorText}>{errors.rate.message}</Text>}
        </View>

        {/* Note */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Izoh</Text>
          <Controller
            control={control}
            name="note"
            render={({ field: { onChange, value } }) => (
              <TextInput
                style={[styles.input, styles.textArea, !isEditing && styles.inputDisabled]}
                value={value}
                onChangeText={onChange}
                editable={isEditing}
                placeholder="Qo'shimcha izoh..."
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            )}
          />
        </View>

        {/* Save button (bottom) */}
        {isEditing && (
          <Pressable style={styles.saveBtn} onPress={handleSubmit(onSubmit)}>
            <Text style={styles.saveBtnText}>Saqlash</Text>
          </Pressable>
        )}
      </ScrollView>
  )
}

export default CustomerForm

const styles = StyleSheet.create({
  headerBtn: {
    paddingHorizontal: 12,
  },
  container: {
    padding: 20,
    gap: 4,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#fff',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  valueText: {
    fontSize: 15,
    color: '#111827',
    paddingVertical: 4,
  },
  inputDisabled: {
    backgroundColor: '#f9fafb',
    borderColor: '#f3f4f6',
    color: '#374151',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  errorText: {
    marginTop: 4,
    fontSize: 12,
    color: '#ef4444',
  },
  saveBtn: {
    marginTop: 8,
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
