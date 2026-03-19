import db from "@/services/database";
import CustomerList from "@components/CustomerList";
import Search from "@components/Search";
import { Customer } from "@interfaces/index";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

const Customers = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = db.customers.watch((data) => {
      setCustomers(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

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
