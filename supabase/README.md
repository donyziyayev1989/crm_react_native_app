# CRM backend (Supabase, `crm` sxemasi)

Bu papka kurka.uz bilan **bitta Supabase loyihasi** uchun CRM qismini saqlaydi.

- `migrations/0006..0008` — `crm` sxemasi, RLS, Realtime, RPC. Sayt `public.*` jadvallariga tegmaydi.
  `0001..0005` (kurka.uz repo'sida) dan keyin qo'llanadi (`public.profiles`, `public.app_role()` kerak).
- `functions/` — Telegram bot (`telegram-webhook`) va `send-telegram`. Batafsil: `functions/README.md`.

## Lokal sinov

1. Alohida ish papkasi yarating: kurka.uz `supabase/config.toml` + `migrations/0001..0005` + shu repo `migrations/0006..0008`.
2. `config.toml` da: `[api] schemas` ga `"crm"` qo'shing (`extra_search_path` ga ham), portlarni boshqa lokal stek bilan to'qnashmaydigan qiling.
3. `npx supabase start -x studio,imgproxy,vector,logflare,mailpit`.
4. Adapter testi:
   ```
   SUPABASE_TEST_URL=http://127.0.0.1:<port> SUPABASE_TEST_ANON_KEY=... SUPABASE_TEST_SERVICE_KEY=... npx jest database.integration
   ```
5. Bot testi: `functions/README.md`.

## Production'ga o'tkazish (cutover) — tartib

Hech qaysi qadam avtomatik bajarilmagan; har biri uchun tasdiq kerak.

1. `0006..0008` ni kurka.uz repo'sining `supabase/migrations/` ga ko'chiring (bitta tarix) va `supabase db push` qiling.
2. Dashboard → Settings → API → **Exposed schemas** ga `crm` qo'shing. (Realtime uchun qo'shimcha narsa kerak emas — migratsiya jadvallarni publication'ga qo'shadi.)
3. Dashboard → Authentication → Providers → **Google** ni yoqing; **Authorized Client IDs** ga ilovadagi `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (Web client ID) ni kiriting. Native `idToken` da nonce yo'q, shuning uchun "Skip nonce checks" kerak bo'lishi mumkin — Android qurilmada sinab ko'ring.
4. Ma'lumot ko'chirish: `scripts/migrate-firestore-to-supabase/README.md` (avval `--dry-run`). U Firebase xodimlari uchun Supabase foydalanuvchilari va `public.profiles` qatorlarini yaratadi; kirishda Google email bo'yicha mavjud akkauntga bog'lanadi.
5. Ilovaga `.env` va EAS `production` env ga `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` qo'shing (anon kalit ochiq bo'lishi mumkin; service_role hech qachon). `EXPO_PUBLIC_BOT_TOKEN` ni o'chiring va eski bot tokenini @BotFather'da yangilang (u avvalgi APK'larda ochiq turgan).
6. Bot: `supabase secrets set TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=...`, `supabase functions deploy telegram-webhook send-telegram`, so'ng `setWebhook` (`functions/README.md`). Webhook almashtirilgach Firebase funksiyasi to'xtaydi.
7. Yangi APK build (`eas build -p android --profile production`; endi native Firebase yo'q, `google-services.json` kerak emas).
8. Hammasi tekshirilgach Firebase loyihasini zaxirada ushlab turib, keyin `functions/`, `firebase.json`, `firestore.rules`, `.firebaserc`, `google-services.json` ni repodan olib tashlang.

## Ma'lum cheklovlar

- Oflayn yozuv navbati yo'q (Firestore'da bor edi): internet yo'q paytda saqlash xato beradi. O'qish uchun reference ma'lumotlar keshdan chiqadi.
- Web'dagi Google bilan kirish (`profile.tsx`) avvalgidek yo'q.
- Mavjud xodimlar `public.profiles` da faol bo'lishi shart, aks holda ilovaga kira olmaydi.
