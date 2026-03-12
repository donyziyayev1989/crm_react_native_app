import Select from '@/components/Select';
import db from '@/services/database';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

/**
 * Search (Mijozlarni qidirish va filtrlash)
 */
const Search = ({ initialValue = '' } : { initialValue?: string }) => {
  const [val, setVal] = useState(initialValue);
  const [allLots, setAllLots] = useState<any[]>([]);
  const [allRegions, setAllRegions] = useState<any[]>([]);
  const [lotId, setLotId] = useState<string>('');
  const [region, setRegion] = useState<string>('');
  const [showFilter, setShowFilter] = useState(false);
  const router = useRouter();

  const handleSearch = () => {
    const selectedLot = allLots.find(o => o.value === lotId);
    const params: Record<string, string> = {};

    if (val.trim()) params.q = val.trim();
    if (lotId) {
      params.lotId = lotId;
      if (selectedLot) params.lotName = selectedLot.label;
    }
    if (region) params.region = region;

    router.push({
      pathname: '/customers/search_results',
      params,
    });
  };

  useEffect(() => {
    const fetchLots = async () => {
      // Partiyalarni (Lots) yuklash
      const data = await db.lots.list();
      const lotsData = data.map((lot: any) => ({
        label: lot.name,
        value: lot.id,
        date: lot.date,
      }));
      setAllLots(lotsData);
    };
    const fetchAllRegions = async () => {
      const data = await db.regions.list();
      const regionsData = data.map((region: any) => ({
        label: region.name,
        value: region.name,
      }));
      setAllRegions(regionsData);
    };

    fetchLots();
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
              name="lot_id"
              data={allLots}
              search={true}
              placeholder="Partiyalar"
              searchPlaceholder="Qidirish..."
              maxHeight={300}
              value={lotId}
              onChange={(val) => {
                setLotId(val);
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