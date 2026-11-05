-- ============================================================================
-- Tekma — migracja 1.6: moduł opinii (zgłoszenia pomysłów, błędów, pytań i pochwał z aplikacji).
-- Idempotentna. Użytkownik dodaje opinie i widzi swoje; właściciel firmy widzi opinie całej firmy.
-- Status zgłoszenia (new/seen/planned/done) zmienia twórca produktu w panelu Supabase.
-- ============================================================================
create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('idea','bug','question','praise')),
  rating      int  null check (rating is null or rating between 1 and 5),
  message     text not null check (char_length(message) between 3 and 4000),
  page        text not null default '' check (char_length(page) <= 300),
  app_version text not null default '' check (char_length(app_version) <= 40),
  user_agent  text not null default '' check (char_length(user_agent) <= 300),
  status      text not null default 'new' check (status in ('new','seen','planned','done')),
  created_at  timestamptz not null default now()
);
comment on table public.feedback is 'Opinie użytkowników z aplikacji. status zmieniany ręcznie przez twórcę produktu.';
create index if not exists feedback_org_idx on public.feedback(org_id, created_at desc);
create index if not exists feedback_status_idx on public.feedback(status, created_at desc);

alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;
grant select on public.feedback to authenticated;
grant insert (org_id, user_id, kind, rating, message, page, app_version, user_agent) on public.feedback to authenticated;

drop policy if exists feedback_select on public.feedback;
create policy feedback_select on public.feedback for select to authenticated
  using (user_id = auth.uid() or public.has_role(org_id, array['owner']));
drop policy if exists feedback_insert on public.feedback;
create policy feedback_insert on public.feedback for insert to authenticated
  with check (user_id = auth.uid() and public.is_member(org_id));
