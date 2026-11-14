import Card from "@/components/Card";
import {
  AppUser,
  onAuthStateChanged,
  signInWithEmail,
  signOut,
} from "@/supabase/auth";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Link, Stack } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function Profile() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Xatolik", "Email va parolni kiriting.");
      return;
    }
    try {
      setSubmitting(true);
      // Faqat profiles jadvalida faol xodim bo'lganlar kiradi (aks holda NoAccessError)
      await signInWithEmail(email, password);
      setPassword("");
    } catch (error: any) {
      Alert.alert("Xatolik", error.message || "Tizimga kirishda xatolik yuz berdi.");
    } finally {
      setSubmitting(false);
    }
  };

  const logOut = async () => {
    try {
      setLoading(true);
      await signOut();
    } catch (error: any) {
      console.error(error);
      Alert.alert("Xatolik", "Tizimdan chiqishda xatolik yuz berdi.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen
        options={{
          title: "Shaxsiy profil",
          headerLeft: () => (
            <Link href="/" asChild>
              <Pressable className="p-3">
                <MaterialIcons name="arrow-back" size={24} color="#6b7280" />
              </Pressable>
            </Link>
          ),
        }}
      />
      {user ? (
        <Card>
          <View style={styles.profileHeader}>
            {user.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <MaterialIcons name="person" size={40} color="#9ca3af" />
              </View>
            )}
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user.displayName}</Text>
              <Text style={styles.userEmail}>{user.email}</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>Tizim xodimi</Text>
              </View>
            </View>
          </View>

          <Pressable style={styles.logoutBtn} onPress={logOut}>
            <MaterialIcons name="logout" size={20} color="#ef4444" />
            <Text style={styles.logoutBtnText}>Tizimdan chiqish</Text>
          </Pressable>
        </Card>
      ) : (
        <Card>
          <View style={styles.loginContent}>
            <MaterialIcons name="account-circle" size={60} color="#9ca3af" />
            <Text style={styles.loginText}>
              Xaridlar va mijozlarni tizimga qo'shish uchun hisobingizga kiring.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#9ca3af"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              editable={!submitting}
            />

            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Parol"
                placeholderTextColor="#9ca3af"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={signIn}
                editable={!submitting}
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={8}
                style={styles.eyeBtn}
                accessibilityRole="button"
                accessibilityLabel={
                  showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"
                }
              >
                <MaterialIcons
                  name={showPassword ? "visibility-off" : "visibility"}
                  size={22}
                  color="#6b7280"
                />
              </Pressable>
            </View>

            <Pressable
              style={[styles.loginBtn, submitting && styles.loginBtnDisabled]}
              onPress={signIn}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="login" size={20} color="#fff" />
                  <Text style={styles.loginBtnText}>Kirish</Text>
                </>
              )}
            </Pressable>
          </View>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, flexGrow: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 16,
  },

  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 24,
  },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  userInfo: { flex: 1 },
  userName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  userEmail: { fontSize: 14, color: "#6b7280", marginBottom: 8 },
  roleBadge: {
    backgroundColor: "#dbeafe",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  roleText: { color: "#1d4ed8", fontSize: 12, fontWeight: "600" },

  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    backgroundColor: "#fee2e2",
    borderRadius: 12,
    gap: 8,
  },
  logoutBtnText: { color: "#ef4444", fontSize: 16, fontWeight: "600" },

  loginContent: { alignItems: "center", paddingVertical: 32, gap: 16 },
  loginText: {
    textAlign: "center",
    color: "#6b7280",
    fontSize: 15,
    paddingHorizontal: 16,
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
    backgroundColor: "#fff",
  },
  passwordRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
  },
  eyeBtn: { paddingHorizontal: 12, paddingVertical: 10 },
  loginBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6366f1",
    padding: 14,
    borderRadius: 12,
    gap: 12,
    width: "100%",
    marginTop: 8,
  },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
