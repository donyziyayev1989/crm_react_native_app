import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { Pressable, TextInput, View } from 'react-native';

const Search = () => {
  return (
    <View className='flex-row items-center p-2'>
      <TextInput
        placeholder="Search..."
        className='flex-1 border border-gray-300 rounded-full px-4 py-3 bg-white focus:border-primary'
      />
      <Pressable>
        <MaterialIcons name="search" size={24} color="gray" />
      </Pressable>
    </View>
  )
}

export default Search