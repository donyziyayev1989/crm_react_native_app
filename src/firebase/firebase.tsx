import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBAJKSA_9PljZ-0atV5z23nWUJx-CrWUr0",
  authDomain: "crm-app-73726.firebaseapp.com",
  projectId: "crm-app-73726",
  storageBucket: "crm-app-73726.firebasestorage.app",
  messagingSenderId: "537571948273",
  appId: "1:537571948273:web:223a26afb9c8a6aa089b50",
  measurementId: "G-18M524QV5V"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const database = getFirestore(app);
