-- FAQ jadvali: `public.faqs` yagona jadval (matnlar uz/ru/en), `crm.faqs` eski mobil build'lar uchun
-- yoziladigan compat view (INSTEAD OF triggerlari bilan; faqat `uz` tilini o'qiydi/yozadi).
-- Eski jadval `crm.faqs_legacy` nomi bilan saqlanadi.
-- Qayta ishga tushirishga chidamli: nomini o'zgartirish faqat relkind = 'r' bo'lsa, ko'chirish faqat
-- public.faqs da id'si yo'q legacy qatorlar uchun.

-- ─── public.faqs ────────────────────────────────────────────────────────────
create table if not exists public.faqs (
  id text primary key default gen_random_uuid()::text,
  question jsonb not null check (public.is_localized(question)),
  answer jsonb not null check (public.is_localized(answer)),
  sort_order integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace trigger faqs_set_updated_at before update on public.faqs
for each row execute function public.set_updated_at();

alter table public.faqs enable row level security;

drop policy if exists faqs_public_select on public.faqs;
create policy faqs_public_select on public.faqs for select to anon using (published);

drop policy if exists faqs_staff_select on public.faqs;
create policy faqs_staff_select on public.faqs for select to authenticated
  using ((select public.app_role()) in ('admin', 'operator'));

drop policy if exists faqs_admin_insert on public.faqs;
create policy faqs_admin_insert on public.faqs for insert to authenticated
  with check ((select public.app_role()) = 'admin');

drop policy if exists faqs_admin_update on public.faqs;
create policy faqs_admin_update on public.faqs for update to authenticated
  using ((select public.app_role()) = 'admin') with check ((select public.app_role()) = 'admin');

drop policy if exists faqs_admin_delete on public.faqs;
create policy faqs_admin_delete on public.faqs for delete to authenticated
  using ((select public.app_role()) = 'admin');

grant select on public.faqs to anon;
grant select, insert, update, delete on public.faqs to authenticated;
grant all on public.faqs to service_role;

-- Realtime
alter table public.faqs replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'faqs'
  ) then
    alter publication supabase_realtime add table public.faqs;
  end if;
end $$;

-- ─── Eski jadval -> crm.faqs_legacy (o'chirilmaydi, yozish huquqi olinadi) ──
do $$
begin
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'crm' and c.relname = 'faqs' and c.relkind = 'r'
  ) then
    if exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'crm' and tablename = 'faqs'
    ) then
      alter publication supabase_realtime drop table crm.faqs;
    end if;
    alter table crm.faqs rename to faqs_legacy;
    revoke insert, update, delete, truncate on crm.faqs_legacy from authenticated;
  end if;
end $$;

-- ─── Ko'chirish ─────────────────────────────────────────────────────────────
-- Eski created_at/updated_at matn: tahlil qilib bo'lmasa now() olinadi.
create or replace function crm.faq_safe_ts(v text)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
begin
  if v is null or btrim(v) = '' then
    return now();
  end if;
  return v::timestamptz;
exception when others then
  return now();
end;
$$;

-- public.faqs da hali yo'q har bir legacy qator uchun: matn uz da, ru/en bo'sh, published = true,
-- sort_order = created_at (matn tartibi, null oxirida) bo'yicha tartib raqami.
-- Qayta ishga tushirilsa, admin keyin public.faqs dan o'chirgan legacy qatorlar qayta qo'shiladi (bir martalik).
create or replace function crm.merge_faqs_into_public()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.faqs (id, question, answer, sort_order, published, created_at, updated_at)
  select
    l.id,
    jsonb_build_object('uz', coalesce(l.question, ''), 'ru', '', 'en', ''),
    jsonb_build_object('uz', coalesce(l.answer, ''), 'ru', '', 'en', ''),
    (select coalesce(max(f.sort_order), 0) from public.faqs f)
      + row_number() over (order by l.created_at asc nulls last, l.id),
    true,
    crm.faq_safe_ts(l.created_at),
    crm.faq_safe_ts(coalesce(l.updated_at, l.created_at))
  from crm.faqs_legacy l
  where not exists (select 1 from public.faqs f where f.id = l.id);
end;
$$;

revoke all on function crm.faq_safe_ts(text) from public, anon, authenticated;
grant execute on function crm.faq_safe_ts(text) to service_role;
revoke all on function crm.merge_faqs_into_public() from public, anon, authenticated;
grant execute on function crm.merge_faqs_into_public() to service_role;

select crm.merge_faqs_into_public();

-- ─── crm.faqs compat view (eski ustunlar va turlar) ─────────────────────────
create or replace view crm.faqs with (security_invoker = true) as
select
  f.id,
  f.question ->> 'uz' as question,
  f.answer ->> 'uz' as answer,
  f.created_at::text as created_at,
  f.updated_at::text as updated_at
from public.faqs f;

-- Triggerlar chaqiruvchi huquqi bilan ishlaydi: public.faqs RLS qo'llanadi (yozish — faqat admin).
create or replace function crm.faqs_view_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_q text := coalesce(new.question, '');
  v_a text := coalesce(new.answer, '');
  v_row public.faqs;
begin
  insert into public.faqs (id, question, answer, published)
  values (
    coalesce(new.id, gen_random_uuid()::text),
    jsonb_build_object('uz', v_q, 'ru', '', 'en', ''),
    jsonb_build_object('uz', v_a, 'ru', '', 'en', ''),
    true
  )
  returning * into v_row;

  new.id := v_row.id;
  new.question := v_row.question ->> 'uz';
  new.answer := v_row.answer ->> 'uz';
  new.created_at := v_row.created_at::text;
  new.updated_at := v_row.updated_at::text;
  return new;
end;
$$;

create or replace function crm.faqs_view_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.faqs;
begin
  update public.faqs set
    question = jsonb_set(question, '{uz}', to_jsonb(coalesce(new.question, ''))),
    answer = jsonb_set(answer, '{uz}', to_jsonb(coalesce(new.answer, '')))
  where id = old.id
  returning * into v_row;

  if not found then
    return null;
  end if;

  new.id := v_row.id;
  new.question := v_row.question ->> 'uz';
  new.answer := v_row.answer ->> 'uz';
  new.created_at := v_row.created_at::text;
  new.updated_at := v_row.updated_at::text;
  return new;
end;
$$;

create or replace function crm.faqs_view_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.faqs where id = old.id;
  if not found then
    return null;
  end if;
  return old;
end;
$$;

revoke all on function crm.faqs_view_insert(), crm.faqs_view_update(), crm.faqs_view_delete()
  from public, anon;

create or replace trigger faqs_view_insert instead of insert on crm.faqs
for each row execute function crm.faqs_view_insert();
create or replace trigger faqs_view_update instead of update on crm.faqs
for each row execute function crm.faqs_view_update();
create or replace trigger faqs_view_delete instead of delete on crm.faqs
for each row execute function crm.faqs_view_delete();

grant select, insert, update, delete on crm.faqs to authenticated;
grant all on crm.faqs to service_role;
revoke all on crm.faqs from anon;
