-- Operator leadni tasdiqlaydi: bitta tranzaksiyada mijoz (tanlangan yoki leaddan yaratilgan),
-- har bir mahsulot uchun crm.orders qatori va lead -> 'confirmed'.
-- Buyurtma maydonlari ilovadagi OrderModal bilan bir xil: state 'new', rate 0, date = to'liq ISO vaqt,
-- user_id = joriy foydalanuvchi. customers.order_ids (tarixiy partiya ID'lari) o'zgartirilmaydi.
-- location: leaddagi {lat,lng} + sayt manzili (address bo'sh bo'lmasa) -> {lat?,lng?,address};
-- ikkalasi ham yo'q bo'lsa null. Yangi mijoz va har bir buyurtmaga yoziladi.
-- Qayta ishga tushirishga chidamli (create or replace).
--
-- javob: { customer_id, order_ids: [text] }   -- order_ids items tartibida
--
-- Xatolar (har qandayida hech narsa yozilmaydi):
--   'not_staff'         (42501): chaqiruvchi faol admin/operator emas.
--   'lead_not_found'    (P0002)
--   'already_confirmed' (P0001): lead allaqachon tasdiqlangan (qator for update bilan bloklanadi).
--   'lot_not_found'     (P0002): p_lot_id bo'sh yoki public.lots da yo'q.
--   'no_items'          (P0001): items ham, eski product_id ham yo'q.
--   'unpriced_item'     (P0001, detail = product_id): narx leadda ham, p_item_prices da ham yo'q.
--   'customer_not_found'(P0002): p_customer_id berilgan, lekin crm.customers da yo'q.
create or replace function crm.confirm_lead(
  p_lead_id text,
  p_customer_id text,
  p_lot_id text,
  p_delivery_price numeric,
  p_item_prices jsonb default '{}'
) returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_lead crm.leads%rowtype;
  v_items jsonb;
  v_lines jsonb;
  v_unpriced text;
  v_customer_id text;
  v_order_id text;
  v_order_ids text[] := '{}';
  v_date text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_line record;
  v_location jsonb;
begin
  if not crm.is_staff() then
    raise exception 'not_staff' using errcode = '42501';
  end if;

  -- Bir vaqtdagi ikkinchi chaqiruv shu yerda kutadi va keyin 'confirmed' holatini ko'radi.
  select * into v_lead from crm.leads where id = p_lead_id for update;
  if not found then
    raise exception 'lead_not_found' using errcode = 'P0002';
  end if;
  if v_lead.state = 'confirmed' then
    raise exception 'already_confirmed' using errcode = 'P0001';
  end if;

  if coalesce(p_lot_id, '') = '' or not exists (select 1 from public.lots where id = p_lot_id) then
    raise exception 'lot_not_found' using errcode = 'P0002';
  end if;

  -- items bo'sh bo'lsa eski bitta mahsulotli maydonlar (Telegram leadlari).
  v_items := case
    when jsonb_typeof(v_lead.items) = 'array' and jsonb_array_length(v_lead.items) > 0 then v_lead.items
    when v_lead.product_id is not null then jsonb_build_array(jsonb_build_object(
      'product_id', v_lead.product_id,
      'name', v_lead.product_name,
      'price', null,
      'quantity', v_lead.product_count
    ))
    else '[]'::jsonb
  end;
  if jsonb_array_length(v_items) = 0 then
    raise exception 'no_items' using errcode = 'P0001';
  end if;

  -- Narx: leaddagi narx, bo'lmasa operator kiritgan p_item_prices[product_id].
  select jsonb_agg(jsonb_build_object(
    'product_id', e.item ->> 'product_id',
    'quantity', (e.item ->> 'quantity')::numeric,
    'price', coalesce(
      (e.item ->> 'price')::numeric,
      (coalesce(p_item_prices, '{}'::jsonb) ->> (e.item ->> 'product_id'))::numeric
    )
  ) order by e.ord)
  into v_lines
  from jsonb_array_elements(v_items) with ordinality e(item, ord);

  select l ->> 'product_id' into v_unpriced
  from jsonb_array_elements(v_lines) l
  where l -> 'price' = 'null'::jsonb
  limit 1;
  if found then
    raise exception 'unpriced_item' using errcode = 'P0001', detail = coalesce(v_unpriced, '');
  end if;

  -- Sayt leadlarida koordinata bo'lmasligi mumkin, lekin matnli manzil bor: uni yo'qotmaymiz.
  v_location := case
    when nullif(btrim(coalesce(v_lead.address, '')), '') is null then v_lead.location
    else (case when jsonb_typeof(v_lead.location) = 'object' then v_lead.location else '{}'::jsonb end)
      || jsonb_build_object('address', v_lead.address)
  end;

  if p_customer_id is not null then
    select id into v_customer_id from crm.customers where id = p_customer_id;
    if not found then
      raise exception 'customer_not_found' using errcode = 'P0002';
    end if;
  else
    insert into crm.customers (name, phone, region_name, district_name, location, telegram_id, user_id)
    values (
      v_lead.name,
      v_lead.phone,
      coalesce(v_lead.region_name, ''),
      v_lead.district_name,
      v_location,
      nullif(v_lead.telegram_id, ''),
      auth.uid()
    )
    returning id into v_customer_id;
  end if;

  -- delivery_price faqat birinchi qatorda (partiya yetkazish summasi ikki marta hisoblanmasin).
  for v_line in
    select l.value as line, l.ord from jsonb_array_elements(v_lines) with ordinality l(value, ord)
    order by l.ord
  loop
    insert into crm.orders (
      lot_id, customer_id, product_id, product_count, product_price, region_name, district_name,
      date, rate, state, user_id, delivery_price, note, location
    )
    values (
      p_lot_id,
      v_customer_id,
      v_line.line ->> 'product_id',
      (v_line.line ->> 'quantity')::numeric,
      (v_line.line ->> 'price')::numeric,
      coalesce(v_lead.region_name, ''),
      v_lead.district_name,
      v_date,
      0,
      'new',
      auth.uid(),
      case when v_line.ord = 1 then coalesce(p_delivery_price, 0) else 0 end,
      v_lead.note,
      v_location
    )
    returning id into v_order_id;
    v_order_ids := v_order_ids || v_order_id;
  end loop;

  update crm.leads
  set state = 'confirmed', customer_id = v_customer_id, order_ids = v_order_ids
  where id = p_lead_id;

  return jsonb_build_object('customer_id', v_customer_id, 'order_ids', to_jsonb(v_order_ids));
end;
$$;

revoke execute on function crm.confirm_lead(text, text, text, numeric, jsonb) from public, anon;
grant execute on function crm.confirm_lead(text, text, text, numeric, jsonb) to authenticated, service_role;
