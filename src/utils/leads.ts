import { Customer, Lead, LeadItem, WithId } from "../interfaces";
import { digitsOnly, phonesMatch } from "./phone";

/**
 * Lead tarkibi. Yangi leadlarda `items` to'ldirilgan; eski Telegram leadlarda faqat
 * `product_*` maydonlari bor — ulardan bitta item yasaladi (narx noma'lum: null).
 */
export const leadItems = (lead: Lead): LeadItem[] => {
  if (lead.items && lead.items.length > 0) return lead.items;
  if (!lead.product_id) return [];
  return [
    {
      product_id: lead.product_id,
      name: lead.product_name ?? "",
      price: null,
      quantity: lead.product_count ?? 0,
    },
  ];
};

const SOURCE_LABELS: Record<Lead["source"], string> = {
  website: "Sayt",
  telegram: "Telegram",
  manual: "Qo'lda",
};

export const sourceLabel = (source: Lead["source"]): string => SOURCE_LABELS[source] ?? source;

/** Telefon bo'yicha qidirish uchun so'rovdagi minimal raqamlar soni */
const MIN_PHONE_DIGITS = 7;

/**
 * Lead uchun mavjud mijozni topish: ism qismi (katta-kichik harfsiz) yoki telefon.
 * Telefon so'rovda kamida 7 raqam bo'lsa tekshiriladi: to'liq raqam `phonesMatch` bilan,
 * qisman yozilgani mijoz raqamining ichida qidiriladi.
 */
export const findCustomerMatches = (
  customers: WithId<Customer>[],
  query: string,
): WithId<Customer>[] => {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const qDigits = digitsOnly(q);
  const byPhone = qDigits.length >= MIN_PHONE_DIGITS;

  return customers.filter((c) => {
    if ((c.name ?? "").toLowerCase().includes(q)) return true;
    if (!byPhone) return false;
    return phonesMatch(c.phone, qDigits) || digitsOnly(c.phone).includes(qDigits);
  });
};
