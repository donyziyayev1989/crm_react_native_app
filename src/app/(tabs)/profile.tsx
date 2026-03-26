import Card from "@/components/Card";
import db from "@/services/database";
import {
  auth,
  federatedGoogleAuthProvider,
  federatedOnAuthStateChanged,
  federatedSignInWithCredential,
  federatedSignOut,
} from "@/firebase/firebase";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Link, Stack } from "expo-router";
import { User } from "firebase/auth";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function Profile() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Safe GoogleSignin access
  const getGoogleSignin = () => {
    try {
      return require("@react-native-google-signin/google-signin").GoogleSignin;
    } catch (e) {
      return null;
    }
  };

  useEffect(() => {
    const initGoogle = async () => {
      if (Platform.OS !== "web") {
        try {
          const GSignin = getGoogleSignin();
          if (GSignin) {
            GSignin.configure({
              webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "",
            });
          }
        } catch (e) {
          console.error("GoogleSignin init error:", e);
        }
      }
    };
    initGoogle();
  }, []);

  useEffect(() => {
    const unsubscribe = federatedOnAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async () => {
    try {
      if (Platform.OS === ("web" as string)) {
        Alert.alert(
          "Xato",
          "Web versiyada Google orqali kirish hali qo'shilmagan",
        );
        return;
      }

      const GSignin = getGoogleSignin();
      if (!GSignin) {
        throw new Error(
          "Google Sign-In moduli topilmadi. Ilovani qayta build qiling.",
        );
      }

      setLoading(true);
      await GSignin.hasPlayServices();
      const userInfo = await GSignin.signIn();
      const idToken = userInfo.data?.idToken;

      if (!idToken) throw new Error("No ID Token found");

      const googleCredential = federatedGoogleAuthProvider.credential(idToken);
      const userCredential =
        await federatedSignInWithCredential(googleCredential);
      const currentUser = userCredential.user;

      // Save/Update user in Firestore
      await db.users.set(currentUser.uid, {
        name: currentUser.displayName || "Noma'lum foydalanuvchi",
        email: currentUser.email || null,
        photoURL: currentUser.photoURL || null,
        role: "employee", // Default role
      });

      Alert.alert("Tizimga kirildi", "Muvaffaqiyatli tizimga kirdingiz!");
    } catch (error: any) {
      Alert.alert(
        "Xatolik",
        "Tizimga kirishda xatolik yuz berdi: " + error.message,
      );
    } finally {
      setLoading(false);
    }
  };

  const logOut = async () => {
    try {
      setLoading(true);
      await federatedSignOut();
      const GSignin = getGoogleSignin();
      if (Platform.OS !== ("web" as string) && GSignin) {
        await GSignin.signOut();
      }
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

            <Pressable style={styles.googleBtn} onPress={signIn}>
              <MaterialIcons name="g-translate" size={20} color="#fff" />
              <Text style={styles.googleBtnText}>Google orqali kirish</Text>
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
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4285F4",
    padding: 14,
    borderRadius: 12,
    gap: 12,
    width: "100%",
    marginTop: 8,
  },
  googleBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
