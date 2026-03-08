import Search from '@/components/Search';
import Card from '@components/card';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Customer } from '@interfaces/index';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import db from '@/services/database';
import { callPhone, openTelegram } from '@utils/actions';



const Customers = () => {
  const [customers, setCustomers] = useState<Customer[]>([])
  const rowRefs = useRef(new Map<string, any>());
  let prevOpenedRow = useRef<string | null>(null);
  const router = useRouter();
  const closeRow = (id: string) => {
    if (prevOpenedRow.current !== null && prevOpenedRow.current !== id) {
      const row = rowRefs.current.get(prevOpenedRow.current);
      if (row) row.close();
    }
    prevOpenedRow.current = id;
  };

  useEffect(() => {
    const fetchCustomers = async() => {
      const data = await db.customers.list();
      setCustomers(data)
    }
    fetchCustomers()
  }, [] )


  const renderRightPanel = (item: Customer) => {
    return (
        <View className='flex-row z-50 w-32'>
          <Pressable
            onPress={() => callPhone(item.phone)}
            className='bg-success w-16 h-full flex items-center justify-center'
          >
            <MaterialIcons name="phone" size={24} color="white" />
          </Pressable>
          <Pressable
            onPress={() => openTelegram(item.phone)}
            className='bg-blue-400 w-16 h-full flex items-center justify-center'
          >
            <MaterialIcons name="telegram" size={24} color="white" />
          </Pressable>
        </View>
      );
  };


  return (
    <View className=''>
    {/* Search */}
    <Search value="Ali" onChange={() => {}} />
    <View className='flex-row justify-end p-2'>
      {/* filter dropdown */}
      <Pressable>
        <MaterialIcons name="filter" size={24} color="gray" />
      </Pressable>

    </View>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <FlatList
          data={customers}
          contentContainerStyle={{ padding: 8, gap: 8 }}
          renderItem={({ item }) => (
            <View className='bg-white rounded-xl overflow-hidden'>
              <ReanimatedSwipeable
                ref={((ref: any) => {
                  if (item.id) {
                    if (ref) rowRefs.current.set(item.id, ref);
                    else rowRefs.current.delete(item.id);
                  }
                }) as any}
                onSwipeableWillOpen={() => item.id && closeRow(item.id)}
                renderRightActions={() => renderRightPanel(item)}
              >
                <Pressable
                  onPress={() => item.id && router.push(`/customers/${item.id}`)}
                >
                  <Card>
                      <View className='flex-row justify-between mb-1'>
                        <Text className='text-lg font-semibold text-gray-900'>{item.name}</Text>
                        <View className='flex-row gap-1 items-center'>
                          <MaterialIcons name='location-pin' size={16} className='text-green-700'/>
                          <Text className='text-gray-900'>{item.district_name}, { item.region_name}</Text>
                        </View>
                      </View>
                      <View className='flex-row justify-between'>
                        <Text>{item.phone}</Text>
                        <View className='flex-row gap-1 items-center'>
                          {item.tag_ids.map((tag: string) => (
                            <View key={tag} className='bg-gray-200 px-2 rounded-full'>
                              <Text className='text-sm text-black'>{tag}</Text> 
                            </View>
                          ))}
                        </View>
                      </View>
                    </Card>
                </Pressable>
              </ReanimatedSwipeable>
            </View>
          )}
          keyExtractor={(item) => item.id || Math.random().toString()}
        />
      </GestureHandlerRootView>
    </View>
    
  )
}

export default Customers