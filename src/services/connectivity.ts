import { AppState } from "react-native";

/**
 * Ulanish holati native modulsiz: Supabase so'rovlari (client.ts fetch o'rami) tarmoq xatosida
 * `reportNetwork(false)`, javob kelganda `reportNetwork(true)` chaqiradi. Oflayn bo'lganda
 * serverning health endpoint'i davriy tekshiriladi va ulanish tiklanishi shu yerdan bilinadi.
 */
const PROBE_MS = 8000;
const PROBE_TIMEOUT_MS = 5000;

let online = true;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<(online: boolean) => void>();

export const isOnline = (): boolean => online;

export function subscribeConnectivity(cb: (online: boolean) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function reportNetwork(ok: boolean): void {
  if (ok === online) return;
  online = ok;
  if (ok) {
    if (timer) clearInterval(timer);
    timer = null;
  } else if (!timer) {
    timer = setInterval(probe, PROBE_MS);
  }
  listeners.forEach((cb) => cb(ok));
}

export async function probe(): Promise<void> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!url) return;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "" },
      signal: ctrl.signal,
    });
    reportNetwork(true); // har qanday HTTP javob — server yetib boriladi
  } catch {
    // hali oflayn
  } finally {
    clearTimeout(t);
  }
}

// Ilova oldinga chiqqanda oflayn bo'lsak darhol tekshiramiz
AppState.addEventListener("change", (state) => {
  if (state === "active" && !online) probe();
});
