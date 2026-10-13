import Card from "@/components/Card";
import db, { where } from "@/services/database";
import { formatPhone } from "@/utils/format";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Customer } from "@interfaces/index";
import { callPhone, openTelegram } from "@utils/actions";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, Pressable, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";

const CustomerList = ({ data }: { data: Customer[] }) => {
  const router = useRouter();
  const rowRefs = useRef(new Map<string, any>());
  const prevOpenedRow = useRef<string | null>(null);

  const [listData, setListData] = useState<Customer[]>(data);
  const [tags, setTags] = useState<any[]>([]);
  const [unreadChatIds, setUnreadChatIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = db.lead_chats.watch((chats) => {
      const ids = chats
        .filter((c) => (c.unread_count || 0) > 0)
        .map((c) => c.id || c.lead_id)
        .filter(Boolean) as string[];
      setUnreadChatIds(new Set(ids));
    }, where("unread_count", ">", 0));

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    db.tags.list().then(setTags);
  }, []);

  const tagsMap = useMemo(() => {
    const map: Record<string, string> = {};
    tags.forEach((t) => {
      map[t.id] = (t.name as string) || t.id;
    });
    return map;
  }, [tags]);

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
          onPress={() =>
            openTelegram(item.telegram_id || item.phone, undefined, {
              chatId: item.id!,
              title: item.name,
            })
          }
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
          <View
            className={`${
              item.id && unreadChatIds.has(item.id)
                ? "bg-green-50 shadow-green-200/50"
                : "bg-white shadow-slate-400/30"
            } rounded-2xl overflow-hidden shadow-sm`}
          >
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
                <Card
                  className={
                    item.id && unreadChatIds.has(item.id) ? "bg-green-50" : ""
                  }
                >
                  <View className="flex-row justify-between mb-1">
                    <View className="flex-row items-center flex-1">
                      <Text className="text-lg font-semibold text-gray-900 pr-2">
                        {item.name}
                      </Text>
                      {item.id && unreadChatIds.has(item.id) && (
                        <View className="bg-green-500 rounded-full w-2.5 h-2.5 shadow-sm shadow-green-400" />
                      )}
                    </View>
                    {item.id && unreadChatIds.has(item.id) && (
                      <View className="bg-green-50 flex-row items-center px-2 py-1 rounded-full border border-green-200 shadow-sm">
                        <MaterialIcons
                          name="chat-bubble"
                          size={10}
                          color="#10b981"
                        />
                        <Text className="text-[9px] font-black text-green-700 ml-1 tracking-tighter uppercase">
                          Yangi
                        </Text>
                      </View>
                    )}
                    <View className="flex-row gap-1 items-center">
                      <MaterialIcons
                        name="location-pin"
                        size={16}
                        className="text-green-700"
                      />
                      <Text className="text-gray-900">
                        {[item.district_name, item.region_name]
                          .filter(Boolean)
                          .join(", ")}
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
