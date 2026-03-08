import CustomerForm from '@components/customerForm';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Customer } from '@interfaces/Customer';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Pressable,
} from 'react-native';

const CustomerDetail = () => {
  const { customerId } = useLocalSearchParams();
  const [isEditing, setIsEditing] = useState(false);

  const {
    handleSubmit,
  } = useForm<Customer>({
    defaultValues: {
      id: '',
      name: '',
      phone: '',
      district_id: '',
      tag_id: '',
      note: '',
      user_id: '',
    },
  });

  const onSubmit = (data: Customer) => {
    console.log('Saqlandi:', data);
    setIsEditing(false);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: `Mijoz #${customerId}`,
          headerTitleAlign: 'center',
          headerLeft: ({ tintColor }) => (
            <Link href="/customers" className="text-primary">
              <MaterialIcons name="arrow-back" size={24} color={tintColor} />
            </Link>
          ),
          headerRight: ({ tintColor }) => (
            <Pressable
              onPress={() => {
                if (isEditing) {
                  handleSubmit(onSubmit)();
                } else {
                  setIsEditing(true);
                }
              }}
            >
              <MaterialIcons
                name={isEditing ? 'check' : 'edit'}
                size={24}
                color={tintColor}
              />
            </Pressable>
          ),
        }}
      />

      <CustomerForm isEditing={isEditing} onSubmit={handleSubmit(onSubmit)} customerId={customerId} />
    </>
  );
};



export default CustomerDetail;