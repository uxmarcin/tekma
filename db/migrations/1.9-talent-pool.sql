-- ============================================================================
-- Tekma — migracja 1.9: baza talentów (kandydaci spoza aktywnych procesów) ze zgodą RODO.
-- Idempotentna. Odczyt: każdy członek firmy. Zapis: owner i recruiter.
-- consent_status: granted (zgoda ważna do consent_until), pending (czeka na odpowiedź), none (brak zgody → do usunięcia).
-- ============================================================================
create table if not exists public.talent_pool (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  full_name     text not null check (char_length(full_name) between 2 and 160),
  email         text not null default '' check (char_length(email) <= 254),
  role_title    text not null default '' check (char_length(role_title) <= 160),
  location      text not null default '' check (char_length(location) <= 160),
  tags          text[] not null default '{}' check (cardinality(tags) <= 12),
  source        text not null default '' check (char_length(source) <= 80),
  note          text not null default '' check (char_length(note) <= 1000),
  consent_status text not null default 'pending' check (consent_status in ('granted','pending','none')),
  consent_until date null,
  last_contact  date null,
  candidate_id  uuid null references public.candidates(id) on delete set null,
  created_at    timestamptz not null default now()
);
comment on table public.talent_pool is 'Baza talentów. Wpis wymaga ważnej zgody (consent_until); po terminie dane są do usunięcia.';
create index if not exists talent_pool_org_idx on public.talent_pool(org_id, created_at desc);
create index if not exists talent_pool_consent_idx on public.talent_pool(org_id, consent_until);

create or replace function public.talent_check_org()
returns trigger language plpgsql security definer set search_path = public as $$
declare ref_org uuid;
begin
  if new.candidate_id is not null then
    select org_id into ref_org from public.candidates where id = new.candidate_id;
    if ref_org is null or ref_org <> new.org_id then raise exception 'Kandydat nie należy do tej firmy.'; end if;
  end if;
  return new;
end $$;
revoke all on function public.talent_check_org() from public, anon, authenticated;
drop trigger if exists talent_same_org on public.talent_pool;
create trigger talent_same_org before insert or update of candidate_id, org_id on public.talent_pool for each row execute function public.talent_check_org();
drop trigger if exists talent_lock_org on public.talent_pool;
create trigger talent_lock_org before update on public.talent_pool for each row execute function public.forbid_key_change();

alter table public.talent_pool enable row level security;
revoke all on public.talent_pool from anon;
grant select, insert, update, delete on public.talent_pool to authenticated;
drop policy if exists talent_pool_select on public.talent_pool;
create policy talent_pool_select on public.talent_pool for select to authenticated using (public.is_member(org_id));
drop policy if exists talent_pool_insert on public.talent_pool;
create policy talent_pool_insert on public.talent_pool for insert to authenticated with check (public.has_role(org_id, array['owner','recruiter']));
drop policy if exists talent_pool_update on public.talent_pool;
create policy talent_pool_update on public.talent_pool for update to authenticated using (public.is_member(org_id)) with check (public.has_role(org_id, array['owner','recruiter']));
drop policy if exists talent_pool_delete on public.talent_pool;
create policy talent_pool_delete on public.talent_pool for delete to authenticated using (public.has_role(org_id, array['owner','recruiter']));
