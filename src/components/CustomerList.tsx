import Card from "@/components/Card";
import db, { database } from "@/services/database";
import { formatPhone } from "@/utils/format";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Customer } from "@interfaces/index";
import { callPhone, openTelegram } from "@utils/actions";
import { useRouter } from "expo-router";
import { collection } from "firebase/firestore";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useCollectionOnce } from "react-firebase-hooks/firestore";
import { Alert, FlatList, Pressable, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";

const CustomerList = ({ data }: { data: Customer[] }) => {
  const router = useRouter();
  const rowRefs = useRef(new Map<string, any>());
  const prevOpenedRow = useRef<string | null>(null);

  const [listData, setListData] = useState<Customer[]>(data);

  const [tagsSnap] = useCollectionOnce(collection(database, "tags") as any);

  const tagsMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (tagsSnap && tagsSnap.docs) {
      tagsSnap.docs.forEach((d) => {
        map[d.id] = (d.data().name as string) || d.id;
      });
    }
    return map;
  }, [tagsSnap]);

  useEffect(() => {
    setListData(data);
  }, [data]);

  const closeRow = (id: string) => {
    if (prevOpenedRow.current !== null && prevOpenedRow.current !== id) {
      const row = rowRefs.current.get(prevOpenedRow.current);
      if (row) row.close();
    }
    prevOpenedRow.current = id;
  };

  const handleDelete = (id: string | undefined) => {
    if (!id) return;
    Alert.alert("O'chirish", "Haqiqatan ham bu mijozni o'chirmoqchimisiz?", [
      { text: "Bekor qilish", style: "cancel" },
      {
        text: "O'chirish",
        style: "destructive",
        onPress: async () => {
          try {
            setListData((prev) => prev.filter((c) => c.id !== id));
            await db.customers.delete(id);
          } catch (error) {
            Alert.alert("Xato", "Mijozni o'chirishda xatolik yuz berdi");
          }
        },
      },
    ]);
  };

  const handleEdit = (customer: Customer) => {
    if (customer.id) {
      closeRow(customer.id);
      router.push(`/customers/edit/${customer.id}`);
    }
  };

  const renderRightPanel = (item: Customer) => {
    return (
      <View className="flex-row z-50">
        <Pressable
          onPress={() => handleEdit(item)}
          className="bg-slate-300 w-16 h-full flex items-center justify-center"
        >
          <MaterialIcons name="edit" size={22} color="white" />
        </Pressable>
        <Pressable
          onPress={() => handleDelete(item.id)}
          className="bg-red-400 w-16 h-full flex items-center justify-center"
        >
          <MaterialIcons name="delete-outline" size={22} color="white" />
        </Pressable>
        <Pressable
          onPress={() => callPhone(item.phone)}
          className="bg-green-500 w-16 h-full flex items-center justify-center"
        >
          <MaterialIcons name="phone" size={24} color="white" />
        </Pressable>
        <Pressable
          onPress={() => openTelegram(item.phone)}
          className="bg-blue-400 w-16 h-full flex items-center justify-center"
        >
          <MaterialIcons name="telegram" size={24} color="white" />
        </Pressable>
      </View>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <FlatList
        data={listData}
        contentContainerStyle={{ padding: 8, gap: 8 }}
        renderItem={({ item }) => (
          <View className="bg-white rounded-2xl overflow-hidden">
            <ReanimatedSwipeable
              ref={
                ((ref: any) => {
                  if (item.id) {
                    if (ref) rowRefs.current.set(item.id, ref);
                    else rowRefs.current.delete(item.id);
                  }
                }) as any
              }
              onSwipeableWillOpen={() => item.id && closeRow(item.id)}
              renderRightActions={() => renderRightPanel(item)}
            >
              <Pressable
                onPress={() => item.id && router.push(`/customers/${item.id}`)}
              >
                <Card>
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-lg font-semibold text-gray-900">
                      {item.name}
                    </Text>
                    <View className="flex-row gap-1 items-center">
                      <MaterialIcons
                        name="location-pin"
                        size={16}
                        className="text-green-700"
                      />
                      <Text className="text-gray-900">
                        {item.district_name}, {item.region_name}
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-gray-600">
                      {formatPhone(item.phone)}
                    </Text>
                    <View className="flex-row gap-1 items-center">
                      {item.tag_ids.map(
                        (tag: string) =>
                          tagsMap[tag] && (
                            <View
                              key={tag}
                              className="bg-slate-300 px-2 rounded-full"
                            >
                              <Text className="text-sm text-black">
                                {tagsMap[tag]}
                              </Text>
                            </View>
                          ),
                      )}
                    </View>
                  </View>
                </Card>
              </Pressable>
            </ReanimatedSwipeable>
          </View>
        )}
        keyExtractor={(item) => item.id || Math.random().toString()}
      />
    </GestureHandlerRootView>
  );
};

export default CustomerList;
