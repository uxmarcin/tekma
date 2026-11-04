-- ============================================================================
-- Tekma — schemat bazy dla Postgres / Supabase (wersja 1.1 — utwardzanie)
-- ============================================================================
-- JAK URUCHOMIĆ (Supabase SQL Editor):
--   1. W panelu Supabase otwórz projekt → menu „SQL Editor” → „New query”.
--   2. Wklej CAŁĄ zawartość tego pliku i kliknij „Run” (Ctrl/Cmd+Enter).
--      Skrypt jest idempotentny — można go uruchomić ponownie bez szkody
--      (także na bazie z wersji 1: policies, triggery i ograniczenia są dokładane/podmieniane).
--   3. Sprawdź w „Table Editor”, że pojawiły się tabele: organizations, members,
--      profiles, positions, candidates, rubrics, scorecards (każda z włączonym RLS).
--   4. W „Project Settings → API” skopiuj „Project URL” i klucz „anon public”
--      do site/app/js/config.js (SUPABASE_URL, SUPABASE_ANON_KEY).
--   5. Załóż konto w aplikacji (#/signup), utwórz firmę w onboardingu i wczytaj
--      dane przykładowe — wszystko trafi do tych tabel.
--
-- UWAGA na czas testów: Authentication → Providers → Email → wyłącz „Confirm email”.
--   Wtedy rejestracja od razu zwraca sesję (bez klikania linku w mailu). W produkcji
--   włącz potwierdzanie z powrotem — aplikacja obsługuje oba warianty (needsConfirmation).
--
-- Bezpieczeństwo: klucz anon jest publiczny; dostęp do danych ogranicza RLS.
--   Brak jakichkolwiek polityk dla roli anon → niezalogowani nie widzą nic.
--   Zalogowani widzą tylko dane firm, których są członkami (is_member); zapis zależy od roli
--   (has_role): owner i recruiter zarządzają stanowiskami, kandydatami i rubrykami;
--   interviewer tylko je czyta i wypełnia karty oceny. Szczegóły: docs/supabase-security.md.
--
-- Co nowego w 1.1 (sekcje „Utwardzanie — wersja 1.1”):
--   - has_role(org, roles[]) i polityki zależne od roli (owner/recruiter/interviewer),
--   - spójność między firmami: position_id / candidate_id / rubric_id muszą należeć do tej
--     samej firmy co wiersz; org_id (i members.user_id) są niezmienne po utworzeniu,
--   - ochrona ostatniego właściciela firmy, zmiana organizations tylko w kolumnie name,
--   - karty oceny: decyzję zatwierdza tylko owner/recruiter; rozmówca zapisuje wyłącznie
--     własne oceny (rater_id = auth.uid()), cudze wpisy są chronione,
--   - limity: 5 firm na konto, długości tekstów, rozmiar jsonb, format stages/ratings/ai,
--   - funkcje: search_path = public, pg_temp; EXECUTE tylko dla authenticated (anon: brak).
-- ============================================================================

create extension if not exists pgcrypto;  -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- Tabele
-- ----------------------------------------------------------------------------

-- Firma (organizacja). Wszystkie dane biznesowe mają org_id i są widoczne tylko dla członków.
create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 120),
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null
);
comment on table public.organizations is 'Firmy (organizacje). Jedna firma = jeden zbiór stanowisk, kandydatów i rubryk.';

-- Członkostwo użytkownika w firmie z rolą.
create table if not exists public.members (
  org_id      uuid not null references public.organizations(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'recruiter' check (role in ('owner','recruiter','interviewer')),
  created_at  timestamptz not null default now(),
  primary key (org_id, user_id)
);
comment on table public.members is 'Członkowie firmy i ich role: owner (właściciel), recruiter (rekruter), interviewer (rozmówca).';
create index if not exists members_user_id_idx on public.members(user_id);

-- Profil użytkownika (imię i nazwisko) — tworzony triggerem po rejestracji.
create table if not exists public.profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  created_at  timestamptz not null default now()
);
comment on table public.profiles is 'Profil użytkownika: imię i nazwisko z raw_user_meta_data->>''name'' przy rejestracji.';

-- Stanowisko z lejkiem etapów (stages jsonb = lista nazw etapów).
create table if not exists public.positions (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  title       text not null check (char_length(title) between 2 and 160),
  department  text not null default '',
  location    text not null default '',
  status      text not null default 'open' check (status in ('open','closed')),
  stages      jsonb not null default '["Screening CV","Rozmowa wstępna","Rozmowa techniczna","Rozmowa z CEO","Oferta"]'::jsonb,
  rubric_id   uuid null,
  description text not null default '',
  created_at  timestamptz not null default now()
);
comment on table public.positions is 'Stanowiska rekrutacyjne. stages = lejek (lista etapów po polsku), rubric_id = domyślna rubryka rozmów.';
create index if not exists positions_org_id_idx on public.positions(org_id, created_at desc);

-- Rubryka ocen: pytania z kompetencją, wagą (1–3), czasem i kotwicami 1–5.
create table if not exists public.rubrics (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null check (char_length(name) between 2 and 160),
  version     int not null default 1 check (version >= 1),
  questions   jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
comment on table public.rubrics is 'Rubryki. questions = [{id, text, competency, weight (1|2|3), minutes, anchors:{"1".."5"}}]. Zmiana pytań podnosi version.';
create index if not exists rubrics_org_id_idx on public.rubrics(org_id, updated_at desc);

-- FK positions.rubric_id → rubrics (dodawany po utworzeniu rubrics; idempotentnie).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'positions_rubric_id_fkey') then
    alter table public.positions
      add constraint positions_rubric_id_fkey foreign key (rubric_id) references public.rubrics(id) on delete set null;
  end if;
end $$;

-- Kandydat przypisany do stanowiska i etapu lejka.
create table if not exists public.candidates (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  position_id   uuid not null references public.positions(id) on delete cascade,
  full_name     text not null check (char_length(full_name) between 2 and 160),
  email         text not null default '',
  source        text not null default '',
  stage         text not null,
  cv_score      int null check (cv_score is null or (cv_score between 0 and 100)),
  status        text not null default 'active' check (status in ('active','rejected','hired')),
  reject_reason text null,
  applied_at    timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
comment on table public.candidates is 'Kandydaci. stage = nazwa etapu z positions.stages; cv_score = dopasowanie CV 0–100 (sugestia AI, zatwierdzana przez człowieka).';
create index if not exists candidates_org_id_idx on public.candidates(org_id, applied_at desc);
create index if not exists candidates_position_id_idx on public.candidates(position_id);

-- Karta oceny kandydata na danym etapie: oceny rozmówców + sugestie AI + decyzja człowieka.
create table if not exists public.scorecards (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  candidate_id  uuid not null references public.candidates(id) on delete cascade,
  stage         text not null,
  rubric_id     uuid null references public.rubrics(id) on delete set null,
  ratings       jsonb not null default '[]'::jsonb,
  ai            jsonb not null default '{}'::jsonb,
  decision      text null check (decision is null or decision in ('yes','maybe','no')),
  updated_at    timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  unique (candidate_id, stage)
);
comment on table public.scorecards is 'Karty oceny. ratings = [{question_id, rater_id, rater_name, score 1–5}]; ai = {question_id:{score, quote, reason}} to TYLKO sugestia; decision podejmuje człowiek (owner/recruiter).';
create index if not exists scorecards_org_id_idx on public.scorecards(org_id, updated_at desc);
create index if not exists scorecards_candidate_idx on public.scorecards(candidate_id);

-- ----------------------------------------------------------------------------
-- Funkcje pomocnicze
-- ----------------------------------------------------------------------------
-- Wszystkie funkcje mają search_path = public, pg_temp (pg_temp na końcu: nikt nie podstawi
-- własnej funkcji/tabeli tymczasowej o tej samej nazwie przed obiektami z public).

-- Czy bieżący użytkownik jest członkiem firmy? Używana we wszystkich politykach RLS.
-- security definer + stable: omija RLS na members (unika rekurencji) i jest tania w planie zapytania.
create or replace function public.is_member(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.members m
    where m.org_id = org and m.user_id = auth.uid()
  );
$$;

-- [1.1] Czy bieżący użytkownik ma w firmie jedną z podanych ról? Np. has_role(org_id, array['owner','recruiter']).
create or replace function public.has_role(org uuid, roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.members m
    where m.org_id = org and m.user_id = auth.uid() and m.role = any (roles)
  );
$$;

-- Tworzy firmę i wpisuje bieżącego użytkownika jako właściciela. Zwraca id firmy.
-- Wywoływana z aplikacji przez POST /rest/v1/rpc/create_org {"name": "..."}.
-- [1.1] Limit 5 firm utworzonych z jednego konta (ochrona przed zaśmiecaniem bazy).
create or replace function public.create_org(name text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_id uuid;
  max_orgs constant int := 5;
begin
  if auth.uid() is null then
    raise exception 'Musisz być zalogowany, aby utworzyć firmę.' using errcode = '42501';
  end if;
  if name is null or char_length(btrim(name)) < 2 then
    raise exception 'Podaj nazwę firmy (co najmniej 2 znaki).' using errcode = '23514';
  end if;
  if char_length(btrim(name)) > 120 then
    raise exception 'Nazwa firmy może mieć najwyżej 120 znaków.' using errcode = '23514';
  end if;
  if (select count(*) from public.organizations o where o.created_by = auth.uid()) >= max_orgs then
    raise exception 'Osiągnięto limit % firm na jedno konto. Napisz do nas, jeśli potrzebujesz więcej.', max_orgs
      using errcode = 'P0001';
  end if;
  insert into public.organizations (name, created_by)
  values (btrim(name), auth.uid())
  returning id into new_id;
  insert into public.members (org_id, user_id, role)
  values (new_id, auth.uid(), 'owner');
  return new_id;
end;
$$;

-- Profil po rejestracji: imię i nazwisko z metadanych (raw_user_meta_data->>'name').
-- Trigger na auth.users działa jako właściciel funkcji (security definer) — zwykły użytkownik
-- nie ma prawa pisać do profiles cudzych osób, a sama funkcja nie jest wywoływalna z API.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (user_id, full_name)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), ''), 160)
  )
  on conflict (user_id) do update set full_name = excluded.full_name;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Automatyczne updated_at dla rubryk i kart oceny.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists rubrics_touch on public.rubrics;
create trigger rubrics_touch before update on public.rubrics for each row execute function public.touch_updated_at();
drop trigger if exists scorecards_touch on public.scorecards;
create trigger scorecards_touch before update on public.scorecards for each row execute function public.touch_updated_at();

-- ============================================================================
-- Utwardzanie — wersja 1.1 — A. Walidacja danych (format i limity rozmiaru)
-- ============================================================================
-- Aplikacja waliduje dane w store.js, ale klucz anon jest publiczny — każdy zalogowany może
-- wysłać dowolne żądanie do PostgREST. Dlatego limity są też w bazie.

-- Czy jsonb to tablica min_n..max_n niepustych napisów o długości ≤ max_len? (dla positions.stages)
create or replace function public.jsonb_is_string_array(j jsonb, min_n int, max_n int, max_len int)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when j is null or jsonb_typeof(j) <> 'array' then false
    when jsonb_array_length(j) < min_n or jsonb_array_length(j) > max_n then false
    else not exists (
      select 1 from jsonb_array_elements(j) e
      where jsonb_typeof(e) <> 'string'
         or char_length(btrim(e #>> '{}')) < 1
         or char_length(e #>> '{}') > max_len
    )
  end;
$$;

-- Ograniczenia CHECK dodawane idempotentnie (po nazwie w pg_constraint).
do $$
declare
  c record;
begin
  for c in
    select * from (values
      -- profile
      ('public.profiles',  'profiles_full_name_len',     'char_length(full_name) <= 160'),
      -- stanowiska
      ('public.positions', 'positions_department_len',   'char_length(department) <= 160'),
      ('public.positions', 'positions_location_len',     'char_length(location) <= 160'),
      ('public.positions', 'positions_description_len',  'char_length(description) <= 20000'),
      ('public.positions', 'positions_stages_format',    'public.jsonb_is_string_array(stages, 1, 12, 120)'),
      ('public.positions', 'positions_stages_size',      'pg_column_size(stages) <= 16384'),
      -- rubryki
      ('public.rubrics',   'rubrics_questions_format',   'jsonb_typeof(questions) = ''array'' and jsonb_array_length(questions) <= 100'),
      ('public.rubrics',   'rubrics_questions_size',     'pg_column_size(questions) <= 262144'),
      -- kandydaci
      ('public.candidates','candidates_email_len',       'char_length(email) <= 254'),
      ('public.candidates','candidates_source_len',      'char_length(source) <= 120'),
      ('public.candidates','candidates_stage_len',       'char_length(stage) between 1 and 120'),
      ('public.candidates','candidates_reject_reason_len','reject_reason is null or char_length(reject_reason) <= 1000'),
      -- karty oceny
      ('public.scorecards','scorecards_stage_len',       'char_length(stage) between 1 and 120'),
      ('public.scorecards','scorecards_ratings_format',  'jsonb_typeof(ratings) = ''array'' and jsonb_array_length(ratings) <= 2000'),
      ('public.scorecards','scorecards_ratings_size',    'pg_column_size(ratings) <= 262144'),
      ('public.scorecards','scorecards_ai_format',       'jsonb_typeof(ai) = ''object'''),
      ('public.scorecards','scorecards_ai_size',         'pg_column_size(ai) <= 262144')
    ) as v(tbl, cname, expr)
  loop
    if not exists (select 1 from pg_constraint where conname = c.cname) then
      execute format('alter table %s add constraint %I check (%s)', c.tbl, c.cname, c.expr);
    end if;
  end loop;
end $$;

-- ============================================================================
-- Utwardzanie — wersja 1.1 — B. Spójność między firmami i niezmienność org_id
-- ============================================================================
-- RLS sprawdza tylko org_id wiersza. Bez poniższych triggerów członek firmy A mógłby wskazać
-- w position_id / candidate_id / rubric_id rekord firmy B (np. podpiąć kandydata pod cudze
-- stanowisko). Trigger działa z uprawnieniami wywołującego (RLS na tabelach odniesienia
-- obowiązuje), więc cudzy rekord wygląda jak nieistniejący — w obu przypadkach odrzucamy.

create or replace function public.check_same_org()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  ref_org uuid;
begin
  if tg_table_name = 'candidates' then
    select org_id into ref_org from public.positions where id = new.position_id;
    if ref_org is null or ref_org <> new.org_id then
      raise exception 'Stanowisko nie należy do tej firmy.';
    end if;
  elsif tg_table_name = 'positions' then
    if new.rubric_id is not null then
      select org_id into ref_org from public.rubrics where id = new.rubric_id;
      if ref_org is null or ref_org <> new.org_id then
        raise exception 'Rubryka nie należy do tej firmy.';
      end if;
    end if;
  elsif tg_table_name = 'scorecards' then
    select org_id into ref_org from public.candidates where id = new.candidate_id;
    if ref_org is null or ref_org <> new.org_id then
      raise exception 'Kandydat nie należy do tej firmy.';
    end if;
    if new.rubric_id is not null then
      select org_id into ref_org from public.rubrics where id = new.rubric_id;
      if ref_org is null or ref_org <> new.org_id then
        raise exception 'Rubryka nie należy do tej firmy.';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists candidates_same_org on public.candidates;
create trigger candidates_same_org
  before insert or update of position_id, org_id on public.candidates
  for each row execute function public.check_same_org();
drop trigger if exists positions_same_org on public.positions;
create trigger positions_same_org
  before insert or update of rubric_id, org_id on public.positions
  for each row execute function public.check_same_org();
drop trigger if exists scorecards_same_org on public.scorecards;
create trigger scorecards_same_org
  before insert or update of candidate_id, rubric_id, org_id on public.scorecards
  for each row execute function public.check_same_org();

-- org_id jest niezmienne po utworzeniu (nie da się „przenieść” rekordu do innej firmy);
-- w members niezmienne są też user_id i org_id (klucz członkostwa).
create or replace function public.forbid_key_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.org_id is distinct from old.org_id then
    raise exception 'Nie można przenieść rekordu do innej firmy (org_id jest niezmienne).';
  end if;
  -- zagnieżdżony if: new.user_id istnieje tylko w members (plpgsql nie skraca „and”)
  if tg_table_name = 'members' then
    if new.user_id is distinct from old.user_id then
      raise exception 'Nie można zmienić użytkownika w członkostwie — usuń je i dodaj nowe.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists members_lock_key on public.members;
create trigger members_lock_key before update on public.members for each row execute function public.forbid_key_change();
drop trigger if exists positions_lock_org on public.positions;
create trigger positions_lock_org before update on public.positions for each row execute function public.forbid_key_change();
drop trigger if exists candidates_lock_org on public.candidates;
create trigger candidates_lock_org before update on public.candidates for each row execute function public.forbid_key_change();
drop trigger if exists rubrics_lock_org on public.rubrics;
create trigger rubrics_lock_org before update on public.rubrics for each row execute function public.forbid_key_change();
drop trigger if exists scorecards_lock_org on public.scorecards;
create trigger scorecards_lock_org before update on public.scorecards for each row execute function public.forbid_key_change();

-- ============================================================================
-- Utwardzanie — wersja 1.1 — C. Ostatni właściciel firmy
-- ============================================================================
-- Nie można usunąć ani zdegradować ostatniego ownera (firma zostałaby bez administratora).
-- security definer: musimy widzieć wszystkich członków niezależnie od RLS. Kaskady
-- (usunięcie całej firmy albo konta w auth.users) nie są blokowane — wtedy firma/konto
-- już nie istnieje.
create or replace function public.protect_last_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  user_exists boolean := true;
begin
  if old.role <> 'owner' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'UPDATE' and new.role = 'owner' then
    return new;
  end if;
  if not exists (select 1 from public.organizations o where o.id = old.org_id) then
    return case when tg_op = 'DELETE' then old else new end;   -- kaskada po usunięciu firmy
  end if;
  begin
    select exists (select 1 from auth.users u where u.id = old.user_id) into user_exists;
  exception when insufficient_privilege then
    user_exists := true;
  end;
  if not user_exists then
    return case when tg_op = 'DELETE' then old else new end;   -- kaskada po usunięciu konta
  end if;
  -- for update: blokada wierszy innych ownerów, by dwie równoległe degradacje nie zostawiły firmy bez ownera
  perform 1 from public.members m
   where m.org_id = old.org_id and m.role = 'owner' and m.user_id <> old.user_id
   for update;
  if not found then
    raise exception 'Firma musi mieć co najmniej jednego właściciela. Najpierw nadaj rolę właściciela innej osobie.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists members_last_owner on public.members;
create trigger members_last_owner
  before update of role or delete on public.members
  for each row execute function public.protect_last_owner();

-- ============================================================================
-- Utwardzanie — wersja 1.1 — D. Karty oceny: decyzja i integralność ocen
-- ============================================================================
-- Zasada produktu: AI tylko sugeruje, człowiek decyduje. W bazie dokładamy:
--   - decision (decyzja po etapie) zmienia tylko owner lub recruiter — rozmówca ocenia,
--     ale nie zamyka etapu. UWAGA: widok scorecard.js pokazuje przyciski decyzji każdemu;
--     dla rozmówcy zapis kończy się komunikatem błędu (bezpieczna opcja — patrz docs).
--   - ratings: wpis z rater_id innym niż auth.uid() może dodać tylko owner. Rozmówca
--     i rekruter zapisują wyłącznie własne wpisy; cudze wpisy są zachowywane z OLD
--     (aplikacja zapisuje całą tablicę, więc nieaktualny stan w przeglądarce nie skasuje
--     cudzej oceny — zamiast błędu scalamy: cudze z OLD + moje z NEW). Próba PODMIANY
--     cudzego wpisu (inna wartość niż w OLD) albo dopisania cudzego kończy się błędem.
--   - format: każdy wpis ma question_id, rater_id i score 1–5; ai jest obiektem.
-- Ograniczenie: owner może wpisać oceny w cudzym imieniu (potrzebne do danych przykładowych
-- z seed.js, gdzie rozmówcy są fikcyjni). Brak historii zmian (audit log) w tej iteracji.
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

drop trigger if exists scorecards_guard on public.scorecards;
create trigger scorecards_guard
  before insert or update on public.scorecards
  for each row execute function public.scorecards_guard();

-- ----------------------------------------------------------------------------
-- Uprawnienia ról i RLS (brak polityk dla anon = brak dostępu dla niezalogowanych)
-- ----------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.members, public.profiles,
  public.positions, public.candidates, public.rubrics, public.scorecards
to authenticated;
revoke all on
  public.organizations, public.members, public.profiles,
  public.positions, public.candidates, public.rubrics, public.scorecards
from anon;

-- [1.1] organizations: odczyt + zmiana WYŁĄCZNIE kolumny name (grant kolumnowy).
--   Wstawianie tylko przez create_org (security definer); usuwanie firmy z API — brak
--   (zrobi to właściciel projektu w panelu Supabase). revoke najpierw: na bazie z wersji 1
--   authenticated miało pełne insert/update/delete.
revoke insert, update, delete on public.organizations from authenticated;
grant select on public.organizations to authenticated;
grant update (name) on public.organizations to authenticated;
-- [1.1] profiles: zmiana tylko full_name (user_id/created_at nie do ruszenia).
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

-- [1.1] Funkcje: Supabase nadaje EXECUTE domyślnie rolom anon/authenticated/service_role
--   (ALTER DEFAULT PRIVILEGES), więc `revoke from public` nie wystarcza — odcinamy anon jawnie.
--   Funkcje triggerów nie potrzebują EXECUTE dla użytkownika (Postgres sprawdza je przy tworzeniu
--   triggera), więc nie są wywoływalne z API wcale. jsonb_is_string_array jest w CHECK —
--   musi być wykonywalna przez authenticated.
revoke all on function public.is_member(uuid) from public, anon;
grant execute on function public.is_member(uuid) to authenticated;
revoke all on function public.has_role(uuid, text[]) from public, anon;
grant execute on function public.has_role(uuid, text[]) to authenticated;
revoke all on function public.create_org(text) from public, anon;
grant execute on function public.create_org(text) to authenticated;
revoke all on function public.jsonb_is_string_array(jsonb, int, int, int) from public, anon;
grant execute on function public.jsonb_is_string_array(jsonb, int, int, int) to authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.check_same_org() from public, anon, authenticated;
revoke all on function public.forbid_key_change() from public, anon, authenticated;
revoke all on function public.protect_last_owner() from public, anon, authenticated;
revoke all on function public.scorecards_guard() from public, anon, authenticated;

alter table public.organizations enable row level security;
alter table public.members       enable row level security;
alter table public.profiles      enable row level security;
alter table public.positions     enable row level security;
alter table public.candidates    enable row level security;
alter table public.rubrics       enable row level security;
alter table public.scorecards    enable row level security;

-- organizations: członkowie czytają; zmienia (tylko name — grant kolumnowy) owner;
-- wstawianie wyłącznie przez create_org (security definer).
drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations
  for select to authenticated using (public.is_member(id));
drop policy if exists organizations_update on public.organizations;
create policy organizations_update on public.organizations
  for update to authenticated
  using (public.has_role(id, array['owner']))
  with check (public.has_role(id, array['owner']));

-- members: członkowie widzą skład swojej firmy; dodaje i zmienia role tylko owner;
-- każdy może opuścić firmę (ostatniego ownera chroni trigger members_last_owner).
drop policy if exists members_select on public.members;
create policy members_select on public.members
  for select to authenticated using (public.is_member(org_id));
drop policy if exists members_insert on public.members;
create policy members_insert on public.members
  for insert to authenticated
  with check (public.has_role(org_id, array['owner']));
drop policy if exists members_update on public.members;
create policy members_update on public.members
  for update to authenticated
  using (public.has_role(org_id, array['owner']))
  with check (public.has_role(org_id, array['owner']));
drop policy if exists members_delete on public.members;
create policy members_delete on public.members
  for delete to authenticated
  using (user_id = auth.uid() or public.has_role(org_id, array['owner']));

-- profiles: własny wiersz (odczyt/zapis) + odczyt profili członków tej samej firmy.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.members mine
      join public.members theirs on theirs.org_id = mine.org_id
      where mine.user_id = auth.uid() and theirs.user_id = profiles.user_id
    )
  );
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================================
-- Utwardzanie — wersja 1.1 — E. Dane biznesowe: odczyt dla członków, zapis zależny od roli
-- ============================================================================
-- positions / candidates / rubrics:
--   select — każdy członek; insert/delete — owner, recruiter; update — using: każdy członek,
--   with check: owner, recruiter. Dzięki „using = członek” PostgREST zwraca rozmówcy jasny
--   błąd 42501 (aplikacja: „Brak uprawnień…”) zamiast pustej odpowiedzi „nie znaleziono”.
-- scorecards:
--   select/insert/update — każdy członek (rozmówca ocenia; decyzję i cudze oceny pilnuje
--   trigger scorecards_guard); delete — owner, recruiter.

-- positions
drop policy if exists positions_select on public.positions;
create policy positions_select on public.positions for select to authenticated using (public.is_member(org_id));
drop policy if exists positions_insert on public.positions;
create policy positions_insert on public.positions for insert to authenticated with check (public.has_role(org_id, array['owner','recruiter']));
drop policy if exists positions_update on public.positions;
create policy positions_update on public.positions for update to authenticated using (public.is_member(org_id)) with check (public.has_role(org_id, array['owner','recruiter']));
drop policy if exists positions_delete on public.positions;
create policy positions_delete on public.positions for delete to authenticated using (public.has_role(org_id, array['owner','recruiter']));

-- candidates
drop policy if exists candidates_select on public.candidates;
create policy candidates_select on public.candidates for select to authenticated using (public.is_member(org_id));
drop policy if exists candidates_insert on public.candidates;
create policy candidates_insert on public.candidates for insert to authenticated with check (public.has_role(org_id, array['owner','recruiter']));
drop policy if exists candidates_update on public.candidates;
create policy candidates_update on public.candidates for update to authenticated using (public.is_member(org_id)) with check (public.has_role(org_id, array['owner','recruiter']));
drop policy if exists candidates_delete on public.candidates;
create policy candidates_delete on public.candidates for delete to authenticated using (public.has_role(org_id, array['owner','recruiter']));

-- rubrics
drop policy if exists rubrics_select on public.rubrics;
create policy rubrics_select on public.rubrics for select to authenticated using (public.is_member(org_id));
drop policy if exists rubrics_insert on public.rubrics;
create policy rubrics_insert on public.rubrics for insert to authenticated with check (public.has_role(org_id, array['owner','recruiter']));
drop policy if exists rubrics_update on public.rubrics;
create policy rubrics_update on public.rubrics for update to authenticated using (public.is_member(org_id)) with check (public.has_role(org_id, array['owner','recruiter']));
drop policy if exists rubrics_delete on public.rubrics;
create policy rubrics_delete on public.rubrics for delete to authenticated using (public.has_role(org_id, array['owner','recruiter']));

-- scorecards
drop policy if exists scorecards_select on public.scorecards;
create policy scorecards_select on public.scorecards for select to authenticated using (public.is_member(org_id));
drop policy if exists scorecards_insert on public.scorecards;
create policy scorecards_insert on public.scorecards for insert to authenticated with check (public.is_member(org_id));
drop policy if exists scorecards_update on public.scorecards;
create policy scorecards_update on public.scorecards for update to authenticated using (public.is_member(org_id)) with check (public.is_member(org_id));
drop policy if exists scorecards_delete on public.scorecards;
create policy scorecards_delete on public.scorecards for delete to authenticated using (public.has_role(org_id, array['owner','recruiter']));

-- Odśwież cache schematu PostgREST (Supabase robi to też samo po chwili).
notify pgrst, 'reload schema';
