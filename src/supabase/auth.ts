import { cacheClear } from "@/services/cache";
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

  return {
    uid: u.id,
    email: u.email ?? null,
    displayName: data?.name || meta.full_name || meta.name || null,
    photoURL: meta.avatar_url || meta.picture || null,
    role: data?.role ?? null,
  };
}

let initStarted = false;
function init() {
  if (initStarted) return;
  initStarted = true;

  supabase.auth.getSession().then(async ({ data }) => {
    try {
      publish(await resolveUser(data.session));
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

/** Google `idToken` bilan kirish. Staff bo'lmasa NoAccessError tashlaydi. */
export async function signInWithGoogleIdToken(idToken: string): Promise<AppUser> {
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
  });
  if (error) throw error;
  const user = await resolveUser(data.session); // NoAccessError tashlashi mumkin
  publish(user);
  return user as AppUser;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  await cacheClear();
  publish(null);
}
