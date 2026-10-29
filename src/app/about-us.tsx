import Card from "@/components/Card";
import Loading from "@/components/Loading";
import db from "@/services/database";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Link, Stack } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function AboutUsScreen() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Bitta hujjat — butun settings kolleksiyasini kuzatish shart emas
    db.settings
      .get("about_us")
      .then((doc) => setText(doc?.text || ""))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!text.trim()) {
      Alert.alert("Xato", "Ma'lumot matnini kiriting");
      return;
    }

    setSaving(true);
    try {
      await db.settings.set("about_us", {
        text: text.trim(),
        updatedAt: new Date().toISOString(),
      });
      Alert.alert("Muvaffaqiyat", "Ma'lumotlar yangilandi!");
    } catch (e: any) {
      Alert.alert("Xatolik", "Saqlashda xatolik yuz berdi: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading color="#10b981" />;

  return (
    <>
      <Stack.Screen
        options={{
          title: "Biz haqimizda",
          headerLeft: () => (
            <Link href="/" asChild>
              <Pressable className="p-3">
                <MaterialIcons name="arrow-back" size={24} color="#6b7280" />
              </Pressable>
            </Link>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card className="p-4" style={styles.boxShadow}>
          <View style={styles.header}>
            <MaterialIcons name="info" size={24} color="#3b82f6" />
            <Text style={styles.title}>Kompaniya haqida ma'lumot</Text>
          </View>
          <TextInput
            style={styles.textArea}
            value={text}
            onChangeText={setText}
            placeholder="Kompaniya haqida ma'lumotni bu yerga yozing..."
            multiline
            textAlignVertical="top"
          />
          <Pressable
            style={[styles.saveButton, saving && styles.disabledButton]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialIcons name="save" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Saqlash</Text>
              </>
            )}
          </Pressable>
        </Card>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { padding: 16 },
  boxShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  title: { fontSize: 18, fontWeight: "800", color: "#111827" },
  label: { fontSize: 14, color: "#6b7280", marginBottom: 8, fontWeight: "500" },
  textArea: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#374151",
    minHeight: 250,
    lineHeight: 24,
  },
  saveButton: {
    backgroundColor: "#10b981",
    paddingVertical: 16,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 20,
  },
  disabledButton: { opacity: 0.7 },
  saveButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
