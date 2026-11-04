-- Kontrola RLS: zapytanie powinno zwrócić 0 wierszy. Uruchamiać po każdej migracji / przed wdrożeniem.
select c.relname::text as obiekt, 'RLS wyłączone' as problem
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity
union all
select table_name::text, 'anon ma uprawnienia: ' || string_agg(privilege_type, ',')
  from information_schema.role_table_grants
 where table_schema = 'public' and grantee = 'anon'
   and not (table_name = 'waitlist' and privilege_type = 'INSERT')   -- celowo: formularz zapisu na listę oczekujących
 group by table_name
union all
select p.proname::text, 'anon może wykonać funkcję'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
   and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e');  -- pomijamy funkcje rozszerzeń
