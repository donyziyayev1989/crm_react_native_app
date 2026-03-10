import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Dropdown, MultiSelect } from "react-native-element-dropdown";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SelectItem {
  label: string;
  value: string;
}

interface SelectProps {
  data: SelectItem[];
  placeholder: string;
  searchPlaceholder: string;
  search?: boolean;
  maxHeight?: number;
  multiSelect?: boolean;
  onChange?: (value: any) => void;
  value?: any;
  name?: string;
  errors?: any;
  /** Bir vaqtda nechta element yuklansin (default: 20) */
  pageSize?: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

const Select = ({
  data,
  placeholder,
  searchPlaceholder,
  search,
  maxHeight,
  multiSelect,
  onChange,
  value: propValue,
  name,
  errors,
  pageSize = 20,
}: SelectProps) => {
  const [value, setValue] = useState<any>(null);
  const [isFocus, setIsFocus] = useState(false);
  const [selected, setSelected] = useState<any[]>([]);

  // ─── Infinite load state ───────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchText, setSearchText] = useState("");
  const isLoadingRef = useRef(false);

  /** Search filterlangan to'liq data */
  const filteredData = useMemo(() => {
    if (!searchText.trim()) return data;
    const q = searchText.toLowerCase();
    return data.filter((item) => item.label.toLowerCase().includes(q));
  }, [data, searchText]);

  /** Hozir ko'rsatiladigan slice */
  const visibleData = useMemo(
    () => filteredData.slice(0, page * pageSize),
    [filteredData, page, pageSize],
  );

  const hasMore = visibleData.length < filteredData.length;

  /** Keyingi sahifani yuklash */
  const loadMore = useCallback(() => {
    if (isLoadingRef.current || !hasMore) return;
    isLoadingRef.current = true;
    setLoadingMore(true);
    // Scroll tugaganda biroz kechiktirib yuklarlik qilish uchun (UI "freeze" bo'lmasin)
    setTimeout(() => {
      setPage((p) => p + 1);
      setLoadingMore(false);
      isLoadingRef.current = false;
    }, 150);
  }, [hasMore]);

  /** Search o'zgarganda page ni reset qilish */
  const handleSearch = useCallback((text: string) => {
    setSearchText(text);
    setPage(1);
  }, []);

  /** Dropdown yopilganda search + page ni tozalash */
  const handleClose = useCallback(() => {
    setSearchText("");
    setPage(1);
    setIsFocus(false);
  }, []);

  // ─── Shared flatListProps ──────────────────────────────────────────────────
  const flatListProps = {
    onEndReached: loadMore,
    onEndReachedThreshold: 0.4,
    keyExtractor: (item: SelectItem) => item.value,
    ListFooterComponent: loadingMore ? (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#6366f1" />
      </View>
    ) : null,
  };

  // ─── MultiSelect ──────────────────────────────────────────────────────────
  if (multiSelect) {
    return (
      <MultiSelect
        style={styles.dropdown}
        inputSearchStyle={styles.inputSearchStyle}
        iconStyle={styles.iconStyle}
        data={visibleData}
        labelField="label"
        valueField="value"
        placeholder={placeholder}
        value={selected}
        search={search}
        searchPlaceholder={searchPlaceholder}
        onChangeText={handleSearch}
        onChange={(item) => {
          setSelected(item);
          if (onChange) onChange(item);
        }}
        flatListProps={flatListProps}
        renderRightIcon={() => (
          <MaterialIcons
            name="keyboard-arrow-down"
            style={styles.icon}
            size={16}
            color={isFocus ? "blue" : "black"}
          />
        )}
        renderSelectedItem={(item, unSelect) => (
          <Pressable onPress={() => unSelect && unSelect(item)}>
            <View style={styles.selectedStyle}>
              <Text style={styles.textSelectedStyle}>{item.label}</Text>
              <MaterialIcons color="red" name="delete-outline" size={17} />
            </View>
          </Pressable>
        )}
      />
    );
  }

  // ─── Single Dropdown ──────────────────────────────────────────────────────
  return (
    <Dropdown
      style={[
        styles.dropdown,
        isFocus && styles.focus,
        name && errors?.[name] && styles.errorInput,
      ]}
      data={visibleData}
      search={search}
      maxHeight={maxHeight}
      labelField="label"
      valueField="value"
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      inputSearchStyle={styles.inputSearchStyle}
      value={propValue !== undefined ? propValue : value}
      onChangeText={handleSearch}
      onChange={(item) => {
        setValue(item.value);
        if (onChange) onChange(item.value);
        setIsFocus(false);
      }}
      onFocus={() => setIsFocus(true)}
      onBlur={handleClose}
      flatListProps={flatListProps}
      renderRightIcon={() =>
        isFocus ? (
          <MaterialIcons
            name="keyboard-arrow-up"
            style={styles.icon}
            size={16}
            color="blue"
          />
        ) : (
          <MaterialIcons
            name="keyboard-arrow-down"
            style={styles.icon}
            size={16}
            color="black"
          />
        )
      }
    />
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    margin: 16,
  },
  inputSearchStyle: {
    height: 40,
    fontSize: 16,
  },
  dropdown: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#fff",
    boxShadow: "0px 1px 1.41px rgba(85, 85, 85, 0.1)",
    elevation: 2,
  },
  icon: {
    marginRight: 8,
  },
  label: {
    fontSize: 14,
    color: "#6b7280",
  },
  focus: {
    borderColor: "#9ca3af",
  },
  selectedStyle: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 14,
    backgroundColor: "white",
    marginTop: 8,
    marginRight: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    boxShadow: "0px 1px 1.41px rgba(85, 85, 85, 0.1)",
    elevation: 2,
  },
  textSelectedStyle: {
    marginRight: 5,
    fontSize: 16,
  },
  iconStyle: {
    width: 20,
    height: 20,
  },
  errorInput: {
    borderColor: "#ef4444",
    boxShadow: "0px 1px 1.41px rgba(239, 68, 68, 0.1)",
  },
  footer: {
    paddingVertical: 10,
    alignItems: "center",
  },
});

export default Select;
