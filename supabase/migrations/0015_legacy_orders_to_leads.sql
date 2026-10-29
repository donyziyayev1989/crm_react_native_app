-- Eski sayt buyurtmalari (`public.orders`) `crm.leads` ga ko'chiriladi (source = 'website').
-- public.customers/orders/order_items/order_status_history o'zgartirilmaydi va o'chirilmaydi;
-- asl qatorlar `legacy` ga to'liq saqlanadi.
-- Qayta ishga tushirishga chidamli: id'si `legacy->'order'->>'id'` da bor buyurtmalar o'tkazib yuboriladi.

-- Bitta buyurtma bitta lead (dublikatdan himoya va not exists uchun indeks).
create unique index if not exists leads_legacy_order_id_key
  on crm.leads ((legacy -> 'order' ->> 'id'));

-- Holat: new -> new, contacted -> pending, delivering/delivered -> confirmed, cancelled -> rejected.
-- number sequence'dan olinadi; qatorlar created_at tartibida qo'shiladi.
create or replace function crm.backfill_site_orders_to_leads()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into crm.leads (
    source, state, name, phone, region_name, district_name, address, location, note, locale,
    items, total, has_unpriced, date, product_id, product_name, product_count, legacy
  )
  select
    'website',
    case o.status::text
      when 'new' then 'new'
      when 'contacted' then 'pending'
      when 'delivering' then 'confirmed'
      when 'delivered' then 'confirmed'
      when 'cancelled' then 'rejected'
    end,
    coalesce(c.name, ''),
    coalesce(c.phone, ''),
    crm.region_name_from_site_id(o.region),
    crm.district_name_from_site_slug(o.region, o.district),
    o.address,
    case
      when o.latitude is not null and o.longitude is not null
      then jsonb_build_object('lat', o.latitude, 'lng', o.longitude)
    end,
    o.message,
    o.locale,
    i.items,
    o.total,
    o.has_unpriced,
    to_char(o.created_at at time zone 'Asia/Tashkent', 'YYYY-MM-DD'),
    i.items -> 0 ->> 'product_id',
    i.items -> 0 ->> 'name',
    coalesce((i.items -> 0 ->> 'quantity')::numeric, 0),
    jsonb_build_object(
      'order', to_jsonb(o),
      'items', i.raw,
      'status_history', h.history,
      'customer', to_jsonb(c)
    )
  from public.orders o
  left join public.customers c on c.id = o.customer_id
  cross join lateral (
    select
      coalesce(jsonb_agg(jsonb_build_object(
        'product_id', oi.product_id,
        'name', oi.name_snapshot,
        'price', oi.price_snapshot,
        'quantity', oi.quantity
      ) order by oi.id), '[]'::jsonb) as items,
      coalesce(jsonb_agg(to_jsonb(oi) order by oi.id), '[]'::jsonb) as raw
    from public.order_items oi
    where oi.order_id = o.id
  ) i
  cross join lateral (
    select coalesce(jsonb_agg(to_jsonb(sh) order by sh.changed_at, sh.id), '[]'::jsonb) as history
    from public.order_status_history sh
    where sh.order_id = o.id
  ) h
  where not exists (
    select 1 from crm.leads l where l.legacy -> 'order' ->> 'id' = o.id::text
  )
  order by o.created_at, o.number;
end;
$$;

revoke all on function crm.backfill_site_orders_to_leads() from public, anon, authenticated;
grant execute on function crm.backfill_site_orders_to_leads() to service_role;

select crm.backfill_site_orders_to_leads();
