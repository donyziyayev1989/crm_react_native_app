-- Mahsulotlar birlashadi: `public.products` yagona jadval, `crm.products` eski mobil build'lar uchun
-- yoziladigan compat view (INSTEAD OF triggerlari bilan). Eski jadval `crm.products_legacy` nomi bilan
-- saqlanadi; eski -> yangi id `public.product_id_map` da qoladi (tozalash keyingi migratsiyada).
-- Qayta ishga tushirishga chidamli: nomini o'zgartirish faqat relkind = 'r' bo'lsa, birlashtirish faqat
-- map'da yo'q legacy qatorlar uchun.

-- ─── Narx: integer -> numeric (CRM narxlari kasrli bo'lishi mumkin) ─────────
-- View ustun turiga bog'liq bo'lgani uchun faqat hali numeric bo'lmasa o'zgartiriladi.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'price'
      and data_type <> 'numeric'
  ) then
    alter table public.products alter column price type numeric;
  end if;
end $$;

-- ─── Eski -> yangi id jadvali (faqat service_role) ──────────────────────────
create table if not exists public.product_id_map (
  old_id text primary key,
  new_id text not null
);
alter table public.product_id_map enable row level security;
revoke all on public.product_id_map from anon, authenticated;
grant all on public.product_id_map to service_role;

-- ─── public.products: staff nashr qilinmaganlarni ham ko'radi (ilova hamma mahsulotni ko'rsatadi) ──
drop policy if exists products_staff_select on public.products;
create policy products_staff_select on public.products for select to authenticated
  using ((select public.app_role()) in ('admin', 'operator'));

-- Realtime (yangi ilova public.products ni kuzatadi)
alter table public.products replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'products'
  ) then
    alter publication supabase_realtime add table public.products;
  end if;
end $$;

-- ─── Eski jadval -> crm.products_legacy (o'chirilmaydi, RLS qoladi) ─────────
do $$
begin
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'crm' and c.relname = 'products' and c.relkind = 'r'
  ) then
    if exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'crm' and tablename = 'products'
    ) then
      alter publication supabase_realtime drop table crm.products;
    end if;
    alter table crm.products rename to products_legacy;
  end if;
end $$;

-- ─── Birlashtirish (spec #14) ───────────────────────────────────────────────
-- Map'da hali yo'q har bir legacy qator uchun:
--   bog'langan (site_product_id): sayt qatori yutadi; saytda narx null bo'lsa CRM narxi olinadi;
--   bog'lanmagan: public.products ga published = false yangi qator (nom/tavsif uchala tilda bir xil).
-- So'ng crm.orders.product_id, crm.leads.product_id va crm.leads.items[*].product_id almashtiriladi.
create or replace function crm.merge_products_into_public()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r record;
  v_new text;
  v_slug text;
  v_ids text[] := '{}';
begin
  for r in
    select l.* from crm.products_legacy l
    where not exists (select 1 from public.product_id_map m where m.old_id = l.id)
    order by l.created_at, l.id
  loop
    if r.site_product_id is not null
       and exists (select 1 from public.products p where p.id = r.site_product_id) then
      v_new := r.site_product_id;
      update public.products set price = r.price where id = v_new and price is null;
    else
      if r.id ~ '^[a-z0-9][a-z0-9-]{0,99}$'
         and not exists (select 1 from public.products p where p.id = r.id) then
        v_new := r.id;
      else
        v_new := gen_random_uuid()::text;
      end if;

      v_slug := v_new;
      if exists (
        select 1 from public.products p
        where v_slug in (p.slug ->> 'uz', p.slug ->> 'ru', p.slug ->> 'en')
      ) then
        v_slug := v_slug || '-crm';
      end if;

      insert into public.products (
        id, slug, name, summary, description, features, price, published, created_at, updated_at
      ) values (
        v_new,
        jsonb_build_object('uz', v_slug, 'ru', v_slug, 'en', v_slug),
        jsonb_build_object('uz', r.name, 'ru', r.name, 'en', r.name),
        jsonb_build_object(
          'uz', coalesce(nullif(r.description, ''), r.name),
          'ru', coalesce(nullif(r.description, ''), r.name),
          'en', coalesce(nullif(r.description, ''), r.name)
        ),
        jsonb_build_object(
          'uz', coalesce(r.description, ''),
          'ru', coalesce(r.description, ''),
          'en', coalesce(r.description, '')
        ),
        jsonb_build_object('uz', '[]'::jsonb, 'ru', '[]'::jsonb, 'en', '[]'::jsonb),
        r.price,
        false,
        r.created_at,
        r.updated_at
      );
    end if;

    insert into public.product_id_map (old_id, new_id) values (r.id, v_new);
    v_ids := v_ids || r.id;
  end loop;

  if cardinality(v_ids) = 0 then
    return;
  end if;

  -- Bitta set-based update: har bir qator bir marta almashtiriladi (zanjir bo'lmaydi)
  update crm.orders o set product_id = m.new_id
  from public.product_id_map m
  where m.old_id = any (v_ids) and m.old_id <> m.new_id and o.product_id = m.old_id;

  update crm.leads l set product_id = m.new_id
  from public.product_id_map m
  where m.old_id = any (v_ids) and m.old_id <> m.new_id and l.product_id = m.old_id;

  update crm.leads l
  set items = (
    select jsonb_agg(
      case when m.new_id is null then t.e else jsonb_set(t.e, '{product_id}', to_jsonb(m.new_id)) end
      order by t.ord
    )
    from jsonb_array_elements(l.items) with ordinality t(e, ord)
    left join public.product_id_map m
      on m.old_id = t.e ->> 'product_id' and m.old_id = any (v_ids) and m.old_id <> m.new_id
  )
  where jsonb_typeof(l.items) = 'array'
    and exists (
      select 1 from jsonb_array_elements(l.items) e
      join public.product_id_map m on m.old_id = e ->> 'product_id'
      where m.old_id = any (v_ids) and m.old_id <> m.new_id
    );
end;
$$;

revoke all on function crm.merge_products_into_public() from public, anon, authenticated;
grant execute on function crm.merge_products_into_public() to service_role;

select crm.merge_products_into_public();

-- ─── crm.products compat view (eski ustunlar) ───────────────────────────────
create or replace view crm.products with (security_invoker = true) as
select
  p.id,
  p.name ->> 'uz' as name,
  p.price,
  p.description ->> 'uz' as description,
  p.published as active,
  p.created_at,
  p.updated_at,
  p.id as site_product_id
from public.products p;

-- Triggerlar chaqiruvchi huquqi bilan ishlaydi: public.products RLS qo'llanadi (yozish — faqat admin).
create or replace function crm.products_view_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id text := coalesce(new.id, gen_random_uuid()::text);
  v_desc text := coalesce(new.description, '');
  v_summary text := coalesce(nullif(new.description, ''), new.name);
  v_row public.products;
begin
  insert into public.products (
    id, slug, name, summary, description, features, price, published, created_at, updated_at
  ) values (
    v_id,
    jsonb_build_object('uz', v_id, 'ru', v_id, 'en', v_id),
    jsonb_build_object('uz', new.name, 'ru', new.name, 'en', new.name),
    jsonb_build_object('uz', v_summary, 'ru', v_summary, 'en', v_summary),
    jsonb_build_object('uz', v_desc, 'ru', v_desc, 'en', v_desc),
    jsonb_build_object('uz', '[]'::jsonb, 'ru', '[]'::jsonb, 'en', '[]'::jsonb),
    coalesce(new.price, 0),
    false,
    coalesce(new.created_at, now()),
    coalesce(new.updated_at, now())
  )
  returning * into v_row;

  new.id := v_row.id;
  new.name := v_row.name ->> 'uz';
  new.price := v_row.price;
  new.description := v_row.description ->> 'uz';
  new.active := v_row.published;
  new.created_at := v_row.created_at;
  new.updated_at := v_row.updated_at;
  new.site_product_id := v_row.id;
  return new;
end;
$$;

create or replace function crm.products_view_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.products;
begin
  update public.products set
    name = jsonb_set(name, '{uz}', to_jsonb(new.name)),
    description = jsonb_set(description, '{uz}', to_jsonb(coalesce(new.description, ''))),
    price = new.price,
    published = new.active
  where id = old.id
  returning * into v_row;

  if not found then
    return null;
  end if;

  new.id := v_row.id;
  new.name := v_row.name ->> 'uz';
  new.price := v_row.price;
  new.description := v_row.description ->> 'uz';
  new.active := v_row.published;
  new.created_at := v_row.created_at;
  new.updated_at := v_row.updated_at;
  new.site_product_id := v_row.id;
  return new;
end;
$$;

create or replace function crm.products_view_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.products where id = old.id;
  if not found then
    return null;
  end if;
  return old;
end;
$$;

revoke all on function crm.products_view_insert(), crm.products_view_update(), crm.products_view_delete()
  from public, anon;

create or replace trigger products_view_insert instead of insert on crm.products
for each row execute function crm.products_view_insert();
create or replace trigger products_view_update instead of update on crm.products
for each row execute function crm.products_view_update();
create or replace trigger products_view_delete instead of delete on crm.products
for each row execute function crm.products_view_delete();

grant select, insert, update, delete on crm.products to authenticated;
grant all on crm.products to service_role;
revoke all on crm.products from anon;
