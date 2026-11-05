-- ============================================================================
-- Tekma — migracja 2.0: widełki wynagrodzenia na stanowisku (jawność płac, Kodeks pracy od 24.12.2025).
-- Idempotentna. Kwoty brutto miesięcznie w walucie salary_currency.
-- ============================================================================
alter table public.positions
  add column if not exists salary_min integer check (salary_min is null or salary_min between 1 and 10000000),
  add column if not exists salary_max integer check (salary_max is null or salary_max between 1 and 10000000),
  add column if not exists salary_currency text not null default 'PLN' check (salary_currency in ('PLN','EUR','USD'));
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'positions_salary_range') then
    alter table public.positions add constraint positions_salary_range check (salary_min is null or salary_max is null or salary_max >= salary_min);
  end if;
end $$;
