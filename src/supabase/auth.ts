import AsyncStorage from "@react-native-async-storage/async-storage";
import { cacheClear } from "@/services/cache";
import { unregisterPush } from "@/services/notifications";
import { isNetworkError } from "../utils/network";
import { supabase } from "./client";

/** Ilova ichida ishlatiladigan foydalanuvchi (Firebase `currentUser` shakliga yaqin) */
export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: string | null;
}

export class NoAccessError extends Error {
  constructor() {
    super("Sizda ilovaga kirish huquqi yo'q. Administrator bilan bog'laning.");
    this.name = "NoAccessError";
  }
}

let current: AppUser | null = null;
let ready = false;
const listeners = new Set<(user: AppUser | null) => void>();

/** `auth.currentUser?.uid` uslubidagi sinxron kirish uchun */
export const auth = {
  get currentUser(): AppUser | null {
    return current;
  },
};

const publish = (user: AppUser | null) => {
  current = user;
  ready = true;
  listeners.forEach((cb) => cb(user));
};

/**
 * Sessiya → ilova foydalanuvchisi. Faqat `public.profiles` da faol (admin/operator)
 * bo'lganlar kiradi. Tarmoq xatosi bo'lsa sessiya saqlanadi (RLS baribir himoya qiladi).
 */
async function resolveUser(session: { user: any } | null): Promise<AppUser | null> {
  if (!session) return null;
  const u = session.user;
  const meta = u.user_metadata ?? {};

  const { data, error } = await supabase
    .schema("public")
    .from("profiles")
    .select("name, role, active")
    .eq("id", u.id)
    .maybeSingle();

  if (!error && (!data || !data.active)) {
    await supabase.auth.signOut();
    await cacheClear();
    throw new NoAccessError();
  }

  // Internet yo'q: oxirgi ma'lum profil (rol) ishlatiladi, aks holda admin ham operator bo'lib qoladi
  const profileKey = PROFILE_KEY + u.id;
  let profile = data;
  if (error) {
    try {
      const raw = await AsyncStorage.getItem(profileKey);
      if (raw) profile = JSON.parse(raw);
    } catch {
      // kesh yo'q
    }
  } else if (data) {
    AsyncStorage.setItem(profileKey, JSON.stringify(data)).catch(() => {});
  }

  return {
    uid: u.id,
    email: u.email ?? null,
    displayName: profile?.name || meta.full_name || meta.name || null,
    photoURL: meta.avatar_url || meta.picture || null,
    role: profile?.role ?? null,
  };
}

const PROFILE_KEY = "crm-profile:v1:";

/**
 * Internet yo'q va access token muddati o'tgan bo'lsa `getSession()` null qaytaradi (refresh
 * bajarilmaydi), lekin sessiya xotirada saqlanib qoladi. Ilova oflayn ochilganda foydalanuvchi
 * chiqib ketgan bo'lib ko'rinmasligi uchun saqlangan sessiyadan foydalanuvchini tiklaymiz;
 * ulanish qaytganda Supabase tokenni o'zi yangilaydi.
 */
async function storedSessionUser(): Promise<{ user: any } | null> {
  try {
    const host = new URL(process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").hostname;
    const raw = await AsyncStorage.getItem(`sb-${host.split(".")[0]}-auth-token`);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.user && parsed?.refresh_token ? { user: parsed.user } : null;
  } catch {
    return null;
  }
}

let initStarted = false;
function init() {
  if (initStarted) return;
  initStarted = true;

  supabase.auth.getSession().then(async ({ data, error }) => {
    try {
      let session: { user: any } | null = data.session;
      // Sessiya yo'q, lekin sabab tarmoq (token yangilanmadi) bo'lsa — saqlangan sessiyadan tiklaymiz
      if (!session && error && isNetworkError(error)) session = await storedSessionUser();
      publish(await resolveUser(session));
    } catch {
      publish(null);
    }
  });

  supabase.auth.onAuthStateChange((event) => {
    // Callback ichida supabase so'rovlari qulflanib qolmasligi uchun keyingi tickda
    if (event === "SIGNED_OUT") {
      setTimeout(() => {
        cacheClear();
        publish(null);
      }, 0);
    }
  });
}

/** Firebase `onAuthStateChanged` bilan bir xil: darhol (holat ma'lum bo'lgach) va har o'zgarishda chaqiriladi */
export function onAuthStateChanged(cb: (user: AppUser | null) => void): () => void {
  init();
  listeners.add(cb);
  if (ready) setTimeout(() => listeners.has(cb) && cb(current), 0);
  return () => {
    listeners.delete(cb);
  };
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Email yoki parol noto'g'ri.");
    this.name = "InvalidCredentialsError";
  }
}

/** Email + parol bilan kirish (saytdagi kabi). Staff bo'lmasa NoAccessError tashlaydi. */
export async function signInWithEmail(email: string, password: string): Promise<AppUser> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) {
    if (error.code === "invalid_credentials" || error.message === "Invalid login credentials") {
      throw new InvalidCredentialsError();
    }
    throw error;
  }
  const user = await resolveUser(data.session); // NoAccessError tashlashi mumkin
  publish(user);
  return user as AppUser;
}

export async function signOut(): Promise<void> {
  await unregisterPush(); // sessiya hali amalda: token shu foydalanuvchidan olib tashlanadi
  await supabase.auth.signOut();
  await cacheClear();
  publish(null);
}
