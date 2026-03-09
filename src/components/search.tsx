import Select from '@/components/Select';
import db from '@/services/database';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

const Search = ({ initialValue = '' } : { initialValue?: string }) => {
  const [val, setVal] = useState(initialValue);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [allRegions, setAllRegions] = useState<any[]>([]);
  const [order, setOrder] = useState<string>('');
  const [region, setRegion] = useState<string>('');
  const [showFilter, setShowFilter] = useState(false);
  const router = useRouter();

  const handleSearch = () => {
    const selectedOrder = allOrders.find(o => o.value === order);
    router.push({
      pathname: '/customers/search_results',
      params: { 
        q: val.trim(), 
        order: order || '', 
        region: region || '',
        orderName: selectedOrder ? selectedOrder.label : ''
      }
    });
  };

  useEffect(() => {
    const fetchOrders = async () => {
      const data = await db.orders.list();
      const ordersdata = data.map((order: any) => ({
        label: order.name,
        value: order.id,
        order_date: order.date,
      }));
      setAllOrders(ordersdata);
    };
    const fetchAllRegions = async () => {
      const data = await db.regions.list();
      const regionsData = data.map((region: any) => ({
        label: region.name,
        value: region.name,
      }));
      setAllRegions(regionsData);
    };

    fetchOrders();
    fetchAllRegions();
  }, []);

  return (
    <>
      <View className='flex-row items-center p-2'>
        <Pressable className="ml-2 px-2" onPress={() => setShowFilter(!showFilter)}>
          <MaterialIcons name="filter-alt" size={24} color={showFilter ? "#6366f1" : "gray"} />
        </Pressable>
        <TextInput
          placeholder="Qidirish telefon raqami..."
          value={val}
          onChangeText={setVal}
          onSubmitEditing={handleSearch}
          className='flex-1 border border-gray-300 rounded-full px-4 py-3 bg-white focus:border-primary'
        />
        <Pressable onPress={handleSearch} className="ml-2 px-2">
          <MaterialIcons name="search" size={28} color="gray" />
        </Pressable>
      </View>
      {showFilter &&
        <View className='flex px-2 gap-2 flex-row'>
          <View className='flex-1'>
            <Select
              name="order_ids"
              data={allOrders}
              search={true}
              placeholder="Buyurtmalar"
              searchPlaceholder="Qidirish..."
              maxHeight={300}
              value={order}
              onChange={(val) => {
                setOrder(val);
              }}
            />
          </View>
          <View className='flex-1'>
            <Select
              name="region_ids"
              data={allRegions}
              search={true}
              placeholder="Viloyatlar"
              searchPlaceholder="Qidirish..."
              maxHeight={300}
              value={region}
              onChange={(val) => {
                setRegion(val);
              }}
            />
          </View>
        </View>
      }
    </>
  );
};

export default Search;