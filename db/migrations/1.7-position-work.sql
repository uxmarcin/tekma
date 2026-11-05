-- 1.7 — tryb pracy i forma współpracy stanowiska. Uruchom raz w Supabase → SQL Editor.
alter table public.positions
  add column if not exists work_mode text
    check (work_mode is null or work_mode in ('onsite', 'hybrid', 'remote')),
  add column if not exists contract_types text[] not null default '{}'
    check (contract_types <@ array['uop', 'b2b', 'zlecenie', 'dzielo', 'staz']::text[] and cardinality(contract_types) <= 5);
comment on column public.positions.work_mode is 'Tryb pracy: onsite (stacjonarnie), hybrid (hybrydowo), remote (zdalnie).';
comment on column public.positions.contract_types is 'Formy współpracy: uop, b2b, zlecenie, dzielo, staz.';
-- uprawnienia do kolumn dziedziczą grant na tabeli (select, insert, update, delete dla authenticated)
