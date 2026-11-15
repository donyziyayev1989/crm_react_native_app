# Edge Functions (CRM bot)

- `telegram-webhook` — Telegram bot webhook (Firebase `functions/index.js` o'rniga).
- `send-telegram` — ilovadan operator xabarini yuborish (JWT + faol staff tekshiruvi).
- `_shared/` — sof mantiq (`geo.ts`, `menu.ts`, `bot.ts`, `telegram.ts`), `_tests/` — testlar.
- `pub` (`supabase.schema("public")`) — umumiy `products` va `faqs` jadvallari (`published = true`, matn `->>uz`); `crm` — leads, customers, bot_sessions, settings.

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

## Yangi lead push bildirishnomalari (`notify-lead`)

Sayt (`public.create_lead`) va Telegram bot `crm.leads` ga yozadi; `crm.notify_new_lead` triggeri (migratsiya
`0019_push_notifications.sql`, pg_net) `notify-lead` ni chaqiradi, u faol admin/operator qurilmalariga
Expo Push yuboradi. `legacy` (import qilingan) va `state <> 'new'` leadlar bildirishnoma bermaydi.

`supabase/config.toml`:

```toml
[functions.notify-lead]
verify_jwt = false
```

Sozlash (bir marta):

```
supabase secrets set PUSH_WEBHOOK_SECRET=<tasodifiy uzun satr>
supabase functions deploy notify-lead --no-verify-jwt
```

SQL muharririda (qiymatlar migratsiyada yo'q, `crm.private_config` ga yoziladi; sir yuqoridagi bilan bir xil):

```sql
insert into crm.private_config (key, value) values
  ('push_function_url', 'https://<project-ref>.supabase.co/functions/v1/notify-lead'),
  ('push_secret', '<PUSH_WEBHOOK_SECRET>')
on conflict (key) do update set value = excluded.value;
```

Android uchun Expo'ga FCM V1 kaliti kerak: `eas credentials` -> Android -> Google Service Account Key (FCM V1).
Ilova qayta build qilinadi (`expo-notifications`, `google-services.json` qo'shildi).
Ixtiyoriy: `EXPO_ACCESS_TOKEN` (Expo "enhanced push security" yoqilgan bo'lsa).
