import { createClient } from "npm:@supabase/supabase-js@2";
import { createHandler } from "../_shared/bot.ts";
import { getAddressDetails } from "../_shared/geo.ts";
import { createTelegramApi } from "../_shared/telegram.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const tg = createTelegramApi(Deno.env.get("TELEGRAM_BOT_TOKEN"), Deno.env.get("TELEGRAM_API_BASE") ?? undefined);
const nominatimBase = Deno.env.get("NOMINATIM_BASE") ?? undefined;

Deno.serve(
  createHandler({
    crm: supabase.schema("crm"),
    pub: supabase.schema("public"),
    sendMessage: tg.sendMessage,
    answerCallbackQuery: tg.answerCallbackQuery,
    geocode: (lat, lng) => getAddressDetails(lat, lng, fetch, nominatimBase),
    webhookSecret: Deno.env.get("TELEGRAM_WEBHOOK_SECRET"),
  }),
);
