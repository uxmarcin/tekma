/**
 * views/rekrutacja-data.js — dane demo agenta B (poza schematem bazy), zapis w localStorage `tekma.demo.rekrutacja`.
 *
 * Co tu jest:
 *   - meta stanowiska (nie ma kolumn w bazie): wstrzymanie, forma, widełki, cel na 6 mies., kryteria, rubryki etapów,
 *     zasady przejścia, kanały publikacji, treść ogłoszenia, zespół rozmówców, rekruter, właściciel.
 *     Domyślne wartości (z ramek Figmy) dobierane po tytule stanowiska z seed.js; zmiany użytkownika nadpisują je per id.
 *   - pochodzenie rubryki (z szablonu / własna),
 *   - szkic kreatora „Nowe stanowisko” (krok 1 → 2),
 *   - biblioteka szablonów (procesy z etapami i pytaniami rubryk),
 *   - zespół firmy (rozmówcy) i treści strony kariery / portalu kandydata.
 *
 * API:
 *   getPositionMeta(position) -> meta (domyślne ⊕ zapisane)      setPositionMeta(id, patch)
 *   getRubricOrigin(rubric) -> 'Własna' | 'Z szablonu „…”'        setRubricOrigin(id, templateName)
 *   getDraft() / setDraft(patch) / clearDraft()
 *   TEMPLATES, TEMPLATE_TABS, templateSummary(t)
 *   TEAM (rozmówcy demo), CAREERS (treści), PORTAL (kandydat demo)
 */

export const STORAGE_KEY = 'tekma.demo.rekrutacja';

function load() {
  try { return { positions: {}, rubrics: {}, draft: null, ...(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}) }; }
  catch { return { positions: {}, rubrics: {}, draft: null }; }
}
function save(db) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch { /* localStorage zablokowany — dane tylko w pamięci */ }
}

/* ------------------------------------------------------------------ zespół (rozmówcy) */
export const TEAM = [
  { id: 'anna', name: 'Anna Kowalczyk', role: 'CTO · właścicielka', stages: ['Rozmowa techniczna', 'Rozmowa z CEO'], stagesLabel: 'Techniczna, CEO', ratings: 14, delta: 0.1 },
  { id: 'tomasz', name: 'Tomasz Wiśniewski', role: 'Staff Engineer', stages: ['Rozmowa techniczna'], stagesLabel: 'Techniczna', ratings: 11, delta: 0.6 },
  { id: 'ola', name: 'Aleksandra Nowak', role: 'People Ops', stages: ['Rozmowa wstępna'], stagesLabel: 'Wstępna', ratings: 19, delta: -0.1 },
  { id: 'piotr', name: 'Piotr Zieliński', role: 'CEO', stages: ['Rozmowa z CEO'], stagesLabel: 'Rozmowa z CEO', ratings: 4, delta: 0 },
];
export const RECRUITER = { name: 'Joanna Nowak', agency: 'Tech Recruiting', candidates: 6, toStage: '2 do etapu techn.', model: '4 000 zł / mies. + 8 000 zł za zatrudnienie', period: '12 paź – 11 lis · odnowienie ręczne', access: 'Tylko to stanowisko' };

/* ------------------------------------------------------------------ meta stanowisk (domyślne wg tytułu z seed.js) */
const AD_BACKEND = {
  title: 'Senior Backend Engineer',
  intro: 'Budujemy platformę, która codziennie przetwarza 2 mln prognoz dla operatorów sieci w Europie. Szukamy osoby, która przejmie warstwę danych i pomoże nam przejść z jednego regionu na pięć.',
  bullets: ['Projektować i rozwijać usługi w Go i PostgreSQL', 'Skalować kolejki zadań i potoki danych', 'Dbać o niezawodność (on-call co 6 tygodni)', 'Mentorować dwie osoby w zespole'],
  process: ['Screening CV', 'Rozmowa wstępna · 30 min', 'Rozmowa techniczna · 45 min', 'Rozmowa z CEO · 45 min'],
  outro: 'Odpowiadamy każdemu w ciągu 10 dni. Status sprawdzisz w portalu kandydata.',
};
const CHANNELS_DEFAULT = [
  { key: 'careers', name: 'Strona kariery Nordlight', sub: 'nordlight.tekma.app/kariera', on: true },
  { key: 'linkedin', name: 'LinkedIn', sub: 'Ogłoszenie + przycisk „Aplikuj”', on: true },
  { key: 'justjoin', name: 'JustJoin.it', sub: 'Płatne ogłoszenie', on: false },
  { key: 'pracuj', name: 'Pracuj.pl', sub: 'Płatne ogłoszenie', on: false },
  { key: 'nofluff', name: 'No Fluff Jobs', sub: 'Płatne ogłoszenie', on: false },
];
const RULES_DEFAULT = [
  { key: 'min2', title: 'Nikt nie przechodzi po jednej rozmowie', sub: 'Wymagane min. 2 oceny przed decyzją', on: true },
  { key: 'flag', title: 'Flaga przy rozbieżności', sub: 'Gdy oceny różnią się o 2+ pkt', on: true },
  { key: 'ai', title: 'AI nie odrzuca automatycznie', sub: 'Zawsze włączone (AI Act)', on: true, locked: true },
  { key: 'remind', title: 'Przypomnienie po 5 dniach bez ruchu', sub: 'Do właściciela stanowiska', on: false },
];

const POSITION_DEFAULTS = {
  'Senior Backend Engineer': {
    form: 'B2B', salary: '22–28 tys. zł B2B', slug: 'senior-backend',
    goal: 'Przejąć warstwę danych i przeprowadzić platformę z jednego regionu na pięć.',
    criteria: ['Projektowanie systemów', 'Go i PostgreSQL', 'Niezawodność', 'Mentoring', 'Komunikacja'],
    ad: AD_BACKEND,
    team: ['anna', 'tomasz', 'ola', 'piotr'], recruiter: true, owner: 'anna',
  },
  'Product Designer': {
    form: 'B2B lub UoP', salary: '16–20 tys. zł B2B', slug: 'product-designer',
    goal: 'Przeprojektować onboarding klienta i zbudować system designu od zera.',
    criteria: ['Projektowanie interakcji', 'Badania z użytkownikami', 'Systemy designu', 'Komunikacja z inżynierią', 'Samodzielność'],
    team: ['anna', 'ola', 'piotr'], owner: 'anna',
  },
  'Founding Account Executive': {
    form: 'B2B', salary: '75–90 tys. € + prowizja', slug: 'founding-ae',
    goal: 'Zbudować pipeline od zera i domknąć pierwszych 10 klientów w segmencie 50–500 osób.',
    criteria: ['Discovery', 'Odporność', 'Pipeline od zera', 'Negocjacje'],
    team: ['piotr', 'ola'], owner: 'piotr',
  },
  'Data Analyst': {
    paused: true, form: 'UoP', salary: '12–15 tys. zł brutto', slug: 'data-analyst',
    goal: 'Dać produktowi i sprzedaży jedno źródło prawdy o użyciu.',
    criteria: ['SQL', 'dbt', 'Komunikacja wyników'],
    team: ['anna', 'ola'], owner: 'anna',
  },
};

function slugify(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function defaultAd(position) {
  const d = POSITION_DEFAULTS[position.title];
  if (d && d.ad) return d.ad;
  const stages = Array.isArray(position.stages) ? position.stages : [];
  return {
    title: position.title,
    intro: position.description || `Szukamy osoby na stanowisko ${position.title}${position.department ? ' w zespole ' + position.department : ''}.`,
    bullets: ['Opisz 3–4 zadania, które zajmą tej osobie większość czasu.', 'Powiedz, z kim będzie pracować.', 'Nazwij sukces po 6 miesiącach.'],
    process: stages.map((s, i) => (i === 0 ? s : `${s} · 45 min`)),
    outro: 'Odpowiadamy każdemu w ciągu 10 dni. Status sprawdzisz w portalu kandydata.',
  };
}

export function getPositionMeta(position) {
  if (!position) return {};
  const db = load();
  const d = POSITION_DEFAULTS[position.title] || {};
  const saved = db.positions[position.id] || {};
  return {
    paused: false, form: '', salary: '', goal: position.description || '', criteria: [],
    slug: slugify(position.title), team: ['anna', 'ola'], owner: 'anna', recruiter: false,
    stageRubrics: {}, stagePeople: {},
    ...d, ad: saved.ad || d.ad || defaultAd(position),
    channels: CHANNELS_DEFAULT.map((c) => ({ ...c })), rules: RULES_DEFAULT.map((r) => ({ ...r })),
    ...saved,
  };
}
export function setPositionMeta(id, patch) {
  const db = load();
  db.positions[id] = { ...(db.positions[id] || {}), ...patch };
  save(db);
  return db.positions[id];
}

/* ------------------------------------------------------------------ pochodzenie rubryk */
const RUBRIC_ORIGIN_DEFAULTS = {
  'Backend — rozmowa techniczna': 'Pierwszy inżynier',
  'Product Designer — przegląd portfolio': 'Product Designer',
  'Sprzedaż — rozmowa wstępna': 'Pierwszy handlowiec',
};
export function getRubricOrigin(rubric) {
  const db = load();
  const saved = db.rubrics[rubric.id];
  const t = (saved && saved.origin) || RUBRIC_ORIGIN_DEFAULTS[rubric.name];
  return t ? `Z szablonu „${t}”` : 'Własna';
}
export function setRubricOrigin(id, templateName) {
  const db = load();
  db.rubrics[id] = { ...(db.rubrics[id] || {}), origin: templateName || null };
  save(db);
}

/* ------------------------------------------------------------------ szkic kreatora */
export function getDraft() { return load().draft || null; }
export function setDraft(patch) { const db = load(); db.draft = { ...(db.draft || {}), ...patch }; save(db); return db.draft; }
export function clearDraft() { const db = load(); db.draft = null; save(db); }

/* ------------------------------------------------------------------ biblioteka szablonów */
const q = (text, competency, weight, minutes, a) => ({ text, competency, weight, minutes, anchors: { 1: a[0], 2: a[1], 3: a[2], 4: a[3], 5: a[4] } });

export const TEMPLATE_TABS = [
  { key: 'all', label: 'Wszystkie' },
  { key: 'eng', label: 'Inżynieria' },
  { key: 'product', label: 'Produkt i design' },
  { key: 'sales', label: 'Sprzedaż' },
  { key: 'ops', label: 'Operacje' },
  { key: 'after', label: 'Po zatrudnieniu' },
];

export const TEMPLATES = [
  {
    key: 'first-engineer', name: 'Pierwszy inżynier', category: 'eng', badge: 'Inżynieria', rubricName: 'Backend — rozmowa techniczna',
    stages: ['Screening CV', 'Rozmowa wstępna', 'Rozmowa techniczna', 'Rozmowa z CEO'],
    questions: [
      q('Opowiedz o systemie, który projektowałeś lub projektowałaś pod rosnące obciążenie. Co było wąskim gardłem?', 'Projektowanie systemów', 3, 15, ['Mówi ogólnikami, nie potrafi wskazać własnej decyzji ani wyniku.', 'Opisuje system, ale nie wyjaśnia, co pękło i dlaczego.', 'Wskazuje wąskie gardło i rozwiązanie, bez liczb przed i po.', 'Konkretna decyzja, kompromisy i mierzalny efekt (np. p95).', 'Jak 4, plus wnioski na przyszłość i sposób sprawdzenia efektu.']),
      q('Jak debugujesz problem, którego nie da się odtworzyć lokalnie?', 'Rozwiązywanie problemów', 2, 8, ['Zgaduje i restartuje.', 'Wymienia narzędzia bez kolejności.', 'Stawia hipotezy i sprawdza je po kolei.', 'Zawęża obszar pomiarami, dodaje zabezpieczenie.', 'Izoluje zmienne, odtwarza, naprawia przyczynę i dodaje alert.']),
      q('Opisz decyzję techniczną, która budziła Twój sprzeciw. Co zrobiłeś lub zrobiłaś?', 'Współpraca', 2, 8, ['Unika konfliktu albo narzuca zdanie.', 'Zgłasza sprzeciw bez argumentów.', 'Argumentuje, akceptuje decyzję zespołu.', 'Proponuje eksperyment lub kompromis.', 'Zamienia spór w decyzję opartą na dowodach.']),
      q('Jak dbasz o jakość kodu w małym zespole?', 'Jakość', 1, 7, ['Jakość to sprawa QA.', 'Testy sporadycznie.', 'Testuje kluczowe ścieżki, robi review.', 'Wprowadza praktyki i mierzy wpływ.', 'Buduje kulturę jakości w zespole.']),
      q('Jak wyglądał Twój najgorszy incydent produkcyjny i co się po nim zmieniło?', 'Niezawodność', 2, 8, ['Nie pamięta albo obwinia innych.', 'Opisuje incydent bez wniosków.', 'Nazywa przyczynę i jedną zmianę.', 'Post-mortem bez obwiniania, zmiany w procesie.', 'Systemowe zmiany, które zapobiegły kolejnym incydentom.']),
      q('Zaprojektuj na tablicy kolejkę zadań odporną na duplikaty.', 'Projektowanie systemów', 3, 15, ['Nie zna problemu idempotencji.', 'Zna pojęcie, nie umie go zastosować.', 'Projektuje klucz idempotencji i retry.', 'Rozważa at-least-once vs exactly-once i koszty.', 'Pokazuje kompromisy, monitoring i ścieżkę migracji.']),
      q('Jak rozkładasz dużą zmianę na bezpieczne wdrożenia?', 'Dostarczanie', 2, 6, ['Wdraża wszystko naraz.', 'Dzieli, ale bez planu wycofania.', 'Feature flagi i małe PR-y.', 'Plan migracji z kompatybilnością wstecz.', 'Strategia wdrożeń z metrykami i rollbackiem.']),
      q('Czego nauczyłeś lub nauczyłaś się od juniora, którego mentorowałeś lub mentorowałaś?', 'Mentoring', 1, 5, ['Nigdy nie mentorował.', 'Mentoring to code review.', 'Regularne 1:1, konkretne cele.', 'Dopasowuje styl do osoby, mierzy postęp.', 'Osoba mentorowana została samodzielna, podaje dowody.']),
      q('Jak decydujesz, że czas przepisać fragment systemu zamiast go łatać?', 'Decyzje techniczne', 2, 6, ['Przepisuje, bo nowe jest lepsze.', 'Czuje, że czas, bez danych.', 'Liczy koszt utrzymania vs przepisania.', 'Analiza ryzyka i plan etapowy.', 'Decyzja z danymi, komunikacją do biznesu i kryteriami sukcesu.']),
      q('Jak zabezpieczasz API przed nadużyciami?', 'Bezpieczeństwo', 1, 5, ['Nie myśli o tym.', 'Wymienia auth.', 'Auth, rate limiting, walidacja wejścia.', 'Zna model zagrożeń i logowanie.', 'Projektuje obronę warstwową i testuje ją.']),
      q('Opisz sytuację, w której zmieniłeś lub zmieniłaś zdanie pod wpływem danych.', 'Pokora intelektualna', 1, 5, ['Nie przychodzi mu nic do głowy.', 'Przykład błahy.', 'Konkretna sytuacja i zmiana decyzji.', 'Wyciąga metodę na przyszłość.', 'Buduje w zespole nawyk sprawdzania założeń.']),
      q('Co zrobiłbyś lub zrobiłabyś w pierwszych 30 dniach u nas?', 'Dopasowanie', 2, 6, ['Nie ma planu.', 'Ogólniki o poznawaniu kodu.', 'Plan: ludzie, system, pierwszy mały ship.', 'Plan z pytaniami o nasze cele.', 'Plan oparty na tym, co usłyszał w rozmowach, z metrykami.']),
    ],
  },
  {
    key: 'senior-frontend', name: 'Senior Frontend', category: 'eng', badge: 'Inżynieria', rubricName: 'Frontend — rozmowa techniczna',
    stages: ['Screening CV', 'Rozmowa wstępna', 'Zadanie techniczne', 'Rozmowa z zespołem'],
    questions: [
      q('Opowiedz o najtrudniejszym problemie z wydajnością interfejsu, jaki rozwiązałeś lub rozwiązałaś.', 'Wydajność', 3, 12, ['Nie mierzy wydajności.', 'Zna narzędzia, nie wyniki.', 'Mierzy, poprawia, podaje efekt.', 'Rozumie rendering i sieć, pokazuje liczby.', 'Systemowe podejście: budżety, monitoring, edukacja zespołu.']),
      q('Jak projektujesz komponent, który będzie używany w 20 miejscach?', 'Architektura UI', 3, 10, ['Kopiuje kod.', 'Robi komponent bez API.', 'Projektuje props i stany.', 'Myśli o dostępności, testach i wersjonowaniu.', 'Projektuje system z dokumentacją i ścieżką migracji.']),
      q('Jak dbasz o dostępność?', 'Dostępność', 2, 6, ['Nie wie, co to WCAG.', 'Alt na obrazkach.', 'Semantyka, fokus, kontrast.', 'Testuje czytnikiem ekranu.', 'Wbudowuje dostępność w proces zespołu.']),
      q('Jak testujesz frontend, żeby testy nie były kruche?', 'Jakość', 2, 6, ['Nie testuje.', 'Snapshoty wszystkiego.', 'Testy zachowań użytkownika.', 'Piramida testów z e2e na krytycznych ścieżkach.', 'Strategia testów z metrykami stabilności.']),
      q('Opisz współpracę z designerem przy trudnym projekcie.', 'Współpraca', 2, 6, ['Robi, co dostanie.', 'Narzeka na projekt.', 'Zgłasza problemy wcześnie.', 'Proponuje alternatywy z argumentami.', 'Wspólnie poprawia proces projektowania.']),
      q('Jak zarządzasz stanem w dużej aplikacji?', 'Architektura UI', 2, 8, ['Globalny stan na wszystko.', 'Zna bibliotekę, nie zasady.', 'Lokalny vs globalny, uzasadnia.', 'Rozdziela stan serwera i UI.', 'Dobiera narzędzia do problemu, pokazuje kompromisy.']),
      q('Jak podchodzisz do code review?', 'Jakość', 1, 5, ['Akceptuje bez czytania.', 'Czepia się stylu.', 'Skupia się na logice i ryzyku.', 'Daje kontekst i alternatywy.', 'Review jako narzędzie uczenia zespołu.']),
      q('Jak wdrażasz zmianę w systemie designu bez psucia produktu?', 'Systemy designu', 2, 6, ['Zmienia i patrzy, co się zepsuje.', 'Ostrzega zespół.', 'Wersjonuje i migruje etapami.', 'Testy wizualne i plan wycofania.', 'Proces zmian z komunikacją i metrykami adopcji.']),
      q('Opisz sytuację, gdy musiałeś lub musiałaś powiedzieć „nie” wymaganiu.', 'Komunikacja', 1, 5, ['Nigdy nie mówi „nie”.', 'Mówi „nie” bez uzasadnienia.', 'Tłumaczy koszt i proponuje alternatywę.', 'Negocjuje zakres z danymi.', 'Zmienia decyzję interesariusza argumentami i relacją.']),
      q('Jak dbasz o bezpieczeństwo po stronie klienta?', 'Bezpieczeństwo', 1, 4, ['Nie myśli o tym.', 'Zna XSS.', 'Sanityzacja, CSP, tokeny.', 'Zna model zagrożeń frontendu.', 'Projektuje i audytuje obronę.']),
      q('Czego chcesz się nauczyć w kolejnym roku?', 'Rozwój', 1, 4, ['Nie wie.', 'Ogólnie: „nowe technologie”.', 'Konkretny cel i powód.', 'Cel powiązany z naszym produktem.', 'Plan z krokami i miarą sukcesu.']),
    ],
  },
  {
    key: 'product-designer', name: 'Product Designer', category: 'product', badge: 'Produkt', rubricName: 'Product Designer — przegląd portfolio',
    stages: ['Screening CV', 'Rozmowa wstępna', 'Zadanie projektowe', 'Rozmowa z zespołem'],
    questions: [
      q('Przeprowadź nas przez jeden projekt z portfolio: od problemu do decyzji projektowych.', 'Proces projektowy', 3, 20, ['Pokazuje ekrany bez problemu.', 'Nazywa problem, decyzje uzasadnia gustem.', 'Łączy decyzje z badaniami; brakuje iteracji.', 'Pokazuje iteracje i wpływ na metryki.', 'Problem, hipotezy, badania, kompromisy, wynik i lekcje.']),
      q('Oceń własną pracę: co zrobiłbyś lub zrobiłabyś dziś inaczej?', 'Rzemiosło i krytyka', 2, 10, ['Nie widzi nic do poprawy.', 'Wymienia drobiazgi.', 'Wskazuje problemy użyteczności.', 'Krytykuje własne założenia.', 'Rozbiera projekt z dystansem mentora.']),
      q('Jak prowadzisz badania, gdy masz tydzień i zero budżetu?', 'Badania', 2, 8, ['Nie bada.', 'Ankieta do wszystkich.', '5 rozmów z właściwymi osobami.', 'Dobiera metodę do pytania.', 'Łączy dane jakościowe z ilościowymi i decyduje szybko.']),
      q('Jak współpracujesz z inżynierią przy ograniczeniach technicznych?', 'Komunikacja z inżynierią', 2, 8, ['Oddaje makiety i znika.', 'Spiera się o piksele.', 'Rozumie ograniczenia, szuka kompromisu.', 'Projektuje z inżynierami od początku.', 'Buduje wspólny proces i system.']),
      q('Jak zbudowałbyś lub zbudowałabyś system designu od zera?', 'Systemy designu', 3, 10, ['Zaczyna od kolorów.', 'Kopiuje gotowy system.', 'Audyt, tokeny, komponenty priorytetowe.', 'Plan adopcji i governance.', 'System jako produkt z metrykami i wersjonowaniem.']),
      q('Opisz decyzję projektową, którą obroniłeś lub obroniłaś danymi.', 'Argumentacja', 2, 6, ['Nie używa danych.', 'Przytacza dane wybiórczo.', 'Test A/B lub badanie i wniosek.', 'Dane plus kontekst biznesowy.', 'Zmienia decyzję zespołu i proces.']),
      q('Jak projektujesz onboarding dla złożonego produktu B2B?', 'Projektowanie interakcji', 3, 10, ['Tutorial na start.', 'Kopiuje wzorce.', 'Dzieli na momenty wartości.', 'Mierzy aktywację i iteruje.', 'Onboarding jako system z segmentacją i eksperymentami.']),
      q('Jak dbasz o dostępność w projektach?', 'Dostępność', 1, 5, ['Nie myśli o tym.', 'Kontrast.', 'Kontrast, fokus, semantyka w makietach.', 'Testuje z użytkownikami z niepełnosprawnościami.', 'Dostępność w systemie i procesie.']),
      q('Jak pracujesz z PM-em, gdy się nie zgadzacie?', 'Współpraca', 1, 5, ['Ustępuje albo walczy.', 'Eskaluje.', 'Szuka wspólnego celu.', 'Proponuje eksperyment.', 'Buduje relację opartą na dowodach.']),
      q('Jak mierzysz, czy projekt się udał?', 'Wpływ', 2, 6, ['Po zachwycie zespołu.', 'Po liczbie użytkowników.', 'Metryka zdefiniowana przed startem.', 'Metryka wiodąca i opóźniona.', 'System mierzenia i uczenia się z wyników.']),
      q('Co w naszym produkcie zmieniłbyś lub zmieniłabyś najpierw?', 'Dopasowanie', 1, 5, ['Nie przygotował się.', 'Ogólniki.', 'Konkretna obserwacja i hipoteza.', 'Obserwacja, priorytet i uzasadnienie.', 'Plan z badaniem i miarą sukcesu.']),
    ],
  },
  {
    key: 'product-manager', name: 'Product Manager', category: 'product', badge: 'Produkt', rubricName: 'Product Manager — rozmowa produktowa',
    stages: ['Screening CV', 'Rozmowa wstępna', 'Case produktowy', 'Rozmowa z zespołem', 'Rozmowa z CEO'],
    questions: [
      q('Opowiedz o produkcie, który prowadziłeś lub prowadziłaś, od pomysłu do wyniku.', 'Prowadzenie produktu', 3, 15, ['Opisuje funkcje.', 'Nazywa cel bez wyniku.', 'Cel, decyzje, wynik.', 'Kompromisy i to, czego nie zrobił.', 'Strategia, wynik i lekcje dla firmy.']),
      q('Jak priorytetyzujesz, gdy wszystko jest ważne?', 'Priorytetyzacja', 3, 10, ['Robi, co krzyczy najgłośniej.', 'Zna framework, nie używa.', 'Kryteria i rozmowa z interesariuszami.', 'Dane plus strategia.', 'Transparentny proces, który zespół rozumie.']),
      q('Jak odkrywasz, czego naprawdę potrzebują klienci?', 'Discovery', 3, 10, ['Pyta sprzedaż.', 'Czyta zgłoszenia.', 'Rozmowy z klientami, synteza.', 'Ciągłe discovery z zespołem.', 'Discovery jako system z hipotezami i testami.']),
      q('Opisz funkcję, którą zabiłeś lub zabiłaś.', 'Decyzje', 2, 8, ['Nigdy nic nie zabił.', 'Zabił, bo tak kazano.', 'Decyzja z danymi.', 'Komunikacja do klientów i zespołu.', 'Nauka dla organizacji.']),
      q('Jak pracujesz z inżynierią przy szacowaniu?', 'Współpraca', 2, 6, ['Narzuca terminy.', 'Przyjmuje każdy szacunek.', 'Rozmawia o zakresie i ryzyku.', 'Negocjuje zakres, nie termin.', 'Buduje zaufanie i przewidywalność.']),
      q('Jakie metryki prowadzisz i dlaczego te?', 'Metryki', 2, 8, ['Nie prowadzi.', 'Vanity metrics.', 'Metryka północna i wspierające.', 'Drzewo metryk powiązane z biznesem.', 'Metryki napędzają decyzje zespołu.']),
      q('Case: spadł retention o 10 % w miesiąc. Co robisz?', 'Analiza', 3, 12, ['Panikuje albo ignoruje.', 'Pyta zespół.', 'Segmentuje, stawia hipotezy.', 'Zawęża przyczynę i proponuje test.', 'Plan diagnozy, komunikacji i naprawy.']),
      q('Jak komunikujesz roadmapę zarządowi i zespołowi?', 'Komunikacja', 2, 6, ['Lista funkcji z datami.', 'Prezentacja raz na kwartał.', 'Cele i problemy, nie funkcje.', 'Dopasowuje narrację do odbiorcy.', 'Roadmapa jako narzędzie decyzji.']),
      q('Opisz konflikt z interesariuszem i jego rozwiązanie.', 'Wpływ bez władzy', 2, 6, ['Unika.', 'Eskaluje.', 'Szuka wspólnego celu.', 'Dane i relacja.', 'Zmienia sposób współpracy na stałe.']),
      q('Jak pracujesz z designem?', 'Współpraca', 1, 5, ['Zamawia ekrany.', 'Ocenia gust.', 'Wspólne discovery.', 'Trio PM-design-eng.', 'Buduje kulturę wspólnej odpowiedzialności.']),
      q('Jak wprowadzasz cennik lub zmianę ceny?', 'Monetyzacja', 2, 6, ['Nie robił.', 'Kopiuje konkurencję.', 'Bada skłonność do płacenia.', 'Testuje warianty i mierzy.', 'Strategia cenowa powiązana z wartością.']),
      q('Jak dbasz o jakość dostarczanego produktu?', 'Jakość', 1, 5, ['To sprawa QA.', 'Testuje sam przed releasem.', 'Kryteria akceptacji i monitoring.', 'Definicja ukończenia z zespołem.', 'Jakość jako metryka produktu.']),
      q('Co zrobiłbyś lub zrobiłabyś w pierwszych 90 dniach?', 'Dopasowanie', 2, 6, ['Nie ma planu.', 'Ogólniki.', 'Ludzie, klienci, pierwsza decyzja.', 'Plan z pytaniami o naszą strategię.', 'Plan oparty na rozmowach, z miarą sukcesu.']),
      q('Czego nauczyła Cię największa porażka produktowa?', 'Pokora', 1, 5, ['Nie miał porażek.', 'Obwinia innych.', 'Nazywa błąd i wniosek.', 'Zmienił sposób pracy.', 'Zbudował z tego praktykę zespołu.']),
    ],
  },
  {
    key: 'first-sales', name: 'Pierwszy handlowiec', category: 'sales', badge: 'Sprzedaż', rubricName: 'Sprzedaż — symulacja rozmowy',
    stages: ['Screening CV', 'Rozmowa wstępna', 'Symulacja rozmowy', 'Rozmowa z CEO'],
    questions: [
      q('Zrób z nami 5-minutowy discovery call. Jesteśmy CTO firmy, która nigdy nie słyszała o Twoim produkcie.', 'Discovery', 3, 10, ['Mówi o produkcie zamiast pytać.', 'Pytania z listy, nie słucha.', 'Odkrywa jeden realny problem.', 'Kwantyfikuje ból, proponuje krok.', 'Klient sam formułuje, dlaczego potrzebuje zmiany.']),
      q('Opowiedz o największej przegranej szansie sprzedażowej.', 'Odporność', 1, 8, ['Obwinia klienta.', 'Porażka bez wniosków.', 'Wniosek i zmiana zachowania.', 'Analiza systemowa.', 'Playbook dla zespołu.']),
      q('Jak budujesz pipeline od zera w nowym segmencie?', 'Pipeline', 3, 10, ['Czeka na leady.', 'Masowe maile.', 'ICP, lista, sekwencja, pomiar.', 'Testuje kanały i iteruje komunikat.', 'System generowania popytu z metrykami.']),
      q('Jak kwalifikujesz szansę, żeby nie tracić czasu?', 'Kwalifikacja', 2, 6, ['Każdy lead jest dobry.', 'Zna BANT, nie stosuje.', 'Jasne kryteria i odwaga, by odpuścić.', 'Kwalifikuje przez cały proces.', 'Prognoza oparta na kwalifikacji, trafna.']),
      q('Symulacja: klient mówi, że jesteśmy za drodzy. Co dalej?', 'Negocjacje', 2, 8, ['Daje rabat.', 'Broni ceny na siłę.', 'Wraca do wartości i problemu.', 'Rozbiera obiekcję, proponuje opcje.', 'Przekształca obiekcję w decyzję o wartości.']),
      q('Jak współpracujesz z produktem przy feedbacku od klientów?', 'Współpraca', 1, 5, ['Nie przekazuje.', 'Przekazuje każde życzenie.', 'Syntetyzuje i priorytetyzuje.', 'Łączy feedback z pipeline.', 'Buduje pętlę uczenia firmy.']),
      q('Jak prowadzisz CRM i prognozę?', 'Dyscyplina', 1, 5, ['CRM to zło.', 'Uzupełnia pod presją.', 'Aktualny CRM, prognoza co tydzień.', 'Prognoza z uzasadnieniem i trafnością.', 'CRM jako źródło prawdy dla firmy.']),
      q('Opisz najtrudniejszą rozmowę z klientem po sprzedaży.', 'Relacje', 1, 5, ['Unika takich rozmów.', 'Przerzuca na support.', 'Bierze odpowiedzialność.', 'Ratuje relację i uczy się.', 'Zamienia kryzys w referencję.']),
      q('Jak sprzedajesz, gdy produkt ma braki?', 'Uczciwość', 2, 6, ['Obiecuje wszystko.', 'Ukrywa braki.', 'Mówi wprost i pokazuje plan.', 'Sprzedaje wizję z uczciwym zakresem.', 'Buduje zaufanie, które wygrywa długoterminowo.']),
      q('Dlaczego Nordlight i dlaczego teraz?', 'Motywacja', 1, 5, ['Nie wie, co robimy.', 'Ogólniki.', 'Rozumie produkt i rynek.', 'Ma tezę o rynku.', 'Ma plan pierwszych 90 dni oparty na tezie.']),
    ],
  },
  {
    key: 'customer-success', name: 'Customer Success', category: 'ops', badge: 'Operacje', rubricName: 'Customer Success — rozmowa',
    stages: ['Screening CV', 'Rozmowa wstępna', 'Rozmowa z zespołem'],
    questions: [
      q('Opisz klienta, którego uratowałeś lub uratowałaś przed odejściem.', 'Retencja', 3, 10, ['Nie ma przykładu.', 'Dał rabat.', 'Zdiagnozował problem, naprawił.', 'Plan odzyskania i wynik.', 'System wczesnego ostrzegania dla zespołu.']),
      q('Jak prowadzisz onboarding nowego klienta?', 'Onboarding', 3, 8, ['Wysyła instrukcję.', 'Jedno szkolenie.', 'Plan z kamieniami milowymi.', 'Mierzy czas do wartości.', 'Onboarding jako proces z metrykami.']),
      q('Jak rozmawiasz z klientem, gdy produkt zawiódł?', 'Komunikacja', 2, 6, ['Przeprasza i znika.', 'Broni produktu.', 'Uczciwie, z planem naprawy.', 'Odbudowuje zaufanie.', 'Wzmacnia relację po kryzysie.']),
      q('Jak przekazujesz feedback klientów do produktu?', 'Współpraca', 2, 6, ['Nie przekazuje.', 'Przekazuje wszystko.', 'Syntetyzuje i priorytetyzuje.', 'Łączy z danymi o użyciu.', 'Buduje proces między CS a produktem.']),
      q('Jak mierzysz zdrowie klienta?', 'Metryki', 2, 6, ['Po nastroju.', 'NPS.', 'Użycie, zaangażowanie, ryzyko.', 'Health score z akcjami.', 'System, który przewiduje churn.']),
      q('Jak prowadzisz rozmowę o odnowieniu i rozszerzeniu?', 'Rozwój konta', 2, 6, ['Czeka na klienta.', 'Przypomina miesiąc przed.', 'Przygotowuje wartość i propozycję.', 'Buduje case na rozszerzenie.', 'Przewidywalne odnowienia i wzrost.']),
      q('Jak organizujesz pracę z 40 klientami naraz?', 'Organizacja', 1, 5, ['Reaguje na pożary.', 'Lista zadań.', 'Segmentacja i rytm kontaktu.', 'Automatyzacja i priorytety.', 'Skalowalny model obsługi.']),
      q('Opisz trudną sytuację z zespołem wewnętrznym.', 'Współpraca', 1, 5, ['Unika.', 'Eskaluje.', 'Rozmawia wprost.', 'Szuka wspólnego celu.', 'Poprawia proces na stałe.']),
      q('Dlaczego CS, a nie sprzedaż lub support?', 'Motywacja', 1, 4, ['Nie wie.', 'Przypadek.', 'Jasna motywacja.', 'Motywacja spójna z rolą.', 'Wizja rozwoju w CS.']),
    ],
  },
  {
    key: 'plan90-eng', name: 'Plan 90 dni — inżynier', category: 'after', badge: 'Po zatrudnieniu', rubricName: 'Plan 90 dni — inżynier', after: true,
    stages: ['Dzień 1–7', 'Dzień 30', 'Dzień 60', 'Dzień 90', 'Przegląd końcowy'], checkins: 12,
    questions: [
      q('Dzień 7: czy środowisko działa i zrobiłeś lub zrobiłaś pierwszy mały ship?', 'Start', 1, 10, ['Nic nie działa.', 'Środowisko działa.', 'Pierwszy PR wdrożony.', 'Kilka małych zmian.', 'Zmiana z realnym wpływem.']),
      q('Dzień 30: czy rozumiesz architekturę i kto za co odpowiada?', 'Kontekst', 2, 15, ['Nie wie.', 'Zna swój moduł.', 'Rozumie całość z grubsza.', 'Potrafi wyjaśnić innym.', 'Proponuje usprawnienia.']),
      q('Dzień 60: czy prowadzisz samodzielnie zadanie od projektu do wdrożenia?', 'Samodzielność', 3, 15, ['Potrzebuje prowadzenia.', 'Samodzielnie małe zadania.', 'Samodzielnie średnie zadanie.', 'Prowadzi duże zadanie.', 'Prowadzi i angażuje innych.']),
      q('Dzień 90: jaki jest Twój mierzalny wpływ?', 'Wpływ', 3, 15, ['Brak.', 'Ukończone zadania.', 'Wpływ na metrykę.', 'Wpływ i poprawa procesu.', 'Wpływ widoczny dla firmy.']),
      q('Przegląd końcowy: czego potrzebujesz, żeby rosnąć dalej?', 'Rozwój', 1, 10, ['Nie wie.', 'Ogólniki.', 'Konkretny cel.', 'Cel z planem.', 'Plan spójny z celami zespołu.']),
    ],
  },
  {
    key: 'plan90-sales', name: 'Plan 90 dni — sprzedaż', category: 'after', badge: 'Po zatrudnieniu', rubricName: 'Plan 90 dni — sprzedaż', after: true,
    stages: ['Dzień 1–7', 'Dzień 30', 'Dzień 60', 'Dzień 90', 'Przegląd końcowy'], checkins: 12,
    questions: [
      q('Dzień 7: czy znasz produkt na tyle, by zrobić demo?', 'Start', 1, 10, ['Nie zna produktu.', 'Zna funkcje.', 'Robi demo.', 'Demo z historią klienta.', 'Demo dopasowane do segmentu.']),
      q('Dzień 30: czy masz listę 100 kont i pierwsze rozmowy?', 'Pipeline', 2, 15, ['Brak listy.', 'Lista bez rozmów.', '10 rozmów.', '20 rozmów, pierwsze szanse.', 'Pipeline z kwalifikowanymi szansami.']),
      q('Dzień 60: czy prowadzisz szanse przez cały proces?', 'Samodzielność', 3, 15, ['Nie prowadzi.', 'Z pomocą.', 'Samodzielnie do propozycji.', 'Samodzielnie do decyzji.', 'Zamyka i uczy się z wyników.']),
      q('Dzień 90: pierwszy podpisany klient?', 'Wynik', 3, 15, ['Brak.', 'Szanse na końcu procesu.', 'Jeden klient.', 'Klient i powtarzalny proces.', 'Kilku klientów, playbook.']),
      q('Przegląd końcowy: co zmienić w naszym procesie sprzedaży?', 'Wpływ', 1, 10, ['Nic.', 'Ogólniki.', 'Konkretna propozycja.', 'Propozycja z danymi.', 'Zmiana już wdrożona.']),
    ],
  },
];

export function templateSummary(t) {
  const n = t.stages.length;
  if (t.after) return `${n} przeglądów · ${t.checkins} check-inów`;
  const qn = t.questions.length;
  const st = n === 1 ? '1 etap' : (n >= 2 && n <= 4 ? `${n} etapy` : `${n} etapów`);
  const qs = qn === 1 ? '1 pytanie' : ((qn % 10 >= 2 && qn % 10 <= 4 && (qn % 100 < 12 || qn % 100 > 14)) ? `${qn} pytania` : `${qn} pytań`);
  return `${st} · ${qs}`;
}

/* ------------------------------------------------------------------ strona kariery i portal kandydata */
export const CAREERS = {
  company: 'Nordlight Labs',
  kicker: 'KARIERA W NORDLIGHT LABS',
  title: 'Prognozujemy popyt na energię w całej Europie. Dołącz do nas.',
  lead: '35 osób w Warszawie, Krakowie i Berlinie. Ten sam proces rekrutacji dla każdego — te same pytania, jasne kryteria i odpowiedź w ciągu 10 dni.',
  values: [
    { title: 'Kultura pisania', text: 'Decyzje żyją w dokumentach, nie na korytarzu.' },
    { title: 'Małe, zgrane zespoły', text: 'Każdy zespół odpowiada za problem od początku do końca.' },
    { title: 'Uczciwość z założenia', text: 'Te same pytania i ta sama rubryka dla każdego kandydata.' },
  ],
  fallbackJobs: [
    { title: 'Senior Backend Engineer', meta: 'Inżynieria · Warszawa / zdalnie · 22–28 tys. zł B2B' },
    { title: 'Product Designer', meta: 'Produkt · Kraków · 16–20 tys. zł B2B' },
    { title: 'Founding Account Executive', meta: 'Sprzedaż · Berlin · 75–90 tys. € + prowizja' },
  ],
};

export const PORTAL = {
  company: 'Nordlight Labs', code: 'TK-4821', firstName: 'Marto', candidateName: 'Marta Lewandowska',
  position: 'Senior Backend Engineer', stage: 'Rozmowa techniczna',
  steps: [
    { title: 'Aplikacja otrzymana', sub: '3 paź', state: 'done' },
    { title: 'Rozmowa wstępna', sub: '14 paź · z Aleksandrą', state: 'done' },
    { title: 'Rozmowa techniczna', sub: 'czw 6 lis, 14:00 · Google Meet', state: 'current' },
    { title: 'Rozmowa z CEO', sub: '—', state: 'todo' },
    { title: 'Decyzja', sub: 'odpowiemy w ciągu 10 dni', state: 'todo' },
  ],
  nextTitle: 'Przed rozmową',
  nextText: 'Rozmowa trwa ok. 45 min. Zapytamy o projektowanie systemów, debugowanie i współpracę. Za Twoją zgodą rozmowa jest nagrywana.',
  event: { title: 'Rozmowa techniczna — Nordlight Labs', start: '20261106T130000Z', end: '20261106T134500Z', location: 'Google Meet' },
};

export default { getPositionMeta, setPositionMeta, defaultAd, getRubricOrigin, setRubricOrigin, getDraft, setDraft, clearDraft, TEMPLATES, TEMPLATE_TABS, templateSummary, TEAM, RECRUITER, CAREERS, PORTAL };
