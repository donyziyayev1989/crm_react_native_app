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

export const formatPhone = (phone: string | undefined) => {
  if (!phone) return "";

  // Faqat raqamlarni olamiz
  const digits = phone.replace(/\D/g, "");

  // 998 bilan boshlangan 12 xonali raqam bo'lsa
  if (digits.length === 12 && digits.startsWith("998")) {
    return `+998 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10, 12)}`;
  }

  // 9 xonali raqam bo'lsa (+998 siz)
  if (digits.length === 9) {
    return `+998 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
  }

  // Boshqa holatlarda, agar 998 dan ko'p bo'lsa shunchaki + qo'shib qaytaramiz
  return digits.length >= 3 ? `+${digits}` : digits;
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
