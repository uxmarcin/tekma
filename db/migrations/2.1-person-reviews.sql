-- ============================================================================
-- Tekma — migracja 2.1: oceny po 30/60/90 dniach (ocena 1–5, „keeper test”, notatka).
-- Idempotentna. Odczyt: każdy członek firmy. Zapis: owner i recruiter. Jedna ocena na osobę i fazę.
-- ============================================================================
create table if not exists public.person_reviews (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  person_id  uuid not null references public.people(id) on delete cascade,
  phase      int  not null check (phase in (30,60,90)),
  rating     int  not null check (rating between 1 and 5),
  keeper     text not null check (keeper in ('yes','unsure','no')),
  notes      text not null default '' check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  unique (person_id, phase)
);
comment on table public.person_reviews is 'Oceny po 30/60/90 dniach pracy; keeper = czy zespół walczyłby o zatrzymanie osoby.';
create index if not exists person_reviews_org_idx on public.person_reviews(org_id, created_at desc);

create or replace function public.person_reviews_check_org()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare ref_org uuid;
begin
  select org_id into ref_org from public.people where id = new.person_id;
  if ref_org is null or ref_org <> new.org_id then raise exception 'Osoba nie należy do tej firmy.'; end if;
  return new;
end $fn$;
revoke all on function public.person_reviews_check_org() from public, anon, authenticated;
drop trigger if exists person_reviews_same_org on public.person_reviews;
create trigger person_reviews_same_org before insert or update of person_id, org_id on public.person_reviews for each row execute function public.person_reviews_check_org();
drop trigger if exists person_reviews_lock_org on public.person_reviews;
create trigger person_reviews_lock_org before update on public.person_reviews for each row execute function public.forbid_key_change();

alter table public.person_reviews enable row level security;
revoke all on public.person_reviews from anon;
grant select, insert, update, delete on public.person_reviews to authenticated;
drop policy if exists person_reviews_select on public.person_reviews;
create policy person_reviews_select on public.person_reviews for select to authenticated using (public.is_member(org_id));
drop policy if exists person_reviews_insert on public.person_reviews;
create policy person_reviews_insert on public.person_reviews for insert to authenticated with check (public.has_role(org_id, array['owner','recruiter']));
drop policy if exists person_reviews_update on public.person_reviews;
create policy person_reviews_update on public.person_reviews for update to authenticated using (public.is_member(org_id)) with check (public.has_role(org_id, array['owner','recruiter']));
drop policy if exists person_reviews_delete on public.person_reviews;
create policy person_reviews_delete on public.person_reviews for delete to authenticated using (public.has_role(org_id, array['owner','recruiter']));
