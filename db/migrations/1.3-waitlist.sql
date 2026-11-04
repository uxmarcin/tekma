-- ============================================================================
-- Tekma — migracja 1.3: lista oczekujących na wcześniejszy dostęp (formularz na stronie)
-- Anon może WYŁĄCZNIE dodawać wiersze (insert). Nie może ich czytać, zmieniać ani usuwać.
-- Idempotentna.
-- ============================================================================
create table if not exists public.waitlist (
  id            uuid primary key default gen_random_uuid(),
  email         text not null check (char_length(email) between 5 and 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  consent       boolean not null check (consent),
  consent_text  text not null check (char_length(consent_text) between 10 and 600),
  source        text check (source is null or char_length(source) <= 40),
  plan          text check (plan is null or char_length(plan) <= 20),
  created_at    timestamptz not null default now()
);
comment on table public.waitlist is 'Prośby o wcześniejszy dostęp ze strony. Zgoda na przetwarzanie e-maila + treść zgody. Odczyt tylko dla właściciela projektu (panel/SQL).';
create unique index if not exists waitlist_email_uq on public.waitlist (lower(email));

alter table public.waitlist enable row level security;
revoke all on public.waitlist from anon, authenticated;
grant insert (email, consent, consent_text, source, plan) on public.waitlist to anon;
drop policy if exists waitlist_insert on public.waitlist;
create policy waitlist_insert on public.waitlist for insert to anon with check (consent = true);
