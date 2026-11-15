/** Push `data` dan ochiladigan ekran (server: supabase/functions/_shared/push.ts). Noma'lum bo'lsa null. */
export function notificationRoute(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as { type?: unknown; leadId?: unknown };
  if (d.type === "lead" && typeof d.leadId === "string" && /^[\w-]+$/.test(d.leadId)) {
    return `/(tabs)/leads/${d.leadId}`;
  }
  return null;
}
