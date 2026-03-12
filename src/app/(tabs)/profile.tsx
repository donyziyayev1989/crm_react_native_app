import Card from "@/components/Card";
import { auth, database } from "@/firebase/firebase";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import {
  GoogleAuthProvider,
  signInWithCredential,
  signOut,
  User,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "",
});

const Profile = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async () => {
    try {
      setLoading(true);
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;

      if (!idToken) throw new Error("No ID Token found");

      const googleCredential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, googleCredential);
      const currentUser = userCredential.user;

      // Save/Update user in Firestore
      await setDoc(
        doc(database, "users", currentUser.uid),
        {
          name: currentUser.displayName || "Noma'lum foydalanuvchi",
          email: currentUser.email || null,
          photoURL: currentUser.photoURL || null,
          role: "employee", // Default role
        },
        { merge: true },
      );

      Alert.alert("Tizimga kirildi", "Muvaffaqiyatli tizimga kirdingiz!");
    } catch (error: any) {
      console.error(error);
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
      await signOut(auth);
      await GoogleSignin.signOut();
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
      <Text style={styles.title}>Shaxsiy profil</Text>

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
};

export default Profile;

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
