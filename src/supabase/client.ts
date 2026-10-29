import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    ".env da EXPO_PUBLIC_SUPABASE_URL va EXPO_PUBLIC_SUPABASE_ANON_KEY ko'rsatilmagan.",
  );
}

// Web'ning statik render bosqichida (window yo'q) sessiya saqlanmaydi.
const canPersist = Platform.OS !== "web" || typeof window !== "undefined";

/**
 * Bitta klient: CRM jadvallari `crm` sxemasida (default), umumiy jadvallar (profiles)
 * uchun `supabase.schema("public")` ishlating.
 */
export const supabase = createClient(url, anonKey, {
  db: { schema: "crm" },
  auth: {
    storage: canPersist ? AsyncStorage : undefined,
    autoRefreshToken: true,
    persistSession: canPersist,
    detectSessionInUrl: false,
  },
});

// React Native'da fon rejimida token yangilanmasligi uchun
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
