import React from "react";
import { Text, View } from "react-native";
import { lostPercent } from "../utils/lots";

interface Props {
  /** Reja (partiyadagi jami tovar soni) */
  planned: number;
  /** Buyurtmalar bilan band qilingan dona */
  ordered: number;
  /** Yo'qotilgan dona */
  lost: number;
}

/** `part` ning `whole` dagi ulushi, 0–100 oralig'ida. */
const pct = (part: number, whole: number) =>
  whole > 0 ? Math.min(100, Math.max(0, (part * 100) / whole)) : 0;

/** "Reja bandligi": band / yo'qotilgan / bo'sh dona (kurka.uz admin partiya sahifasidagi kabi). */
const CapacityBar = ({ planned, ordered, lost }: Props) => {
  const free = planned - ordered - lost;

  const lostPct = lostPercent({ product_count: planned, lost_products: lost });

  return (
    <View className="mt-3 shadow-slate-300">
      <View className="flex-row items-center justify-between mb-1.5">
        <Text className="text-xs font-medium text-gray-500">Reja bandligi</Text>
        <Text className="text-xs text-gray-500">
          Reja: <Text className="font-semibold text-gray-800">{planned}</Text>{" "}
          ta
        </Text>
      </View>
      <View
        className="flex-row h-3 rounded-full overflow-hidden bg-slate-200"
        accessible
        accessibilityLabel={`Band ${ordered}, yo'qotilgan ${lost}, bo'sh ${Math.max(free, 0)} ta, reja ${planned}`}
      >
        <View
          className="h-full bg-[#2a78d6]"
          style={{ width: `${pct(ordered, planned)}%` }}
        />
        <View
          className="h-full bg-[#e34948] ml-0.5"
          style={{ width: `${pct(lost, planned)}%` }}
        />
      </View>
      {/* Uch teng ustun: matn uzun bo'lsa ham o'z ustunida o'raladi, qatorlar bir-biriga o'tmaydi */}
      <View className="flex-row mt-2.5 gap-2">
        <Stat color="bg-[#2a78d6]" label="Band" value={`${ordered} ta`} />
        <Stat
          color="bg-[#e34948]"
          label="Yo'qotilgan"
          value={`${lost} ta`}
          extra={`${lostPct}%`}
        />
        <Stat
          color="bg-slate-200 border border-slate-300"
          label="Bo'sh"
          value={`${Math.max(free, 0)} ta`}
        />
      </View>
      {free < 0 && (
        <Text className="text-xs text-red-500 mt-2">
          Reja {-free} ta oshib ketgan
        </Text>
      )}
    </View>
  );
};

const Stat = ({
  color,
  label,
  value,
  extra,
}: {
  color: string;
  label: string;
  value: string;
  extra?: string;
}) => (
  <View className="flex-1">
    <View className="flex-row items-center gap-1.5">
      <View className={`w-2.5 h-2.5 rounded-sm ${color}`} />
      <Text className="text-xs text-gray-500" numberOfLines={1}>
        {label}
      </Text>
    </View>
    <Text className="text-sm font-semibold text-gray-800 mt-0.5 ms-4">
      {value}
      {extra ? (
        <Text className="text-xs font-normal text-gray-500">{`  ${extra}`}</Text>
      ) : null}
    </Text>
  </View>
);

export default CapacityBar;
