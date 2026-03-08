import Card from '@components/card';
import Search from '@components/search';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React, { useRef } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';


import { callPhone, openTelegram } from '@utils/actions';

interface Customer {
  id: number;
  name: string;
  mobile: string;
  district: string;
  rate: number;
  note: string;
}

const customers: Customer[] = [
  { id: 1, name: 'John Doe', mobile: '+998907773707', district: 'Xorazm', rate: 100, note: 'Note 1' },
  { id: 2, name: 'Jane Doe', mobile: '+998901234567', district: 'Tashkent', rate: 100, note: 'Note 2' },
  { id: 3, name: 'John Doe', mobile: '+99891234438', district: 'Xorazm', rate: 100, note: 'Note 1' },
  { id: 4, name: 'Jane Doe', mobile: '+998901234567', district: 'Tashkent', rate: 100, note: 'Note 2' },
  { id: 5, name: 'John Doe', mobile: '+99891234438', district: 'Xorazm', rate: 100, note: 'Note 1' },
  { id: 6, name: 'Jane Doe', mobile: '+998901234567', district: 'Tashkent', rate: 100, note: 'Note 2' },
]

const Customers = () => {
  const rowRefs = useRef(new Map<number, any>());
  let prevOpenedRow = useRef<number | null>(null);
  const router = useRouter();
  const closeRow = (id: number) => {
    if (prevOpenedRow.current !== null && prevOpenedRow.current !== id) {
      const row = rowRefs.current.get(prevOpenedRow.current);
      if (row) row.close();
    }
    prevOpenedRow.current = id;
  };


  const renderRightPanel = (item: Customer) => {
    return (
        <View className='flex-row z-50 w-32'>
          <Pressable
            onPress={() => callPhone(item.mobile)}
            className='bg-success w-16 h-full flex items-center justify-center'
          >
            <MaterialIcons name="phone" size={24} color="white" />
          </Pressable>
          <Pressable
            onPress={() => openTelegram(item.mobile)}
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
    <Search />
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
                  if (ref) rowRefs.current.set(item.id, ref);
                  else rowRefs.current.delete(item.id);
                }) as any}
                onSwipeableWillOpen={() => closeRow(item.id)}
                renderRightActions={() => renderRightPanel(item)}
              >
                <Pressable
                  onPress={() => router.push(`/customers/${item.id}`)}
                >
                  <Card>
                      <View className='flex-row justify-between mb-1'>
                        <Text className='text-lg font-bold'>{item.name}</Text>
                        <Text className='text-muted'>{item.district}</Text>
                      </View>
                      <View className='flex-row justify-between'>
                        <Text>{item.mobile}</Text>
                        <Text>{item.rate}</Text>
                      </View>
                    </Card>
                </Pressable>
              </ReanimatedSwipeable>
            </View>
          )}
          keyExtractor={(item) => item.id.toString()}
        />
      </GestureHandlerRootView>
    </View>
    
  )
}

export default Customers