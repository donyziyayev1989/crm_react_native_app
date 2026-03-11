import { InputProps } from "@/interfaces/index";
import React from "react";
import { StyleSheet, TextInput } from "react-native";

const Input = ({
  name,
  value,
  onChange,
  errors,
  placeholder,
  multiline,
  keyboardType,
  ...props
}: InputProps) => {
  if (multiline) {
    return (
      <TextInput
        {...props}
        keyboardType={keyboardType}
        style={[
          styles.input,
          styles.textArea,
          errors?.[name] && styles.inputError,
        ]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        placeholderTextColor="#9ca3af"
      />
    );
  }
  return (
    <TextInput
      {...props}
      keyboardType={keyboardType}
      style={[styles.input, errors?.[name] && styles.inputError]}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor="#9ca3af"
    />
  );
};

const styles = StyleSheet.create({
  input: {
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
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  valueText: {
    fontSize: 15,
    color: "#111827",
    paddingVertical: 4,
  },
  focusInput: {
    borderColor: "#6366f1",
  },
  inputDisabled: {
    backgroundColor: "#f9fafb",
    borderColor: "#f3f4f6",
    color: "#374151",
  },
  inputError: {
    borderColor: "#ef4444",
  },
});
export default Input;
