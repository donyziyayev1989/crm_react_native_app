import { Customer, Lead, LeadItem, WithId } from "../interfaces";
import { parseNum } from "./format";
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

/** Manba nomi. `source` yo'q eski qatorlar — Telegram murojaatlari. */
export const sourceLabel = (source: Lead["source"] | null | undefined): string =>
  (source && SOURCE_LABELS[source]) ?? SOURCE_LABELS.telegram;

/** `crm.confirm_lead` RPC argumentlari (database.tsx `confirmLead`) */
export interface ConfirmArgs {
  leadId: string;
  /** null — leaddan yangi mijoz yaratiladi */
  customerId: string | null;
  lotId: string;
  deliveryPrice: number;
  /** Faqat leadda narxi yo'q (null) itemlar uchun: product_id → narx */
  itemPrices: Record<string, number>;
}

export interface ConfirmForm {
  customerId: string | null;
  lotId: string;
  deliveryPrice: string;
  /** Narxsiz itemlar uchun kiritilgan narxlar: product_id → matn */
  prices: Record<string, string>;
}

/** Tasdiqlash formasini tekshiradi va RPC argumentlariga aylantiradi */
export const buildConfirmArgs = (
  lead: Lead,
  form: ConfirmForm,
): { ok: true; args: ConfirmArgs } | { ok: false; error: string } => {
  if (!form.lotId) return { ok: false, error: "Partiyani tanlang" };

  const itemPrices: Record<string, number> = {};
  for (const item of leadItems(lead)) {
    if (item.price != null) continue;
    const raw = (form.prices[item.product_id] ?? "").replace(/\s/g, "");
    if (raw === "" || !Number.isFinite(parseFloat(raw))) {
      return { ok: false, error: "Narxi kiritilmagan mahsulot bor" };
    }
    itemPrices[item.product_id] = parseNum(raw);
  }

  return {
    ok: true,
    args: {
      leadId: lead.id ?? "",
      customerId: form.customerId,
      lotId: form.lotId,
      deliveryPrice: parseNum(form.deliveryPrice),
      itemPrices,
    },
  };
};

const CONFIRM_ERRORS: Record<string, string> = {
  already_confirmed: "Bu murojaat allaqachon tasdiqlangan",
  unpriced_item: "Narxi kiritilmagan mahsulot bor",
  lot_not_found: "Partiya topilmadi",
  customer_not_found: "Mijoz topilmadi",
  no_items: "Mahsulot yo'q",
  not_staff: "Ruxsat yo'q",
};

/** `confirm_lead` xatosi (Postgres exception message) → o'zbekcha xabar */
export const confirmErrorMessage = (err: unknown): string => {
  const message =
    err && typeof err === "object" && "message" in err
      ? String((err as { message: unknown }).message)
      : "";
  return CONFIRM_ERRORS[message.trim()] ?? "Tasdiqlashda xatolik yuz berdi";
};

const STATE_LABELS: Record<Lead["state"], string> = {
  new: "Yangi",
  pending: "Kutilmoqda",
  confirmed: "Tasdiqlangan",
  rejected: "Rad etilgan",
};

/** Lead holati o'zbekcha */
export const leadStateLabel = (state: Lead["state"]): string => STATE_LABELS[state] ?? state;

/** Hali tasdiqlanmagan (operator ishlashi kerak) lead — "Tasdiqlash" tugmasi ko'rinadi */
export const canConfirmLead = (lead: Pick<Lead, "state">): boolean =>
  lead.state === "new" || lead.state === "pending";

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
