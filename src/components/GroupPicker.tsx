import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Select from "./Select";

export type GroupBy = null | "region" | "product" | "lot";

interface GroupPickerProps {
  value: GroupBy;
  onChange: (value: GroupBy) => void;
}

const GroupPicker: React.FC<GroupPickerProps> = ({ value, onChange }) => {
  const groupByOptions = useMemo(
    () => [
      { label: "Viloyat", value: "region" },
      { label: "Mahsulot", value: "product" },
      { label: "Partiya", value: "lot" },
    ],
    [],
  );

  return (
    <View style={styles.groupPicker}>
      <View style={{ flex: 1 }}>
        <Select
          data={groupByOptions}
          placeholder="Guruhlash..."
          searchPlaceholder="Qidirish..."
          value={value}
          onChange={(v) => onChange(v as GroupBy)}
        />
      </View>
    </View>
  );
};

export default GroupPicker;

const styles = StyleSheet.create({
  groupPicker: {
    flexDirection: "row",
  },
});
