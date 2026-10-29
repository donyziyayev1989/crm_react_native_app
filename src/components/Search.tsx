import Select from "@/components/Select";
import { useRefData } from "@/providers/ReferenceData";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, TextInput, View } from "react-native";

/**
 * Search (Mijozlarni qidirish va filtrlash)
 */
const Search = ({ initialValue = "" }: { initialValue?: string }) => {
  const [val, setVal] = useState(initialValue);
  const { lots, regions, tags } = useRefData();
  const allLots = useMemo(() => lots.map((l) => ({ label: l.name, value: l.id })), [lots]);
  const allRegions = useMemo(
    () => regions.map((r) => ({ label: r.name, value: r.name })),
    [regions],
  );
  const allTags = useMemo(() => tags.map((t) => ({ label: t.name, value: t.id })), [tags]);
  const [lotId, setLotId] = useState<string>("");
  const [region, setRegion] = useState<string>("");
  const [tagId, setTagId] = useState<string>("");
  const [showFilter, setShowFilter] = useState(false);
  const router = useRouter();

  const handleSearch = () => {
    const selectedLot = allLots.find((o) => o.value === lotId);
    const selectedTag = allTags.find((o) => o.value === tagId);
    const params: Record<string, string> = {};

    if (val.trim()) params.q = val.trim();
    if (lotId) {
      params.lotId = lotId;
      if (selectedLot) params.lotName = selectedLot.label;
    }
    if (region) params.region = region;
    if (tagId) {
      params.tagId = tagId;
      if (selectedTag) params.tagName = selectedTag.label;
    }

    router.push({
      pathname: "/customers/search_results",
      params,
    });
  };

  return (
    <>
      <View className="flex-row items-center p-2">
        <Pressable
          className="ml-2 px-2"
          onPress={() => setShowFilter(!showFilter)}
        >
          <MaterialIcons
            name="filter-alt"
            size={24}
            color={showFilter ? "#6366f1" : "gray"}
          />
        </Pressable>
        <TextInput
          placeholder="Mijoz ismi yoki telefoni..."
          value={val}
          onChangeText={setVal}
          onSubmitEditing={handleSearch}
          className="flex-1 border border-gray-300 rounded-full px-4 py-3 bg-white focus:border-primary"
        />
        <Pressable onPress={handleSearch} className="ml-2 px-2">
          <MaterialIcons name="search" size={28} color="gray" />
        </Pressable>
      </View>
      {showFilter && (
        <View className="flex px-2 gap-2">
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Select
                name="lot_id"
                data={allLots}
                search={true}
                placeholder="Partiyalar"
                searchPlaceholder="Qidirish..."
                maxHeight={300}
                value={lotId}
                onChange={(val) => {
                  setLotId(val);
                }}
              />
            </View>
            <View className="flex-1">
              <Select
                name="region_ids"
                data={allRegions}
                search={true}
                placeholder="Viloyatlar"
                searchPlaceholder="Qidirish..."
                maxHeight={300}
                value={region}
                onChange={(val) => {
                  setRegion(val);
                }}
              />
            </View>
          </View>
          <View>
            <Select
              name="tag_id"
              data={allTags}
              search={true}
              placeholder="Teg bo'yicha filter"
              searchPlaceholder="Teg qidirish..."
              maxHeight={300}
              value={tagId}
              onChange={(val) => {
                setTagId(val);
              }}
            />
          </View>
        </View>
      )}
    </>
  );
};

export default Search;
