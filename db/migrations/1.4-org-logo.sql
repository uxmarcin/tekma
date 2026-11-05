-- 1.4 — logo firmy (avatar). Uruchom raz w Supabase → SQL Editor.
-- Logo trzymamy jako mały obraz PNG/WebP w postaci data-URL (aplikacja zmniejsza je do 256×256 px
-- po stronie przeglądarki, zwykle 5–60 KB), więc nie potrzeba osobnego Storage.
alter table public.organizations
  add column if not exists logo text
  check (logo is null or (logo like 'data:image/%' and length(logo) <= 300000));
comment on column public.organizations.logo is 'Logo firmy jako data-URL (PNG/WebP 256×256), max ~300 KB.';
-- właściciel może je zmieniać (RLS nadal ogranicza UPDATE do ról owner)
grant update (name, retention_months, logo) on public.organizations to authenticated;
