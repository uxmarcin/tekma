# Audyt RLS i regionu danych — 2026-11-04

Zakres: db/schema.sql (v1.1), klucz w config.js, region projektu Supabase. Audyt statyczny (kod), bez dostępu do danych i bez service_role.

## Region
- Projekt Supabase: **West EU (Ireland)** — dane w UE. OK pod RODO (brak transferu poza EOG po stronie bazy).
- Do sprawdzenia: plan (Free/Pro) — na Free brak automatycznych kopii zapasowych (PITR/backupy dzienne zależą od planu). Przed pierwszym klientem: plan Pro + backupy + test odtworzenia.
- Dostęp do projektu: 1 członek organizacji (Owner). Włączyć MFA na koncie Supabase i GitHub; rozważyć drugą osobę/odzyskiwanie dostępu.

## Co jest dobrze
- RLS włączone na wszystkich 7 tabelach; anon ma revoke all na tabelach i funkcjach.
- Izolacja firm: wszystkie polityki przez is_member/has_role (org_id), org_id niezmienne (trigger), spójność referencji między firmami (check_same_org, działa z RLS wywołującego).
- Role: zapis stanowisk/kandydatów/rubryk tylko owner/recruiter; decyzja po etapie i cudze oceny chronione triggerem scorecards_guard; ochrona ostatniego ownera.
- Funkcje security definer mają search_path = public, pg_temp; funkcje triggerów nie są wywoływalne z API.
- organizations/profiles: grant kolumnowy (tylko name / full_name).
- W kliencie jest wyłącznie klucz anon (zweryfikowane: role=anon); brak service_role w repo.

## Ustalenia (od najważniejszych)
1. **Nowe tabele = domyślne granty dla anon/authenticated w Supabase.** Każda nowa tabela (people, goals, settings, marketplace…) musi w tej samej migracji mieć: enable RLS, revoke z anon, polityki. Dodać do repo skrypt kontrolny (zapytanie: tabele w public bez RLS lub z grantem dla anon) i uruchamiać przed każdym wdrożeniem.
2. **Publiczne składanie aplikacji kandydata (careers/apply)** — dziś brak polityk anon, więc w trybie Supabase nie zadziała. Docelowo wymaga Edge Function z walidacją, limitem żądań, ochroną antyspamową i skanowaniem plików CV. To największa przyszła powierzchnia ataku.
3. **Rola interviewer widzi wszystkich kandydatów i ich e-maile** oraz wszystkie scorecards firmy, także cudze oceny przed własną (utrata ślepej oceny). Zasada najmniejszych uprawnień: przypisanie rozmówców do kandydatów/etapów i ukrycie cudzych ocen do czasu złożenia własnej. Klienci korporacyjni o to zapytają.
4. **Pole scorecards.ai może zapisać każdy członek** (łącznie z interviewer) — sugestie AI mogą być sfałszowane. Zapis ai tylko z backendu (Edge Function) / blokada w scorecards_guard.
5. **Brak ścieżki usunięcia firmy i konta z API** (prawo do usunięcia, koniec umowy). Potrzebna procedura/funkcja admin: usunięcie organizacji i danych kandydatów + eksport.
6. **Brak retencji** — dane kandydatów przechowywane bezterminowo. Dodać pole retention i zadanie czyszczące (np. 6/12 miesięcy po zamknięciu rekrutacji, wg ustawień klienta).
7. **Brak audit logu** (kto, co, kiedy: odczyt/zmiana/usunięcie danych kandydatów) — standardowe wymaganie dużych firm.
8. scorecards.stage nie jest walidowane względem positions.stages (integralność, nie bezpieczeństwo).
9. Limit 5 firm/konto i potwierdzenie e-mail ograniczają nadużycia; brak limitu żądań na poziomie API poza ustawieniami Supabase Auth — rozważyć limity i CAPTCHA przy rejestracji/aplikowaniu.

## Dalsze kroki
- [ ] Skrypt kontrolny RLS (CI/ręczny)
- [ ] Migracja: widoczność interviewer, blokada zapisu ai, retention, audit log
- [ ] Plan Pro + backupy + test odtworzenia, MFA na kontach
- [ ] Edge Function dla publicznej aplikacji kandydata
- [ ] Test penetracyjny RLS na kopii (dwie firmy, próby odczytu między nimi)
