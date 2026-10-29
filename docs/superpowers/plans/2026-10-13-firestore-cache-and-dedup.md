# Firestore Cache and Dedup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut Firestore reads by serving reference collections from one app-level provider, and collapse duplicated phone/money/region/CRUD logic into shared utils and components.

**Architecture:** A `ReferenceDataProvider` (React Context, mounted in the root layout) opens one `watch` per reference collection (regions, districts, products, tags, lots, users, customers) and exposes arrays plus `byId` maps through `useRefData()`. Screens drop their own subscriptions and read from the provider. `database.tsx` gains `watchDoc` and `sum`. Pure helpers live in `src/utils/{phone,format,regions,lots}.ts` and are unit-tested with Jest; UI-level dedup goes into `RegionDistrictSelect`, `LotLostList`, `LotExpenseList`, `SimpleCrudScreen`, `Loading`, and a `useSwipeableRows` hook.

**Tech Stack:** Expo SDK 54, React Native 0.81, expo-router 6, Firebase JS SDK 12 (web) / @react-native-firebase 23 (native) behind `src/services/database.tsx`, NativeWind 4, react-hook-form, Jest via `jest-expo`.

**Spec:** `docs/superpowers/specs/2026-10-13-firestore-cache-and-dedup-design.md`

## Global Constraints

- All data access goes through `src/services/database.tsx`; never import `firebase/firestore` or `@react-native-firebase/firestore` in screens or components.
- UI text stays in Uzbek. Screens must look the same after each task; only code location changes.
- Path aliases: `@/*` → `src/*`, `@interfaces/*`, `@utils/*`, `@components/*`. Pure utils under `src/utils` import siblings with relative paths so Jest resolves them without alias config.
- `npx tsc --noEmit` must report 0 errors and `npx expo lint` 0 errors after every task.
- No new Firestore composite indexes: never combine `where` on one field with `orderBy` on another in a single query (sort in JS instead, as the current code does).
- Out of scope: customers pagination, full `any` cleanup, `functions/`, `firebase.tsx` `require()` calls, dashboard table layout.

## Review Focus

1. Phone input `+998 99 812 34 56` typed as `998998123456` — `toLocal9` must return `998123456` (a real Uzbek prefix), not strip a second `998`. Test in Task 1.
2. `watchDoc` for a deleted document on native — callback must receive `null`, not a stale object; `exists` is a method on both SDKs today (the current wrapper treats it as a property on native, which is a bug). Covered by the `exists` helper in Task 5 (`snapExists`).
3. `sum("product_count")` where some orders store `product_count` as a string — Firestore ignores non-numeric fields in `sum`, so the lot count can be lower than the old JS sum. Task 11 documents this and the manual check compares counts.
4. `RegionDistrictSelect` given a legacy region name like `"Toshkent"` or `"Farg'ona"` must still resolve to a region id and list its districts. Tested via `findRegion`/`districtsOfRegion` in Task 3.
5. `OrderModal` opened six times from different screens — the provider must not be re-created per modal; `initializedRef` from phase 1 must still reset when `visible` goes false. Manual check in Task 8.

---

### Task 1: Jest setup, `WithId`, and `utils/phone.ts`

**Files:**
- Modify: `package.json` (scripts, devDependencies, jest config)
- Modify: `src/interfaces/index.ts` (append `WithId`)
- Create: `src/utils/phone.ts`
- Modify: `src/utils/format.tsx:22-40` (move `formatPhone` out, re-export)
- Test: `src/utils/__tests__/phone.test.ts`

**Interfaces:**
- Produces: `type WithId<T> = T & { id: string }` in `@/interfaces`.
- Produces (`@/utils/phone`): `digitsOnly(s)`, `last9(s)`, `toLocal9(s)`, `phonesMatch(a, b)`, `phoneVariants(s): string[]`, `formatPhone(s)`.

- [ ] **Step 1: Install Jest**

```bash
npm install --save-dev jest@~29.7.0 jest-expo@~54.0.0 @types/jest@^29.5.0
```

- [ ] **Step 2: Add test script and jest config to `package.json`**

Add to `"scripts"`: `"test": "jest"`. Add a top-level key:

```json
"jest": {
  "preset": "jest-expo",
  "moduleNameMapper": {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@interfaces/(.*)$": "<rootDir>/src/interfaces/$1",
    "^@utils/(.*)$": "<rootDir>/src/utils/$1"
  },
  "testMatch": ["**/__tests__/**/*.test.ts"]
}
```

- [ ] **Step 3: Add `WithId` to `src/interfaces/index.ts`** (append at end of file)

```ts
/** Firestore'dan kelgan hujjat: id har doim mavjud */
export type WithId<T> = T & { id: string };
```

- [ ] **Step 4: Write the failing test** `src/utils/__tests__/phone.test.ts`

```ts
import {
  digitsOnly,
  formatPhone,
  last9,
  phoneVariants,
  phonesMatch,
  toLocal9,
} from "../phone";

describe("digitsOnly", () => {
  it("strips everything but digits", () => {
    expect(digitsOnly("+998 (90) 123-45-67")).toBe("998901234567");
    expect(digitsOnly(undefined)).toBe("");
  });
});

describe("toLocal9", () => {
  it("drops the 998 country code only when more than 9 digits remain", () => {
    expect(toLocal9("+998 90 123 45 67")).toBe("901234567");
    expect(toLocal9("901234567")).toBe("901234567");
    // 99 is a real operator prefix: a 9-digit number starting with 998 must stay intact
    expect(toLocal9("998123456")).toBe("998123456");
    expect(toLocal9("998998123456")).toBe("998123456");
  });
  it("keeps the last 9 digits of anything longer", () => {
    expect(toLocal9("00998901234567")).toBe("901234567");
  });
});

describe("last9 / phonesMatch", () => {
  it("matches numbers that differ only by formatting or country code", () => {
    expect(last9("+998 90 123 45 67")).toBe("901234567");
    expect(phonesMatch("+998 90 123 45 67", "901234567")).toBe(true);
    expect(phonesMatch("998901234567", "998901234568")).toBe(false);
  });
  it("never matches short inputs", () => {
    expect(phonesMatch("12345", "12345")).toBe(false);
  });
});

describe("phoneVariants", () => {
  it("returns all stored spellings for a 9-digit local number", () => {
    expect(phoneVariants("901234567").sort()).toEqual(
      ["901234567", "998901234567", "+998 901234567"].sort(),
    );
  });
  it("returns all stored spellings for a 12-digit number", () => {
    expect(phoneVariants("+998 90 123 45 67").sort()).toEqual(
      ["998901234567", "901234567", "+998 901234567"].sort(),
    );
  });
  it("returns just the digits for other lengths", () => {
    expect(phoneVariants("1234567")).toEqual(["1234567"]);
    expect(phoneVariants("")).toEqual([]);
  });
});

describe("formatPhone", () => {
  it("formats 12 and 9 digit numbers", () => {
    expect(formatPhone("998901234567")).toBe("+998 90 123 45 67");
    expect(formatPhone("901234567")).toBe("+998 90 123 45 67");
  });
  it("falls back to +digits for other lengths", () => {
    expect(formatPhone("12345")).toBe("+12345");
    expect(formatPhone(undefined)).toBe("");
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npx jest src/utils/__tests__/phone.test.ts`
Expected: FAIL with "Cannot find module '../phone'".

- [ ] **Step 6: Create `src/utils/phone.ts`**

```ts
/**
 * Telefon raqamlari bilan ishlash. O'zbekiston raqamlari: +998 + 9 raqam.
 * Bazada raqamlar uch xil ko'rinishda saqlangan bo'lishi mumkin:
 *   "901234567" | "998901234567" | "+998 901234567"
 */

export const digitsOnly = (s: string | number | undefined | null): string =>
  String(s ?? "").replace(/\D/g, "");

/** Mahalliy 9 raqam. 998 prefiksi faqat undan keyin 9 tadan ko'p raqam qolsa olib tashlanadi. */
export const toLocal9 = (s: string | undefined | null): string => {
  let d = digitsOnly(s);
  if (d.startsWith("998") && d.length > 9) d = d.slice(3);
  return d.length > 9 ? d.slice(-9) : d;
};

export const last9 = (s: string | undefined | null): string =>
  digitsOnly(s).slice(-9);

/** Ikki raqam oxirgi 9 raqami bo'yicha bir xilmi */
export const phonesMatch = (
  a: string | undefined | null,
  b: string | undefined | null,
): boolean => {
  const x = last9(a);
  const y = last9(b);
  return x.length === 9 && x === y;
};

/** Firestore `where("phone", "in", ...)` uchun barcha saqlanish variantlari */
export const phoneVariants = (s: string | undefined | null): string[] => {
  const d = digitsOnly(s);
  if (!d) return [];
  const out = new Set<string>([d]);
  let local: string | null = null;
  if (d.length === 9) local = d;
  else if (d.length === 12 && d.startsWith("998")) local = d.slice(3);
  if (local) {
    out.add(local);
    out.add("998" + local);
    out.add(`+998 ${local}`);
  }
  return [...out];
};

export const formatPhone = (phone: string | undefined | null): string => {
  if (!phone) return "";
  const digits = digitsOnly(phone);

  if (digits.length === 12 && digits.startsWith("998")) {
    return `+998 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10, 12)}`;
  }
  if (digits.length === 9) {
    return `+998 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
  }
  return digits.length >= 3 ? `+${digits}` : digits;
};
```

- [ ] **Step 7: Replace `formatPhone` in `src/utils/format.tsx` with a re-export**

Delete lines 22-40 (the `formatPhone` function) and add at the top of the file:

```ts
export { formatPhone } from "./phone";
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx jest src/utils/__tests__/phone.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 9: Type-check and lint**

Run: `npx tsc --noEmit && npx expo lint`
Expected: 0 errors.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json src/interfaces/index.ts src/utils/phone.ts src/utils/format.tsx src/utils/__tests__/phone.test.ts
git commit -m "feat(utils): add phone helpers with jest setup and WithId type"
```

---

### Task 2: `utils/format.tsx` — `formatSum`, `parseNum`, `formatTime`, `formatDateLabel`

**Files:**
- Modify: `src/utils/format.tsx`
- Test: `src/utils/__tests__/format.test.ts`

**Interfaces:**
- Produces: `formatSum(n): string` (`"12 000 so'm"`), `parseNum(v: unknown): number`, `formatTime(d): string` (`"HH:mm"`), `formatDateLabel(iso, now?): string` (`"Bugun" | "Kecha" | "13 oktabr" | "13 oktabr 2025"`), `UZ_MONTHS`.
- Existing `formatMoney` and `formatDate` are unchanged.

- [ ] **Step 1: Write the failing test** `src/utils/__tests__/format.test.ts`

```ts
import {
  formatDateLabel,
  formatMoney,
  formatSum,
  formatTime,
  parseNum,
} from "../format";

describe("formatMoney / formatSum", () => {
  it("groups thousands with spaces", () => {
    expect(formatMoney(1234567)).toBe("1 234 567");
    expect(formatMoney("12 000")).toBe("12000".replace(/\B(?=(\d{3})+(?!\d))/g, " "));
  });
  it("formatSum appends the currency", () => {
    expect(formatSum(12000)).toBe("12 000 so'm");
    expect(formatSum(undefined)).toBe("0 so'm");
  });
});

describe("parseNum", () => {
  it("accepts numbers and spaced strings", () => {
    expect(parseNum(5)).toBe(5);
    expect(parseNum("12 000")).toBe(12000);
    expect(parseNum("abc")).toBe(0);
    expect(parseNum(null)).toBe(0);
    expect(parseNum(NaN)).toBe(0);
  });
});

describe("formatTime", () => {
  it("renders HH:mm with zero padding", () => {
    expect(formatTime(new Date(2026, 0, 1, 9, 5))).toBe("09:05");
    expect(formatTime("")).toBe("");
    expect(formatTime("not a date")).toBe("");
  });
});

describe("formatDateLabel", () => {
  const now = new Date(2026, 9, 13, 12, 0); // 13 oktabr 2026
  it("says Bugun and Kecha", () => {
    expect(formatDateLabel(new Date(2026, 9, 13, 1).toISOString(), now)).toBe("Bugun");
    expect(formatDateLabel(new Date(2026, 9, 12, 23).toISOString(), now)).toBe("Kecha");
  });
  it("omits the year inside the current year", () => {
    expect(formatDateLabel(new Date(2026, 2, 5).toISOString(), now)).toBe("5 mart");
  });
  it("includes the year for other years", () => {
    expect(formatDateLabel(new Date(2025, 11, 31).toISOString(), now)).toBe("31 dekabr 2025");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/utils/__tests__/format.test.ts`
Expected: FAIL — `formatSum is not a function` (and others).

- [ ] **Step 3: Append to `src/utils/format.tsx`**

```ts
export const formatSum = (amount: number | string | undefined): string =>
  `${formatMoney(amount)} so'm`;

/** "12 000" yoki 12000 → 12000; boshqa hamma narsa → 0 */
export const parseNum = (val: unknown): number => {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (typeof val === "string") return parseFloat(val.replace(/\s/g, "")) || 0;
  return 0;
};

const pad2 = (n: number) => String(n).padStart(2, "0");

export const formatTime = (
  value: string | number | Date | undefined | null,
): string => {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

export const UZ_MONTHS = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentabr",
  "oktabr",
  "noyabr",
  "dekabr",
];

/** Chat sarlavhalari uchun: "Bugun" | "Kecha" | "5 mart" | "31 dekabr 2025" */
export const formatDateLabel = (dateStr: string, now = new Date()): string => {
  const date = new Date(dateStr);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const messageDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );

  if (messageDate.getTime() === today.getTime()) return "Bugun";
  if (messageDate.getTime() === yesterday.getTime()) return "Kecha";

  const day = date.getDate();
  const month = UZ_MONTHS[date.getMonth()];
  const year = date.getFullYear();
  return year !== now.getFullYear()
    ? `${day} ${month} ${year}`
    : `${day} ${month}`;
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/utils/__tests__/format.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/format.tsx src/utils/__tests__/format.test.ts
git commit -m "feat(utils): add formatSum, parseNum, formatTime, formatDateLabel"
```

---

### Task 3: `utils/regions.ts`

**Files:**
- Create: `src/utils/regions.ts`
- Test: `src/utils/__tests__/regions.test.ts`

**Interfaces:**
- Produces: `normalizeRegionName(s)`, `REGION_ID_ALIASES: Record<string, string[]>`, `findRegion<T extends Region>(regions: T[], nameOrId): T | undefined`, `districtsOfRegion<T extends District>(districts: T[], regionId): T[]`, `findDistrictName(districts, name): string` (official spelling or the input).

- [ ] **Step 1: Write the failing test** `src/utils/__tests__/regions.test.ts`

```ts
import { District, Region, WithId } from "../../interfaces";
import {
  districtsOfRegion,
  findDistrictName,
  findRegion,
  normalizeRegionName,
} from "../regions";

const regions: WithId<Region>[] = [
  { id: "toshkent_sh", name: "Toshkent sh." },
  { id: "toshkent_v", name: "Toshkent vil." },
  { id: "fargona", name: "Farg'ona" },
  { id: "andijon", name: "Andijon" },
];

const districts: WithId<District>[] = [
  { id: "d1", name: "Yunusobod", regionId: "toshkent_sh" },
  { id: "d2", name: "Chilonzor", regionId: "Toshkent shahri" }, // legacy regionId
  { id: "d3", name: "Zangiota", regionId: "toshkent_v" },
  { id: "d4", name: "Qo'qon", regionId: "Farg'ona" },
];

describe("normalizeRegionName", () => {
  it("ignores case, spaces, dots and apostrophes", () => {
    expect(normalizeRegionName("Farg'ona")).toBe("fargona");
    expect(normalizeRegionName("Fargʻona ")).toBe("fargona");
    expect(normalizeRegionName("Toshkent sh.")).toBe("toshkentsh");
    expect(normalizeRegionName(undefined)).toBe("");
  });
});

describe("findRegion", () => {
  it("finds by id, by name and by apostrophe-insensitive name", () => {
    expect(findRegion(regions, "fargona")?.id).toBe("fargona");
    expect(findRegion(regions, "Farg'ona")?.id).toBe("fargona");
    expect(findRegion(regions, "fargʻona")?.id).toBe("fargona");
    expect(findRegion(regions, "ANDIJON")?.id).toBe("andijon");
  });
  it("maps bare 'Toshkent' to the city", () => {
    expect(findRegion(regions, "Toshkent")?.id).toBe("toshkent_sh");
  });
  it("returns undefined for unknown or empty", () => {
    expect(findRegion(regions, "Mars")).toBeUndefined();
    expect(findRegion(regions, "")).toBeUndefined();
  });
});

describe("districtsOfRegion", () => {
  it("includes districts stored under legacy region ids", () => {
    expect(districtsOfRegion(districts, "toshkent_sh").map((d) => d.id)).toEqual(["d1", "d2"]);
    expect(districtsOfRegion(districts, "fargona").map((d) => d.id)).toEqual(["d4"]);
  });
  it("returns [] for null", () => {
    expect(districtsOfRegion(districts, null)).toEqual([]);
  });
});

describe("findDistrictName", () => {
  it("returns the official spelling when it matches loosely", () => {
    expect(findDistrictName(districts, "qoqon")).toBe("Qo'qon");
  });
  it("returns the input when nothing matches", () => {
    expect(findDistrictName(districts, "Nowhere")).toBe("Nowhere");
    expect(findDistrictName(districts, "")).toBe("");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/utils/__tests__/regions.test.ts`
Expected: FAIL with "Cannot find module '../regions'".

- [ ] **Step 3: Create `src/utils/regions.ts`**

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/utils/__tests__/regions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/regions.ts src/utils/__tests__/regions.test.ts
git commit -m "feat(utils): add region/district matching helpers"
```

---

### Task 4: `utils/lots.ts` and `services/lotStats.ts`

**Files:**
- Create: `src/utils/lots.ts` (pure)
- Create: `src/services/lotStats.ts` (touches db)
- Test: `src/utils/__tests__/lots.test.ts`

**Interfaces:**
- Produces: `lostPercent(lot): string` (one decimal, `"0"` when no product_count); `recalcLostTotal(lotId): Promise<number>`.

- [ ] **Step 1: Write the failing test** `src/utils/__tests__/lots.test.ts`

```ts
import { lostPercent } from "../lots";

describe("lostPercent", () => {
  it("returns one-decimal percentage", () => {
    expect(lostPercent({ product_count: 200, lost_products: 15 })).toBe("7.5");
  });
  it("treats missing lost_products as 0", () => {
    expect(lostPercent({ product_count: 10, lost_products: undefined as unknown as number })).toBe("0.0");
  });
  it("returns 0 when product_count is missing or zero", () => {
    expect(lostPercent({ product_count: 0, lost_products: 3 })).toBe("0");
    expect(lostPercent(null)).toBe("0");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/utils/__tests__/lots.test.ts`
Expected: FAIL with "Cannot find module '../lots'".

- [ ] **Step 3: Create `src/utils/lots.ts`**

```ts
import { ProductLot } from "../interfaces";

/** Yo'qotilgan tovarlar foizi, bir o'nlik: "7.5". product_count bo'lmasa "0". */
export const lostPercent = (
  lot: Pick<ProductLot, "product_count" | "lost_products"> | null | undefined,
): string => {
  if (!lot?.product_count) return "0";
  return (((lot.lost_products || 0) * 100) / lot.product_count).toFixed(1);
};
```

- [ ] **Step 4: Create `src/services/lotStats.ts`**

```ts
import db, { where } from "@/services/database";

/**
 * Partiyadagi barcha yo'qotishlarni qayta yig'ib, lots/{lotId}.lost_products ni yangilaydi.
 * LostProductModal (saqlash) va LotLostList (o'chirish) dan chaqiriladi.
 */
export const recalcLostTotal = async (lotId: string): Promise<number> => {
  const all = await db.lost_products.list(where("lotId", "==", lotId));
  const total = all.reduce((sum, item) => sum + (item.count || 0), 0);
  await db.lots.update(lotId, { lost_products: total });
  return total;
};
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest src/utils/__tests__/lots.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/utils/lots.ts src/services/lotStats.ts src/utils/__tests__/lots.test.ts
git commit -m "feat: add lostPercent and recalcLostTotal helpers"
```

---

### Task 5: `database.tsx` `watchDoc` + `sum`, `Loading`, `useSwipeableRows`

**Files:**
- Modify: `src/services/database.tsx`
- Create: `src/components/Loading.tsx`
- Create: `src/hooks/useSwipeableRows.ts`

**Interfaces:**
- Produces on every `db.<collection>`: `watchDoc(id: string, cb: (doc: WithId<T> | null) => void): () => void`, `sum(field: string, ...constraints): Promise<number>`.
- Produces: `<Loading color?: string />`.
- Produces: `useSwipeableRows()` → `{ closeRow(id), registerRow(id): (ref: SwipeableMethods | null) => void }`.

- [ ] **Step 1: Add a shared `snapExists` helper in `database.tsx`** (after `const f: any = ...`)

```ts
// Web va native v23 da ham exists() metod. Eski native versiyalarda xususiyat edi.
const snapExists = (snap: any): boolean =>
  typeof snap.exists === "function" ? snap.exists() : !!snap.exists;
```

Replace both occurrences of
`const exists = isWeb ? docSnap.exists() : (docSnap as any).exists;`
with
`const exists = snapExists(docSnap);`

- [ ] **Step 2: Add `watchDoc` and `sum` to `createCollection`** (after `watch`)

```ts
    watchDoc: (id: string, callback: (data: WithId<T> | null) => void) => {
      const ref = f.doc(database as any, collectionName, id);
      return f.onSnapshot(
        ref,
        (snap: any) => {
          callback(
            snapExists(snap) ? ({ id: snap.id, ...snap.data() } as WithId<T>) : null,
          );
        },
        (error: any) => {
          console.error(`Error watching ${collectionName}/${id}:`, error);
        },
      );
    },

    sum: async (field: string, ...constraints: any[]): Promise<number> => {
      const colRef = getColRef();
      const q = constraints.length > 0 ? f.query(colRef, ...constraints) : colRef;
      const snap = await f.getAggregateFromServer(q, { total: f.sum(field) });
      return Number(snap.data().total) || 0;
    },
```

Add the same two methods to the object returned inside `createSubCollection` (using `path` instead of `collectionName` and `getSubColRef` instead of `getColRef`).

- [ ] **Step 3: Extend `CollectionMethods<T>`**

```ts
  watchDoc: (id: string, callback: (data: WithId<T> | null) => void) => () => void;
  sum: (field: string, ...constraints: any[]) => Promise<number>;
```

Import `WithId` from `@interfaces/index` in `database.tsx`.

- [ ] **Step 4: Create `src/components/Loading.tsx`**

```tsx
import React from "react";
import { ActivityIndicator, View } from "react-native";

/** Ekran markazidagi spinner. Har ekranda takrorlangan styles.center + ActivityIndicator o'rniga. */
const Loading = ({ color = "#6366f1" }: { color?: string }) => (
  <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
    <ActivityIndicator size="large" color={color} />
  </View>
);

export default Loading;
```

- [ ] **Step 5: Create `src/hooks/useSwipeableRows.ts`**

```ts
import { useCallback, useRef } from "react";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";

/**
 * Ro'yxatda bir vaqtda faqat bitta swipeable qator ochiq tursin.
 *   const { closeRow, registerRow } = useSwipeableRows();
 *   <ReanimatedSwipeable ref={registerRow(item.id)} onSwipeableWillOpen={() => closeRow(item.id)} />
 */
export function useSwipeableRows() {
  const rowRefs = useRef(new Map<string, SwipeableMethods>());
  const prevOpenedRow = useRef<string | null>(null);

  const closeRow = useCallback((id: string) => {
    if (prevOpenedRow.current !== null && prevOpenedRow.current !== id) {
      rowRefs.current.get(prevOpenedRow.current)?.close();
    }
    prevOpenedRow.current = id;
  }, []);

  const registerRow = useCallback(
    (id: string) => (ref: SwipeableMethods | null) => {
      if (ref) rowRefs.current.set(id, ref);
      else rowRefs.current.delete(id);
    },
    [],
  );

  return { closeRow, registerRow };
}
```

- [ ] **Step 6: Type-check and lint**

Run: `npx tsc --noEmit && npx expo lint`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/services/database.tsx src/components/Loading.tsx src/hooks/useSwipeableRows.ts
git commit -m "feat(db): add watchDoc and sum; add Loading and useSwipeableRows"
```

---

### Task 6: `ReferenceDataProvider`

**Files:**
- Create: `src/providers/ReferenceData.tsx`
- Modify: `src/app/_layout.tsx`

**Interfaces:**
- Produces: `ReferenceDataProvider`, `useRefData(): RefData`, `useDistrictsOfRegion(regionId: string | null): WithId<District>[]`.

```ts
interface RefData {
  regions: WithId<Region>[];
  districts: WithId<District>[];
  products: WithId<Product>[];
  tags: WithId<Tag>[];
  lots: WithId<ProductLot>[];
  users: WithId<User>[];
  customers: WithId<Customer>[];
  productsById: Record<string, WithId<Product>>;
  lotsById: Record<string, WithId<ProductLot>>;
  usersById: Record<string, WithId<User>>;
  customersById: Record<string, WithId<Customer>>;
  tagsById: Record<string, WithId<Tag>>;
  loading: boolean;
}
```

- [ ] **Step 1: Create `src/providers/ReferenceData.tsx`**

```tsx
import {
  Customer,
  District,
  Product,
  ProductLot,
  Region,
  Tag,
  User,
  WithId,
} from "@/interfaces";
import db, { orderBy } from "@/services/database";
import { districtsOfRegion } from "@/utils/regions";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/**
 * Reference kolleksiyalar uchun ilova darajasida BITTA watch.
 * Ilgari har ekran/modal o'zi products, lots, customers... ni alohida kuzatardi.
 */

export interface RefData {
  regions: WithId<Region>[];
  districts: WithId<District>[];
  products: WithId<Product>[];
  tags: WithId<Tag>[];
  lots: WithId<ProductLot>[];
  users: WithId<User>[];
  customers: WithId<Customer>[];
  productsById: Record<string, WithId<Product>>;
  lotsById: Record<string, WithId<ProductLot>>;
  usersById: Record<string, WithId<User>>;
  customersById: Record<string, WithId<Customer>>;
  tagsById: Record<string, WithId<Tag>>;
  /** Birinchi snapshot hammasidan kelguncha true */
  loading: boolean;
}

const byId = <T extends { id: string }>(items: T[]): Record<string, T> => {
  const map: Record<string, T> = {};
  for (const item of items) map[item.id] = item;
  return map;
};

type Key = keyof typeof INITIAL_LOADED;
const INITIAL_LOADED = {
  regions: false,
  districts: false,
  products: false,
  tags: false,
  lots: false,
  users: false,
  customers: false,
};

const RefDataContext = createContext<RefData | null>(null);

export const ReferenceDataProvider = ({ children }: { children: ReactNode }) => {
  const [regions, setRegions] = useState<WithId<Region>[]>([]);
  const [districts, setDistricts] = useState<WithId<District>[]>([]);
  const [products, setProducts] = useState<WithId<Product>[]>([]);
  const [tags, setTags] = useState<WithId<Tag>[]>([]);
  const [lots, setLots] = useState<WithId<ProductLot>[]>([]);
  const [users, setUsers] = useState<WithId<User>[]>([]);
  const [customers, setCustomers] = useState<WithId<Customer>[]>([]);
  const [loaded, setLoaded] = useState(INITIAL_LOADED);

  useEffect(() => {
    const mark = (key: Key) =>
      setLoaded((prev) => (prev[key] ? prev : { ...prev, [key]: true }));

    const unsubs = [
      db.regions.watch((d) => { setRegions(d as WithId<Region>[]); mark("regions"); }, orderBy("name", "asc")),
      db.districts.watch((d) => { setDistricts(d as WithId<District>[]); mark("districts"); }, orderBy("name", "asc")),
      db.products.watch((d) => { setProducts(d as WithId<Product>[]); mark("products"); }, orderBy("name", "asc")),
      db.tags.watch((d) => { setTags(d as WithId<Tag>[]); mark("tags"); }, orderBy("name", "asc")),
      db.lots.watch((d) => { setLots(d as WithId<ProductLot>[]); mark("lots"); }, orderBy("date", "desc")),
      db.users.watch((d) => { setUsers(d as WithId<User>[]); mark("users"); }),
      db.customers.watch((d) => { setCustomers(d as WithId<Customer>[]); mark("customers"); }, orderBy("name", "asc")),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const value = useMemo<RefData>(
    () => ({
      regions,
      districts,
      products,
      tags,
      lots,
      users,
      customers,
      productsById: byId(products),
      lotsById: byId(lots),
      usersById: byId(users),
      customersById: byId(customers),
      tagsById: byId(tags),
      loading: !Object.values(loaded).every(Boolean),
    }),
    [regions, districts, products, tags, lots, users, customers, loaded],
  );

  return <RefDataContext.Provider value={value}>{children}</RefDataContext.Provider>;
};

export const useRefData = (): RefData => {
  const ctx = useContext(RefDataContext);
  if (!ctx) {
    throw new Error("useRefData faqat ReferenceDataProvider ichida ishlaydi");
  }
  return ctx;
};

/** Viloyat ID bo'yicha tumanlar (legacy regionId lar bilan) */
export const useDistrictsOfRegion = (regionId: string | null | undefined) => {
  const { districts } = useRefData();
  return useMemo(() => districtsOfRegion(districts, regionId), [districts, regionId]);
};
```

- [ ] **Step 2: Wrap the root layout** — `src/app/_layout.tsx`

```tsx
import GlobalChat from "@/components/GlobalChat";
import { ReferenceDataProvider } from "@/providers/ReferenceData";
import { Stack } from "expo-router";
import "./globals.css";

export default function RootLayout() {
  return (
    <ReferenceDataProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <GlobalChat />
    </ReferenceDataProvider>
  );
}
```

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit && npx expo lint`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/providers/ReferenceData.tsx src/app/_layout.tsx
git commit -m "feat: add ReferenceDataProvider with one watch per reference collection"
```

---

### Task 7: Move simple screens onto the provider

**Files:**
- Modify: `src/app/(tabs)/orders/index.tsx`
- Modify: `src/app/lots/[lotId]/map.tsx`
- Modify: `src/app/(tabs)/customers/[customerId].tsx`
- Modify: `src/app/(tabs)/messages/index.tsx`
- Modify: `src/components/TelegramChat.tsx`
- Modify: `src/components/CustomerList.tsx`
- Modify: `src/app/about-us.tsx`
- Modify: `src/app/(tabs)/customers/search_results.tsx`

**Interfaces:**
- Consumes: `useRefData`, `db.*.watchDoc`, `Loading`, `useSwipeableRows`, `phoneVariants`, `digitsOnly`, `formatTime`, `formatDateLabel`, `WithId`.

- [ ] **Step 1: `orders/index.tsx` — watch with limit, provider for the rest**

Replace the whole component body above `handleDelete` with:

```tsx
const PAGE_SIZE = 50;

const AllOrders = () => {
  const [orders, setOrders] = useState<WithId<Order>[]>([]);
  const [limitCount, setLimitCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const { customers, products, users, lots } = useRefData();
  const router = useRouter();

  const [editLine, setEditLine] = useState<WithId<Order> | null>(null);
  const [addLineModal, setAddLineModal] = useState(false);

  // Oxirgi N buyurtma. "Yana yuklash" N ni oshiradi; watch keshdan ishlaydi.
  useEffect(() => {
    const unsub = db.orders.watch(
      (data) => {
        setOrders(data as WithId<Order>[]);
        setLoading(false);
      },
      orderBy("date", "desc"),
      limit(limitCount),
    );
    return unsub;
  }, [limitCount]);
```

Imports: `db, { limit, orderBy } from "@/services/database"`, `{ Order, WithId } from "@/interfaces"`, `{ useRefData } from "@/providers/ReferenceData"`, `Loading from "@/components/Loading"`, `React, { useEffect, useState }` (drop `useCallback`, `useFocusEffect`, `ActivityIndicator`, `Customer`, `Product`, `ProductLot`, `User`).

In `handleDelete` keep `await db.orders.delete(order.id);` and drop the `setOrders(...)` line (watch updates the list).

Replace the loading block with `if (loading) return <Loading />;`.

Pass to `OrderList`:

```tsx
        ListFooterComponent={
          orders.length >= limitCount ? (
            <Pressable
              onPress={() => setLimitCount((n) => n + PAGE_SIZE)}
              className="self-center my-4 px-6 py-3 rounded-xl bg-indigo-100"
            >
              <Text className="text-indigo-700 font-semibold">Yana yuklash</Text>
            </Pressable>
          ) : null
        }
```

(add `Text` to the react-native import). In `OrderModal`, change `onSuccess={() => fetchData()}` to remove the prop entirely.

- [ ] **Step 2: `lots/[lotId]/map.tsx` — drop the one-shot lists**

Remove the `customers`/`products` state, the `fetchOthers` function and its call. Add `const { customers, products } = useRefData();` and import it. Keep the orders watch. Type the `orders` state as `WithId<Order>[]`.

- [ ] **Step 3: `customers/[customerId].tsx` — `watchDoc` and provider maps**

Replace the three maps state and the `useEffect` with:

```tsx
  const { customerId } = useLocalSearchParams<{ customerId: string }>();
  const { productsById, usersById, lotsById } = useRefData();
  const [customer, setCustomer] = useState<WithId<Customer> | null>(null);
  const [customerLoaded, setCustomerLoaded] = useState(false);
  const [orders, setOrders] = useState<WithId<Order>[]>([]);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [addLineModal, setAddLineModal] = useState(false);

  useEffect(() => {
    if (!customerId) return;
    const unsubCustomer = db.customers.watchDoc(customerId, (doc) => {
      setCustomer(doc);
      setCustomerLoaded(true);
    });
    // where + orderBy turli maydonlarda composite index talab qiladi — JS da saralaymiz
    const unsubOrders = db.orders.watch(
      (data) => {
        const sorted = [...(data as WithId<Order>[])].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        );
        setOrders(sorted);
        setOrdersLoaded(true);
      },
      where("customer_id", "==", customerId),
    );
    return () => {
      unsubCustomer();
      unsubOrders();
    };
  }, [customerId]);

  if (!customerLoaded || !ordersLoaded) return <Loading />;
```

In `renderItem` use `lotsById[line.lotId || ""]?.name`, `productsById[line.product_id]?.name`, `usersById[line.user_id]?.name`. Replace the `OrderModal` `onSuccess` with nothing (remove the prop; the orders watch updates the list) and set `initialCustomer={customer}`. Remove the `styles.center` usage for loading (keep for "not found").

- [ ] **Step 4: `messages/index.tsx`**

Remove the `customers` state and `unsubCustomers`. Add `const { customers } = useRefData();`. In `filteredChats` replace `.replace(/\D/g, "")` calls with `digitsOnly(...)` from `@/utils/phone`. Replace the `toLocaleTimeString` block with `{formatTime(item.last_timestamp)}`. Replace the loading spinner `View` with `<Loading color="#3b82f6" />`.

- [ ] **Step 5: `TelegramChat.tsx`**

- Remove `users` state and its `useEffect`; add `const { usersById, customersById, loading: refLoading } = useRefData();` and replace reads of `users[...]` with `usersById[...]`.
- Remove the `isCustomer` state and its `useEffect`; add
  `const isCustomer: boolean | null = refLoading ? null : !!customersById[chatId];`
- Delete the local `formatDateLabel` (lines ~150-188) and import `{ formatDateLabel, formatTime } from "@/utils/format"`.
- Replace `new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })` with `formatTime(msg.timestamp)`.

- [ ] **Step 6: `CustomerList.tsx`**

- Remove `tags` state, its effect and `tagsMap`; add `const { tagsById } = useRefData();` and render `tagsById[tag]?.name`.
- Replace `rowRefs`/`prevOpenedRow`/`closeRow` with `const { closeRow, registerRow } = useSwipeableRows();` and `ref={registerRow(item.id!)}`.
- Replace the `listData` state + sync effect with a deleted-ids set:

```tsx
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const listData = useMemo(
    () => data.filter((c) => !c.id || !deletedIds.has(c.id)),
    [data, deletedIds],
  );
```

  and in `handleDelete`: `setDeletedIds((prev) => new Set(prev).add(id));`.
- `keyExtractor={(item) => item.id ?? item.phone}`.

- [ ] **Step 7: `about-us.tsx`**

```tsx
  useEffect(() => {
    db.settings
      .get("about_us")
      .then((doc) => setText(doc?.text || ""))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);
```

Replace the loading block with `<Loading color="#10b981" />`.

- [ ] **Step 8: `search_results.tsx`**

```tsx
        if (q && q.trim()) {
          const queryText = q.trim();
          const variants = phoneVariants(queryText);
          if (digitsOnly(queryText).length >= 7) {
            constraints.push(where("phone", "in", variants));
          } else {
            constraints.push(where("name", ">=", queryText));
            constraints.push(where("name", "<=", queryText + ""));
          }
        }
```

Replace the spinner with `<Loading color="#007AFF" />`.

- [ ] **Step 8b: `src/components/PhoneInput.tsx` — use `toLocal9`**

Replace the body of `handleSelectLog` (lines 90-103) and the `localValue` memo (105-113) with:

```tsx
  const handleSelectLog = React.useCallback(
    (phoneNumber: string) => {
      onChange("+998 " + toLocal9(phoneNumber));
      setModalVisible(false);
    },
    [onChange],
  );

  // MaskInput uchun mahalliy 9 raqam (+998 dan keyingi qism)
  const localValue = React.useMemo(() => toLocal9(value), [value]);
```

Import `{ toLocal9 } from "@/utils/phone"`. Behaviour change: a 9-digit local number beginning with `998` (operator 99) is no longer mangled.

- [ ] **Step 9: Type-check, lint, confirm no leftover subscriptions in these files**

Run: `npx tsc --noEmit && npx expo lint`
Run: `grep -n "db\.\(customers\|products\|users\|lots\|tags\)\.\(watch\|list\)(" "src/app/(tabs)/orders/index.tsx" "src/app/lots/[lotId]/map.tsx" "src/app/(tabs)/customers/[customerId].tsx" "src/app/(tabs)/messages/index.tsx" src/components/TelegramChat.tsx src/components/CustomerList.tsx`
Expected: no output.

- [ ] **Step 10: Commit**

```bash
git add "src/app/(tabs)/orders/index.tsx" "src/app/lots/[lotId]/map.tsx" "src/app/(tabs)/customers/[customerId].tsx" "src/app/(tabs)/messages/index.tsx" src/components/TelegramChat.tsx src/components/CustomerList.tsx src/app/about-us.tsx "src/app/(tabs)/customers/search_results.tsx" src/components/PhoneInput.tsx
git commit -m "refactor: read reference data from provider; paginate orders; watchDoc for customer"
```

---

### Task 8: `RegionDistrictSelect` + OrderModal, CustomerForm, Search

**Files:**
- Create: `src/components/RegionDistrictSelect.tsx`
- Modify: `src/components/OrderModal.tsx`
- Modify: `src/components/CustomerForm.tsx`
- Modify: `src/components/Search.tsx`

**Interfaces:**
- Produces:

```ts
interface RegionDistrictSelectProps {
  regionName: string;
  districtName: string;
  onChange: (v: { region_name: string; district_name: string }) => void;
  isInModal?: boolean;
  search?: boolean;                 // default true
  labelStyle?: StyleProp<TextStyle>;
  fieldStyle?: StyleProp<ViewStyle>; // wrapper around each label+select
  regionError?: string;
  errorTextStyle?: StyleProp<TextStyle>;
}
```

- [ ] **Step 1: Create `src/components/RegionDistrictSelect.tsx`**

```tsx
import Select from "@/components/Select";
import { useDistrictsOfRegion, useRefData } from "@/providers/ReferenceData";
import { findDistrictName, findRegion } from "@/utils/regions";
import React, { useMemo } from "react";
import { StyleProp, Text, TextStyle, View, ViewStyle } from "react-native";

interface RegionDistrictSelectProps {
  regionName: string;
  districtName: string;
  onChange: (v: { region_name: string; district_name: string }) => void;
  isInModal?: boolean;
  search?: boolean;
  labelStyle?: StyleProp<TextStyle>;
  fieldStyle?: StyleProp<ViewStyle>;
  regionError?: string;
  errorTextStyle?: StyleProp<TextStyle>;
}

/**
 * Viloyat + tuman tanlash. Formada ID emas, NOM saqlanadi (Lead va CRM mosligi uchun),
 * shu sababli nomdan ID ga o'tish findRegion orqali bo'ladi.
 */
const RegionDistrictSelect = ({
  regionName,
  districtName,
  onChange,
  isInModal,
  search = true,
  labelStyle,
  fieldStyle,
  regionError,
  errorTextStyle,
}: RegionDistrictSelectProps) => {
  const { regions } = useRefData();
  const region = useMemo(() => findRegion(regions, regionName), [regions, regionName]);
  const districts = useDistrictsOfRegion(region?.id ?? null);

  const regionOptions = useMemo(
    () => regions.map((r) => ({ label: r.name, value: r.id })),
    [regions],
  );
  const districtOptions = useMemo(
    () => districts.map((d) => ({ label: d.name, value: d.name })),
    [districts],
  );
  const districtValue = useMemo(
    () => (districtName ? findDistrictName(districts, districtName) : null),
    [districts, districtName],
  );

  return (
    <>
      <View style={fieldStyle}>
        <Text style={[labelStyle, !!regionError && { color: "#ef4444" }]}>Viloyat</Text>
        <Select
          data={regionOptions}
          placeholder="Viloyatni tanlang"
          searchPlaceholder="Qidirish..."
          search={search}
          maxHeight={300}
          value={region?.id ?? null}
          isInModal={isInModal}
          onChange={(id: string) => {
            const picked = regions.find((r) => r.id === id);
            onChange({ region_name: picked?.name ?? id, district_name: "" });
          }}
        />
        {regionError ? <Text style={errorTextStyle}>{regionError}</Text> : null}
      </View>

      <View style={fieldStyle}>
        <Text style={labelStyle}>Tuman</Text>
        <Select
          data={districtOptions}
          placeholder="Tumanni tanlang"
          searchPlaceholder="Qidirish..."
          search={search}
          maxHeight={300}
          value={districtValue}
          isInModal={isInModal}
          onChange={(name: string) =>
            onChange({ region_name: region?.name ?? regionName, district_name: name })
          }
        />
      </View>
    </>
  );
};

export default RegionDistrictSelect;
```

- [ ] **Step 2: `OrderModal.tsx` — provider data, no district fetching**

Remove:
- `normalizeStr` (lines 57-63), the `idMap`, `fetchDistrictsByRegionName`, `selectedRegionId` state, the `customers/products/regions/districts/lots` states and the `useEffect` that opens the four watches (lines 224-252), `regionOptions`, `districtOptions`.
- Imports no longer used: `District`, `Region`, `where`, `orderBy`.

Add: `const { customers, products, regions, districts, lots } = useRefData();` and imports for `useRefData`, `RegionDistrictSelect`, `findDistrictName, findRegion, districtsOfRegion` from `@/utils/regions`, `phonesMatch` from `@/utils/phone`.

`selectCustomer` becomes synchronous:

```tsx
  const selectCustomer = useCallback(
    (customer: WithId<Customer>) => {
      const reg = findRegion(regions, customer.region_name);
      const regName = reg?.name ?? customer.region_name ?? "";
      const distName = reg
        ? findDistrictName(districtsOfRegion(districts, reg.id), customer.district_name)
        : customer.district_name ?? "";

      setForm((f) => ({
        ...f,
        customer_id: customer.id,
        customer_phone: customer.phone,
        customer_name: customer.name,
        region_name: regName || f.region_name,
        district_name: distName,
      }));
      setShowSuggestions(false);
    },
    [regions, districts],
  );
```

`handlePhoneChange`: replace the inner `find` with `customers.find((c) => phonesMatch(c.phone, phone))` guarded by `digitsOnly(phone).length >= 9`; deps `[customers, selectCustomer]`.

Init effect: keep `initializedRef`; remove the two `await fetchDistrictsByRegionName(...)` calls and the `setSelectedRegionId` calls; the function no longer needs `async`. Deps: `[editLine, visible, initialCustomer, lotId, regions, customers]`. Normalise `region_name` via `findRegion(regions, editLine.region_name)?.name ?? editLine.region_name ?? ""` when filling the form.

In the JSX replace the `Viloyat` label + `Select` and the `Tuman` label + `Select` (inside `{!initialCustomer && (...)}`) with:

```tsx
              <RegionDistrictSelect
                regionName={form.region_name}
                districtName={form.district_name}
                isInModal
                search={false}
                labelStyle={styles.fieldLabel}
                onChange={(v) => setForm((f) => ({ ...f, ...v }))}
              />
```

- [ ] **Step 3: `CustomerForm.tsx`**

Remove `selectedRegionId`, `regionsData/districtsData/lotsData/tagsData` states, both subscription effects (lines 49-76) and the region-id effect (78-98), `where` and `District`/`Region`/`ProductLot` imports. Add `const { regions: regionsData, lots: lotsData, tags: tagsData } = useRefData();` and keep the `lots`/`tags` option memos (drop `regions`/`districts` memos).

Add `watch` to the `useForm` destructuring. Replace the Region and District `fieldGroup` blocks with:

```tsx
        <Controller
          control={control}
          name="region_name"
          rules={{ required: "Viloyat kiritilishi shart" }}
          render={({ field: { onChange, value } }) => (
            <RegionDistrictSelect
              regionName={value || ""}
              districtName={watch("district_name") || ""}
              isInModal={isInModal}
              labelStyle={styles.label}
              fieldStyle={styles.fieldGroup}
              errorTextStyle={styles.errorText}
              regionError={errors.region_name?.message as string | undefined}
              onChange={({ region_name, district_name }) => {
                onChange(region_name);
                setValue("district_name", district_name);
              }}
            />
          )}
        />
```

In `onSubmit`, replace the phone-variant block (lines 160-171) with `const uniqueQueries = phoneVariants(cleanedData.phone);` and use `digitsOnly(data.phone)` for `cleanedData.phone`.

- [ ] **Step 4: `Search.tsx`**

Remove the three `any[]` states and the effect. Add:

```tsx
  const { lots, regions, tags } = useRefData();
  const allLots = useMemo(() => lots.map((l) => ({ label: l.name, value: l.id })), [lots]);
  const allRegions = useMemo(() => regions.map((r) => ({ label: r.name, value: r.name })), [regions]);
  const allTags = useMemo(() => tags.map((t) => ({ label: t.name, value: t.id })), [tags]);
```

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit && npx expo lint`
Expected: 0 errors.

- [ ] **Step 6: Manual check (Android dev client)**

1. Tab "+" → type a known customer's phone → name, region and district auto-fill; change region → district list updates without any delay; save.
2. Open an order from the list → edit → fields pre-filled; type into "Izoh" and wait 5 s → text stays.
3. Customers → add customer → Viloyat "Toshkent sh." → Tuman list shows city districts.

- [ ] **Step 7: Commit**

```bash
git add src/components/RegionDistrictSelect.tsx src/components/OrderModal.tsx src/components/CustomerForm.tsx src/components/Search.tsx
git commit -m "refactor: single RegionDistrictSelect; OrderModal/CustomerForm/Search use provider"
```

---

### Task 9: `LotLostList`, `LotExpenseList`, lot screens and modals

**Files:**
- Create: `src/components/LotExpenseList.tsx`
- Create: `src/components/LotLostList.tsx`
- Modify: `src/app/(tabs)/lots/[lotId].tsx`
- Modify: `src/app/(tabs)/lots/dashboard/[lotId].tsx`
- Modify: `src/components/LostProductModal.tsx`
- Modify: `src/components/LotExpenseModal.tsx:129`

**Interfaces:**
- Produces:
  - `LotExpenseList({ expenses: WithId<LotExpense>[]; onAdd(): void; onEdit(e: WithId<LotExpense>): void })`
  - `LotLostList({ lotId: string; lot: WithId<ProductLot> | null; items: WithId<LostProduct>[]; onAdd(): void; onEdit(i: WithId<LostProduct>): void })`
- Consumes: `recalcLostTotal`, `lostPercent`, `formatSum`, `watchDoc`, `useRefData`, `Loading`.

- [ ] **Step 1: Create `src/components/LotExpenseList.tsx`** (moved from `lots/[lotId].tsx:329-401` and its styles)

```tsx
import { LotExpense, WithId } from "@/interfaces";
import db from "@/services/database";
import { formatSum } from "@/utils/format";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React, { useMemo } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

interface Props {
  expenses: WithId<LotExpense>[];
  onAdd: () => void;
  onEdit: (expense: WithId<LotExpense>) => void;
}

const LotExpenseList = ({ expenses, onAdd, onEdit }: Props) => {
  const total = useMemo(
    () => expenses.reduce((sum, e) => sum + (e.total_price || 0), 0),
    [expenses],
  );

  const confirmDelete = (id: string) =>
    Alert.alert("O'chirish", "O'chirilsinmi?", [
      { text: "Yo'q" },
      {
        text: "Ha",
        onPress: async () => {
          try {
            await db.lot_expenses.delete(id);
          } catch {
            Alert.alert("Xato", "O'chirishda xatolik yuz berdi");
          }
        },
      },
    ]);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 12 }}>
      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>Jami xarajat:</Text>
        <Text style={styles.summaryValue}>{formatSum(total)}</Text>
      </View>

      <Pressable style={[styles.btn, { backgroundColor: "#10b981" }]} onPress={onAdd}>
        <MaterialIcons name="add-circle" size={20} color="#fff" />
        <Text style={styles.btnText}>Xarajat qo'shish</Text>
      </Pressable>

      {expenses.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="payments" size={40} color="#d1d5db" />
          <Text style={styles.emptyText}>Hozircha xarajatlar yo'q</Text>
        </View>
      ) : (
        expenses.map((ex) => (
          <View key={ex.id} style={styles.item}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{ex.name}</Text>
              <Text style={styles.itemDetail}>
                {ex.count} ta x {formatSum(ex.price_per_unit)}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.itemTotal}>{formatSum(ex.total_price)}</Text>
              <View style={styles.actions}>
                <Pressable onPress={() => onEdit(ex)}>
                  <MaterialIcons name="edit" size={18} color="#6366f1" />
                </Pressable>
                <Pressable onPress={() => confirmDelete(ex.id)}>
                  <MaterialIcons name="delete" size={18} color="#ef4444" />
                </Pressable>
              </View>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
};

export default LotExpenseList;

export const lotListStyles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#F2F2F2" },
  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText: { color: "#9ca3af", fontSize: 14 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  summary: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  summaryLabel: { fontSize: 14, color: "#6b7280", fontWeight: "500" },
  summaryValue: { fontSize: 18, fontWeight: "700", color: "#6366f1" },
  item: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  itemName: { fontSize: 16, fontWeight: "600", color: "#111827" },
  itemDetail: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  itemTotal: { fontSize: 15, fontWeight: "700", color: "#111827" },
  actions: { flexDirection: "row", gap: 12, marginTop: 4 },
});

const styles = lotListStyles;
```

- [ ] **Step 2: Create `src/components/LotLostList.tsx`** (moved from `lots/[lotId].tsx:403-492`)

```tsx
import { LostProduct, ProductLot, WithId } from "@/interfaces";
import db from "@/services/database";
import { recalcLostTotal } from "@/services/lotStats";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { lotListStyles as styles } from "./LotExpenseList";

interface Props {
  lotId: string;
  lot: WithId<ProductLot> | null;
  items: WithId<LostProduct>[];
  onAdd: () => void;
  onEdit: (item: WithId<LostProduct>) => void;
}

const LotLostList = ({ lotId, lot, items, onAdd, onEdit }: Props) => {
  const confirmDelete = (id: string) =>
    Alert.alert("O'chirish", "O'chirilsinmi?", [
      { text: "Yo'q" },
      {
        text: "Ha",
        onPress: async () => {
          try {
            await db.lost_products.delete(id);
            await recalcLostTotal(lotId);
          } catch {
            Alert.alert("Xato", "O'chirishda xatolik yuz berdi");
          }
        },
      },
    ]);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 12 }}>
      <View style={[styles.summary, { borderColor: "#ef4444" }]}>
        <Text style={styles.summaryLabel}>Jami yo'qotilgan:</Text>
        <Text style={[styles.summaryValue, { color: "#ef4444" }]}>
          {lot?.lost_products || 0} dona
        </Text>
      </View>

      <Pressable style={[styles.btn, { backgroundColor: "#ef4444" }]} onPress={onAdd}>
        <MaterialIcons name="remove-circle" size={20} color="#fff" />
        <Text style={styles.btnText}>Yo'qotilgan qo'shish</Text>
      </Pressable>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="remove-shopping-cart" size={40} color="#d1d5db" />
          <Text style={styles.emptyText}>Hozircha yo'qotishlar yo'q</Text>
        </View>
      ) : (
        items.map((ls) => (
          <View key={ls.id} style={styles.item}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{ls.count} dona</Text>
              <Text style={styles.itemDetail}>{ls.date}</Text>
            </View>
            <View style={styles.actions}>
              <Pressable onPress={() => onEdit(ls)}>
                <MaterialIcons name="edit" size={18} color="#6366f1" />
              </Pressable>
              <Pressable onPress={() => confirmDelete(ls.id)}>
                <MaterialIcons name="delete" size={18} color="#ef4444" />
              </Pressable>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
};

export default LotLostList;
```

- [ ] **Step 3: `lots/[lotId].tsx`**

- Remove `customers`, `products`, `users` states and their watches; add `const { customers, products, users } = useRefData();`.
- Replace the lot watch with `db.lots.watchDoc(lotId, setLot)`.
- Delete `handleSuccess` and pass no `onSuccess` to `OrderModal`; remove the empty `onSuccess` callbacks on `LostProductModal` and `LotExpenseModal`.
- Wrap `openMap` in `useCallback(..., [router, lotId])` so `mapView`'s deps are honest.
- Replace the two `ScrollView` branches with:

```tsx
      ) : activeTab === "expenses" ? (
        <LotExpenseList
          expenses={expenses}
          onAdd={() => { setEditExpense(null); setAddExpenseModal(true); }}
          onEdit={(ex) => { setEditExpense(ex); setAddExpenseModal(true); }}
        />
      ) : (
        <LotLostList
          lotId={lotId as string}
          lot={lot}
          items={lost}
          onAdd={() => { setEditLost(null); setAddLostModal(true); }}
          onEdit={(ls) => { setEditLost(ls); setAddLostModal(true); }}
        />
      )}
```

- Remove `totalExpenses` and the now-unused styles (`expenseSummary`, `summaryLabel`, `summaryValue`, `expenseItem`, `expenseName`, `expenseDetail`, `expenseTotal`, `center`).

- [ ] **Step 4: `lots/dashboard/[lotId].tsx`**

- Lot: `db.lots.watchDoc(lotId, setLot)`.
- Drop the two JS `.sort(...)` wrappers; add `orderBy("timestamp", "desc")` to the `lot_expenses` watch (matching the previous JS sort direction).
- Delete the local `parseNum`; import it from `@/utils/format`.
- Replace `{formatMoney(ex.total_price)} so'm` (expenses table) with `{formatSum(ex.total_price)}`. Leave the three "Moliya" rows alone — their `so'm` is a separately styled `Text`.
- Replace the loading block with `<Loading />`.

- [ ] **Step 5: `LostProductModal.tsx`**

Replace lines 81-91 (the recount) with `const newLostTotal = await recalcLostTotal(lotId);` and the percent expression (lines 122-124) with `{lostPercent(lot)}`. Remove the now-unused `where` import.

- [ ] **Step 6: `LotExpenseModal.tsx:129`**

`{formatSum(Number(count) * Number(pricePerUnit))}` with `import { formatSum } from "@/utils/format";`.

- [ ] **Step 7: Type-check and lint**

Run: `npx tsc --noEmit && npx expo lint`
Expected: 0 errors.

- [ ] **Step 8: Manual check**

Partiya → "Yo'qotilgan" tab → add 3 → total shows 3 → delete it → total 0. Dashboard for the same lot shows the same number. "Xarajatlar" tab adds/edits/deletes an expense.

- [ ] **Step 9: Commit**

```bash
git add src/components/LotExpenseList.tsx src/components/LotLostList.tsx "src/app/(tabs)/lots/[lotId].tsx" "src/app/(tabs)/lots/dashboard/[lotId].tsx" src/components/LostProductModal.tsx src/components/LotExpenseModal.tsx
git commit -m "refactor: extract LotLostList/LotExpenseList; lot screens use watchDoc and provider"
```

---

### Task 10: `SimpleCrudScreen` for products and tags

**Files:**
- Create: `src/components/SimpleCrudScreen.tsx`
- Modify: `src/app/(tabs)/products/index.tsx` (rewrite)
- Modify: `src/app/(tabs)/tags/index.tsx` (rewrite)

**Interfaces:**
- Produces:

```ts
interface CrudField<F> {
  name: keyof F & string;
  placeholder: string;
  keyboardType?: "numeric" | "default";
  multiline?: boolean;
  required?: boolean;
  requiredMessage?: string;
}
interface SimpleCrudScreenProps<T extends { id?: string }, F extends Record<string, string>> {
  title: string;
  items: T[];
  loading: boolean;
  fields: CrudField<F>[];
  emptyForm: F;
  toForm: (item: T) => F;
  fromForm: (values: F, editing: T | null) => Omit<T, "id">;
  collection: {
    create: (data: Omit<T, "id">) => Promise<string>;
    update: (id: string, data: Partial<Omit<T, "id">>) => Promise<void>;
    delete: (id: string) => Promise<void>;
  };
  renderItem: (item: T, actions: { edit: () => void; remove: () => void }) => React.ReactNode;
  modalTitle: (editing: T | null) => string;
  deleteMessage: string;
  ListEmptyComponent?: React.ReactElement | null;
}
```

- [ ] **Step 1: Create `src/components/SimpleCrudScreen.tsx`**

```tsx
import CustomModal from "@/components/CustomModal";
import Loading from "@/components/Loading";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Link, Stack } from "expo-router";
import React, { useState } from "react";
import { Controller, DefaultValues, FieldValues, Path, useForm } from "react-hook-form";
import { Alert, FlatList, Pressable, Text, TextInput, View } from "react-native";

export interface CrudField<F> {
  name: keyof F & string;
  placeholder: string;
  keyboardType?: "numeric" | "default";
  multiline?: boolean;
  required?: boolean;
  requiredMessage?: string;
}

interface SimpleCrudScreenProps<T extends { id?: string }, F extends FieldValues> {
  title: string;
  items: T[];
  loading: boolean;
  fields: CrudField<F>[];
  emptyForm: F;
  toForm: (item: T) => F;
  fromForm: (values: F, editing: T | null) => Omit<T, "id">;
  collection: {
    create: (data: Omit<T, "id">) => Promise<string>;
    update: (id: string, data: Partial<Omit<T, "id">>) => Promise<void>;
    delete: (id: string) => Promise<void>;
  };
  renderItem: (item: T, actions: { edit: () => void; remove: () => void }) => React.ReactNode;
  modalTitle: (editing: T | null) => string;
  deleteMessage: string;
  ListEmptyComponent?: React.ReactElement | null;
}

/**
 * Oddiy ro'yxat + qo'shish/tahrirlash modal + o'chirish. products va tags ekranlari
 * uchun umumiy skelet; ro'yxat elementi ko'rinishi renderItem orqali beriladi.
 */
function SimpleCrudScreen<T extends { id?: string }, F extends FieldValues>({
  title,
  items,
  loading,
  fields,
  emptyForm,
  toForm,
  fromForm,
  collection,
  renderItem,
  modalTitle,
  deleteMessage,
  ListEmptyComponent,
}: SimpleCrudScreenProps<T, F>) {
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const { control, handleSubmit, reset } = useForm<F>({
    defaultValues: emptyForm as DefaultValues<F>,
  });

  const openCreate = () => {
    reset(emptyForm);
    setEditing(null);
    setModalVisible(true);
  };
  const openEdit = (item: T) => {
    reset(toForm(item));
    setEditing(item);
    setModalVisible(true);
  };
  const close = () => {
    setModalVisible(false);
    reset(emptyForm);
    setEditing(null);
  };

  const onSubmit = async (values: F) => {
    try {
      const data = fromForm(values, editing);
      if (editing?.id) await collection.update(editing.id, data);
      else await collection.create(data);
      close();
    } catch {
      Alert.alert("Xato", "Saqlashda xatolik yuz berdi");
    }
  };

  const confirmDelete = (id: string) =>
    Alert.alert("O'chirish", deleteMessage, [
      { text: "Yo'q", style: "cancel" },
      {
        text: "Ha",
        style: "destructive",
        onPress: async () => {
          try {
            await collection.delete(id);
          } catch {
            Alert.alert("Xato", "O'chirishda xatolik yuz berdi");
          }
        },
      },
    ]);

  if (loading) return <Loading />;

  return (
    <View className="flex-1 bg-gray-50">
      <Stack.Screen
        options={{
          title,
          headerLeft: () => (
            <Link href="/" asChild>
              <Pressable className="p-3">
                <MaterialIcons name="arrow-back" size={24} color="#6b7280" />
              </Pressable>
            </Link>
          ),
        }}
      />

      {items.length === 0 && ListEmptyComponent ? (
        ListEmptyComponent
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id!}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <>
              {renderItem(item, {
                edit: () => openEdit(item),
                remove: () => confirmDelete(item.id!),
              })}
            </>
          )}
        />
      )}

      <Pressable
        onPress={openCreate}
        className="absolute bottom-6 right-6 w-14 h-14 bg-indigo-600 rounded-full justify-center items-center shadow-lg"
      >
        <MaterialIcons name="add" size={32} color="white" />
      </Pressable>

      <CustomModal
        visible={modalVisible}
        onClose={close}
        modalTitle={modalTitle(editing)}
        contentContainerStyle={{ justifyContent: "flex-end" }}
      >
        {fields.map((field) => (
          <Controller
            key={field.name}
            control={control}
            name={field.name as Path<F>}
            rules={field.required ? { required: field.requiredMessage ?? true } : undefined}
            render={({ field: { onChange, onBlur, value }, fieldState }) => (
              <>
                <TextInput
                  placeholder={field.placeholder}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value as string}
                  keyboardType={field.keyboardType}
                  multiline={field.multiline}
                  className={`bg-gray-50 p-4 rounded-xl mb-3 border ${
                    fieldState.error ? "border-red-400" : "border-gray-200"
                  } ${field.multiline ? "min-h-[100px]" : ""}`}
                />
                {fieldState.error && field.requiredMessage ? (
                  <Text className="text-red-500 text-xs mb-3 -mt-2 ml-1">
                    {field.requiredMessage}
                  </Text>
                ) : null}
              </>
            )}
          />
        ))}

        <View className="flex-row gap-3 mt-2">
          <Pressable onPress={close} className="flex-1 p-4 bg-slate-100 rounded-xl">
            <Text className="text-center font-bold text-slate-600">Bekor qilish</Text>
          </Pressable>
          <Pressable onPress={handleSubmit(onSubmit)} className="flex-1 p-4 bg-indigo-600 rounded-xl">
            <Text className="text-center font-bold text-white">Saqlash</Text>
          </Pressable>
        </View>
      </CustomModal>
    </View>
  );
}

export default SimpleCrudScreen;
```

- [ ] **Step 2: Rewrite `src/app/(tabs)/products/index.tsx`**

```tsx
import Card from "@/components/Card";
import SimpleCrudScreen from "@/components/SimpleCrudScreen";
import { Product, WithId } from "@/interfaces";
import { useRefData } from "@/providers/ReferenceData";
import db from "@/services/database";
import { formatSum } from "@/utils/format";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type ProductFormValues = { name: string; price: string; description: string };
const emptyForm: ProductFormValues = { name: "", price: "", description: "" };

export default function ProductsScreen() {
  const { products, loading } = useRefData();

  return (
    <SimpleCrudScreen<WithId<Product>, ProductFormValues>
      title="Mahsulotlar"
      items={products}
      loading={loading}
      emptyForm={emptyForm}
      fields={[
        { name: "name", placeholder: "Nomi", required: true },
        { name: "price", placeholder: "Narxi", keyboardType: "numeric", required: true },
        { name: "description", placeholder: "Tavsif (ixtiyoriy)", multiline: true },
      ]}
      toForm={(p) => ({ name: p.name, price: String(p.price), description: p.description || "" })}
      fromForm={(v, editing) => ({
        name: v.name,
        price: parseFloat(v.price),
        description: v.description,
        active: editing ? editing.active : true,
        updatedAt: new Date(),
        ...(editing ? {} : { createdAt: new Date() }),
      })}
      collection={db.products}
      modalTitle={(e) => (e ? "Tahrirlash" : "Yangi mahsulot")}
      deleteMessage="Haqiqatdan ham bu mahsulotni o'chirmoqchimisiz?"
      renderItem={(item, { edit, remove }) => (
        <Card className="mb-3" style={styles.boxShadow}>
          <View className="flex-row justify-between items-center">
            <View className="flex-1">
              <Text className="text-lg font-bold text-gray-800">{item.name}</Text>
              <Text className="text-gray-500">{item.description || "Tavsif yo'q"}</Text>
              <Text className="text-indigo-600 font-bold mt-1">{formatSum(item.price)}</Text>
            </View>
            <View className="flex-row gap-2">
              <Pressable onPress={edit} className="p-2 bg-blue-50 rounded-full">
                <MaterialIcons name="edit" size={20} color="#3b82f6" />
              </Pressable>
              <Pressable onPress={remove} className="p-2 bg-red-50 rounded-full">
                <MaterialIcons name="delete" size={20} color="#ef4444" />
              </Pressable>
            </View>
          </View>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  boxShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
});
```

Note: `formatSum(item.price)` renders `"12 000 so'm"` where the old code rendered `item.price.toLocaleString()` (locale-dependent grouping). Same meaning.

- [ ] **Step 3: Rewrite `src/app/(tabs)/tags/index.tsx`**

```tsx
import Card from "@/components/Card";
import SimpleCrudScreen from "@/components/SimpleCrudScreen";
import { Tag, WithId } from "@/interfaces";
import { useRefData } from "@/providers/ReferenceData";
import db from "@/services/database";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type TagFormValues = { name: string };
const emptyForm: TagFormValues = { name: "" };

export default function TagsScreen() {
  const router = useRouter();
  const { tags, loading } = useRefData();

  return (
    <SimpleCrudScreen<WithId<Tag>, TagFormValues>
      title="Teglar"
      items={tags}
      loading={loading}
      emptyForm={emptyForm}
      fields={[{ name: "name", placeholder: "Teg nomi", required: true, requiredMessage: "Teg nomi majburiy" }]}
      toForm={(t) => ({ name: t.name })}
      fromForm={(v) => ({ name: v.name })}
      collection={db.tags}
      modalTitle={(e) => (e ? "Tegni tahrirlash" : "Yangi teg")}
      deleteMessage="Haqiqatdan ham bu tegni o'chirmoqchimisiz?"
      ListEmptyComponent={
        <View style={styles.empty}>
          <MaterialIcons name="label-off" size={56} color="#d1d5db" />
          <Text style={styles.emptyText}>Hech qanday teg mavjud emas</Text>
          <Text style={styles.emptySubText}>Yangi teg qo'shish uchun + tugmasini bosing</Text>
        </View>
      }
      renderItem={(item, { edit, remove }) => (
        <Card className="mb-3" style={styles.boxShadow}>
          <View className="flex-row justify-between items-center">
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/customers/search_results",
                  params: { tagId: item.id, tagName: item.name },
                })
              }
              className="flex-row items-center flex-1 gap-3 py-1"
            >
              <View style={styles.tagBadge}>
                <MaterialIcons name="label" size={18} color="#6366f1" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-gray-800">{item.name}</Text>
                <Text className="text-xs text-indigo-500 mt-0.5">Mijozlarni ko'rish →</Text>
              </View>
            </Pressable>
            <View className="flex-row gap-2">
              <Pressable onPress={edit} className="p-2 bg-blue-50 rounded-full">
                <MaterialIcons name="edit" size={20} color="#3b82f6" />
              </Pressable>
              <Pressable onPress={remove} className="p-2 bg-red-50 rounded-full">
                <MaterialIcons name="delete" size={20} color="#ef4444" />
              </Pressable>
            </View>
          </View>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#6b7280", marginTop: 8 },
  emptySubText: { fontSize: 13, color: "#9ca3af", textAlign: "center" },
  tagBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#eef2ff",
    justifyContent: "center",
    alignItems: "center",
  },
  boxShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
});
```

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit && npx expo lint`
Expected: 0 errors. If `collection={db.products}` fails because `CollectionMethods<Product>` has extra members, that is fine (structural typing accepts a superset); if it fails on `Omit<T,"id">` variance, pass `collection={{ create: db.products.create, update: db.products.update, delete: db.products.delete }}`.

- [ ] **Step 5: Manual check**

Mahsulotlar: add, edit, delete. Teglar: add (empty name shows "Teg nomi majburiy"), edit, delete, tap a tag → search results.

- [ ] **Step 6: Commit**

```bash
git add src/components/SimpleCrudScreen.tsx "src/app/(tabs)/products/index.tsx" "src/app/(tabs)/tags/index.tsx"
git commit -m "refactor: products and tags share SimpleCrudScreen"
```

---

### Task 11: `lots/index.tsx` — aggregate sums instead of watching all orders

**Files:**
- Modify: `src/app/(tabs)/lots/index.tsx`

**Interfaces:**
- Consumes: `db.orders.sum`, `useRefData`, `useSwipeableRows`, `lostPercent`, `Loading`.

- [ ] **Step 1: Replace state and effects**

```tsx
const Lots = () => {
  const { lots, loading } = useRefData();
  const router = useRouter();
  const { closeRow, registerRow } = useSwipeableRows();
  const [orderCounts, setOrderCounts] = useState<Record<string, number>>({});

  // Har lot uchun bitta aggregate read (sum). Ilgari BARCHA orders watch qilinardi.
  // Eslatma: product_count string bo'lib saqlangan hujjatlar sum ga kirmaydi.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all(
        lots.map(async (lot) => {
          const total = await db.orders
            .sum("product_count", where("lotId", "==", lot.id))
            .catch(() => 0);
          return [lot.id, total] as const;
        }),
      ).then((entries) => {
        if (!cancelled) setOrderCounts(Object.fromEntries(entries));
      });
      return () => {
        cancelled = true;
      };
    }, [lots]),
  );

  const enrichedLots = useMemo(
    () => lots.map((lot) => ({ ...lot, order_count: orderCounts[lot.id] ?? 0 })),
    [lots, orderCounts],
  );
```

Imports: `db, { where }`, `{ useFocusEffect, Stack, useRouter } from "expo-router"`, `useRefData`, `useSwipeableRows`, `lostPercent` from `@/utils/lots`, `Loading`. Drop `orderBy`, `Order`, `ProductLot`, `useEffect`, `useRef`, `ActivityIndicator`, `Alert`, and the unused `handleDelete`.

- [ ] **Step 2: Swipeable wiring and percent**

`ref={registerRow(item.id)}` and `onSwipeableWillOpen={() => closeRow(item.id)}`. Replace the inline percent expression (lines 224-229) with `{lostPercent(item)}`. Replace the loading block with `if (loading) return <Loading />;`. Guard the "Jami buyurtmalar" colour expression with `(item.lost_products || 0)`.

- [ ] **Step 3: Type-check, lint**

Run: `npx tsc --noEmit && npx expo lint`
Expected: 0 errors.

- [ ] **Step 4: Manual check**

Open Partiyalar; note "Jami buyurtmalar" for two lots; compare with the dashboard "Jami buyurtmalar" of each — they must match (if one differs, that lot has string `product_count` values; report it, do not patch data).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(tabs)/lots/index.tsx"
git commit -m "perf(lots): aggregate order sums per lot instead of watching all orders"
```

---

### Task 12: `LotMapView` — geocode cache, route key, lookups by id

**Files:**
- Modify: `src/components/LotMapView.tsx`

**Interfaces:**
- Consumes: `digitsOnly`, `formatSum`, `WithId`.

- [ ] **Step 1: Merge the duplicate format imports** (lines 6 and 17) into one: `import { formatMoney, formatPhone, formatSum } from "@/utils/format";`

- [ ] **Step 2: Add id maps and a location key** (after the state declarations)

```tsx
  const ordersById = useMemo(() => {
    const m: Record<string, WithId<Order>> = {};
    for (const o of orders) m[o.id] = o;
    return m;
  }, [orders]);
  const customersById = useMemo(() => {
    const m: Record<string, WithId<Customer>> = {};
    for (const c of customers) m[c.id] = c;
    return m;
  }, [customers]);
  const productsById = useMemo(() => {
    const m: Record<string, WithId<Product>> = {};
    for (const p of products) m[p.id] = p;
    return m;
  }, [products]);

  // Lokatsiyalarni qayta hisoblash faqat shu kalit o'zgarganda (har snapshot'da emas)
  const locationKey = useMemo(
    () =>
      orders
        .map((o) => {
          const c = customersById[o.customer_id];
          return [
            o.id,
            o.state,
            o.location?.lat ?? "",
            o.location?.lng ?? "",
            c?.location?.lat ?? "",
            c?.location?.lng ?? "",
            o.region_name || c?.region_name || "",
            o.district_name || c?.district_name || "",
          ].join(":");
        })
        .join("|"),
    [orders, customersById],
  );

  const ordersRef = useRef(orders);
  ordersRef.current = orders;
  const customersRef = useRef(customersById);
  customersRef.current = customersById;
  const geocodeCache = useRef(new Map<string, Coordinate | null>());
```

- [ ] **Step 3: Rewrite the `fetchLocations` effect** so it depends on `locationKey` only and caches geocodes

```tsx
  useEffect(() => {
    let cancelled = false;
    const fetchLocations = async () => {
      setLoading(true);
      const newLocations = new Map<string, Coordinate>();

      for (const order of ordersRef.current) {
        if (order.location) {
          newLocations.set(order.id, { latitude: order.location.lat, longitude: order.location.lng });
          continue;
        }
        const customer = customersRef.current[order.customer_id];
        if (!customer) continue;
        if (customer.location) {
          newLocations.set(order.id, { latitude: customer.location.lat, longitude: customer.location.lng });
          continue;
        }
        const region = order.region_name || customer.region_name;
        const district = order.district_name || customer.district_name;
        const coords = await geocodeCached(region, district);
        if (coords) newLocations.set(order.id, coords);
      }
      if (!cancelled) {
        setLocations(newLocations);
        setLoading(false);
      }
    };

    // Bir xil region/district uchun Mapbox geocode faqat bir marta chaqiriladi
    const geocodeCached = async (region?: string, district?: string) => {
      if (!region) return null;
      const key = `${region}|${district ?? ""}`;
      if (geocodeCache.current.has(key)) return geocodeCache.current.get(key) ?? null;
      let coords: Coordinate | null = null;
      if (district) coords = await MapboxService.geocode(region, district);
      if (!coords) coords = await MapboxService.geocode(region);
      geocodeCache.current.set(key, coords);
      return coords;
    };

    fetchLocations();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationKey]);
```

- [ ] **Step 4: Make `calculateRoute` stable**

In `calculateRoute` replace `orders.find((o) => o.id === id)` with `ordersRef.current[id]` and set the dependency array to `[nearestNeighborOrder]`. Everywhere else in the file replace `orders.find((o) => o.id === X)` with `ordersById[X]`, `customers.find((c) => c.id === X)` with `customersById[X]`, `products.find((p) => p.id === X)` with `productsById[X]`.

- [ ] **Step 5: Small dedups**

`customer?.phone?.replace(/\s+/g, "")` → `digitsOnly(customer?.phone)`. `{selectedOrder.delivery_price.toLocaleString()} so'm` and the similar line near 889 → `{formatSum(...)}`.

- [ ] **Step 6: Type-check and lint**

Run: `npx tsc --noEmit && npx expo lint`
Expected: 0 errors.

- [ ] **Step 7: Manual check**

Open a lot map with ≥3 orders. Route draws once. From another device/tab change an unrelated field on one order (e.g. `note`) → map does not re-geocode or redraw (no spinner). Change an order's state to `done` → it drops from the route.

- [ ] **Step 8: Commit**

```bash
git add src/components/LotMapView.tsx
git commit -m "perf(map): cache geocodes, recompute route only when locations change"
```

---

### Task 13: Final verification and docs

**Files:**
- Modify: `CLAUDE.md` (Architecture section)

- [ ] **Step 1: Full verification**

Run: `npm test && npx tsc --noEmit && npx expo lint`
Expected: all tests pass, 0 tsc errors, 0 lint errors.

Run: `grep -rn "db\.\(regions\|districts\|products\|tags\|lots\|users\|customers\)\.watch(" src --include=*.tsx | grep -v providers/`
Expected: no output (all reference watches live in the provider). `db.customers.list(where("phone"...))` in `CustomerForm` and `search_results` are allowed (filtered queries).

- [ ] **Step 2: Update `CLAUDE.md`**

Under "### Dual Firebase SDK" add after the `database.tsx` bullet:

```markdown
- `src/providers/ReferenceData.tsx` holds **one** `watch` per reference collection (regions, districts, products, tags, lots, users, customers) for the whole app. Screens read them with `useRefData()` / `useDistrictsOfRegion()`; do not open your own `watch` on these collections. Per-document reads use `db.<col>.watchDoc(id, cb)`, per-lot totals use `db.orders.sum(field, ...constraints)`.
```

Under "## Commands" add `npm test                  # jest (pure utils only: src/utils/__tests__)` and change "There is no test suite." to "Tests cover only the pure helpers in `src/utils`; screens are verified manually."

Under "## Conventions and gotchas" add:

```markdown
- Shared helpers: phone (`utils/phone.ts`), money/date (`utils/format.tsx`: `formatSum` includes "so'm"), region/district matching (`utils/regions.ts`), lot lost totals (`utils/lots.ts`, `services/lotStats.ts`). Region/district pickers are always `RegionDistrictSelect`; list+modal CRUD screens use `SimpleCrudScreen`.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: describe ReferenceDataProvider and shared helpers"
```
