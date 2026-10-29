import Loading from "@/components/Loading";
import { useRefData } from "@/providers/ReferenceData";
import CustomerList from "@components/CustomerList";
import Search from "@components/Search";
import React from "react";
import { View } from "react-native";

const Customers = () => {
  // Barcha mijozlar ilova darajasidagi provider'dan (alohida watch yo'q)
  const { customers, loading } = useRefData();

  return (
    <View className="flex-1">
      <Search />
      {loading ? <Loading color="#007AFF" /> : <CustomerList data={customers} />}
    </View>
  );
};

export default Customers;
