-- Umumiy jadvallar: teglar, partiyalar, yo'qotishlar va xarajatlar `public` sxemasiga ko'chadi.
-- Eski mobil ilova build'lari `crm.<nom>` ga murojaat qiladi, shu sababli crm'da yoziladigan view'lar qoladi.
-- Qayta ishga tushirishga chidamli (jadval faqat relkind = 'r' bo'lsa ko'chadi).

do $$
declare
  t text;
begin
  foreach t in array array['tags', 'lots', 'lost_products', 'lot_expenses'] loop
    if exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'crm' and c.relname = t and c.relkind = 'r'
    ) then
      -- Eski crm siyosati jadval bilan birga ko'chadi; yangi qoidalar pastda
      execute format('drop policy if exists %I on crm.%I', t || '_staff_all', t);
      execute format('alter table crm.%I set schema public', t);
    end if;
  end loop;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array['tags', 'lots', 'lost_products', 'lot_expenses'] loop
    -- Compat view: oddiy bitta jadvalli view avtomatik yoziladi; RLS chaqiruvchi huquqi bilan ishlaydi
    execute format('create or replace view crm.%I with (security_invoker = true) as select * from public.%I', t, t);
    execute format('grant select, insert, update, delete on crm.%I to authenticated', t);
    execute format('grant all on crm.%I to service_role', t);
    execute format('revoke all on crm.%I from anon', t);

    -- public jadvallar: grants
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);

    -- RLS: o'qish — faol staff, yozish — faqat admin
    execute format('drop policy if exists %I on public.%I', t || '_staff_all', t);
    execute format('drop policy if exists %I on public.%I', t || '_staff_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_delete', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.app_role() in (''admin'', ''operator''))',
      t || '_staff_select', t
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.app_role() = ''admin'')',
      t || '_admin_insert', t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.app_role() = ''admin'') with check (public.app_role() = ''admin'')',
      t || '_admin_update', t
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.app_role() = ''admin'')',
      t || '_admin_delete', t
    );

    -- Realtime
    execute format('alter table public.%I replica identity full', t);
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Sayt teglarni anon sifatida o'qiydi
grant select on public.tags to anon;
drop policy if exists tags_anon_select on public.tags;
create policy tags_anon_select on public.tags for select to anon using (true);
