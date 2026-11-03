# Tekma app — kontrakt architektury (wersja 1)

Aplikacja to statyczny SPA bez builda, serwowany z `site/app/` (URL: `https://tekma.app/app/`). Natywne moduły ES (`<script type="module">`), zero zależności npm, zero bibliotek zewnętrznych. Router po hashu: `#/…`. Język interfejsu: polski. Podgląd lokalny: `cd site && python3 -m http.server 8777` → `http://localhost:8777/app/`.

## Układ plików (właściciel w nawiasie)
```
site/app/index.html            (A) shell: <div id="root">, ładuje js/main.js, app.css, fonty z ../assets/fonts
site/app/app.css               (A) tokeny, układ, komponenty bazowe
site/app/js/config.js          (A) export const SUPABASE_URL = '', SUPABASE_ANON_KEY = ''  (puste = tryb demo)
site/app/js/main.js            (A) start: sesja → router
site/app/js/router.js          (A) tabela tras, nawigacja, ładowanie widoków dynamic import()
site/app/js/store.js           (A) fasada danych + adaptery: supabase.js, local.js
site/app/js/supabase.js        (A) adapter REST (fetch) do Supabase Auth + PostgREST, bez SDK
site/app/js/local.js           (A) adapter demo w localStorage (klucz tekma.demo.v1)
site/app/js/seed.js            (A) dane przykładowe (firma Nordlight Labs, stanowiska, kandydaci, rubryka)
site/app/js/ai.js              (A) atrapa AI: deterministyczne sugestie ocen z cytatem (bez sieci)
site/app/js/ui.js              (A) h(), icon(), komponenty, toast, modal, loadCss
site/app/js/views/auth.js      (A) logowanie, rejestracja, reset hasła
site/app/js/views/onboarding.js(A) tworzenie firmy + pierwszy krok
site/app/js/views/dashboard.js (B) pulpit
site/app/js/views/positions.js (B) lista stanowisk + okno „Nowe stanowisko”
site/app/js/views/pipeline.js  (C) lejek (kanban) jednego stanowiska
site/app/js/views/candidates.js(C) baza kandydatów + dodawanie kandydata
site/app/js/views/scorecard.js (D) karta oceny kandydata
site/app/js/views/rubrics.js   (D) lista rubryk i edytor rubryki
site/app/db/schema.sql         (A) tabele, RLS, funkcja create_org (do wklejenia w Supabase SQL Editor)
```
Każdy widok może mieć własny plik CSS `site/app/js/views/<nazwa>.css` ładowany przez `ui.loadCss(new URL('./nazwa.css', import.meta.url))`.

## Trasy (router.js)
| hash | widok | układ |
|---|---|---|
| `#/login`, `#/signup`, `#/reset` | auth | bare |
| `#/onboarding` | onboarding | bare |
| `#/` | dashboard | shell |
| `#/positions` | positions | shell |
| `#/positions/:id` | pipeline | shell |
| `#/candidates` | candidates | shell |
| `#/candidates/:id` | scorecard (opcjonalnie `?stage=`) | shell |
| `#/rubrics`, `#/rubrics/:id` | rubrics | shell |
Strażnik: brak sesji → `#/login`; sesja bez firmy → `#/onboarding`. Layout „shell” = pasek boczny (Pulpit, Stanowiska, Rubryki, Kandydaci; grupa „Po zatrudnieniu” widoczna jako wyszarzone „Wkrótce”: Ludzie, Cele; „Administracja”: Ustawienia „Wkrótce”), nagłówek firmy, wyloguj, ⌘K nie jest wymagane.

## Sygnatura widoku
```js
// każdy plik views/*.js:
export default async function render(ctx) -> HTMLElement   // tylko treść główna
// ctx = { params, query, store, ui, ai, navigate(hash), user, org, refreshShell() }
```
Widok zwraca element; router wstawia go do `<main>`. Błąd w widoku nie może wywrócić aplikacji: router łapie i pokazuje stan błędu z przyciskiem „Spróbuj ponownie”.

## Model danych (wszystko ma `org_id`, RLS po członkostwie)
- `organizations(id uuid pk, name text, created_at, created_by uuid)`
- `members(org_id, user_id, role text check in ('owner','recruiter','interviewer'), primary key(org_id,user_id))`, `profiles(user_id pk, full_name text)`
- `positions(id, org_id, title, department, location, status text check in ('open','closed') default 'open', stages jsonb default '["Screening CV","Rozmowa wstępna","Rozmowa techniczna","Rozmowa z CEO","Oferta"]', rubric_id uuid null, description text, created_at)`
- `candidates(id, org_id, position_id, full_name, email, source text, stage text, cv_score int null, status text check in ('active','rejected','hired') default 'active', reject_reason text null, applied_at timestamptz default now())`
- `rubrics(id, org_id, name, version int default 1, questions jsonb, updated_at)` gdzie `questions = [{id, text, competency, weight (1|2|3), minutes, anchors:{"1":"…","2":"…","3":"…","4":"…","5":"…"}}]`
- `scorecards(id, org_id, candidate_id, stage text, rubric_id, ratings jsonb default '[]', ai jsonb default '{}', decision text null check in ('yes','maybe','no'), updated_at, unique(candidate_id, stage))` gdzie `ratings=[{question_id, rater_id, rater_name, score(1-5)}]`, `ai={question_id:{score, quote, reason}}`
Zasada produktu (UWAGA, wymóg AI Act): AI tylko sugeruje; ocenę i decyzję zawsze zatwierdza człowiek; wszędzie widać, co jest sugestią AI, a co decyzją człowieka; AI nigdy nie odrzuca ani nie przesuwa kandydata samo.

## API `store` (wszystkie metody async; błąd = rzucony Error z polskim, konkretnym komunikatem)
```
store.mode                       // 'supabase' | 'demo'
store.auth.session()             -> {user:{id,email,name}} | null
store.auth.signUp({email,password,name}) -> {session|null, needsConfirmation:boolean}
store.auth.signIn({email,password}) -> session
store.auth.signOut()
store.auth.resetPassword(email)
store.auth.onChange(cb)
store.org.current()              -> {id,name,role} | null
store.org.create({name})         -> org   (twórca zostaje owner)
store.org.loadDemoData()         -> wstawia dane z seed.js do bieżącej firmy
store.positions.list() / .get(id) / .create({title,department,location,stages?,rubric_id?,description?}) / .update(id,patch)
store.candidates.list({position_id?}) / .get(id) / .create({position_id,full_name,email,source,cv_score?}) / .move(id,stage) / .reject(id,reason) / .update(id,patch)
store.rubrics.list() / .get(id) / .create({name,questions}) / .update(id,patch)    // update zwiększa version przy zmianie pytań
store.scorecards.get(candidate_id,stage)  -> scorecard (tworzy pusty, jeśli brak)
store.scorecards.save(scorecard)
store.stats.dashboard()           -> {openPositions, activeCandidates, interviewsThisWeek:null, attention:[…]}
```
`ai.js`: `ai.suggest({candidate, rubric, stage}) -> {questionId:{score,quote,reason}}` oraz `ai.cvScore(candidate, position) -> 0..100` (deterministycznie z hasha, bez sieci). Wszystkie teksty AI po polsku, z cytatem.

## ui.js (A) — API
`h(tag, attrs, ...children)` (attrs: class, on{click}, aria-*, dataset; children: string|Node|array), `icon(name, size=16)` (SVG obrysowe 24×24, stroke 1.6, round), `button({label, variant:'primary'|'secondary'|'ghost'|'danger', size:'sm'|'md', icon?, onClick, disabled})`, `field({label, name, type, value, error, hint, required, autocomplete})`, `avatar(name)`, `tag(text, tone:'neutral'|'good'|'warn'|'bad'|'info'|'blue')`, `toast(message, tone)`, `modal({title, body, actions})` zwraca `{close}`, `confirm(...)`, `emptyState({title, text, action})`, `loadCss(url)`, `formatDate(iso)`, `fmtScore(n)` (przecinek dziesiętny), `skeleton()`.

## Design (jasny interfejs aplikacji, spójny z marketingowym)
Tokeny (jasny): tło `#fff`, powierzchnia-2 `#f5f5f5`, powierzchnia-3 `#ededed`, linia `#ebebeb`, tekst `#111`, treść `#3b3b3b`, wyciszony `#6b6b6b`, akcent = czerń `#111` (przycisk główny: tło #111, tekst #fff, hover #2b2b2b; zaznaczenia i stany aktywne też czarne), status: good `#16a34a`/ink `#15803d`, warn `#ea6a0c`/ink `#c2410c`, bad `#e11d48`/ink `#be123c`, info `#7c3aed`/ink `#6d28d9`. Fonty: Inter (treść) i Inter Display (nagłówki) z `../assets/fonts`. Promienie: 8 (pola, przyciski), 12 (karty), 16 (okna). Marka CZARNO-BIAŁA (jak ChatGPT): brak niebieskiego akcentu. Kolory statusowe tylko tam, gdzie niosą znaczenie.
ZASADA UŻYTKOWNIKA: karty, pakiety i panele BEZ obramowań. Rozróżniaj tłem (`#f5f5f5` na `#fff`), cieniem i światłem. Cienkie linie-separatory między wierszami są dozwolone. Pola formularzy: wypełnione tło `#f5f5f5` bez ramki, fokus = niebieski outline 2px. Przyciski drugorzędne: tło `#f5f5f5`.
Słownik: stanowisko, rubryka, kotwica (opis oceny), karta oceny, rozmówca, etap/lejek, sugestia AI, dopasowanie CV, rozbieżność, baza kandydatów, notetaker, coach AI. Ton: zdania krótkie, czasowniki czynne, sentence case, bez wykrzykników, bez przepraszania; błędy mówią, co poszło nie tak i co zrobić. Przyciski nazywają akcję („Dodaj stanowisko”, „Zapisz zmiany”).
Jakość: responsywność od 360 px (pasek boczny zamienia się na dolny pasek zakładek poniżej 900 px), widoczny fokus, role i aria, kontrast AA, prefers-reduced-motion, brak przewijania poziomego strony. Animacje tylko tam, gdzie odpowiadają na działanie użytkownika.
