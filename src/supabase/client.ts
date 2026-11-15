import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";
import { reportNetwork } from "@/services/connectivity";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    ".env da EXPO_PUBLIC_SUPABASE_URL va EXPO_PUBLIC_SUPABASE_ANON_KEY ko'rsatilmagan.",
  );
}

const REST_TIMEOUT_MS = 15000;

/**
 * Ma'lumot so'rovlariga timeout (zaif signalda fetch cheksiz osilib qolmasin) va ulanish holatini
 * `connectivity` ga xabar qilish. Oflayn yozuvlar navbati shu holatga tayanadi.
 */
const trackedFetch: typeof fetch = async (input, init) => {
  const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const ctrl = new AbortController();
  const outer = init?.signal;
  if (outer) {
    if (outer.aborted) ctrl.abort();
    else outer.addEventListener("abort", () => ctrl.abort());
  }
  const timer = href.includes("/rest/v1/") ? setTimeout(() => ctrl.abort(), REST_TIMEOUT_MS) : null;
  try {
    const res = await fetch(input, { ...init, signal: ctrl.signal });
    reportNetwork(true);
    return res;
  } catch (e) {
    if (!outer?.aborted) reportNetwork(false);
    throw e;
  } finally {
    if (timer) clearTimeout(timer);
  }
};

// Web'ning statik render bosqichida (window yo'q) sessiya saqlanmaydi.
const canPersist = Platform.OS !== "web" || typeof window !== "undefined";

/**
 * Bitta klient: CRM jadvallari `crm` sxemasida (default), umumiy jadvallar (profiles)
 * uchun `supabase.schema("public")` ishlating.
 */
export const supabase = createClient(url, anonKey, {
  db: { schema: "crm" },
  global: { fetch: trackedFetch },
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
