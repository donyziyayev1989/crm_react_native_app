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

/**
 * PhoneInput ichidagi mahalliy qism. Input qiymati "+998 " + yozilgan raqamlar
 * ko'rinishida saqlanadi, shuning uchun prefiks matn sifatida olib tashlanadi —
 * toLocal9 bunga yaramaydi: "+998 1" dan "9981" chiqib ketadi.
 */
export const localInputPart = (value: string | undefined | null): string => {
  const v = value ?? "";
  if (/^\s*\+?998\s/.test(v)) {
    return digitsOnly(v.replace(/^\s*\+?998\s/, "")).slice(0, 9);
  }
  return toLocal9(v);
};

export const last9 =(s: string | undefined | null): string =>
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
