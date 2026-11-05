-- 1.8 — kategoria stanowiska (ikona w liście i w wyszukiwarce). Uruchom raz w Supabase → SQL Editor.
-- Wartość dobiera aplikacja automatycznie po nazwie stanowiska (np. 'backend', 'design', 'qa').
alter table public.positions
  add column if not exists category text check (category is null or char_length(category) <= 40);
comment on column public.positions.category is 'Kategoria katalogu stanowisk (id z positions-db.js), dobierana automatycznie.';
