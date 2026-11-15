import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/supabase/client";
import { isNetworkError } from "../utils/network";
import { isOnline, reportNetwork, subscribeConnectivity } from "./connectivity";
import { PendingOp } from "./overlay";

/**
 * Oflayn yozuvlar navbati (Firestore'ning yozuv keshi o'rnini bosadi).
 * Internet yo'qligida create/update/delete shu yerga yoziladi (AsyncStorage'da saqlanadi),
 * ekranlarda `overlay` orqali darhol ko'rinadi va ulanish tiklanganda tartib bilan serverga yuboriladi.
 * Serverdan tarmoqdan boshqa xato qaytsa (ruxsat, cheklov) yozuv `failed` ro'yxatiga o'tadi.
 */
const KEY = "crm-outbox:v1";
const FAILED_KEY = "crm-outbox-failed:v1";
/** Yuborilgan op Realtime/refetch yetib kelguncha ko'rinishda qoladi (miltillamasligi uchun) */
const SETTLE_TTL_MS = 4000;

export interface FailedOp extends PendingOp {
  error: string;
}

type Executor = (op: PendingOp) => Promise<void>;

let ops: PendingOp[] = [];
let failed: FailedOp[] = [];
const executors = new Map<string, Executor>();
const changeListeners = new Set<() => void>();
const settleListeners = new Set<(coll: string) => void>();
let sweepTimer: ReturnType<typeof setTimeout> | null = null;
let flushing: Promise<void> | null = null;
let dirty = false; // yuborish davomida yangi op qo'shildi

const emit = () => changeListeners.forEach((cb) => cb());

const persist = () => {
  AsyncStorage.setItem(KEY, JSON.stringify(ops.filter((o) => !o.settledAt))).catch(() => {});
  AsyncStorage.setItem(FAILED_KEY, JSON.stringify(failed)).catch(() => {});
};

export const outboxReady: Promise<void> = (async () => {
  try {
    const [raw, rawFailed] = await Promise.all([
      AsyncStorage.getItem(KEY),
      AsyncStorage.getItem(FAILED_KEY),
    ]);
    const saved = raw ? JSON.parse(raw) : [];
    if (Array.isArray(saved)) ops = [...saved, ...ops];
    const savedFailed = rawFailed ? JSON.parse(rawFailed) : [];
    if (Array.isArray(savedFailed)) failed = savedFailed;
  } catch {
    // buzilgan navbat e'tiborsiz
  }
  if (ops.length || failed.length) emit();
  if (ops.some((o) => !o.settledAt)) flushOutbox();
})();

export function registerExecutor(coll: string, exec: Executor): void {
  executors.set(coll, exec);
}

export const getOps = (coll: string): PendingOp[] => ops.filter((o) => o.coll === coll);
export const pendingCount = (): number => ops.filter((o) => !o.settledAt).length;
export const hasPending = (): boolean => ops.some((o) => !o.settledAt);
export const getFailed = (): FailedOp[] => failed;

export function subscribeOutbox(cb: () => void): () => void {
  changeListeners.add(cb);
  return () => {
    changeListeners.delete(cb);
  };
}

/** Op serverga yetib borganda (refetch uchun) */
export function onOpSettled(cb: (coll: string) => void): () => void {
  settleListeners.add(cb);
  return () => {
    settleListeners.delete(cb);
  };
}

export async function outboxEnqueue(op: Omit<PendingOp, "opId" | "ts">): Promise<void> {
  await outboxReady;
  const clean: PendingOp = JSON.parse(
    JSON.stringify({ ...op, opId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ts: Date.now() }),
  );
  ops = [...ops, clean];
  persist();
  emit();
  if (flushing) dirty = true; // joriy sikl tugagach yana ko'riladi
  else if (isOnline()) flushOutbox();
}

export function clearFailed(): void {
  failed = [];
  persist();
  emit();
}

function sweep() {
  sweepTimer = null;
  const now = Date.now();
  const next = ops.filter((o) => !o.settledAt || now - o.settledAt < SETTLE_TTL_MS);
  if (next.length !== ops.length) {
    ops = next;
    emit();
  }
  if (ops.some((o) => o.settledAt)) sweepTimer = setTimeout(sweep, SETTLE_TTL_MS);
}

const messageOf = (e: unknown): string =>
  e && typeof e === "object" && "message" in e ? String((e as any).message) : String(e);

/** Navbatni tartib bilan yuboradi. Tarmoq uzilsa to'xtaydi (ulanish tiklanganda qayta ishga tushadi). */
export function flushOutbox(): Promise<void> {
  if (flushing) return flushing;
  dirty = false;
  flushing = (async () => {
    await outboxReady;
    for (;;) {
      const op = ops.find((o) => !o.settledAt);
      if (!op) break;

      // Kirmagan (yoki sessiyasi tiklanmagan) holatda yuborib bo'lmaydi — RLS xatosi op'ni yo'qotmasin
      const { data } = await supabase.auth.getSession();
      if (!data.session) break;

      try {
        const exec = executors.get(op.coll);
        if (!exec) throw new Error(`Noma'lum jadval: ${op.coll}`);
        await exec(op);
        op.settledAt = Date.now();
        persist();
        emit();
        settleListeners.forEach((cb) => cb(op.coll));
        if (!sweepTimer) sweepTimer = setTimeout(sweep, SETTLE_TTL_MS);
      } catch (e) {
        if (isNetworkError(e)) {
          reportNetwork(false);
          break;
        }
        console.error(`Oflayn yozuv yuborilmadi (${op.coll} ${op.kind} ${op.id}):`, e);
        ops = ops.filter((o) => o.opId !== op.opId);
        failed = [...failed, { ...op, error: messageOf(e) }];
        persist();
        emit();
        settleListeners.forEach((cb) => cb(op.coll)); // ko'rinish serverdagi haqiqatga qaytsin
      }
    }
  })().finally(() => {
    flushing = null;
    if (dirty && isOnline()) flushOutbox();
  });
  return flushing;
}

subscribeConnectivity((online) => {
  if (online) flushOutbox();
});
supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") setTimeout(flushOutbox, 0);
});
