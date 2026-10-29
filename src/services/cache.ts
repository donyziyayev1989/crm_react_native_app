import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Filtrsiz (reference) watch'lar natijasi uchun kesh: xotira + AsyncStorage.
 * Firestore'ning oflayn keshi o'rnini bosadi — ilova qayta ochilganda ma'lumot darhol chiqadi,
 * server javobi kelgach yangilanadi.
 */
const PREFIX = "crm-cache:v1:";
const memory = new Map<string, any[]>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

export const cacheGetMemory = (key: string): any[] | undefined => memory.get(key);

export async function cacheRead(key: string): Promise<any[] | undefined> {
  const mem = memory.get(key);
  if (mem) return mem;
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return undefined;
    const rows = JSON.parse(raw);
    if (Array.isArray(rows)) {
      memory.set(key, rows);
      return rows;
    }
  } catch {
    // buzilgan kesh e'tiborsiz
  }
  return undefined;
}

export function cacheWrite(key: string, rows: any[]): void {
  memory.set(key, rows);
  const prev = timers.get(key);
  if (prev) clearTimeout(prev);
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      AsyncStorage.setItem(PREFIX + key, JSON.stringify(rows)).catch(() => {});
    }, 1000),
  );
}

/** Chiqishda chaqiriladi: boshqa foydalanuvchiga eski ma'lumot ko'rinmasin */
export async function cacheClear(): Promise<void> {
  memory.clear();
  timers.forEach((t) => clearTimeout(t));
  timers.clear();
  try {
    const keys = await AsyncStorage.getAllKeys();
    const mine = keys.filter((k) => k.startsWith(PREFIX));
    if (mine.length) await AsyncStorage.multiRemove(mine);
  } catch {
    // e'tiborsiz
  }
}
