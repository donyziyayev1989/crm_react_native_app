-- CRM (mobil ilova + Telegram bot) jadvallari: alohida `crm` sxemasi.
-- Sayt jadvallari (`public.*`) o'zgarmaydi. Auth va rollar umumiy: public.profiles / auth.users.
--
-- Hujjat ID'lari Firestore'dan ko'chiriladi, shuning uchun PK = text.
-- Munosabat ustunlari (lot_id, customer_id, ...) ataylab FK'siz: Firestore'da cascade bo'lmagan va
-- eski ma'lumotda yetim havolalar bor; xatti-harakat saqlanadi. Qidiruv uchun indekslar bor.

create schema if not exists crm;

-- Staff = public.profiles da faol admin yoki operator (public.app_role() 0002 da).
create function crm.is_staff() returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select coalesce(public.app_role() in ('admin', 'operator'), false);
$$;

revoke execute on function crm.is_staff() from public;
grant execute on function crm.is_staff() to authenticated, service_role;

-- ─── Spravochniklar ─────────────────────────────────────────────────────────

create table crm.regions (
  id text primary key default gen_random_uuid()::text,
  name text not null
);

create table crm.districts (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  region_id text not null -- legacy aliaslar bo'lishi mumkin, FK yo'q (utils/regions.ts)
);
create index districts_region_id_idx on crm.districts (region_id);

create table crm.products (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  price numeric not null default 0,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- keyingi integratsiya uchun: saytdagi mahsulot (ixtiyoriy)
  site_product_id text references public.products (id) on delete set null
);

create table crm.tags (
  id text primary key default gen_random_uuid()::text,
  name text not null
);

create table crm.rates (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  rate numeric not null default 0
);

-- ─── Partiyalar ─────────────────────────────────────────────────────────────

create table crm.lots (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  date text not null, -- ISO sana satri (tartiblash shu satr bo'yicha)
  product_count numeric not null default 0,
  lost_products numeric not null default 0,
  order_count numeric
);

create table crm.lost_products (
  id text primary key default gen_random_uuid()::text,
  lot_id text not null,
  count numeric not null default 0,
  date text not null,
  timestamp bigint not null default 0
);
create index lost_products_lot_id_idx on crm.lost_products (lot_id);

create table crm.lot_expenses (
  id text primary key default gen_random_uuid()::text,
  lot_id text not null,
  name text not null,
  count numeric not null default 0,
  price_per_unit numeric not null default 0,
  total_price numeric not null default 0,
  date text not null,
  timestamp bigint not null default 0
);
create index lot_expenses_lot_id_idx on crm.lot_expenses (lot_id);

-- ─── Mijozlar va buyurtmalar ────────────────────────────────────────────────

create table crm.customers (
  id text primary key default gen_random_uuid()::text,
  name text not null default '',
  region_name text not null default '',
  district_name text,
  phone text not null default '',
  user_id uuid references auth.users (id) on delete set null,
  tag_ids text[] not null default '{}',
  note text not null default '',
  rates numeric not null default 0,
  order_ids text[] not null default '{}', -- tarixiy: partiya ID'lari (qidiruv: array-contains)
  location jsonb, -- { lat, lng, address? }
  telegram_id text,
  created_at timestamptz not null default now()
);
create index customers_phone_idx on crm.customers (phone);
create index customers_name_idx on crm.customers (lower(name) text_pattern_ops);
create index customers_telegram_id_idx on crm.customers (telegram_id) where telegram_id is not null;
create index customers_tag_ids_idx on crm.customers using gin (tag_ids);
create index customers_order_ids_idx on crm.customers using gin (order_ids);

create table crm.orders (
  id text primary key default gen_random_uuid()::text,
  lot_id text not null,
  customer_id text not null,
  product_id text not null,
  product_count numeric not null default 0,
  product_price numeric not null default 0,
  region_name text not null default '',
  district_name text,
  date text not null,
  rate numeric not null default 0,
  state text not null default '',
  user_id uuid references auth.users (id) on delete set null,
  delivery_price numeric not null default 0,
  note text,
  location jsonb, -- { lat, lng, address? }
  created_at timestamptz not null default now()
);
create index orders_lot_id_idx on crm.orders (lot_id);
create index orders_customer_id_idx on crm.orders (customer_id);
create index orders_date_idx on crm.orders (date desc);

-- ─── Leadlar va Telegram chat ───────────────────────────────────────────────

create table crm.leads (
  id text primary key default gen_random_uuid()::text,
  name text not null default '',
  phone text not null default '',
  telegram_id text not null default '',
  product_id text,
  product_name text,
  product_count numeric not null default 0,
  region_name text,
  district_name text,
  location jsonb, -- { lat, lng }
  date text not null,
  state text not null default 'new' check (state in ('new', 'confirmed', 'rejected', 'pending')),
  note text
);
create index leads_telegram_id_idx on crm.leads (telegram_id);
create index leads_date_idx on crm.leads (date desc);

-- id = lead yoki mijoz ID'si
create table crm.lead_chats (
  id text primary key,
  lead_id text not null,
  last_message text,
  last_timestamp text,
  unread_count integer not null default 0
);
create index lead_chats_last_timestamp_idx on crm.lead_chats (last_timestamp desc);

create table crm.lead_messages (
  id text primary key default gen_random_uuid()::text,
  chat_id text not null references crm.lead_chats (id) on delete cascade,
  text text not null,
  sender text not null check (sender in ('operator', 'customer')),
  timestamp text not null,
  user_id uuid references auth.users (id) on delete set null
);
create index lead_messages_chat_id_idx on crm.lead_messages (chat_id, timestamp);

-- ─── Kontent ────────────────────────────────────────────────────────────────

create table crm.faqs (
  id text primary key default gen_random_uuid()::text,
  question text not null,
  answer text not null,
  created_at text,
  updated_at text
);

create table crm.settings (
  id text primary key, -- masalan 'about_us'
  text text,
  updated_at text
);

-- ─── Bot sessiyalari (faqat service_role) ───────────────────────────────────

create table crm.bot_sessions (
  chat_id text primary key,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- ─── Foydalanuvchilar: profiles + auth.users ustidan o'qish uchun view ───────
-- View egasi (postgres) sifatida ishlaydi, shuning uchun auth.users o'qiladi; staff bo'lmaganga bo'sh.

create view crm.users as
select
  p.id::text as id,
  p.name,
  u.email,
  u.raw_user_meta_data ->> 'avatar_url' as photo_url,
  p.role::text as role
from public.profiles p
join auth.users u on u.id = p.id
where p.active and crm.is_staff();
