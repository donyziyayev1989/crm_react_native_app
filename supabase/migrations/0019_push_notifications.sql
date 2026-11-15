-- Yangi leadlar (sayt va Telegram bot) uchun mobil push bildirishnomalar.
-- Oqim: crm.leads INSERT -> trigger -> pg_net -> Edge Function `notify-lead` -> Expo Push -> qurilma.
-- Qayta ishga tushirishga chidamli.

create extension if not exists pg_net with schema extensions;

-- ─── Qurilma tokenlari ──────────────────────────────────────────────────────
create table if not exists crm.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text,
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user_idx on crm.push_tokens (user_id);

-- RLS yoqilgan, siyosat yo'q: faqat quyidagi RPC'lar (va service_role) orqali.
alter table crm.push_tokens enable row level security;

-- Token qurilmaga bog'liq: qurilmada boshqa xodim kirsa token unga o'tadi (shuning uchun RPC, to'g'ridan-to'g'ri upsert emas)
create or replace function crm.register_push_token(p_token text, p_platform text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not crm.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into crm.push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;

create or replace function crm.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from crm.push_tokens where token = p_token and user_id = auth.uid();
$$;

revoke execute on function crm.register_push_token(text, text) from public, anon;
revoke execute on function crm.unregister_push_token(text) from public, anon;
grant execute on function crm.register_push_token(text, text) to authenticated, service_role;
grant execute on function crm.unregister_push_token(text) to authenticated, service_role;

-- ─── Maxfiy sozlamalar (Edge Function URL va umumiy sir) ────────────────────
-- RLS yoqilgan, siyosat yo'q: faqat service_role va security definer funksiyalar o'qiydi.
create table if not exists crm.private_config (
  key text primary key,
  value text not null
);
alter table crm.private_config enable row level security;
revoke all on crm.private_config from anon, authenticated;

-- ─── Trigger ────────────────────────────────────────────────────────────────
-- Lead yozilishi hech qachon push xatosi tufayli yiqilmasin: hamma xato yutiladi.
-- Migratsiya/import orqali kelgan eski leadlar (legacy) va 'new' bo'lmaganlar bildirishnoma bermaydi.
create or replace function crm.notify_new_lead()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if new.state <> 'new' or new.legacy is not null then
    return new;
  end if;

  select value into v_url from crm.private_config where key = 'push_function_url';
  select value into v_secret from crm.private_config where key = 'push_secret';
  if v_url is null or v_secret is null then
    return new; -- sozlanmagan: jim
  end if;

  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('lead_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  raise warning 'notify_new_lead: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists leads_notify_new on crm.leads;
create trigger leads_notify_new
  after insert on crm.leads
  for each row execute function crm.notify_new_lead();

-- Edge Function (service_role) o'qiydi/o'chiradi; default privileges ham beradi, lekin aniq yozib qo'yamiz
grant all on crm.push_tokens to service_role;
grant all on crm.private_config to service_role;
