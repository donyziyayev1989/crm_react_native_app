export { formatPhone } from "./phone";

const toFormattedDate = (d: Date): string => {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
};

export const formatDate = (date: any): string => {
  if (!date) return "";
  // Firestore Timestamp
  if (typeof date?.toDate === "function") {
    return toFormattedDate(date.toDate());
  }
  // JS Date
  if (date instanceof Date) {
    return toFormattedDate(date);
  }
  // string yoki number
  return toFormattedDate(new Date(date));
};

export const formatMoney = (amount: number | string | undefined): string => {
  if (amount === undefined || amount === null) return "0";

  // Faqat raqamlarni olib tashlab formatlash uchun
  const num =
    typeof amount === "string" ? parseFloat(amount.replace(/ /g, "")) : amount;

  if (isNaN(num)) return "0";

  // Har 3 ta raqam orasiga bo'sh joy qoldiruvchi regex
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

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
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
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
