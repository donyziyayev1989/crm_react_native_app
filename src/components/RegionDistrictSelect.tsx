import Select from "@/components/Select";
import { useDistrictsOfRegion, useRefData } from "@/providers/ReferenceData";
import { findDistrictName, findRegion } from "@/utils/regions";
import React, { useMemo } from "react";
import { StyleProp, Text, TextStyle, View, ViewStyle } from "react-native";

interface RegionDistrictSelectProps {
  regionName: string;
  districtName: string;
  onChange: (v: { region_name: string; district_name: string }) => void;
  isInModal?: boolean;
  search?: boolean;
  labelStyle?: StyleProp<TextStyle>;
  fieldStyle?: StyleProp<ViewStyle>;
  regionError?: string;
  errorTextStyle?: StyleProp<TextStyle>;
}

/**
 * Viloyat + tuman tanlash. Formada ID emas, NOM saqlanadi (Lead va CRM mosligi uchun),
 * shu sababli nomdan ID ga o'tish findRegion orqali bo'ladi.
 */
const RegionDistrictSelect = ({
  regionName,
  districtName,
  onChange,
  isInModal,
  search = true,
  labelStyle,
  fieldStyle,
  regionError,
  errorTextStyle,
}: RegionDistrictSelectProps) => {
  const { regions } = useRefData();
  const region = useMemo(() => findRegion(regions, regionName), [regions, regionName]);
  const districts = useDistrictsOfRegion(region?.id ?? null);

  const regionOptions = useMemo(
    () => regions.map((r) => ({ label: r.name, value: r.id })),
    [regions],
  );
  const districtOptions = useMemo(
    () => districts.map((d) => ({ label: d.name, value: d.name })),
    [districts],
  );
  const districtValue = useMemo(
    () => (districtName ? findDistrictName(districts, districtName) : null),
    [districts, districtName],
  );

  return (
    <>
      <View style={fieldStyle}>
        <Text style={[labelStyle, !!regionError && { color: "#ef4444" }]}>Viloyat</Text>
        <Select
          data={regionOptions}
          placeholder="Viloyatni tanlang"
          searchPlaceholder="Qidirish..."
          search={search}
          maxHeight={300}
          value={region?.id ?? null}
          isInModal={isInModal}
          onChange={(id: string) => {
            const picked = regions.find((r) => r.id === id);
            onChange({ region_name: picked?.name ?? id, district_name: "" });
          }}
        />
        {regionError ? <Text style={errorTextStyle}>{regionError}</Text> : null}
      </View>

      <View style={fieldStyle}>
        <Text style={labelStyle}>Tuman</Text>
        <Select
          data={districtOptions}
          placeholder="Tumanni tanlang"
          searchPlaceholder="Qidirish..."
          search={search}
          maxHeight={300}
          value={districtValue}
          isInModal={isInModal}
          onChange={(name: string) =>
            onChange({ region_name: region?.name ?? regionName, district_name: name })
          }
        />
      </View>
    </>
  );
};

export default RegionDistrictSelect;
