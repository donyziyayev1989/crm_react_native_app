import CustomerList from "@/components/CustomerList";
import db, { limit, where } from "@/services/database";
import { Customer } from "@interfaces/index";
import { Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

const SearchResults = () => {
  const { q, lotId, region, lotName } = useLocalSearchParams<{
    q?: string;
    lotId?: string;
    region?: string;
    lotName?: string;
  }>();
  const [results, setResults] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const performSearch = async () => {
      setLoading(true);
      try {
        const constraints = [];

        // Telefon raqami bo'yicha qidiruv
        if (q && q.trim()) {
          const sanitizedPhone = q.replace(/\D/g, "");
          if (sanitizedPhone) {
            constraints.push(where("phone", "==", sanitizedPhone));
          }
        }

        // Partiya bo'yicha filter (order_ids array-contains)
        if (lotId && lotId !== "") {
          constraints.push(where("order_ids", "array-contains", lotId));
        }

        // Viloyat bo'yicha filter
        if (region && region !== "") {
          constraints.push(where("region_name", "==", region));
        }

        constraints.push(limit(20));

        const allCustomers = await db.customers.list(...(constraints as any));
        setResults(allCustomers);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setLoading(false);
      }
    };

    performSearch();
  }, [q, lotId, region]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View className="flex-1">
      <Stack.Screen
        options={{
          title:
            `Qidiruv: ${(lotName && lotName + ",") || ""} ${(region && region + ",") || ""} ${q ? `"${q}"` : ""}`
              .trim()
              .replace(/\s+/g, " "),
        }}
      />

      <CustomerList data={results} />
    </View>
  );
};

export default SearchResults;
