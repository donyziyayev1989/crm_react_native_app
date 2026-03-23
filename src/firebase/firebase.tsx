import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  initializeAuth,
  // @ts-ignore
  getReactNativePersistence
} from "firebase/auth";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  memoryLocalCache
} from "firebase/firestore";
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from "react-native";

// Native Firebase (Android/iOS uchun) - v23+ yordamida Modular API
import { 
  getApp as getNativeApp, 
  getApps as getNativeApps, 
  initializeApp as initializeNativeApp 
} from '@react-native-firebase/app';
import { getAuth as getNativeAuth } from '@react-native-firebase/auth';
import { getFirestore as getNativeFirestore } from '@react-native-firebase/firestore';

const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId:     process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
  databaseURL:       `https://${process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID}.firebaseio.com`,
};

// Initialize Web Firebase
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Native Firebase
let nativeAppInstance: any;
if (Platform.OS !== 'web') {
  try {
    nativeAppInstance = getNativeApps().length === 0 
      ? initializeNativeApp(firebaseConfig as any) 
      : getNativeApp();
  } catch (e) {
    console.log("Native Firebase initialization error:", e);
  }
}

// Auth ni export qilish
export const auth = Platform.OS === 'web' 
  ? getAuth(app) 
  : getNativeAuth(); 

// Firestore ni export qilish
export const database = Platform.OS === 'web' 
  ? initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      })
    })
  : getNativeFirestore(); 

