-- ============================================================================
-- Tekma — migracja 1.2 (utwardzanie, zgodność z RODO)
-- Zastosować po schema.sql (1.1). Idempotentna. NIE uruchamiać na produkcji bez testu.
--   A. Dziennik zmian (audit_log) — kto/kiedy/co zmienił (bez wartości, żeby nie kopiować danych osobowych)
--   B. Sugestie AI (scorecards.ai) tylko od owner/recruiter
--   C. Retencja danych kandydatów (organizations.retention_months, candidates.closed_at, purge_expired_candidates)
--   D. delete_org — usunięcie firmy wraz z danymi przez właściciela (prawo do usunięcia / koniec umowy)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A. audit_log
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id            bigint generated always as identity primary key,
  at            timestamptz not null default now(),
  org_id        uuid,                       -- bez FK: wpisy przeżywają usunięcie firmy
  actor         uuid,                       -- auth.uid(); null = zadanie systemowe
  action        text not null check (action in ('insert','update','delete')),
  table_name    text not null,
  row_id        text,
  changed_cols  text[]
);
comment on table public.audit_log is 'Dziennik zmian (insert/update/delete) na tabelach biznesowych. Zapisuje nazwy zmienionych kolumn, nie wartości. Odczyty (select) nie są logowane.';
create index if not exists audit_log_org_idx on public.audit_log(org_id, at desc);

alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;
drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log
  for select to authenticated using (public.has_role(org_id, array['owner']));

create or replace function public.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rec  jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  oid_ uuid;
  cols text[];
begin
  oid_ := case when tg_table_name = 'organizations' then (rec->>'id')::uuid else (rec->>'org_id')::uuid end;
  if tg_op = 'UPDATE' then
    select array_agg(n.key order by n.key) into cols
      from jsonb_each(rec) n
     where n.value is distinct from to_jsonb(old)->n.key;
    if cols is null then
      return new;                           -- brak realnej zmiany
    end if;
  end if;
  insert into public.audit_log (org_id, actor, action, table_name, row_id, changed_cols)
  values (oid_, auth.uid(), lower(tg_op), tg_table_name,
          coalesce(rec->>'id', rec->>'user_id'), cols);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function public.audit_trigger() from public, anon, authenticated;

drop trigger if exists audit_candidates on public.candidates;
create trigger audit_candidates after insert or update or delete on public.candidates
  for each row execute function public.audit_trigger();
drop trigger if exists audit_scorecards on public.scorecards;
create trigger audit_scorecards after insert or update or delete on public.scorecards
  for each row execute function public.audit_trigger();
drop trigger if exists audit_members on public.members;
create trigger audit_members after insert or update or delete on public.members
  for each row execute function public.audit_trigger();
drop trigger if exists audit_positions on public.positions;
create trigger audit_positions after insert or update or delete on public.positions
  for each row execute function public.audit_trigger();
drop trigger if exists audit_organizations on public.organizations;
create trigger audit_organizations after update or delete on public.organizations
  for each row execute function public.audit_trigger();

-- ---------------------------------------------------------------------------
-- B. scorecards_guard: pole ai tylko od owner/recruiter
-- ---------------------------------------------------------------------------
create or replace function public.scorecards_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me        text := auth.uid()::text;
  is_owner  boolean;
  can_decide boolean;
  r         jsonb;
begin
  -- 1) format
  if jsonb_typeof(new.ratings) <> 'array' then
    raise exception 'Pole ratings musi być tablicą ocen.';
  end if;
  if jsonb_typeof(new.ai) <> 'object' then
    raise exception 'Pole ai musi być obiektem {question_id: {score, quote, reason}}.';
  end if;
  for r in select e from jsonb_array_elements(new.ratings) e loop
    if jsonb_typeof(r) <> 'object'
       or coalesce(r->>'question_id', '') = ''
       or coalesce(r->>'rater_id', '') = ''
       or jsonb_typeof(r->'score') <> 'number' then
      raise exception 'Każda ocena musi mieć question_id, rater_id i liczbowy score.';
    end if;
    if (r->>'score')::numeric < 1 or (r->>'score')::numeric > 5 then
      raise exception 'Ocena (score) musi być liczbą od 1 do 5.';
    end if;
  end loop;

  -- 2) bez tożsamości (np. skrypt administracyjny z service_role) nie ma czego sprawdzać
  if me is null then
    return new;
  end if;

  is_owner   := public.has_role(new.org_id, array['owner']);
  can_decide := public.has_role(new.org_id, array['owner','recruiter']);

  -- 3) decyzja po etapie: tylko owner/recruiter
  if tg_op = 'INSERT' then
    if new.decision is not null and not can_decide then
      raise exception 'Tylko właściciel lub rekruter może zatwierdzić decyzję po etapie.';
    end if;
  elsif new.decision is distinct from old.decision and not can_decide then
    raise exception 'Tylko właściciel lub rekruter może zatwierdzić decyzję po etapie.';
  end if;

  -- [1.2] Sugestie AI (pole ai) zapisuje wyłącznie owner/recruiter; rozmówca nie może ich
  -- dopisać ani zmienić (zachowujemy poprzedni stan zamiast zgłaszać błąd — aplikacja zapisuje całą kartę).
  if not can_decide then
    new.ai := case when tg_op = 'UPDATE' then old.ai else '{}'::jsonb end;
  end if;

  if is_owner then
    return new;
  end if;

  -- 4) oceny: cudzy wpis wolno przekazać tylko dokładnie w takiej postaci, w jakiej już jest w OLD
  for r in select e from jsonb_array_elements(new.ratings) e loop
    if r->>'rater_id' <> me then
      if tg_op = 'INSERT'
         or not exists (select 1 from jsonb_array_elements(old.ratings) o where o = r) then
        raise exception 'Możesz zapisywać tylko własne oceny (rater_id musi być Twoim identyfikatorem).';
      end if;
    end if;
  end loop;
  -- 5) scalanie: cudze wpisy z OLD (nienaruszone) + moje wpisy z NEW
  if tg_op = 'UPDATE' then
    new.ratings :=
      coalesce((select jsonb_agg(o) from jsonb_array_elements(old.ratings) o where o->>'rater_id' <> me), '[]'::jsonb)
      || coalesce((select jsonb_agg(n) from jsonb_array_elements(new.ratings) n where n->>'rater_id' = me), '[]'::jsonb);
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- C. Retencja danych kandydatów
-- ---------------------------------------------------------------------------
alter table public.organizations
  add column if not exists retention_months int
  check (retention_months is null or retention_months between 1 and 120);
comment on column public.organizations.retention_months is 'Po ilu miesiącach od zamknięcia (odrzucenie/zatrudnienie) kasować dane kandydata. NULL = nie kasuj automatycznie.';
grant update (name, retention_months) on public.organizations to authenticated;

alter table public.candidates add column if not exists closed_at timestamptz;
comment on column public.candidates.closed_at is 'Kiedy kandydat przestał być aktywny (rejected/hired). Ustawiane triggerem.';
update public.candidates set closed_at = created_at where status <> 'active' and closed_at is null;

create or replace function public.candidates_set_closed_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = 'active' then
    new.closed_at := null;
  elsif tg_op = 'INSERT' or old.status = 'active' or new.closed_at is null then
    new.closed_at := coalesce(new.closed_at, now());
  else
    new.closed_at := old.closed_at;
  end if;
  return new;
end;
$$;
revoke all on function public.candidates_set_closed_at() from public, anon, authenticated;
drop trigger if exists candidates_closed_at on public.candidates;
create trigger candidates_closed_at before insert or update of status on public.candidates
  for each row execute function public.candidates_set_closed_at();

-- Wywoływana z zadania harmonogramu (pg_cron) lub ręcznie przez właściciela projektu — NIE z API.
-- Przykład (po zgodzie): select cron.schedule('tekma-purge', '17 3 * * *', 'select public.purge_expired_candidates()');
create or replace function public.purge_expired_candidates()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  n int;
begin
  with d as (
    delete from public.candidates c
     using public.organizations o
     where o.id = c.org_id
       and o.retention_months is not null
       and c.closed_at is not null
       and c.closed_at < now() - make_interval(months => o.retention_months)
    returning 1
  )
  select count(*) into n from d;
  return n;
end;
$$;
revoke all on function public.purge_expired_candidates() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- D. delete_org
-- ---------------------------------------------------------------------------
create or replace function public.delete_org(org uuid, confirm_name text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  org_name text;
begin
  if auth.uid() is null or not public.has_role(org, array['owner']) then
    raise exception 'Tylko właściciel może usunąć firmę.' using errcode = '42501';
  end if;
  select name into org_name from public.organizations where id = org;
  if org_name is distinct from confirm_name then
    raise exception 'Nazwa firmy nie zgadza się z potwierdzeniem — nic nie usunięto.' using errcode = '23514';
  end if;
  delete from public.organizations where id = org;   -- kaskada: członkowie, stanowiska, kandydaci, rubryki, karty
end;
$$;
revoke all on function public.delete_org(uuid, text) from public, anon;
grant execute on function public.delete_org(uuid, text) to authenticated;
