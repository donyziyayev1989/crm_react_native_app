import db from '@/services/database';
import CustomerList from '@components/CustomerList';
import Search from '@components/Search';
import { Customer } from '@interfaces/index';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';




const Customers = () => {
  const [customers, setCustomers] = useState<Customer[]>([])
  useEffect(() => {
    const fetchCustomers = async() => {
      const data = await db.customers.list();
      setCustomers(data)
    }
    fetchCustomers()
  }, [] )


  return (
    <View className=''>
      <Search />
      <CustomerList data={customers} />
    </View>
    
  )
}

export default Customers