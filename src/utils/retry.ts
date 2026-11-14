/**
 * Birinchi yuklash xatosidan keyin qayta urinish jadvali (ms).
 * Masalan: migratsiyadan keyin PostgREST sxema keshi hali yangilanmagan bo'lsa
 * ("Could not find the table ... in the schema cache") yoki tarmoq uzilib qolsa.
 * Jami ~50 soniya — Supabase keshni qayta yuklashga yetarli.
 */
export const RETRY_DELAYS: readonly number[] = [1000, 2000, 5000, 15000, 30000];

/** `attempt`-urinish uchun kutish vaqti; jadval tugagan bo'lsa `null` (boshqa urinilmaydi). */
export function retryDelay(attempt: number): number | null {
  const i = Math.max(0, attempt);
  return i < RETRY_DELAYS.length ? RETRY_DELAYS[i] : null;
}
