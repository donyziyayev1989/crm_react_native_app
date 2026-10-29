# Edge Functions (CRM bot)

- `telegram-webhook` — Telegram bot webhook (Firebase `functions/index.js` o'rniga).
- `send-telegram` — ilovadan operator xabarini yuborish (JWT + faol staff tekshiruvi).
- `_shared/` — sof mantiq (`geo.ts`, `menu.ts`, `bot.ts`, `telegram.ts`), `_tests/` — testlar.

## Sozlash

`supabase/config.toml` ga (webhook Telegram'dan keladi, Supabase JWT yo'q):

```toml
[functions.telegram-webhook]
verify_jwt = false
```

`send-telegram` JWT ni o'zi tekshiradi (`verify_jwt` default true qolishi mumkin).

Sirlar (`supabase secrets set`):

```
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=<tasodifiy uzun satr, A-Za-z0-9_->
```

`SUPABASE_URL` va `SUPABASE_SERVICE_ROLE_KEY` avtomatik beriladi. Ixtiyoriy (test): `TELEGRAM_API_BASE`, `NOMINATIM_BASE`.

Webhook'ni ro'yxatdan o'tkazish (cutover paytida):

```
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://<project-ref>.supabase.co/functions/v1/telegram-webhook" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
```

## Testlar

`node --test "supabase/functions/_tests/*.test.mjs"` (Node 22+; Deno shart emas — `_shared` Deno API ishlatmaydi).
