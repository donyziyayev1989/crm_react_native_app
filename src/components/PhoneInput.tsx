import CustomModal from "@/components/CustomModal";
import { InputProps } from "@/interfaces/index";
import { localInputPart, toLocal9 } from "@/utils/phone";
import { MaterialIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MaskInput from "react-native-mask-input";

let CallLogs: any;
try {
  CallLogs = require("react-native-call-log");
  if (CallLogs?.default) {
    CallLogs = CallLogs.default;
  }
} catch {
  // react-native-call-log is not available (e.g. in Expo Go or non-android)
  CallLogs = null;
}

const localPhoneMask = [
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

  const openCallLogs = React.useCallback(async () => {
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
        const callLogs = await CallLogs.load(100);
        setLogs(callLogs || []);
        setLoading(false);
      } else {
        alert("Ruxsat berilmadi");
      }
    } catch (e) {
      console.error(e);
      alert("Xato yuz berdi");
      setLoading(false);
    }
  }, []);

  const handleSelectLog = React.useCallback(
    (phoneNumber: string) => {
      onChange("+998 " + toLocal9(phoneNumber));
      setModalVisible(false);
    },
    [onChange],
  );

  // MaskInput uchun mahalliy 9 raqam (+998 dan keyingi qism)
  const localValue = React.useMemo(() => localInputPart(value), [value]);

  return (
    <View style={styles.container}>
      <View style={[styles.inputWrapper, errors?.[name] && styles.inputError]}>
        <Text style={styles.prefix}>+998 </Text>
        <MaskInput
          {...(props as any)}
          value={localValue}
          onChangeText={(masked, unmasked) => {
            // Always store as +998 + digits in the parent state
            onChange(unmasked ? "+998 " + unmasked : "");
          }}
          mask={localPhoneMask}
          style={styles.maskInput}
          placeholder={placeholder || "__ ___-__-__"}
          placeholderTextColor="#9ca3af"
          keyboardType="phone-pad"
        />
        {Platform.OS === "android" && (
          <Pressable onPress={openCallLogs} style={styles.iconButton}>
            <MaterialIcons name="history" size={24} color="#6b7280" />
          </Pressable>
        )}
      </View>

      <CustomModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        modalTitle={"Qo'ng'iroqlar tarixi"}
        sheetStyle={{ zIndex: 1000 }}
      >
        <View style={styles.modalContent}>
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
                      ? new Date(parseInt(item.timestamp)).toLocaleDateString()
                      : ""}
                  </Text>
                </Pressable>
              )}
            />
          )}
        </View>
      </CustomModal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "relative",
    justifyContent: "center",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: "#fff",
    elevation: 2,
    height: 48,
  },
  prefix: {
    fontSize: 15,
    color: "#111827",
    fontWeight: "500",
  },
  maskInput: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
    height: "100%",
  },
  inputError: {
    borderColor: "#ef4444",
  },
  iconButton: {
    padding: 4,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
