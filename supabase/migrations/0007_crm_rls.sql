-- CRM: grants, RLS va Realtime.
-- Hozirgi xatti-harakat saqlanadi: staff (admin yoki operator) CRM'da hamma narsani o'qiy va yoza oladi.
-- Farq: endi "istalgan authenticated" emas, faqat public.profiles da faol staff.

grant usage on schema crm to authenticated, service_role;

do $$
declare
  t text;
begin
  foreach t in array array[
    'regions', 'districts', 'products', 'tags', 'rates', 'lots', 'lost_products', 'lot_expenses',
    'customers', 'orders', 'leads', 'lead_chats', 'lead_messages', 'faqs', 'settings'
  ] loop
    execute format('alter table crm.%I enable row level security', t);
    execute format('grant select, insert, update, delete on crm.%I to authenticated', t);
    execute format('grant all on crm.%I to service_role', t);
    execute format(
      'create policy %I on crm.%I for all to authenticated using (crm.is_staff()) with check (crm.is_staff())',
      t || '_staff_all', t
    );
    -- Realtime DELETE/UPDATE hodisalarida eski qator to'liq kelishi uchun (mijozda filtrlash)
    execute format('alter table crm.%I replica identity full', t);
    execute format('alter publication supabase_realtime add table crm.%I', t);
  end loop;
end $$;

-- bot_sessions: faqat service_role (RLS yoqilgan, policy yo'q)
alter table crm.bot_sessions enable row level security;
grant all on crm.bot_sessions to service_role;

grant select on crm.users to authenticated;
grant select on crm.users to service_role;

-- Yangi jadvallar uchun default'lar
alter default privileges in schema crm grant all on tables to service_role;
