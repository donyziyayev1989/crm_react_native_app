// Ilovadan operator xabarini Telegram'ga yuborish. Bot tokeni faqat shu yerda (serverda) turadi.
// POST { chat_id, text } + Authorization: Bearer <foydalanuvchi JWT>. Faqat faol admin/operator.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
const base = Deno.env.get("TELEGRAM_API_BASE") ?? "https://api.telegram.org";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "unauthorized" }, 401);

  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData.user) return json({ error: "unauthorized" }, 401);

  const { data: profile } = await admin
    .from("profiles")
    .select("role, active")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (!profile || !profile.active || !["admin", "operator"].includes(profile.role)) {
    return json({ error: "forbidden" }, 403);
  }

  let body: { chat_id?: string | number; text?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const chatId = body.chat_id;
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if ((typeof chatId !== "string" && typeof chatId !== "number") || !/^-?\d+$/.test(String(chatId)) || !text) {
    return json({ error: "bad_request" }, 400);
  }
  if (!token) return json({ error: "bot_not_configured" }, 500);

  // Telegram xatosini ilovaga qaytarish uchun to'g'ridan-to'g'ri chaqiramiz
  const res = await fetch(`${base}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!res.ok) {
    console.error("sendMessage Error:", res.status, await res.text());
    return json({ error: "telegram_failed" }, 502);
  }
  return json({ ok: true });
});
