-- crm.leads ni kengaytirish: veb-sayt buyurtmalari ham lead sifatida shu yerga tushadi.
-- Qayta ishga tushirishga chidamli (if not exists, faqat bo'sh qatorlar to'ldiriladi).

create sequence if not exists crm.leads_number_seq;

alter table crm.leads
  add column if not exists source text,
  add column if not exists items jsonb not null default '[]',
  add column if not exists address text,
  add column if not exists locale text,
  add column if not exists total numeric not null default 0,
  add column if not exists has_unpriced boolean not null default false,
  add column if not exists number bigint,
  add column if not exists customer_id text,
  add column if not exists order_ids text[] not null default '{}',
  add column if not exists legacy jsonb;

-- Mavjud (Telegram) leadlar
update crm.leads set source = 'telegram' where source is null;

alter table crm.leads alter column source set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'crm.leads'::regclass and conname = 'leads_source_check'
  ) then
    alter table crm.leads
      add constraint leads_source_check check (source in ('website', 'telegram', 'manual'));
  end if;
end $$;

-- Eski qatorlarni to'ldiradi: items (product_* dan) va number (date bo'yicha tartibda).
create or replace function crm.leads_backfill()
returns void
language plpgsql
as $$
declare
  base bigint;
begin
  update crm.leads
  set items = jsonb_build_array(jsonb_build_object(
    'product_id', product_id,
    'name', product_name,
    'price', null,
    'quantity', product_count
  ))
  where items = '[]'::jsonb and product_id is not null;

  select coalesce(max(number), 0) into base from crm.leads;

  update crm.leads l
  set number = base + n.rn
  from (
    select id, row_number() over (order by date, id) as rn
    from crm.leads
    where number is null
  ) n
  where l.id = n.id;

  select coalesce(max(number), 0) into base from crm.leads;
  perform setval('crm.leads_number_seq', greatest(base, 1), base > 0);
end;
$$;

revoke all on function crm.leads_backfill() from public, anon, authenticated;
grant execute on function crm.leads_backfill() to service_role;

select crm.leads_backfill();

alter table crm.leads alter column number set default nextval('crm.leads_number_seq');
alter sequence crm.leads_number_seq owned by crm.leads.number;
create unique index if not exists leads_number_key on crm.leads (number);

-- Default nextval() ni chaqirish uchun sequence'ga ruxsat
grant usage, select on sequence crm.leads_number_seq to authenticated, service_role;
-- leads_backfill() setval() chaqiradi
grant update on sequence crm.leads_number_seq to service_role;
