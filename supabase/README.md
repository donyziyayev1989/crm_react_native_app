# CRM backend (Supabase, `crm` sxemasi)

Bu papka kurka.uz bilan **bitta Supabase loyihasi** uchun CRM qismini saqlaydi.

- `migrations/0006..0016` — `crm` sxemasi, RLS, Realtime, RPC (`0006..0009`), so'ng birlashtirilgan baza (`0010..0016`):
  yagona `crm.leads`, umumiy `public` jadvallar (lots, tags, lost_products, lot_expenses, products, faqs), `public.create_lead`,
  eski sayt buyurtmalarini leadga ko'chirish, `crm.confirm_lead`. Fayllar kurka.uz repo'sidagi nusxalar bilan **bir xil** bo'lishi shart
  (`0099_cleanup_after_verification.sql` faqat kurka.uz'da turadi va bu yerga nusxalanmaydi).
  `0001..0005` (kurka.uz repo'sida) dan keyin qo'llanadi (`public.profiles`, `public.app_role()` kerak).
- `functions/` — Telegram bot (`telegram-webhook`) va `send-telegram`. Batafsil: `functions/README.md`.

## Lokal sinov

1. Alohida ish papkasi yarating: kurka.uz `supabase/config.toml` + `migrations/0001..0016` (bu repo'da `0006..0016` bor).
2. `config.toml` da `[api] schemas` ga `"crm"` qo'shilgan bo'lishi kerak (`extra_search_path` ga ham); portlarni boshqa lokal stek bilan to'qnashmaydigan qiling.
   **Tartib muhim:** mutlaqo yangi lokal stekda `crm` sxemasi hali yo'q paytda u `schemas` ro'yxatida tursa PostgREST ishga tushmaydi.
   Avval `crm`siz `supabase start`, so'ng `supabase db reset`, keyin `crm` ni qo'shib stekni qayta ishga tushiring.
3. `npx supabase start -x studio,imgproxy,vector,logflare,mailpit`.
4. Adapter testi (test foydalanuvchisi `admin` rolida yaratiladi — umumiy `public` jadvallarga faqat admin yozadi):
   ```
   SUPABASE_TEST_URL=http://127.0.0.1:<port> SUPABASE_TEST_ANON_KEY=... SUPABASE_TEST_SERVICE_KEY=... npx jest database.integration
   ```
5. Bot testi: `functions/README.md`.

## Production'ga o'tkazish (cutover) — tartib

Hech qaysi qadam avtomatik bajarilmagan; har biri uchun tasdiq kerak. Tartibni buzmang.

1. **Lokal mashq.** Production dump'ini lokal stekka tiklab, `0010..0016` ni shu yerda sinab ko'ring (pre-flight va tekshiruv so'rovlari bilan).
2. **Production backup** (Dashboard → Database → Backups yoki `supabase db dump`).
3. **Pre-flight so'rovlar** (`db push` dan oldin; natijalarni yozib qo'ying):
   - `select count(*) from crm.products where price < 0;` — manfiy legacy narx `0012` ni to'xtatadi; avval tuzating (natija 0 bo'lsin).
   - `select id, created_at from crm.faqs where created_at !~ '^\d{4}-';` — eski matn ustuni (`0013` dan oldin `crm.faqs`, keyin `crm.faqs_legacy`) tekshiriladi; noto'g'ri vaqtlar `now()` ga tushadi; ko'rib chiqing.
   - `select count(*) from public.orders;` va `select count(*) from crm.orders;`
   - `select sum(product_price * product_count) from crm.orders;`
   - `select count(*) from crm.products;` va `select count(*) from public.products;`
4. `supabase db push` (`0010..0016`). Production'da Dashboard → Settings → API → **Exposed schemas** da `crm` bo'lishi shart.
   **Muhim:** `0010` bot deploy'i tayyor bo'lmaguncha jonli bo'lmasin — `source` ustuni `not null`, eski bot `crm.leads` ga `source`siz yozsa xato beradi.
   4–6-qadamlarni (db push, sayt deploy, Edge Function deploy) bitta oynada bajaring.
5. **Saytni deploy qiling** (u endi `public.create_lead` ni chaqiradi).
6. **Edge Function'larni deploy qiling:** `supabase functions deploy telegram-webhook send-telegram` (bot endi `source`/`items` yozadi va `public.products`/`public.faqs` dan o'qiydi).
7. **Yangi APK:** `eas build -p android --profile production`, tarqating.
8. **Tekshiruv ro'yxati** (tasdiqlang va imzolang):
   - [ ] `crm.leads` soni = eski `crm.leads` soni + `public.orders` soni (sayt buyurtmalari `source = 'website'` bilan lead bo'ldi).
   - [ ] `crm.orders` soni va `sum(product_price * product_count)` o'zgarmagan.
   - [ ] `public.products` soni = eski sayt mahsulotlari + saytga bog'lanmagan CRM mahsulotlari.
   - [ ] Har bir `crm.orders.product_id` `public.products` da mavjud.
   - [ ] `select * from crm.leads where source = 'website' limit 5;` — qiymatlar mantiqli.
   - [ ] Cutover paytida `select crm.backfill_site_orders_to_leads();` ni **yana bir marta** ishga tushiring (service role) — push va sayt deploy'i orasida kelgan buyurtmalarni oladi (idempotent).
   - [ ] Saytdan test buyurtma → lead paydo bo'ladi; Telegram bot orqali test lead (`source = 'telegram'`); ilovada leadni tasdiqlash ishlaydi.
   - [ ] Operator ilovada mahsulot/teg/partiya/FAQ ni o'zgartira olmaydi, admin o'zgartira oladi.
9. **`0099` faqat tasdiqdan keyin**, alohida (batafsil quyida).

Qolgan umumiy sozlamalar (birinchi marta o'tkazishda): Dashboard → Authentication → Providers → **Google** ni yoqing,
**Authorized Client IDs** ga `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (Web client ID) ni kiriting (native `idToken` da nonce yo'q, "Skip nonce checks" kerak bo'lishi mumkin);
Firebase ma'lumotini ko'chirish: `scripts/migrate-firestore-to-supabase/README.md` (avval `--dry-run`); ilovaga `.env` va EAS `production` env ga
`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (service_role hech qachon); `EXPO_PUBLIC_BOT_TOKEN` ni o'chiring va eski bot tokenini @BotFather'da yangilang;
bot sirlari: `supabase secrets set TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=...`, `setWebhook` (`functions/README.md`). Hammasi tekshirilgach
`functions/`, `firebase.json`, `firestore.rules`, `.firebaserc`, `google-services.json` ni repodan olib tashlang.

### Ma'lum va qabul qilingan yomonlashuvlar

- Eski APK build'lari `crm.*` compat view'lari orqali ishlashda davom etadi, lekin lots/tags/products/faqs/lost_products/lot_expenses uchun **Realtime olmaydi** (view'lar publication'da emas).
- Operatorlar endi mahsulot, teg, partiya, partiya xarajati va FAQ ni yoza olmaydi (RLS bo'yicha faqat admin); yangi ilova bu boshqaruvlarni yashiradi.
- 6 ta sayt tumani CRM'da mos kelmaydi va slug sifatida o'tadi: `boston` (Andijon), `ozbekiston` (Farg'ona), `davlatobod`, `yangi-namangan` (Namangan), `toyloq` → CRM `Tayloq`, `boka` → CRM `Buka`.
  Tuzatish: `crm.site_districts` ga qator qo'shing yoki CRM tuman nomlarini o'zgartiring.
- Sayt admin panelidagi "Mijozlar" bo'limi mahsulot filtrini va buyurtmalar soni ustunlarini yo'qotdi.

### 0099 faqat tasdiqdan keyin

`kurka.uz/supabase/migrations/0099_cleanup_after_verification.sql` **qaytarib bo'lmaydi** va bu repoga nusxalanmaydi. U
`public.create_order`, `public.orders/order_items/order_status_history/customers`, compat view'lar (`crm.products/faqs/lots/tags/lost_products/lot_expenses`),
`crm.products_legacy`, `crm.faqs_legacy`, `public.product_id_map` va bir martalik funksiyalarni (`merge_*`, `backfill_site_orders_to_leads`, `leads_backfill`) o'chiradi.
Faqat yuqoridagi tekshiruv ro'yxati imzolangach, yangi APK keng tarqalgach va yangi backup olingach, alohida `supabase db push` bilan qo'llang.

## Ma'lum cheklovlar

- Oflayn yozuv navbati yo'q (Firestore'da bor edi): internet yo'q paytda saqlash xato beradi. O'qish uchun reference ma'lumotlar keshdan chiqadi.
- Web'dagi Google bilan kirish (`profile.tsx`) avvalgidek yo'q.
- Mavjud xodimlar `public.profiles` da faol bo'lishi shart, aks holda ilovaga kira olmaydi.
