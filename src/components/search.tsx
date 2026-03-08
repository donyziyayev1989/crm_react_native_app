import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

const Search = ({ initialValue = '' } : { initialValue?: string }) => {
  const [val, setVal] = useState(initialValue);
  const router = useRouter();

  const handleSearch = () => {
    if (val.trim()) {
      router.push({
        pathname: '/customers/search_results',
        params: { q: val.trim() }
      });
    }
  };

  return (
    <View className='flex-row items-center p-2'>
      <TextInput
        placeholder="Qidirish (ism yoki telefon)..."
        value={val}
        onChangeText={setVal}
        onSubmitEditing={handleSearch}
        className='flex-1 border border-gray-300 rounded-full px-4 py-3 bg-white focus:border-primary'
      />
      <Pressable onPress={handleSearch} className="ml-2 px-2">
        <MaterialIcons name="search" size={28} color="gray" />
      </Pressable>
    </View>
  );
};

export default Search;