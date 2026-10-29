-- Sayt buyurtma formasi endi lead yaratadi: `public.create_lead` -> `crm.leads` (source = 'website').
-- `public.create_order` sayt create_lead ga o'tguncha o'zgarishsiz qoladi.
-- Qayta ishga tushirishga chidamli (create or replace).

-- ─── Sayt viloyat id'si -> crm.regions.name (0009_crm_seed_regions.sql) ─────
-- Noma'lum id o'zgarishsiz qaytariladi.
create or replace function crm.region_name_from_site_id(site_id text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case site_id
    when 'tashkentCity' then 'Toshkent shahri'
    when 'tashkent' then 'Toshkent viloyati'
    when 'andijan' then 'Andijon'
    when 'bukhara' then 'Buxoro'
    when 'fergana' then 'Farg''ona'
    when 'jizzakh' then 'Jizzax'
    when 'karakalpakstan' then 'Qoraqalpog''iston Respublikasi'
    when 'kashkadarya' then 'Qashqadaryo'
    when 'khorezm' then 'Xorazm'
    when 'namangan' then 'Namangan'
    when 'navoi' then 'Navoiy'
    when 'samarkand' then 'Samarqand'
    when 'sirdarya' then 'Sirdaryo'
    when 'surkhandarya' then 'Surxondaryo'
    else site_id
  end;
$$;

grant execute on function crm.region_name_from_site_id(text) to anon, authenticated, service_role;

-- ─── Sayt tuman slug'i -> crm.districts.name ────────────────────────────────
-- Manba: src/lib/uz-districts.ts (uz nomi, " tumani"/" shahri"/" shahar" qo'shimchasiz, ASCII apostrof),
-- CRM imlosi boshqacha bo'lgan tumanlar uchun override (src/lib/crm-regions.ts CRM_DISTRICT_OVERRIDES).
-- Faqat service_role (RLS yoqilgan, siyosat yo'q).
create table if not exists crm.site_districts (
  region_site_id text not null,
  slug text not null,
  name text not null,
  primary key (region_site_id, slug)
);

alter table crm.site_districts enable row level security;
revoke all on crm.site_districts from anon, authenticated;
grant all on crm.site_districts to service_role;

insert into crm.site_districts (region_site_id, slug, name) values
  -- karakalpakstan
   ('karakalpakstan', 'amudaryo', 'Amudaryo')
  ,('karakalpakstan', 'beruniy', 'Beruniy')
  ,('karakalpakstan', 'bozatov', 'Bo''zatov')
  ,('karakalpakstan', 'chimboy', 'Chimboy')
  ,('karakalpakstan', 'ellikqala', 'Ellikqal''a')
  ,('karakalpakstan', 'kegeyli', 'Kegeyli')
  ,('karakalpakstan', 'moynoq', 'Mo''ynoq')
  ,('karakalpakstan', 'nukus', 'Nukus')
  ,('karakalpakstan', 'qonlikol', 'Qonliko''l')
  ,('karakalpakstan', 'qoraozak', 'Qorao''zak')
  ,('karakalpakstan', 'qongirot', 'Qo''ng''irot')
  ,('karakalpakstan', 'shumanay', 'Shumanay')
  ,('karakalpakstan', 'taxiatosh', 'Taxiatosh')
  ,('karakalpakstan', 'taxtakopir', 'Taxtako''pir')
  ,('karakalpakstan', 'tortkol', 'To''rtko''l')
  ,('karakalpakstan', 'xojayli', 'Xo''jayli')
  -- andijan
  ,('andijan', 'andijon', 'Andijon')
  ,('andijan', 'asaka', 'Asaka')
  ,('andijan', 'baliqchi', 'Baliqchi')
  ,('andijan', 'boston', 'Bo''ston')
  ,('andijan', 'buloqboshi', 'Buloqboshi')
  ,('andijan', 'izboskan', 'Izboskan')
  ,('andijan', 'jalaquduq', 'Jalaquduq')
  ,('andijan', 'marhamat', 'Marhamat')
  ,('andijan', 'oltinkol', 'Oltinko''l')
  ,('andijan', 'paxtaobod', 'Paxtaobod')
  ,('andijan', 'qorgontepa', 'Qo''rg''ontepa')
  ,('andijan', 'shahrixon', 'Shahrixon')
  ,('andijan', 'ulugnor', 'Ulug''nor')
  ,('andijan', 'xojaobod', 'Xo''jaobod')
  -- bukhara
  ,('bukhara', 'olot', 'Olot')
  ,('bukhara', 'buxoro', 'Buxoro')
  ,('bukhara', 'gijduvon', 'G''ijduvon')
  ,('bukhara', 'jondor', 'Jondor')
  ,('bukhara', 'kogon', 'Kogon')
  ,('bukhara', 'qorakol', 'Qorako''l')
  ,('bukhara', 'qorovulbozor', 'Qorovulbozor')
  ,('bukhara', 'peshku', 'Peshku')
  ,('bukhara', 'romitan', 'Romitan')
  ,('bukhara', 'shofirkon', 'Shofirkon')
  ,('bukhara', 'vobkent', 'Vobkent')
  -- jizzakh
  ,('jizzakh', 'arnasoy', 'Arnasoy')
  ,('jizzakh', 'baxmal', 'Baxmal')
  ,('jizzakh', 'dostlik', 'Do''stlik')
  ,('jizzakh', 'forish', 'Forish')
  ,('jizzakh', 'gallaorol', 'G''allaorol')
  ,('jizzakh', 'mirzachol', 'Mirzacho''l')
  ,('jizzakh', 'paxtakor', 'Paxtakor')
  ,('jizzakh', 'sharof-rashidov', 'Sharof Rashidov')
  ,('jizzakh', 'yangiobod', 'Yangiobod')
  ,('jizzakh', 'zafarobod', 'Zafarobod')
  ,('jizzakh', 'zarbdor', 'Zarbdor')
  ,('jizzakh', 'zomin', 'Zomin')
  -- kashkadarya
  ,('kashkadarya', 'chiroqchi', 'Chiroqchi')
  ,('kashkadarya', 'dehqonobod', 'Dehqonobod')
  ,('kashkadarya', 'guzor', 'G''uzor')
  ,('kashkadarya', 'kasbi', 'Kasbi')
  ,('kashkadarya', 'kitob', 'Kitob')
  ,('kashkadarya', 'kokdala', 'Ko''kdala')
  ,('kashkadarya', 'koson', 'Koson')
  ,('kashkadarya', 'mirishkor', 'Mirishkor')
  ,('kashkadarya', 'muborak', 'Muborak')
  ,('kashkadarya', 'nishon', 'Nishon')
  ,('kashkadarya', 'qamashi', 'Qamashi')
  ,('kashkadarya', 'qarshi', 'Qarshi')
  ,('kashkadarya', 'shahrisabz', 'Shahrisabz')
  ,('kashkadarya', 'yakkabog', 'Yakkabog''')
  -- navoi
  ,('navoi', 'karmana', 'Karmana')
  ,('navoi', 'konimex', 'Konimex')
  ,('navoi', 'navbahor', 'Navbahor')
  ,('navoi', 'nurota', 'Nurota')
  ,('navoi', 'qiziltepa', 'Qiziltepa')
  ,('navoi', 'tomdi', 'Tomdi')
  ,('navoi', 'uchquduq', 'Uchquduq')
  ,('navoi', 'xatirchi', 'Xatirchi')
  -- namangan
  ,('namangan', 'chortoq', 'Chortoq')
  ,('namangan', 'chust', 'Chust')
  ,('namangan', 'davlatobod', 'Davlatobod')
  ,('namangan', 'kosonsoy', 'Kosonsoy')
  ,('namangan', 'mingbuloq', 'Mingbuloq')
  ,('namangan', 'namangan', 'Namangan')
  ,('namangan', 'norin', 'Norin')
  ,('namangan', 'pop', 'Pop')
  ,('namangan', 'toraqorgon', 'To''raqo''rg''on')
  ,('namangan', 'uychi', 'Uychi')
  ,('namangan', 'uchqorgon', 'Uchqo''rg''on')
  ,('namangan', 'yangi-namangan', 'Yangi Namangan')
  ,('namangan', 'yangiqorgon', 'Yangiqo''rg''on')
  -- samarkand
  ,('samarkand', 'bulungur', 'Bulung''ur')
  ,('samarkand', 'ishtixon', 'Ishtixon')
  ,('samarkand', 'jomboy', 'Jomboy')
  ,('samarkand', 'kattaqorgon', 'Kattaqo''rg''on')
  ,('samarkand', 'narpay', 'Narpay')
  ,('samarkand', 'nurobod', 'Nurobod')
  ,('samarkand', 'oqdaryo', 'Oqdaryo')
  ,('samarkand', 'pastdargom', 'Pastdarg''om')
  ,('samarkand', 'paxtachi', 'Paxtachi')
  ,('samarkand', 'payariq', 'Payariq')
  ,('samarkand', 'qoshrabot', 'Qo''shrabot')
  ,('samarkand', 'samarqand', 'Samarqand')
  ,('samarkand', 'toyloq', 'Tayloq')  -- CRM imlosi (0009: sam_tayloq), sayt 'Toyloq'
  ,('samarkand', 'urgut', 'Urgut')
  -- sirdarya
  ,('sirdarya', 'boyovut', 'Boyovut')
  ,('sirdarya', 'guliston', 'Guliston')
  ,('sirdarya', 'mirzaobod', 'Mirzaobod')
  ,('sirdarya', 'oqoltin', 'Oqoltin')
  ,('sirdarya', 'sardoba', 'Sardoba')
  ,('sirdarya', 'sayxunobod', 'Sayxunobod')
  ,('sirdarya', 'sirdaryo', 'Sirdaryo')
  ,('sirdarya', 'xovos', 'Xovos')
  -- surkhandarya
  ,('surkhandarya', 'angor', 'Angor')
  ,('surkhandarya', 'bandixon', 'Bandixon')
  ,('surkhandarya', 'boysun', 'Boysun')
  ,('surkhandarya', 'denov', 'Denov')
  ,('surkhandarya', 'jarqorgon', 'Jarqo''rg''on')
  ,('surkhandarya', 'muzrabot', 'Muzrabot')
  ,('surkhandarya', 'oltinsoy', 'Oltinsoy')
  ,('surkhandarya', 'qiziriq', 'Qiziriq')
  ,('surkhandarya', 'qumqorgon', 'Qumqo''rg''on')
  ,('surkhandarya', 'sariosiyo', 'Sariosiyo')
  ,('surkhandarya', 'sherobod', 'Sherobod')
  ,('surkhandarya', 'shorchi', 'Sho''rchi')
  ,('surkhandarya', 'termiz', 'Termiz')
  ,('surkhandarya', 'uzun', 'Uzun')
  -- fergana
  ,('fergana', 'bagdod', 'Bag''dod')
  ,('fergana', 'beshariq', 'Beshariq')
  ,('fergana', 'buvayda', 'Buvayda')
  ,('fergana', 'dangara', 'Dang''ara')
  ,('fergana', 'fargona', 'Farg''ona')
  ,('fergana', 'furqat', 'Furqat')
  ,('fergana', 'oltiariq', 'Oltiariq')
  ,('fergana', 'ozbekiston', 'O''zbekiston')
  ,('fergana', 'qoshtepa', 'Qo''shtepa')
  ,('fergana', 'quva', 'Quva')
  ,('fergana', 'rishton', 'Rishton')
  ,('fergana', 'sox', 'So''x')
  ,('fergana', 'toshloq', 'Toshloq')
  ,('fergana', 'uchkoprik', 'Uchko''prik')
  ,('fergana', 'yozyovon', 'Yozyovon')
  -- tashkent
  ,('tashkent', 'bekobod', 'Bekobod')
  ,('tashkent', 'boka', 'Buka')  -- CRM imlosi (0009: tv_buka), sayt 'Bo''ka'
  ,('tashkent', 'bostonliq', 'Bo''stonliq')
  ,('tashkent', 'chinoz', 'Chinoz')
  ,('tashkent', 'ohangaron', 'Ohangaron')
  ,('tashkent', 'oqqorgon', 'Oqqo''rg''on')
  ,('tashkent', 'parkent', 'Parkent')
  ,('tashkent', 'piskent', 'Piskent')
  ,('tashkent', 'qibray', 'Qibray')
  ,('tashkent', 'quyi-chirchiq', 'Quyi Chirchiq')
  ,('tashkent', 'orta-chirchiq', 'O''rta Chirchiq')
  ,('tashkent', 'toshkent', 'Toshkent')
  ,('tashkent', 'yangiyol', 'Yangiyo''l')
  ,('tashkent', 'yuqori-chirchiq', 'Yuqori Chirchiq')
  ,('tashkent', 'zangiota', 'Zangiota')
  -- khorezm
  ,('khorezm', 'bogot', 'Bog''ot')
  ,('khorezm', 'gurlan', 'Gurlan')
  ,('khorezm', 'hazorasp', 'Hazorasp')
  ,('khorezm', 'qoshkopir', 'Qo''shko''pir')
  ,('khorezm', 'shovot', 'Shovot')
  ,('khorezm', 'tuproqqala', 'Tuproqqal''a')
  ,('khorezm', 'urganch', 'Urganch')
  ,('khorezm', 'xiva', 'Xiva')
  ,('khorezm', 'xonqa', 'Xonqa')
  ,('khorezm', 'yangiariq', 'Yangiariq')
  ,('khorezm', 'yangibozor', 'Yangibozor')
  -- tashkentCity
  ,('tashkentCity', 'bektemir', 'Bektemir')
  ,('tashkentCity', 'chilonzor', 'Chilonzor')
  ,('tashkentCity', 'mirobod', 'Mirobod')
  ,('tashkentCity', 'mirzo-ulugbek', 'Mirzo Ulug''bek')
  ,('tashkentCity', 'olmazor', 'Olmazor')
  ,('tashkentCity', 'sergeli', 'Sergeli')
  ,('tashkentCity', 'shayxontohur', 'Shayxontohur')
  ,('tashkentCity', 'uchtepa', 'Uchtepa')
  ,('tashkentCity', 'yakkasaroy', 'Yakkasaroy')
  ,('tashkentCity', 'yangihayot', 'Yangihayot')
  ,('tashkentCity', 'yashnobod', 'Yashnobod')
  ,('tashkentCity', 'yunusobod', 'Yunusobod')
on conflict (region_site_id, slug) do update set name = excluded.name;

-- Topilmasa slug o'zgarishsiz qaytariladi.
create or replace function crm.district_name_from_site_slug(p_region_site_id text, p_slug text)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select d.name from crm.site_districts d
     where d.region_site_id = p_region_site_id and d.slug = p_slug),
    p_slug
  );
$$;

revoke all on function crm.district_name_from_site_slug(text, text) from public, anon, authenticated;
grant execute on function crm.district_name_from_site_slug(text, text) to service_role;

-- ─── public.create_lead ─────────────────────────────────────────────────────
-- Server faqat service role bilan chaqiradi. Mahsulot, nom, narx va jami summa bazadan olinadi;
-- payload faqat mahsulot id'lari va sonini beradi.
--
-- payload (create_order bilan bir xil): {
--   name, phone (+998XXXXXXXXX), region (sayt id'si), district (sayt slug'i -> CRM nomi), address,
--   latitude?, longitude?, message?, locale ('uz' | 'ru' | 'en'),
--   items: [{ productId, quantity }]   -- 1..20 ta turli mahsulot, son 1..1000
-- }
-- javob: { id, number, total, has_unpriced, items: [{ product_id, name, price, quantity }] }
--
-- Xatolar:
--   'unknown_product' (SQLSTATE KU001): id noma'lum yoki mahsulot nashr qilinmagan.
--   'invalid_items'   (SQLSTATE KU002): items yo'q, 1..20 emas, takror yoki son noto'g'ri.
create or replace function public.create_lead(payload jsonb) returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_items jsonb := payload -> 'items';
  v_count integer;
  v_lines jsonb;
  v_resolved integer;
  v_total numeric;
  v_has_unpriced boolean;
  v_lead_id text;
  v_lead_number bigint;
begin
  -- Item list: 1..20 entries, each a string id and an integer quantity in 1..1000.
  if jsonb_typeof(v_items) is distinct from 'array' then
    raise exception 'invalid_items' using errcode = 'KU002';
  end if;
  v_count := jsonb_array_length(v_items);
  if v_count < 1 or v_count > 20 then
    raise exception 'invalid_items' using errcode = 'KU002', detail = 'an order has 1 to 20 items';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(v_items) e(item)
    -- CASE (not OR) so the numeric casts only run on JSON numbers.
    where case
      when jsonb_typeof(e.item -> 'productId') = 'string'
       and jsonb_typeof(e.item -> 'quantity') = 'number'
      then (e.item ->> 'quantity')::numeric <> trunc((e.item ->> 'quantity')::numeric)
        or (e.item ->> 'quantity')::numeric not between 1 and 1000
      else true
    end
  ) then
    raise exception 'invalid_items' using errcode = 'KU002', detail = 'bad product id or quantity';
  end if;
  if (select count(distinct e.item ->> 'productId') from jsonb_array_elements(v_items) e(item))
     <> v_count then
    raise exception 'invalid_items' using errcode = 'KU002', detail = 'duplicate product';
  end if;

  -- Resolve every line against published products; snapshot the uz name and the current
  -- (numeric) price. Unpriced products stay orderable and are left out of the total.
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'product_id', p.id,
      'name', p.name ->> 'uz',
      'price', p.price,
      'quantity', l.quantity
    ) order by l.ord), '[]'::jsonb),
    count(*),
    coalesce(sum(p.price * l.quantity) filter (where p.price is not null), 0),
    coalesce(bool_or(p.price is null), false)
  into v_lines, v_resolved, v_total, v_has_unpriced
  from jsonb_array_elements(v_items) with ordinality e(item, ord)
  cross join lateral (
    select e.item ->> 'productId' as product_id, (e.item ->> 'quantity')::integer as quantity, e.ord
  ) l
  join public.products p on p.id = l.product_id and p.published;

  if v_resolved <> v_count then
    raise exception 'unknown_product' using errcode = 'KU001';
  end if;

  -- product_id/product_name/product_count = birinchi qator (eski bitta mahsulotli ekranlar uchun).
  insert into crm.leads (
    source, state, name, phone, region_name, district_name, address, location, note, locale,
    items, total, has_unpriced, date, product_id, product_name, product_count
  )
  values (
    'website',
    'new',
    coalesce(btrim(payload ->> 'name'), ''),
    coalesce(payload ->> 'phone', ''),
    crm.region_name_from_site_id(payload ->> 'region'),
    crm.district_name_from_site_slug(payload ->> 'region', payload ->> 'district'),
    payload ->> 'address',
    case
      when payload ->> 'latitude' is not null and payload ->> 'longitude' is not null
      then jsonb_build_object(
        'lat', (payload ->> 'latitude')::double precision,
        'lng', (payload ->> 'longitude')::double precision
      )
    end,
    coalesce(payload ->> 'message', ''),
    payload ->> 'locale',
    v_lines,
    v_total,
    v_has_unpriced,
    to_char(now() at time zone 'Asia/Tashkent', 'YYYY-MM-DD'),
    v_lines -> 0 ->> 'product_id',
    v_lines -> 0 ->> 'name',
    (v_lines -> 0 ->> 'quantity')::numeric
  )
  returning id, number into v_lead_id, v_lead_number;

  return jsonb_build_object(
    'id', v_lead_id,
    'number', v_lead_number,
    'total', v_total,
    'has_unpriced', v_has_unpriced,
    'items', v_lines
  );
end;
$$;

-- Faqat server (service role). Supabase yangi public funksiyalarga anon/authenticated ga execute
-- beradi, shuning uchun aniq olib tashlanadi.
revoke execute on function public.create_lead(jsonb) from public, anon, authenticated;
grant execute on function public.create_lead(jsonb) to service_role;
