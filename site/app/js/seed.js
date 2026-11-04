/**
 * seed.js — dane przykładowe firmy „Nordlight Labs”.
 *
 * Eksport:
 *   SEED = { org, rubrics[], positions[], candidates[], scorecards[] }
 *   Rekordy mają klucze tekstowe (`key`) zamiast id — adapter/loader (store.org.loadDemoData)
 *   tworzy rekordy po kolei i mapuje klucze na prawdziwe id:
 *     rubric.key → positions[].rubric_key, scorecards[].rubric_key
 *     position.key → candidates[].position_key
 *     candidate.key → scorecards[].candidate_key
 *   Daty są względne (daysAgo) i liczone w momencie ładowania, żeby dane zawsze wyglądały świeżo.
 *   Oceny Jakuba Szymańskiego w pytaniu „Projektowanie systemów” różnią się o 3 pkt (rozbieżność ≥ 2).
 */

const daysAgo = (n, hour = 10) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

export const DEFAULT_STAGES = ['Screening CV', 'Rozmowa wstępna', 'Rozmowa techniczna', 'Rozmowa z CEO', 'Oferta'];
export const SOURCES = ['LinkedIn', 'Strona kariery', 'Polecenie', 'Rekruter'];

export const SEED = {
  org: { name: 'Nordlight Labs' },

  rubrics: [
    {
      key: 'backend-tech',
      name: 'Backend — rozmowa techniczna',
      version: 3,
      questions: [
        {
          id: 'q-system-design',
          text: 'Opowiedz o systemie, który projektowałeś lub projektowałaś pod rosnące obciążenie. Co było wąskim gardłem i jak to rozwiązaliście?',
          competency: 'Projektowanie systemów',
          weight: 3,
          minutes: 15,
          anchors: {
            1: 'Nie potrafi wskazać wąskiego gardła ani uzasadnić decyzji; opisuje cudze rozwiązania bez zrozumienia.',
            2: 'Zna podstawowe wzorce (cache, kolejka), ale nie umie powiązać ich z konkretnym problemem ani ocenić kosztów.',
            3: 'Opisuje jedno rozwiązanie z konkretnymi liczbami i uzasadnia wybór; nie rozważa alternatyw.',
            4: 'Porównuje co najmniej dwa podejścia, podaje wyniki (np. p95, przepustowość) i mówi, co by zrobił inaczej.',
            5: 'Prowadzi od obserwacji do rozwiązania z pomiarami, zna kompromisy (spójność, koszt, złożoność) i uczy innych.',
          },
        },
        {
          id: 'q-problem-solving',
          text: 'Masz produkcyjny incydent: p95 odpowiedzi API rośnie z 200 ms do 3 s bez zmian w kodzie. Jak szukasz przyczyny?',
          competency: 'Rozwiązywanie problemów',
          weight: 2,
          minutes: 10,
          anchors: {
            1: 'Zgaduje przyczynę i proponuje restart; nie korzysta z danych.',
            2: 'Wymienia narzędzia (logi, metryki), ale bez kolejności i hipotez.',
            3: 'Stawia hipotezy i sprawdza je po kolei; dochodzi do przyczyny z podpowiedzią.',
            4: 'Systematycznie zawęża obszar (sieć, baza, kod, dane), weryfikuje pomiarami i proponuje zabezpieczenie na przyszłość.',
            5: 'Prowadzi diagnozę jak dochodzenie: izoluje zmienne, odtwarza problem, naprawia przyczynę i dodaje alert, który go wykryje.',
          },
        },
        {
          id: 'q-collaboration',
          text: 'Opisz sytuację, w której nie zgadzałeś lub nie zgadzałaś się z decyzją techniczną zespołu. Co zrobiłeś lub zrobiłaś?',
          competency: 'Współpraca',
          weight: 2,
          minutes: 10,
          anchors: {
            1: 'Unika konfliktu albo narzuca zdanie; nie widzi perspektywy innych.',
            2: 'Zgłasza sprzeciw, ale bez argumentów lub bez dalszych kroków.',
            3: 'Przedstawia argumenty, akceptuje decyzję zespołu i realizuje ją lojalnie.',
            4: 'Szuka danych, proponuje eksperyment lub kompromis, dba o relację po decyzji.',
            5: 'Zamienia spór w decyzję opartą na dowodach; inni chcą z tą osobą pracować po takim sporze.',
          },
        },
        {
          id: 'q-quality',
          text: 'Jak dbasz o jakość kodu w zespole, w którym nikt nie ma czasu na testy?',
          competency: 'Jakość',
          weight: 1,
          minutes: 8,
          anchors: {
            1: 'Uważa, że jakość to sprawa QA; nie pisze testów.',
            2: 'Pisze testy sporadycznie, nie widzi ich jako narzędzia projektowego.',
            3: 'Testuje kluczowe ścieżki, robi review, zna podstawy CI.',
            4: 'Wprowadza praktyki (testy kontraktowe, lint, review guidelines) i mierzy ich wpływ.',
            5: 'Buduje kulturę jakości: narzędzia, nawyki i argumenty biznesowe, dzięki którym zespół testuje sam z siebie.',
          },
        },
      ],
    },
    {
      key: 'design-portfolio',
      name: 'Product Designer — przegląd portfolio',
      version: 1,
      questions: [
        {
          id: 'q-process',
          text: 'Przeprowadź nas przez jeden projekt z portfolio: od problemu do decyzji projektowych.',
          competency: 'Proces projektowy',
          weight: 3,
          minutes: 20,
          anchors: {
            1: 'Pokazuje ekrany bez problemu, który rozwiązują.',
            2: 'Nazywa problem, ale decyzje projektowe uzasadnia gustem.',
            3: 'Łączy decyzje z badaniami lub danymi; brakuje iteracji.',
            4: 'Pokazuje iteracje, odrzucone kierunki i wpływ na metryki.',
            5: 'Opowiada jak lider produktu: problem, hipotezy, badania, kompromisy, wynik i czego się nauczył.',
          },
        },
        {
          id: 'q-craft',
          text: 'Oceń własną pracę: co w tym projekcie zrobiłbyś lub zrobiłabyś dziś inaczej?',
          competency: 'Rzemiosło i krytyka',
          weight: 2,
          minutes: 10,
          anchors: {
            1: 'Nie widzi nic do poprawy.',
            2: 'Wymienia drobiazgi wizualne.',
            3: 'Wskazuje konkretne problemy użyteczności i ich przyczyny.',
            4: 'Krytykuje własne założenia i proponuje lepszą strukturę rozwiązania.',
            5: 'Rozbiera projekt na czynniki pierwsze z dystansem i precyzją mentora.',
          },
        },
      ],
    },
    {
      key: 'sales-first',
      name: 'Sprzedaż — rozmowa wstępna',
      version: 2,
      questions: [
        {
          id: 'q-discovery',
          text: 'Zrób z nami 5-minutowy discovery call. Jesteśmy CTO firmy, która nigdy nie słyszała o Twoim produkcie.',
          competency: 'Discovery',
          weight: 3,
          minutes: 10,
          anchors: {
            1: 'Mówi o produkcie zamiast pytać.',
            2: 'Zadaje pytania z listy, nie słucha odpowiedzi.',
            3: 'Odkrywa jeden realny problem klienta i do niego nawiązuje.',
            4: 'Buduje obraz sytuacji klienta, kwantyfikuje ból, proponuje następny krok.',
            5: 'Prowadzi rozmowę tak, że klient sam formułuje, dlaczego potrzebuje zmiany.',
          },
        },
        {
          id: 'q-resilience',
          text: 'Opowiedz o największej przegranej szansie sprzedażowej. Co zrobiłeś lub zrobiłaś potem?',
          competency: 'Odporność',
          weight: 1,
          minutes: 8,
          anchors: {
            1: 'Obwinia klienta lub produkt.',
            2: 'Opisuje porażkę bez wniosków.',
            3: 'Wyciąga wniosek i zmienia jedno zachowanie.',
            4: 'Analizuje przyczyny systemowo i wdraża zmianę w procesie.',
            5: 'Zamienia porażkę w playbook, z którego korzysta zespół.',
          },
        },
      ],
    },
  ],

  positions: [
    {
      key: 'backend',
      title: 'Senior Backend Engineer',
      department: 'Inżynieria',
      location: 'Warszawa / zdalnie',
      status: 'open',
      stages: DEFAULT_STAGES,
      rubric_key: 'backend-tech',
      description: 'Szukamy osoby, która poprowadzi przebudowę systemu kolejkowania i będzie mentorować dwójkę juniorów. Stack: Go, Postgres, Kafka, Kubernetes.',
      created_at: daysAgo(34),
    },
    {
      key: 'designer',
      title: 'Product Designer',
      department: 'Produkt',
      location: 'Kraków',
      status: 'open',
      stages: ['Screening CV', 'Rozmowa wstępna', 'Zadanie projektowe', 'Rozmowa z zespołem', 'Oferta'],
      rubric_key: 'design-portfolio',
      description: 'Pierwszy designer w zespole produktowym B2B. Odpowiada za cały proces: od badań po system projektowy.',
      created_at: daysAgo(27),
    },
    {
      key: 'ae',
      title: 'Founding Account Executive',
      department: 'Sprzedaż',
      location: 'Warszawa',
      status: 'open',
      stages: ['Screening CV', 'Rozmowa wstępna', 'Symulacja rozmowy', 'Rozmowa z CEO', 'Oferta'],
      rubric_key: 'sales-first',
      description: 'Pierwsza osoba sprzedażowa. Buduje pipeline od zera w segmencie firm 50–500 osób w Polsce i DACH.',
      created_at: daysAgo(21),
    },
    {
      key: 'analyst',
      title: 'Data Analyst',
      department: 'Dane',
      location: 'Zdalnie (PL)',
      status: 'open',
      stages: DEFAULT_STAGES,
      rubric_key: null,
      description: 'Analityk wspierający produkt i sprzedaż. SQL, dbt, Metabase; mile widziane Python.',
      created_at: daysAgo(12),
    },
  ],

  candidates: [
    // Senior Backend Engineer
    { key: 'marta', position_key: 'backend', full_name: 'Marta Lewandowska', email: 'marta.lewandowska@example.com', source: 'LinkedIn', stage: 'Rozmowa techniczna', cv_score: 86, status: 'active', applied_at: daysAgo(19) },
    { key: 'jakub', position_key: 'backend', full_name: 'Jakub Szymański', email: 'jakub.szymanski@example.com', source: 'Polecenie', stage: 'Rozmowa z CEO', cv_score: 79, status: 'active', applied_at: daysAgo(26) },
    { key: 'daniel', position_key: 'backend', full_name: 'Daniel Ruiz', email: 'daniel.ruiz@example.com', source: 'Rekruter', stage: 'Rozmowa wstępna', cv_score: 71, status: 'active', applied_at: daysAgo(9) },
    { key: 'igor', position_key: 'backend', full_name: 'Igor Pawlak', email: 'igor.pawlak@example.com', source: 'Strona kariery', stage: 'Screening CV', cv_score: 58, status: 'active', applied_at: daysAgo(3) },
    { key: 'tomasz', position_key: 'backend', full_name: 'Tomasz Wiśniewski', email: 'tomasz.wisniewski@example.com', source: 'LinkedIn', stage: 'Screening CV', cv_score: 41, status: 'rejected', reject_reason: 'Brak doświadczenia z systemami rozproszonymi; stanowisko wymaga pracy z Kafką i Postgresem w skali.', applied_at: daysAgo(15) },
    // Product Designer
    { key: 'sofia', position_key: 'designer', full_name: 'Sofia Romero', email: 'sofia.romero@example.com', source: 'LinkedIn', stage: 'Zadanie projektowe', cv_score: 88, status: 'active', applied_at: daysAgo(17) },
    { key: 'claire', position_key: 'designer', full_name: 'Claire Dubois', email: 'claire.dubois@example.com', source: 'Polecenie', stage: 'Rozmowa wstępna', cv_score: 74, status: 'active', applied_at: daysAgo(8) },
    { key: 'ola', position_key: 'designer', full_name: 'Aleksandra Nowak', email: 'aleksandra.nowak@example.com', source: 'Strona kariery', stage: 'Screening CV', cv_score: 63, status: 'active', applied_at: daysAgo(2) },
    // Founding Account Executive
    { key: 'lena', position_key: 'ae', full_name: 'Lena Hoffmann', email: 'lena.hoffmann@example.com', source: 'Rekruter', stage: 'Rozmowa wstępna', cv_score: 82, status: 'active', applied_at: daysAgo(6) },
    { key: 'piotr', position_key: 'ae', full_name: 'Piotr Zieliński', email: 'piotr.zielinski@example.com', source: 'LinkedIn', stage: 'Symulacja rozmowy', cv_score: 69, status: 'active', applied_at: daysAgo(13) },
    { key: 'anna', position_key: 'ae', full_name: 'Anna Kowalczyk', email: 'anna.kowalczyk@example.com', source: 'Strona kariery', stage: 'Screening CV', cv_score: 55, status: 'active', applied_at: daysAgo(1) },
    // Data Analyst
    { key: 'leo', position_key: 'analyst', full_name: 'Leo Fischer', email: 'leo.fischer@example.com', source: 'Polecenie', stage: 'Rozmowa wstępna', cv_score: 77, status: 'active', applied_at: daysAgo(5) },
    { key: 'ewa', position_key: 'analyst', full_name: 'Ewa Dąbrowska', email: 'ewa.dabrowska@example.com', source: 'LinkedIn', stage: 'Screening CV', cv_score: 66, status: 'active', applied_at: daysAgo(4) },
  ],

  /**
   * Oceny istniejące. rater_key 'me' = bieżący użytkownik (zastępowany jego id przy ładowaniu);
   * pozostali rozmówcy to stałe, fikcyjne osoby (ich rater_id to stały identyfikator demo).
   */
  raters: {
    me: { name: null }, // uzupełniane przy ładowaniu
    kasia: { id: 'demo-rater-kasia', name: 'Katarzyna Mazur' },
    bartek: { id: 'demo-rater-bartek', name: 'Bartosz Król' },
  },

  scorecards: [
    {
      candidate_key: 'jakub',
      stage: 'Rozmowa techniczna',
      rubric_key: 'backend-tech',
      decision: 'maybe',
      ratings: [
        // rozbieżność 3 pkt w „Projektowanie systemów” (5 vs 2)
        { question_id: 'q-system-design', rater: 'me', score: 5 },
        { question_id: 'q-system-design', rater: 'kasia', score: 2 },
        { question_id: 'q-problem-solving', rater: 'me', score: 4 },
        { question_id: 'q-problem-solving', rater: 'kasia', score: 4 },
        { question_id: 'q-collaboration', rater: 'me', score: 3 },
        { question_id: 'q-collaboration', rater: 'kasia', score: 4 },
        { question_id: 'q-quality', rater: 'me', score: 4 },
        { question_id: 'q-quality', rater: 'kasia', score: 3 },
      ],
    },
    {
      candidate_key: 'marta',
      stage: 'Rozmowa techniczna',
      rubric_key: 'backend-tech',
      decision: null,
      ratings: [
        { question_id: 'q-system-design', rater: 'bartek', score: 4 },
        { question_id: 'q-problem-solving', rater: 'bartek', score: 5 },
        { question_id: 'q-collaboration', rater: 'bartek', score: 4 },
      ],
    },
    {
      candidate_key: 'sofia',
      stage: 'Rozmowa wstępna',
      rubric_key: 'design-portfolio',
      decision: 'yes',
      ratings: [
        { question_id: 'q-process', rater: 'me', score: 4 },
        { question_id: 'q-craft', rater: 'me', score: 5 },
      ],
    },
  ],
};

/**
 * Dane demo pulpitu i powiadomień (teksty 1:1 z Figmy, ramki 9:2, 32:5680, 33:5764).
 * Używane przez views/dashboard.js i views/notifications.js, gdy firma ma wczytane dane demo.
 *   interviews — „Najbliższe rozmowy” (kolejność jak w ramce); candidate = pełne imię z SEED.candidates
 *   alerts     — „Wymaga uwagi” spoza rekrutacji (1:1, nastrój, RODO); rozbieżne oceny liczy store.stats
 *   funnel     — liczby na etapach lejka per stanowisko (etap z flagą „warn” = wąskie gardło)
 *   stats      — liczniki, których aplikacja nie wylicza z danych (kalendarz, moduł „Ludzie”)
 *   notifications — panel „Powiadomienia”
 */
export const DASHBOARD_DEMO = {
  stats: { interviewsThisWeek: 6, peopleFirstSixMonths: 3 },
  interviews: [
    { candidate: 'Marta Lewandowska', position: 'Senior Backend Engineer', stage: 'Rozmowa techniczna', who: 'Anna, Tomasz', when: 'Dziś 14:00', today: true, mobileWhen: 'Rozmowa techniczna · 14:00', mobileIn: 'za 2 godz.' },
    { candidate: 'Sofia Romero', position: 'Product Designer', stage: 'Zadanie projektowe', who: 'Maya', when: 'Jutro 10:30' },
    { candidate: 'Jakub Szymański', position: 'Senior Backend Engineer', stage: 'Rozmowa z CEO', who: 'Piotr', when: 'Czw 11:00' },
    { candidate: 'Lena Hoffmann', position: 'Founding Account Executive', stage: 'Rozmowa wstępna', who: 'Aleksandra', when: 'Pt 9:30' },
    { candidate: 'Igor Pawlak', position: 'Data Analyst', stage: 'Zadanie SQL', who: 'Dev', when: 'Pt 15:00' },
  ],
  alerts: [
    { type: 'discrepancy', tone: 'warn', label: '⚑ Rozbieżne oceny', text: 'Jakub Szymański: oceny różnią się o 3 pkt w pytaniu o skalowanie systemu.', short: 'Jakub Szymański · 3 pkt', candidate: 'Jakub Szymański', stage: 'Rozmowa techniczna' },
    { type: 'one-on-one', tone: 'bad', label: 'Zaległe 1:1', text: 'Leo Fischer nie miał 1:1 od 14 dni.', short: 'Leo Fischer · 14 dni', href: '#/people' },
    { type: 'mood', tone: 'warn', label: 'Spadek nastroju', text: 'Ewa Dąbrowska oceniła ostatni tydzień na 2/5.', short: 'Ewa Dąbrowska · 2/5', href: '#/people' },
    { type: 'gdpr', tone: 'info', label: 'Wniosek o dane (RODO)', shortLabel: 'Wniosek RODO', text: 'Claire Dubois czeka na odpowiedź — zostało 26 dni.', short: 'Claire Dubois · 26 dni', href: '#/compliance' },
  ],
  funnelLabel: 'Lejek: Aplikacje → Oferta',
  funnel: {
    'Senior Backend Engineer': { counts: [24, 11, 6, 3, 1], warn: 2 },
    'Product Designer': { counts: [18, 9, 4, 2, 0], warn: 1 },
    'Founding Account Executive': { counts: [11, 6, 2, 1, 0], warn: 2 },
    'Data Analyst': { counts: [7, 3, 1, 0, 0], warn: 1 },
  },
  notifications: [
    { id: 'n1', icon: 'flag', tone: 'warn', title: 'Rozbieżne oceny: Jakub Szymański', meta: 'Anna 2 · Tomasz 5 w pytaniu „Współpraca” · 10 min', unread: true, candidate: 'Jakub Szymański', stage: 'Rozmowa techniczna' },
    { id: 'n2', icon: 'check', tone: 'good', title: 'Tomasz wysłał ocenę: Marta Lewandowska', meta: 'Rozmowa techniczna · 4,1 / 5 · 32 min', unread: true, candidate: 'Marta Lewandowska', stage: 'Rozmowa techniczna' },
    { id: 'n3', icon: 'users', title: 'Joanna Nowak dodała 2 kandydatów', meta: 'Senior Backend Engineer · 1 godz.', unread: true, position: 'Senior Backend Engineer' },
    { id: 'n4', icon: 'calendar', title: 'Jutro 10:30 · Sofia Romero', meta: 'Zadanie projektowe · z Mayą · wczoraj', unread: false, candidate: 'Sofia Romero' },
    { id: 'n5', icon: 'sparkle', title: 'AI przeanalizowało 4 nowe CV', meta: 'Product Designer · wczoraj', unread: false, position: 'Product Designer' },
  ],
  checklist: [
    { key: 'profile', title: 'Uzupełnij profil firmy', text: 'AI użyje go do szkiców ogłoszeń', done: true },
    { key: 'position', title: 'Dodaj pierwsze stanowisko', text: 'Senior Backend Engineer', done: true },
    { key: 'rubric', title: 'Dopracuj rubrykę', text: '4 pytania z szablonu — sprawdź wagi', action: 'Otwórz', href: '#/rubrics' },
    { key: 'team', title: 'Zaproś rozmówców', text: 'Bez limitu miejsc', action: 'Zaproś', href: '#/settings?tab=zespol' },
    { key: 'calendar', title: 'Podłącz kalendarz', text: 'Notetaker dołączy do rozmów sam', action: 'Połącz', href: '#/settings?tab=integracje' },
    { key: 'publish', title: 'Opublikuj ogłoszenie', text: 'Strona kariery jest gotowa', action: 'Opublikuj', href: '#/careers' },
  ],
};

export default SEED;
