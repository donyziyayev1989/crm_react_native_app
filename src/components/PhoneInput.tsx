import { InputProps } from "@/interfaces/index";
import { MaterialIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MaskInput from "react-native-mask-input";

const phoneMask = [
  "+",
  "9",
  "9",
  "8",
  " ",
  /\d/,
  /\d/,
  " ",
  /\d/,
  /\d/,
  /\d/,
  " ",
  /\d/,
  /\d/,
  " ",
  /\d/,
  /\d/,
];

const PhoneInput = ({
  name,
  value,
  onChange,
  errors,
  placeholder,
  ...props
}: InputProps & { onFocus?: any; onBlur?: any }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const formatPhoneNumberForInput = (phone: string) => {
    // Basic extraction of digits handling +998 cases
    let digits = phone.replace(/\D/g, "");
    if (digits.startsWith("998")) {
      digits = digits.slice(3);
    }
    // format to +998 XX XXX-XX-XX
    if (digits.length <= 9) {
      let formatted = "+998 ";
      if (digits.length > 0) formatted += digits.substring(0, 2);
      if (digits.length > 2) formatted += " " + digits.substring(2, 5);
      if (digits.length > 5) formatted += "-" + digits.substring(5, 7);
      if (digits.length > 7) formatted += "-" + digits.substring(7, 9);
      return formatted;
    }
    return phone;
  };

  const openCallLogs = async () => {
    let CallLogs: any = null;
    try {
      CallLogs = require("react-native-call-log");
      if (CallLogs && CallLogs.default) {
        CallLogs = CallLogs.default;
      }
    } catch (e) {
      console.warn("react-native-call-log error:", e);
    }

    if (!CallLogs) {
      alert(
        "Qo'ng'iroqlar tarixini ko'rish uchun ilovani 'prebuild' qilib Native rejimda ishga tushirishingiz kerak (bu xususiyat Expo Go'da ishlamaydi).",
      );
      return;
    }

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
        {
          title: "Ruxsat so'rovi",
          message: "Qo'ng'iroqlar tarixini ko'rish uchun ruxsat bering.",
          buttonNeutral: "Keyinroq",
          buttonNegative: "Bekor qilish",
          buttonPositive: "Ruxsat berish",
        },
      );
      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        setModalVisible(true);
        setLoading(true);
        const callLogs = await CallLogs.load(30);
        setLogs(callLogs);
        setLoading(false);
      } else {
        alert("Ruxsat berilmadi");
      }
    } catch (e) {
      console.error(e);
      alert("Xato yuz berdi");
    }
  };

  const handleSelectLog = (phoneNumber: string) => {
    const formatted = formatPhoneNumberForInput(phoneNumber);
    onChange(formatted);
    setModalVisible(false);
  };

  return (
    <View style={styles.container}>
      <MaskInput
        {...(props as any)}
        value={value}
        onChangeText={(masked, unmasked) => {
          if (
            masked === "+" ||
            masked === "+9" ||
            masked === "+99" ||
            masked === "+998" ||
            masked === "+998 "
          ) {
            onChange("");
          } else {
            onChange(masked);
          }
        }}
        onFocus={(e) => {
          if (!value) {
            onChange("+998 ");
          }
          if (props.onFocus) props.onFocus(e);
        }}
        onBlur={(e) => {
          if (value === "+998 " || value === "+998") {
            onChange("");
          }
          if (props.onBlur) props.onBlur(e);
        }}
        mask={phoneMask}
        style={[styles.input, errors?.[name] && styles.inputError]}
        placeholder={placeholder || "+998 __ ___-__-__"}
        placeholderTextColor="#9ca3af"
        keyboardType="phone-pad"
      />
      {Platform.OS === "android" && (
        <Pressable onPress={openCallLogs} style={styles.iconButton}>
          <MaterialIcons name="history" size={24} color="#6b7280" />
        </Pressable>
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Qo'ng'iroqlar tarixi</Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <MaterialIcons name="close" size={24} color="#111827" />
              </Pressable>
            </View>

            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color="#007AFF" />
              </View>
            ) : (
              <FlatList
                data={logs}
                keyExtractor={(item, index) =>
                  item.timestamp?.toString() || index.toString()
                }
                renderItem={({ item }) => (
                  <Pressable
                    style={styles.logItem}
                    onPress={() => handleSelectLog(item.phoneNumber)}
                  >
                    <View style={styles.logIcon}>
                      <MaterialIcons
                        name={
                          item.type === "INCOMING"
                            ? "call-received"
                            : item.type === "OUTGOING"
                              ? "call-made"
                              : "call-missed"
                        }
                        size={20}
                        color={item.type === "MISSED" ? "#ef4444" : "#6b7280"}
                      />
                    </View>
                    <View style={styles.logDetails}>
                      <Text style={styles.logName}>
                        {item.name || "Noma'lum"}
                      </Text>
                      <Text style={styles.logPhone}>{item.phoneNumber}</Text>
                    </View>
                    <Text style={styles.logDate}>
                      {item.timestamp
                        ? new Date(
                            parseInt(item.timestamp),
                          ).toLocaleDateString()
                        : ""}
                    </Text>
                  </Pressable>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "relative",
    justifyContent: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingRight: 45, // Add padding for the icon
    paddingVertical: 12,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#fff",
    boxShadow: "0px 1px 1.41px rgba(85, 85, 85, 0.1)",
    elevation: 2,
  },
  inputError: {
    borderColor: "#ef4444",
  },
  iconButton: {
    position: "absolute",
    right: 12,
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: "70%",
    padding: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f9fafb",
  },
  logIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  logDetails: {
    flex: 1,
  },
  logName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#111827",
    marginBottom: 2,
  },
  logPhone: {
    fontSize: 14,
    color: "#6b7280",
  },
  logDate: {
    fontSize: 12,
    color: "#9ca3af",
  },
});

export default PhoneInput;
