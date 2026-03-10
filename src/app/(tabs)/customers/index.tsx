import db from "@/services/database";
import CustomerList from "@components/CustomerList";
import Search from "@components/Search";
import { Customer } from "@interfaces/index";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, View } from "react-native";

const Customers = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const fetchCustomers = async () => {
        setLoading(true);
        try {
          const data = await db.customers.list();
          if (isActive) {
            setCustomers(data);
          }
        } finally {
          if (isActive) {
            setLoading(false);
          }
        }
      };

      fetchCustomers();

      return () => {
        isActive = false;
      };
    }, []),
  );

  return (
    <View className="flex-1">
      <Search />
      {loading && (
        <View className="flex-1 items-center justify-center flex-grow-1">
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      )}
      {!loading && <CustomerList data={customers} />}
    </View>
  );
};

export default Customers;
