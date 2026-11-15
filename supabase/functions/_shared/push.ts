// Yangi lead uchun push bildirishnoma mantiqi (Expo Push API). Sof funksiyalar: Deno ham, Node ham ishlata oladi.

export interface LeadRow {
  id: string;
  number?: number | null;
  source?: string | null;
  name?: string | null;
  phone?: string | null;
  product_name?: string | null;
  product_count?: number | null;
  items?: { name?: string; quantity?: number }[] | null;
  total?: number | null;
  has_unpriced?: boolean | null;
  region_name?: string | null;
}

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  sound: "default";
  priority: "high";
  channelId: "leads";
  data: { type: "lead"; leadId: string };
}

const SOURCE_LABEL: Record<string, string> = { website: "Sayt", telegram: "Telegram", manual: "Qo'lda" };

const formatSum = (n: number) => `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} so'm`;

/** "Kurka × 50" yoki bir nechta bo'lsa "Kurka × 50 +2" */
export function summarizeItems(lead: LeadRow): string {
  const items = (lead.items ?? []).filter((i) => i && i.name);
  if (items.length === 0) {
    return lead.product_name ? `${lead.product_name} × ${lead.product_count ?? 0}` : "";
  }
  const first = `${items[0].name} × ${items[0].quantity ?? 0}`;
  return items.length > 1 ? `${first} +${items.length - 1}` : first;
}

export function buildLeadMessages(lead: LeadRow, tokens: string[]): ExpoMessage[] {
  const source = SOURCE_LABEL[lead.source ?? ""] ?? "Yangi";
  const title = `Yangi buyurtma (${source})${lead.number ? ` #${lead.number}` : ""}`;
  const parts = [
    lead.name?.trim() || lead.phone?.trim() || "Noma'lum mijoz",
    summarizeItems(lead),
    lead.total && lead.total > 0 ? formatSum(lead.total) : lead.has_unpriced ? "Narx kelishiladi" : "",
    lead.region_name ?? "",
  ].filter(Boolean);
  const body = parts.join(" · ");
  return tokens.map((to) => ({
    to,
    title,
    body,
    sound: "default",
    priority: "high",
    channelId: "leads",
    data: { type: "lead", leadId: lead.id },
  }));
}

/** Expo bir so'rovda 100 tagacha xabar qabul qiladi */
export function chunk<T>(items: T[], size = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Expo javobidagi `DeviceNotRegistered` bo'lgan tokenlar (bazadan o'chiriladi) */
export function deadTokens(
  messages: { to: string }[],
  tickets: { status?: string; details?: { error?: string } }[],
): string[] {
  const dead: string[] = [];
  tickets.forEach((t, i) => {
    if (t?.status === "error" && t.details?.error === "DeviceNotRegistered" && messages[i]) {
      dead.push(messages[i].to);
    }
  });
  return dead;
}

export const isExpoToken = (t: unknown): t is string =>
  typeof t === "string" && /^(Exponent|Expo)PushToken\[[^\]]+\]$/.test(t);
