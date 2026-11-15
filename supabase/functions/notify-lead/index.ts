// Yangi lead -> xodimlar qurilmalariga push (Expo Push API).
// `crm.notify_new_lead` triggeri chaqiradi (pg_net): POST { lead_id } + x-push-secret sarlavhasi.
// JWT yo'q (verify_jwt = false); autentifikatsiya umumiy sir bilan. Sayt va Telegram leadlari uchun bir xil.
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildLeadMessages, chunk, deadTokens, isExpoToken } from "../_shared/push.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const crm = supabase.schema("crm");
const secret = Deno.env.get("PUSH_WEBHOOK_SECRET");
const expoUrl = Deno.env.get("EXPO_PUSH_URL") ?? "https://exp.host/--/api/v2/push/send";
const expoAccessToken = Deno.env.get("EXPO_ACCESS_TOKEN"); // ixtiyoriy (Expo "enhanced security")

Deno.serve(async (req) => {
  if (!secret || req.headers.get("x-push-secret") !== secret) {
    return new Response("unauthorized", { status: 401 });
  }

  let leadId: string | undefined;
  try {
    leadId = (await req.json())?.lead_id;
  } catch {
    return new Response("bad_request", { status: 400 });
  }
  if (!leadId) return new Response("bad_request", { status: 400 });

  const { data: lead, error } = await crm.from("leads").select("*").eq("id", leadId).maybeSingle();
  if (error || !lead) {
    console.error("notify-lead: lead topilmadi", leadId, error);
    return new Response("not_found", { status: 404 });
  }

  // Faqat faol admin/operator qurilmalari
  const { data: rows, error: tokErr } = await crm.from("push_tokens").select("token, user_id");
  if (tokErr) {
    console.error("notify-lead: tokenlar o'qilmadi", tokErr);
    return new Response("error", { status: 500 });
  }
  const userIds = [...new Set((rows ?? []).map((r: { user_id: string }) => r.user_id))];
  const { data: staff } = await supabase
    .schema("public")
    .from("profiles")
    .select("id")
    .in("id", userIds)
    .eq("active", true)
    .in("role", ["admin", "operator"]);
  const allowed = new Set((staff ?? []).map((p: { id: string }) => p.id));
  const tokens = (rows ?? [])
    .filter((r: { user_id: string; token: string }) => allowed.has(r.user_id) && isExpoToken(r.token))
    .map((r: { token: string }) => r.token);
  if (tokens.length === 0) return new Response("no_devices", { status: 200 });

  const messages = buildLeadMessages(lead, tokens);
  const dead: string[] = [];
  for (const batch of chunk(messages)) {
    try {
      const res = await fetch(expoUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(expoAccessToken ? { Authorization: `Bearer ${expoAccessToken}` } : {}),
        },
        body: JSON.stringify(batch),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) console.error("notify-lead: Expo xatosi", res.status, JSON.stringify(json));
      else dead.push(...deadTokens(batch, json.data ?? []));
    } catch (e) {
      console.error("notify-lead: Expo so'rovi", (e as Error).message);
    }
  }

  if (dead.length > 0) await crm.from("push_tokens").delete().in("token", dead);
  return new Response(JSON.stringify({ sent: messages.length, removed: dead.length }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
