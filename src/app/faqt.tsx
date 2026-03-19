import Card from "@/components/Card";
import { database } from "@/firebase/firebase";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Stack } from "expo-router";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";

import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function FAQScreen() {
  const [faqs, setFaqs] = useState<any[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(database, "faqs"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const faqList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setFaqs(faqList);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async () => {
    if (!question || !answer) {
      Alert.alert("Xato", "Savol va javobni kiriting");
      return;
    }

    try {
      if (editingId) {
        // Update existing FAQ
        await updateDoc(doc(database, "faqs", editingId), {
          question,
          answer,
          updatedAt: new Date().toISOString(),
        });
        Alert.alert("Muvaffaqiyat", "Savol muvaffaqiyatli tahrirlandi");
      } else {
        // Add new FAQ
        await addDoc(collection(database, "faqs"), {
          question,
          answer,
          createdAt: new Date().toISOString(),
        });
        Alert.alert("Muvaffaqiyat", "Yangi savol qo'shildi");
      }
      setQuestion("");
      setAnswer("");
      setIsAdding(false);
      setEditingId(null);
    } catch (e: any) {
      Alert.alert(
        "Xatolik",
        `FAQ ${editingId ? "tahrirlashda" : "qo'shishda"} xatolik yuz berdi: ` +
          e.message,
      );
    }
  };

  const editFaq = (faq: any) => {
    setEditingId(faq.id);
    setQuestion(faq.question);
    setAnswer(faq.answer);
    setIsAdding(true);
  };

  const deleteFaq = (id: string) => {
    Alert.alert("O'chirish", "Ushbu savolni o'chirishni xohlaysizmi?", [
      { text: "Yo'q", style: "cancel" },
      {
        text: "Ha",
        onPress: async () => {
          try {
            await deleteDoc(doc(database, "faqs", id));
          } catch (e: any) {
            Alert.alert(
              "Xatolik",
              "O'chirishda xatolik yuz berdi: " + e.message,
            );
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Ko'p berilgan savol-javoblar",
          headerTransparent: false,
          headerRight: () => (
            <Pressable
              style={[
                styles.addButton,
                { backgroundColor: isAdding ? "#f87171" : "#10b981" },
              ]}
              onPress={() => {
                if (isAdding) {
                  setIsAdding(false);
                  setEditingId(null);
                  setQuestion("");
                  setAnswer("");
                } else {
                  setIsAdding(true);
                }
              }}
            >
              <MaterialIcons
                name={isAdding ? "close" : "add"}
                size={20}
                color="#fff"
              />
            </Pressable>
          ),
        }}
      />

      {isAdding && (
        <Card className="mb-4 p-4" style={styles.boxShadow}>
          <View style={{ gap: 12 }}>
            <Text style={styles.formTitle}>
              {editingId ? "Savolni tahrirlash" : "Yangi savol qo'shish"}
            </Text>
            <TextInput
              placeholder="Savolni kiriting..."
              value={question}
              onChangeText={setQuestion}
              style={styles.input}
              multiline
            />
            <TextInput
              placeholder="Javobni kiriting..."
              value={answer}
              onChangeText={setAnswer}
              style={[styles.input, styles.textArea]}
              multiline
            />
            <Pressable style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>
                {editingId ? "Yangilash" : "Saqlash"}
              </Text>
            </Pressable>
          </View>
        </Card>
      )}

      <FlatList
        data={faqs}
        keyExtractor={(item) => item.id}
        style={{ padding: 3, margin: -3 }}
        renderItem={({ item }) => (
          <Card className="mb-3 p-4" style={styles.boxShadow}>
            <View style={styles.faqHeader}>
              <Text style={styles.questionText}>🤔 {item.question}</Text>
            </View>

            <View style={styles.divider} />
            <Text style={styles.answerText}>💡 {item.answer}</Text>
            <View style={styles.actionButtons}>
              <Pressable
                onPress={() => editFaq(item)}
                style={styles.iconButton}
              >
                <MaterialIcons name="edit" size={22} color="#777777" />
              </Pressable>
              <Pressable
                onPress={() => deleteFaq(item.id)}
                style={styles.iconButton}
              >
                <MaterialIcons name="delete-sweep" size={22} color="#f87171" />
              </Pressable>
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="help-outline" size={60} color="#d1d5db" />
            <Text style={styles.emptyText}>Hozircha savollar mavjud emas.</Text>
          </View>
        }
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb", padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  boxShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    backgroundColor: "#fff",
    color: "#374151",
  },
  textArea: { minHeight: 100, textAlignVertical: "top" },
  saveButton: {
    backgroundColor: "#10b981",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  listContainer: { paddingBottom: 40 },
  faqHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
    marginTop: 10,
  },
  iconButton: { padding: 4 },
  formTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
  },

  questionText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
    lineHeight: 22,
  },
  answerText: { fontSize: 15, color: "#4b5563", lineHeight: 24 },
  divider: { height: 1, backgroundColor: "#f3f4f6", marginVertical: 8 },
  emptyContainer: { alignItems: "center", marginTop: 100, gap: 12 },
  emptyText: {
    textAlign: "center",
    color: "#9ca3af",
    fontSize: 16,
    fontWeight: "500",
  },
});
