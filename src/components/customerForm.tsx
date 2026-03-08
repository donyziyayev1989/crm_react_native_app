import Input from '@/components/Input';
import PhoneInput from '@/components/PhoneInput';
import Select from '@/components/Select';
import db from '@/services/database';
import { Customer } from '@interfaces/index';
import { where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Controller, useForm, } from 'react-hook-form';
import { Rating } from 'react-native-ratings';

import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';

const CustomerForm = () => {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [regions, setRegions] = useState<{ label: string; value: string | number }[]>([]);
  const [districts, setDistricts] = useState<{ label: string; value: string | number; region_id?: string }[]>([]);
  const [orders, setOrders] = useState<{ label: string; value: string | number }[]>([]);
  const [tags, setTags] = useState<{ label: string; value: string | number }[]>([]);

  useEffect(() => {
    const fetchRegions = async () => {
      const regions = await db.regions.list();
      const regionsdata = regions.map((region: any) => ({
        label: region.name,
        value: region.name,
      }));
      setRegions(regionsdata);
    };
    
    fetchRegions();
  }, []);

  useEffect(() => {
    const fetchDistricts = async () => {
      let fetchedDistricts;
      if (selectedRegion) {
        fetchedDistricts = await db.districts.list(where('region_id', '==', selectedRegion));
      } else {
        fetchedDistricts = await db.districts.list();
      }
      const districtsdata = fetchedDistricts.map((district: any) => ({
        label: district.name,
        value: district.name,
        region_id: district.region_id,
      }));
      setDistricts(districtsdata);
    };
    fetchDistricts();
  }, [selectedRegion]);

  useEffect(() => {
    const fetchOrders = async () => {
      const orders = await db.orders.list();
      const ordersdata = orders.map((order: any) => ({
        label: order.name,
        value: order.id,
      }));
      setOrders(ordersdata);
    };

    const fetchTags = async () => {
      const tags = await db.tags.list();
      const tagsdata = tags.map((tag: any) => ({
        label: tag.name,
        value: tag.name,
      }));
      setTags(tagsdata);
    };
    fetchOrders();
    fetchTags();
  }, []);


  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<Customer>({
    defaultValues: {
      name: '',
      phone: '',
      region_name: '',
      order_ids: [],
      district_name: '',
      tag_ids: [],
      note: '',
      user_id: '',
      rates: 0
    },
  });

  const onSubmit = async(data: Customer) => {
    try {
      await db.customers.create(data);
      Alert.alert("Mijoz yaratildi");
    } catch (error) {
      Alert.alert("Mijoz qo'shishda xatolik")
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Name */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Ism</Text>
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, value } }) => 
              <Input name="name" value={value} errors={errors} onChange={onChange} placeholder="Mijoz ismi"/>
            }
          />
        </View>

        {/* Mobile */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, errors.phone && styles.errorLabel]}>Telefon</Text>
          <Controller
            control={control}
            name="phone"
            rules={{
              required: "Telefon kiritilishi shart",
              pattern: { value: /^\+998 [0-9]{2} [0-9]{3}-[0-9]{2}-[0-9]{2}$/, message: "Noto'g'ri telefon raqami" },
            }}
            render={({ field: { onChange, value } }) => 
              <PhoneInput name="phone" value={value} errors={errors} onChange={onChange} placeholder="+998 __ ___-__-__"/>
            }
          />
          {errors.phone && <Text style={styles.errorText}>{errors.phone.message}</Text>}
        </View>


        {/* Region */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, errors.region_name && styles.errorLabel]}>Viloyat</Text>
          <Controller
            control={control}
            name="region_name"
            rules={{ required: "Viloyat kiritilishi shart" }}
            render={({ field: { onChange, value } }) => 
              <Select data={regions} 
                      name="region_name"
                      placeholder="Viloyatni tanlang" 
                      searchPlaceholder="Qidirish..." 
                      value={value}
                      errors={errors}
                      onChange={(val) => {setSelectedRegion(val); onChange(val);}}
                      search={true} maxHeight={300}/>
            }
          />
          {errors.region_name && <Text style={styles.errorText}>{errors.region_name.message}</Text>}
        </View>

        {/* District */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Tuman</Text>
          <Controller
            control={control}
            name="district_name"
            render={({ field: { onChange, value } }) => 
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
                console.log(val)
                const district = districts.find(d => d.value === val);
                if (district) {
                   if (district.region_id) {
                    setSelectedRegion(district.region_id);
                    setValue('region_name', district.region_id);
                  }
                  setValue('district_name', district.label);
                }
              }}
            />
            }
          />
        </View>

         {/* Orders */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Buyurtmalar</Text>
          <Controller
            control={control}
            name="order_ids"
            render={({ field: { onChange, value } }) => 
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
            }
          />
        </View>

        {/* Tags */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Taglar</Text>
          <Controller
            control={control}
            name="tag_ids"
            render={({ field: { onChange, value } }) => 
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
            }
          />
        </View>

        {/* Rate */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Reyting</Text>
          <Controller
            control={control}
            name="rates"
            rules={{
              required: "Reyting kiritilishi shart",
              min: { value: 0, message: "Minimal 0" },
              max: { value: 5, message: "Maksimal 5" },
            }}
            render={({ field: { onChange, value } }) => <Rating
                type='star'
                ratingCount={10}
                imageSize={40}
                showRating={false}
                ratingBackgroundColor="red"
                startingValue={0}
                tintColor="#F2F2F2"
                style={{
                  marginRight:"auto"
                }}
                onFinishRating={onChange}
              />
            }
          />
          {errors.rates && <Text style={styles.errorText}>{errors.rates.message}</Text>}
        </View>

        {/* Note */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Izoh</Text>
          <Controller
            control={control}
            name="note"
            render={({ field: { onChange, value } }) => (
              <Input name="note" value={value} errors={errors} onChange={onChange} placeholder="Qo'shimcha izoh..." multiline={true}/>
            )}
          />
        </View>

        {/* Save button (bottom) */}
        <Pressable style={styles.saveBtn} onPress={handleSubmit(onSubmit)}>
          <Text style={styles.saveBtnText}>Saqlash</Text>
        </Pressable>
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
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  errorText: {
    marginTop: 4,
    fontSize: 12,
    color: '#ef4444',
  },
  errorLabel: {
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
