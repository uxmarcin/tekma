-- ============================================================================
-- Tekma — schemat bazy dla Postgres / Supabase (wersja 1)
-- ============================================================================
-- JAK URUCHOMIĆ (Supabase SQL Editor):
--   1. W panelu Supabase otwórz projekt → menu „SQL Editor” → „New query”.
--   2. Wklej CAŁĄ zawartość tego pliku i kliknij „Run” (Ctrl/Cmd+Enter).
--      Skrypt jest idempotentny — można go uruchomić ponownie bez szkody.
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
--   Zalogowani widzą i zmieniają tylko dane firm, których są członkami (is_member).
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
comment on table public.scorecards is 'Karty oceny. ratings = [{question_id, rater_id, rater_name, score 1–5}]; ai = {question_id:{score, quote, reason}} to TYLKO sugestia; decision podejmuje człowiek.';
create index if not exists scorecards_org_id_idx on public.scorecards(org_id, updated_at desc);
create index if not exists scorecards_candidate_idx on public.scorecards(candidate_id);

-- ----------------------------------------------------------------------------
-- Funkcje pomocnicze
-- ----------------------------------------------------------------------------

-- Czy bieżący użytkownik jest członkiem firmy? Używana we wszystkich politykach RLS.
-- security definer + stable: omija RLS na members (unika rekurencji) i jest tania w planie zapytania.
create or replace function public.is_member(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.members m
    where m.org_id = org and m.user_id = auth.uid()
  );
$$;
revoke all on function public.is_member(uuid) from public;
grant execute on function public.is_member(uuid) to authenticated;

-- Tworzy firmę i wpisuje bieżącego użytkownika jako właściciela. Zwraca id firmy.
-- Wywoływana z aplikacji przez POST /rest/v1/rpc/create_org {"name": "..."}.
create or replace function public.create_org(name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Musisz być zalogowany, aby utworzyć firmę.' using errcode = '42501';
  end if;
  if name is null or char_length(btrim(name)) < 2 then
    raise exception 'Podaj nazwę firmy (co najmniej 2 znaki).' using errcode = '23514';
  end if;
  insert into public.organizations (name, created_by)
  values (btrim(name), auth.uid())
  returning id into new_id;
  insert into public.members (org_id, user_id, role)
  values (new_id, auth.uid(), 'owner');
  return new_id;
end;
$$;
revoke all on function public.create_org(text) from public;
grant execute on function public.create_org(text) to authenticated;

-- Profil po rejestracji: imię i nazwisko z metadanych (raw_user_meta_data->>'name').
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), '')
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

-- ----------------------------------------------------------------------------
-- Uprawnienia ról i RLS (brak polityk dla anon = brak dostępu dla niezalogowanych)
-- ----------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.organizations, public.members, public.profiles,
  public.positions, public.candidates, public.rubrics, public.scorecards
to authenticated;
revoke all on
  public.organizations, public.members, public.profiles,
  public.positions, public.candidates, public.rubrics, public.scorecards
from anon;

alter table public.organizations enable row level security;
alter table public.members       enable row level security;
alter table public.profiles      enable row level security;
alter table public.positions     enable row level security;
alter table public.candidates    enable row level security;
alter table public.rubrics       enable row level security;
alter table public.scorecards    enable row level security;

-- organizations: członkowie czytają; zmienia tylko owner; wstawianie wyłącznie przez create_org (security definer).
drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations
  for select to authenticated using (public.is_member(id));
drop policy if exists organizations_update on public.organizations;
create policy organizations_update on public.organizations
  for update to authenticated
  using (exists (select 1 from public.members m where m.org_id = id and m.user_id = auth.uid() and m.role = 'owner'))
  with check (exists (select 1 from public.members m where m.org_id = id and m.user_id = auth.uid() and m.role = 'owner'));

-- members: członkowie widzą skład swojej firmy; zaprasza i zmienia role tylko owner; każdy może opuścić firmę.
drop policy if exists members_select on public.members;
create policy members_select on public.members
  for select to authenticated using (public.is_member(org_id));
drop policy if exists members_insert on public.members;
create policy members_insert on public.members
  for insert to authenticated
  with check (exists (select 1 from public.members m where m.org_id = members.org_id and m.user_id = auth.uid() and m.role = 'owner'));
drop policy if exists members_update on public.members;
create policy members_update on public.members
  for update to authenticated
  using (exists (select 1 from public.members m where m.org_id = members.org_id and m.user_id = auth.uid() and m.role = 'owner'));
drop policy if exists members_delete on public.members;
create policy members_delete on public.members
  for delete to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.members m where m.org_id = members.org_id and m.user_id = auth.uid() and m.role = 'owner'));

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

-- Dane biznesowe: odczyt i zapis tylko dla członków firmy (org_id).
-- positions
drop policy if exists positions_select on public.positions;
create policy positions_select on public.positions for select to authenticated using (public.is_member(org_id));
drop policy if exists positions_insert on public.positions;
create policy positions_insert on public.positions for insert to authenticated with check (public.is_member(org_id));
drop policy if exists positions_update on public.positions;
create policy positions_update on public.positions for update to authenticated using (public.is_member(org_id)) with check (public.is_member(org_id));
drop policy if exists positions_delete on public.positions;
create policy positions_delete on public.positions for delete to authenticated using (public.is_member(org_id));

-- candidates
drop policy if exists candidates_select on public.candidates;
create policy candidates_select on public.candidates for select to authenticated using (public.is_member(org_id));
drop policy if exists candidates_insert on public.candidates;
create policy candidates_insert on public.candidates for insert to authenticated with check (public.is_member(org_id));
drop policy if exists candidates_update on public.candidates;
create policy candidates_update on public.candidates for update to authenticated using (public.is_member(org_id)) with check (public.is_member(org_id));
drop policy if exists candidates_delete on public.candidates;
create policy candidates_delete on public.candidates for delete to authenticated using (public.is_member(org_id));

-- rubrics
drop policy if exists rubrics_select on public.rubrics;
create policy rubrics_select on public.rubrics for select to authenticated using (public.is_member(org_id));
drop policy if exists rubrics_insert on public.rubrics;
create policy rubrics_insert on public.rubrics for insert to authenticated with check (public.is_member(org_id));
drop policy if exists rubrics_update on public.rubrics;
create policy rubrics_update on public.rubrics for update to authenticated using (public.is_member(org_id)) with check (public.is_member(org_id));
drop policy if exists rubrics_delete on public.rubrics;
create policy rubrics_delete on public.rubrics for delete to authenticated using (public.is_member(org_id));

-- scorecards
drop policy if exists scorecards_select on public.scorecards;
create policy scorecards_select on public.scorecards for select to authenticated using (public.is_member(org_id));
drop policy if exists scorecards_insert on public.scorecards;
create policy scorecards_insert on public.scorecards for insert to authenticated with check (public.is_member(org_id));
drop policy if exists scorecards_update on public.scorecards;
create policy scorecards_update on public.scorecards for update to authenticated using (public.is_member(org_id)) with check (public.is_member(org_id));
drop policy if exists scorecards_delete on public.scorecards;
create policy scorecards_delete on public.scorecards for delete to authenticated using (public.is_member(org_id));

-- Odśwież cache schematu PostgREST (Supabase robi to też samo po chwili).
notify pgrst, 'reload schema';
