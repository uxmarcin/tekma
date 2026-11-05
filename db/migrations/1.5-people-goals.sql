-- ============================================================================
-- Tekma — migracja 1.5: moduły „Ludzie” (plan pierwszych 90 dni) i „Cele”.
-- Uruchom raz w Supabase → SQL Editor. Idempotentna.
-- Odczyt: każdy członek firmy. Zapis: owner i recruiter (interviewer tylko czyta).
-- ============================================================================
create table if not exists public.people (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  candidate_id uuid null references public.candidates(id) on delete set null,
  full_name    text not null check (char_length(full_name) between 2 and 160),
  job_title    text not null default '' check (char_length(job_title) <= 160),
  start_date   date not null default current_date,
  status       text not null default 'onboarding' check (status in ('onboarding','active','left')),
  created_at   timestamptz not null default now()
);
comment on table public.people is 'Osoby po zatrudnieniu (moduł Ludzie). start_date = pierwszy dzień pracy.';
create index if not exists people_org_idx on public.people(org_id, start_date desc);

create table if not exists public.onboarding_tasks (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  person_id  uuid not null references public.people(id) on delete cascade,
  phase      int  not null check (phase in (30,60,90)),
  title      text not null check (char_length(title) between 2 and 200),
  due_day    int  not null default 1 check (due_day between 0 and 120),
  done       boolean not null default false,
  done_at    timestamptz null,
  position   int  not null default 0,
  created_at timestamptz not null default now()
);
comment on table public.onboarding_tasks is 'Zadania planu 30/60/90 dni. due_day = dzień od startu.';
create index if not exists onboarding_tasks_person_idx on public.onboarding_tasks(person_id, phase, position);

create table if not exists public.goals (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  person_id   uuid null references public.people(id) on delete cascade,
  title       text not null check (char_length(title) between 2 and 200),
  description text not null default '' check (char_length(description) <= 1000),
  due_date    date null,
  progress    int  not null default 0 check (progress between 0 and 100),
  status      text not null default 'active' check (status in ('active','done')),
  created_at  timestamptz not null default now()
);
comment on table public.goals is 'Cele firmy (person_id NULL) lub osoby.';
create index if not exists goals_org_idx on public.goals(org_id, created_at desc);

-- spójność firm: osoba/zadanie/cel muszą należeć do tej samej firmy co rekord nadrzędny
create or replace function public.people_check_org()
returns trigger language plpgsql security definer set search_path = public as $$
declare ref_org uuid;
begin
  if tg_table_name = 'onboarding_tasks' then
    select org_id into ref_org from public.people where id = new.person_id;
    if ref_org is null or ref_org <> new.org_id then raise exception 'Osoba nie należy do tej firmy.'; end if;
  elsif tg_table_name = 'goals' and new.person_id is not null then
    select org_id into ref_org from public.people where id = new.person_id;
    if ref_org is null or ref_org <> new.org_id then raise exception 'Osoba nie należy do tej firmy.'; end if;
  elsif tg_table_name = 'people' and new.candidate_id is not null then
    select org_id into ref_org from public.candidates where id = new.candidate_id;
    if ref_org is null or ref_org <> new.org_id then raise exception 'Kandydat nie należy do tej firmy.'; end if;
  end if;
  return new;
end $$;
revoke all on function public.people_check_org() from public, anon, authenticated;

drop trigger if exists people_same_org on public.people;
create trigger people_same_org before insert or update of candidate_id, org_id on public.people for each row execute function public.people_check_org();
drop trigger if exists tasks_same_org on public.onboarding_tasks;
create trigger tasks_same_org before insert or update of person_id, org_id on public.onboarding_tasks for each row execute function public.people_check_org();
drop trigger if exists goals_same_org on public.goals;
create trigger goals_same_org before insert or update of person_id, org_id on public.goals for each row execute function public.people_check_org();
drop trigger if exists people_lock_org on public.people;
create trigger people_lock_org before update on public.people for each row execute function public.forbid_key_change();
drop trigger if exists tasks_lock_org on public.onboarding_tasks;
create trigger tasks_lock_org before update on public.onboarding_tasks for each row execute function public.forbid_key_change();
drop trigger if exists goals_lock_org on public.goals;
create trigger goals_lock_org before update on public.goals for each row execute function public.forbid_key_change();

alter table public.people enable row level security;
alter table public.onboarding_tasks enable row level security;
alter table public.goals enable row level security;
revoke all on public.people, public.onboarding_tasks, public.goals from anon;
grant select, insert, update, delete on public.people, public.onboarding_tasks, public.goals to authenticated;

do $$
declare t text;
begin
  foreach t in array array['people','onboarding_tasks','goals'] loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.is_member(org_id))', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (public.has_role(org_id, array[''owner'',''recruiter'']))', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (public.is_member(org_id)) with check (public.has_role(org_id, array[''owner'',''recruiter'']))', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using (public.has_role(org_id, array[''owner'',''recruiter'']))', t);
  end loop;
end $$;
