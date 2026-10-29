import CustomerList from "@/components/CustomerList";
import Loading from "@/components/Loading";
import db, { limit, where } from "@/services/database";
import { digitsOnly, phoneVariants } from "@/utils/phone";
import { Customer } from "@interfaces/index";
import { Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { View } from "react-native";

const SearchResults = () => {
  const { q, lotId, region, lotName, tagId, tagName } = useLocalSearchParams<{
    q?: string;
    lotId?: string;
    region?: string;
    lotName?: string;
    tagId?: string;
    tagName?: string;
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
          const queryText = q.trim();

          if (digitsOnly(queryText).length >= 7) {
            constraints.push(where("phone", "in", phoneVariants(queryText)));
          } else {
            // Agar raqam bo'lmasa, ism bo'yicha qidirishga harakat qilamiz
            constraints.push(where("name", ">=", queryText));
            constraints.push(where("name", "<=", queryText + "\uf8ff"));
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

        // Teg bo'yicha filter
        if (tagId && tagId !== "") {
          constraints.push(where("tag_ids", "array-contains", tagId));
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
  }, [q, lotId, region, tagId]);

  if (loading) return <Loading color="#007AFF" />;

  return (
    <View className="flex-1">
      <Stack.Screen
        options={{
          title:
            [
              lotName && `Partiya: ${lotName}`,
              region && `Viloyat: ${region}`,
              tagName && `Teg: ${tagName}`,
              q && `"${q}"`,
            ]
              .filter(Boolean)
              .join(" · ") || "Qidiruv natijalari",
        }}
      />

      <CustomerList data={results} />
    </View>
  );
};

export default SearchResults;
