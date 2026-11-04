# Tekma — bezpieczeństwo bazy Supabase (schemat 1.1)

Krótki przewodnik: co pilnuje sam schemat (`site/app/db/schema.sql`), co właściciel projektu musi
ustawić ręcznie w panelu Supabase i jak wygląda zgodność z RODO. Stan na schemat w wersji 1.1.

## A. Co jest zabezpieczone w schemacie

| Obszar | Mechanizm w `schema.sql` |
|---|---|
| Niezalogowani (klucz `anon`) | Brak jakichkolwiek grantów i polityk dla roli `anon`; funkcje (`is_member`, `has_role`, `create_org`) mają jawne `revoke … from anon`. Anon nie przeczyta i nie wywoła niczego. |
| Izolacja firm | RLS na każdej z 7 tabel; każdy wiersz ma `org_id`, odczyt tylko przez `is_member(org_id)`. `org_id` jest niezmienne po utworzeniu (trigger `*_lock_org`). |
| Klucze obce między firmami | Triggery `*_same_org`: `candidates.position_id`, `positions.rubric_id`, `scorecards.candidate_id`, `scorecards.rubric_id` muszą należeć do tej samej firmy co wiersz. Nie da się podpiąć kandydata pod cudze stanowisko. |
| Role | `has_role(org, roles[])`. **owner / recruiter**: pełny zapis stanowisk, kandydatów, rubryk, kasowanie kart oceny. **interviewer**: tylko odczyt tych tabel oraz zapis kart oceny (własne oceny). Polityki UPDATE mają `using = członek`, `with check = owner/recruiter`, dzięki czemu rozmówca dostaje czytelny błąd 42501 zamiast pustej odpowiedzi. |
| Karty oceny | Trigger `scorecards_guard`: `decision` ustawia tylko owner/recruiter; każdy wpis w `ratings` ma `question_id`, `rater_id`, `score` 1–5; nie-owner może dodać wyłącznie wpisy z własnym `rater_id`, cudze wpisy są zachowywane z poprzedniej wersji wiersza (aplikacja zapisuje całą tablicę — nieaktualny stan w przeglądarce nie skasuje cudzej oceny), a próba podmiany cudzego wpisu kończy się błędem. Owner może wszystko (potrzebne dla danych przykładowych z fikcyjnymi rozmówcami). |
| Firma i członkowie | `organizations`: zapis tylko kolumny `name` (grant kolumnowy), insert wyłącznie przez `create_org`, brak delete z API. `members`: dodaje i zmienia role tylko owner; nie można usunąć ani zdegradować ostatniego ownera (trigger `members_last_owner`); `org_id`/`user_id` członkostwa niezmienne. |
| Nadużycia | `create_org`: maks. 5 firm na konto. Limity długości: `email` ≤ 254, `source` ≤ 120, `description` ≤ 20 000, `reject_reason` ≤ 1000, `department`/`location` ≤ 160, `stage` 1–120, `full_name` profilu ≤ 160. Rozmiar jsonb: `stages` ≤ 16 KB (tablica 1–12 napisów), `questions`/`ratings`/`ai` ≤ 256 KB; `ratings` tablica, `ai` obiekt. |
| Funkcje | Wszystkie z `set search_path = public, pg_temp`; `security definer` tylko tam, gdzie potrzeba (`is_member`, `has_role`, `create_org`, `handle_new_user`, `protect_last_owner`, `scorecards_guard`). Funkcje triggerów nie są wywoływalne z API. |

Rozbieżność z interfejsem: widok karty oceny (`views/scorecard.js`) pokazuje przyciski decyzji
Tak/Może/Nie każdemu członkowi. Dla rozmówcy zapis decyzji kończy się komunikatem
„Tylko właściciel lub rekruter może zatwierdzić decyzję po etapie” (bezpieczna opcja — baza decyduje).
Do zrobienia w UI: ukryć decyzję i przyciski „Nowe stanowisko / Dodaj kandydata / Nowa rubryka” dla roli
`interviewer` (`ctx.org.role`).

### Jak to zweryfikować w Supabase
1. **Table Editor** → każda tabela (`organizations`, `members`, `profiles`, `positions`, `candidates`,
   `rubrics`, `scorecards`) ma znacznik „RLS enabled”. Kliknij „Policies” — powinny być polityki
   `*_select/insert/update/delete` tylko dla roli `authenticated`.
2. **Advisors → Security Advisor** → brak ostrzeżeń typu „RLS disabled”, „Function search_path mutable”,
   „Security definer view”. Ostrzeżenie „Leaked password protection disabled” rozwiązujesz w punkcie B.
3. **SQL Editor**, szybki test: `select count(*) from public.positions;` uruchomione w panelu działa
   (rola postgres), ale wywołanie `GET /rest/v1/positions` z samym kluczem anon (bez Bearer użytkownika)
   zwraca `permission denied` / 401.
4. Pełny zestaw testów ról i izolacji (147 przypadków) odtwarzasz lokalnie skryptem z katalogu
   roboczego agenta (`db-sec/run.sh`): atrapa Supabase na Postgres 16 + `schema.sql` ×2 + testy.

## B. Ustawienia do wykonania ręcznie w panelu Supabase (właściciel projektu)

**Authentication**
- **Authentication → URL Configuration**: Site URL `https://tekma.app`; Redirect URLs: dokładnie
  `https://tekma.app/app/` (bez `*`, bez `http://`, bez localhost w produkcji). Link resetu hasła
  z aplikacji używa `location.origin + location.pathname`, czyli `https://tekma.app/app/`.
- **Authentication → Providers → Email**: „Confirm email” **włączone** przed produkcją (na czas testów
  może być wyłączone — patrz nagłówek `schema.sql`). Wyłącz providerów, których nie używasz
  (Phone, Google, GitHub itd.). „Secure email change” włączone.
- **Authentication → Settings (Auth / Password)**: minimalna długość hasła **≥ 10**, wymagania
  „Letters, digits and symbols”; włącz „Leaked password protection” (HaveIBeenPwned). Uwaga: aplikacja
  waliduje lokalnie ≥ 8 znaków — serwer odrzuci krótsze, komunikat mapuje się na „Hasło musi mieć…”.
- **Authentication → Attack Protection / Bot and Abuse Protection**: włącz CAPTCHA (Cloudflare Turnstile
  albo hCaptcha). Uwaga: po włączeniu formularze `#/signup`, `#/login`, `#/reset` muszą wysyłać token
  CAPTCHA (`gotrue_meta_security.captcha_token`) — dziś adapter tego nie robi, to zmiana w `views/auth.js`
  i `supabase.js` przed włączeniem.
- **Authentication → Rate Limits**: ogranicz signup/signin/token (np. 30 / godz. z jednego IP), e-mail
  OTP/recovery (np. 2–4 na godzinę na adres), „Anonymous sign-ins” wyłączone.
- **Authentication → SMTP Settings (Custom SMTP)**: własny SMTP (np. Postmark/Resend) z domeny tekma.app;
  wbudowany SMTP Supabase ma limit kilku maili na godzinę i nie nadaje się na produkcję.
- **Organization → Team / Account → Security**: MFA dla konta właściciela projektu Supabase
  (i dla każdego członka zespołu z dostępem do panelu).

**Database / API**
- **Project Settings → Database → SSL enforcement**: „Enforce SSL on incoming connections” włączone.
- **Project Settings → Database → Network Restrictions** (plan Pro+): ogranicz bezpośrednie połączenia
  z bazą do adresów IP zespołu; aplikacja łączy się tylko przez API, więc możesz zablokować resztę.
- **Project Settings → Database → Backups**: Free = brak codziennych kopii, Pro = kopie dzienne
  (7 dni), PITR (Point-in-Time Recovery) jako dodatek od planu Pro — zalecany przed przyjęciem danych
  prawdziwych kandydatów.
- **Project Settings → API (Data API)**: „Exposed schemas” = tylko `public` (usuń `graphql_public`,
  jeśli nie używasz; nigdy `auth`/`storage` bez potrzeby). „Max rows” np. 1000. Sprawdź listę tabel —
  żadna w `public` nie może być bez RLS (Security Advisor to pokaże).
- **Klucze**: w przeglądarce i w repozytorium używaj **wyłącznie** klucza `anon` (`js/config.js`).
  Klucz `service_role` omija RLS — nigdy w froncie, nigdy w commitach, nigdy w logach. Rotacja:
  Project Settings → API → „Generate new JWT secret” (unieważnia wszystkie tokeny i oba klucze —
  potem zaktualizuj `config.js`). Rotuj po każdym podejrzeniu wycieku i przy odejściu osoby z dostępem.
- **Logs → API / Auth**: po wdrożeniu przejrzyj logi pod kątem błędów 401/403/42501 — to próby
  dostępu poza uprawnieniami albo błąd w aplikacji.

## C. Zgodność (RODO)

- **Lokalizacja danych**: projekt utwórz w regionie **EU (Frankfurt, eu-central-1)**. Regionu nie da
  się zmienić bez migracji projektu — sprawdź przed wgraniem danych.
- **Umowa powierzenia (DPA)**: Supabase udostępnia DPA do zaakceptowania w Organization → Legal
  Documents (dla planów płatnych; do pobrania z supabase.com/legal/dpa). Zaakceptuj przed przyjęciem
  danych kandydatów; dodaj Supabase Inc. do rejestru podprocesorów.
- **Dane kandydatów** (`candidates`: imię, e-mail, źródło, etap, wynik CV, powód odrzucenia;
  `scorecards`: oceny i cytaty). Podstawa: art. 6 ust. 1 lit. b/f RODO; informacja dla kandydata
  obowiązkiem firmy-użytkownika (Tekma jest procesorem).
- **Retencja**: dziś brak automatu. Zalecenie: usuwać kandydatów odrzuconych po 3–6 miesiącach, a
  zatrudnionych/pozostałych po zakończeniu rekrutacji (chyba że kandydat zgodził się na dłużej).
  Do zrobienia: kolumna `retention_until` + zadanie `pg_cron` albo ręczne zapytanie w SQL Editor.
- **Prawo do usunięcia (dziś ręcznie)**: właściciel projektu w SQL Editor:
  `delete from public.candidates where email = 'adres@kandydata';` — kaskadowo usuwa karty oceny.
  Usunięcie konta użytkownika aplikacji: Authentication → Users → „Delete user” (kaskada: `profiles`,
  `members`; firma zostaje — jeśli to był jedyny owner, firma zostaje bez właściciela; przypisz ownera
  wcześniej). Usunięcie całej firmy: `delete from public.organizations where id = '…';` (kaskada
  na wszystko). Z poziomu API aplikacji kasowanie firmy jest zablokowane celowo.
- **Zasada AI Act / produktu**: pole `ai` i `cv_score` to sugestie; decyzję (`decision`) i oceny
  zapisuje człowiek, a baza nie pozwala rozmówcy zatwierdzić decyzji ani zapisać cudzych ocen.

### Czego NIE ma w tej iteracji
- **Audit log** (kto i kiedy zmienił ocenę/decyzję): brak; `updated_at` to jedyny ślad.
- **Szyfrowanie na poziomie kolumn** (np. e-mail kandydata): brak — dane szyfrowane są tylko
  „w spoczynku” przez Supabase/AWS.
- **Zaproszenia z tokenami**: dziś owner dodaje członka wpisując `user_id` (osoba musi mieć już konto),
  brak e-maila z zaproszeniem i brak ekranu zarządzania członkami w aplikacji.
- **Automatyczna retencja** i eksport danych kandydata (prawo dostępu) — ręcznie przez SQL Editor.
- **CAPTCHA w formularzach aplikacji** — wymaga zmian w JS zanim włączysz ochronę w panelu.
