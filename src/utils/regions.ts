import { District, Region } from "../interfaces";

/**
 * Viloyat/tuman nomlari bazada har xil yozilgan (apostrof, bo'sh joy, nuqta).
 * Taqqoslash uchun hammasini bitta ko'rinishga keltiramiz.
 */
export const normalizeRegionName = (s: string | undefined | null): string =>
  (s ?? "")
    .trim()
    .toLowerCase()
    .replace(/['`‘’ʻʼ\s.]/g, "");

/**
 * regions.js dagi ID lar bilan districts.js dagi regionId lar mos kelmaydi.
 * Har bir region ID uchun bazada uchrashi mumkin bo'lgan regionId variantlari.
 */
export const REGION_ID_ALIASES: Record<string, string[]> = {
  toshkent_sh: ["Toshkent sh.", "Toshkent shahri", "toshkent_sh"],
  toshkent_v: ["Toshkent vil.", "Toshkent viloyati", "toshkent_v"],
  fargona: ["Fargona", "Farg'ona", "fargona"],
  andijon: ["Andijon", "andijon"],
  buxoro: ["Buxoro", "buxoro"],
  jizzax: ["Jizzax", "jizzax"],
  xorazm: ["Xorazm", "xorazm"],
  namangan: ["Namangan", "namangan"],
  navoiy: ["Navoiy", "navoiy"],
  qashqadaryo: ["Qashqadaryo", "qashqadaryo"],
  qoraqalpogiston: [
    "Qoraqalpog'iston Respublikasi",
    "Qoraqalpog'iston",
    "qoraqalpogiston",
  ],
  samarqand: ["Samarqand", "samarqand"],
  sirdaryo: ["Sirdaryo", "sirdaryo"],
  surxondaryo: ["Surxondaryo", "surxondaryo"],
};

/** ID yoki nom (har qanday yozuvda) bo'yicha viloyatni topish */
export function findRegion<T extends Region>(
  regions: T[],
  nameOrId: string | undefined | null,
): T | undefined {
  if (!nameOrId) return undefined;
  const byId = regions.find((r) => r.id === nameOrId);
  if (byId) return byId;
  const n = normalizeRegionName(nameOrId);
  const byName = regions.find((r) => normalizeRegionName(r.name) === n);
  if (byName) return byName;
  if (n === "toshkent") return regions.find((r) => r.id === "toshkent_sh");
  return undefined;
}

/** Viloyatga tegishli tumanlar (legacy regionId lar bilan birga) */
export function districtsOfRegion<T extends District>(
  districts: T[],
  regionId: string | null | undefined,
): T[] {
  if (!regionId) return [];
  const ids = new Set([regionId, ...(REGION_ID_ALIASES[regionId] ?? [])]);
  return districts.filter((d) => ids.has(d.regionId));
}

/** Tuman nomining bazadagi rasmiy yozuvi; topilmasa kiritilgan nom */
export function findDistrictName(
  districts: Pick<District, "name">[],
  name: string | undefined | null,
): string {
  if (!name) return "";
  const n = normalizeRegionName(name);
  return districts.find((d) => normalizeRegionName(d.name) === n)?.name ?? name;
}
