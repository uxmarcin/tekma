/**
 * views/people-data.js — dane demo modułu „Po zatrudnieniu” (ludzie, 1:1, check-iny, cele, szkolenia).
 *
 * Zapis w localStorage pod kluczem `tekma.demo.people` (bez zmian schematu bazy). Dane startowe
 * przepisane z ramek Figmy (Nordlight Labs: Katarzyna Mazur, Leo Fischer, Ewa Dąbrowska).
 *
 *   load() -> state                      state = { v, people:[…], goals:[…], drafts:{checkin, review} }
 *   save(state) / update(fn)             fn(state) mutuje stan; update zapisuje i zwraca stan
 *   getPerson(state, id), personGoals(state, person), goalChain(state, goal)
 *   personDay(p) -> numer dnia od startu, kpis(state) -> cztery wskaźniki z listy „Ludzie”
 *   oneOnOneAgo(p) -> {days, label, tone}, checkinStatus(p) -> {label, tone}, moodSeries(p, n)
 *   fmtDay(iso) „31 paź” | „31 gru 2027”, fmtWeekday(iso) „Pt 31 paź”, fmtStart(iso) „2 września”, agoLabel(iso)
 *   localIcon(name, size) — ikony, których nie ma w ui.js (lock, shield, book, mark, chevron-down)
 */

export const KEY = 'tekma.demo.people';
const DAY = 86400000;

export const MONTHS = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
const MONTHS_GEN = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
const WEEKDAYS = ['Nd', 'Pn', 'Wt', 'Śr', 'Czw', 'Pt', 'Sb'];

/* ---------------------------------------------------------------- daty */
export function iso(d) {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
export function today() { return iso(new Date()); }
export function daysAgo(n) { return iso(new Date(Date.now() - n * DAY)); }
export function daysFrom(n) { return iso(new Date(Date.now() + n * DAY)); }
function startOf(s) { const d = new Date(s); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }
export function daysBetween(a, b) { return Math.round((startOf(b) - startOf(a)) / DAY); }
export function fmtDay(s, { year = 'auto' } = {}) {
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const y = year === 'always' || (year === 'auto' && d.getFullYear() !== new Date().getFullYear());
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${y ? ' ' + d.getFullYear() : ''}`;
}
export function fmtWeekday(s) { const d = new Date(s); return `${WEEKDAYS[d.getDay()]} ${fmtDay(s)}`; }
export function fmtStart(s) { const d = new Date(s); return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`; }
export function fmtTime(s) { const d = new Date(s); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
export function agoLabel(s) {
  const n = daysBetween(s, today());
  if (n <= 0) return 'dziś';
  if (n === 1) return 'wczoraj';
  return `${n} dni temu`;
}
export function firstName(name) { return String(name || '').trim().split(/\s+/)[0] || ''; }

/* ---------------------------------------------------------------- dane startowe (z Figmy) */
function seed() {
  const d = daysAgo;
  return {
    v: 1,
    people: [
      {
        id: 'katarzyna', name: 'Katarzyna Mazur', role: 'Backend Engineer', team: 'Platforma', start: '2026-09-02', day: 62,
        manager: 'Dev Patel', lastOneOnOne: d(4),
        plan90: [
          { day: 1, label: 'Start i dostępy', done: true },
          { day: 7, label: 'Pierwszy check-in', done: true },
          { day: 30, label: 'Przegląd 30 dni', done: true },
          { day: 60, label: 'Przegląd 60 dni', done: true },
          { day: 90, label: 'Przegląd końcowy', done: false },
        ],
        oneOnOne: {
          next: { date: '2026-11-06T10:00', minutes: 30, cadence: 'Co 2 tygodnie', tool: 'Google Meet' },
          agenda: [
            { id: 'a1', text: 'Feedback z code review migracji kolejki', by: 'Dev', done: true },
            { id: 'a2', text: 'Ścieżka do on-call — czy czuje się gotowa?', by: 'Dev', done: false },
            { id: 'a3', text: 'Budżet na konferencję (GopherCon EU)', by: 'Katarzyna', done: false },
            { id: 'a4', text: 'Co Cię w tym tygodniu najbardziej spowolniło?', by: 'Szablon', done: false },
          ],
          note: 'Pewniejsza w code review. Zaproponować prowadzenie postmortemu po incydencie z 28.10.',
          history: [
            { date: '2026-10-23', title: 'Onboarding do on-call, plan na listopad', tasks: 3 },
            { date: '2026-10-09', title: 'Pierwszy duży PR — co poszło dobrze', tasks: 2 },
            { date: '2026-09-25', title: 'Jak się pracuje z zespołem Platformy', tasks: 1 },
            { date: '2026-09-11', title: 'Oczekiwania na 90 dni', tasks: 4 },
          ],
          ai: 'W ostatnim check-inie Katarzyna napisała, że „mniej gasi pożarów”. Zapytaj, co chciałaby przejąć jako następny projekt.',
        },
        checkins: {
          rhythm: { weekday: 5, questions: 5, minutes: 1 },
          entries: [
            { date: d(4), mood: 5, done: 'Migracja kolejki na partycje zakończona na stagingu.', blocked: 'Czekam na review od Tomasza — 2 dni.', help: 'Szybszy review w piątki.', summary: 'Dobrze — migracja idzie, mniej gaszenia pożarów.' },
            { date: d(11), mood: 4, done: 'Pierwszy dyżur on-call bez eskalacji.', blocked: 'Dokumentacja runbooków jest nieaktualna.', help: '' },
            { date: d(18), mood: 3, done: 'Skończony PR z monitoringiem p95.', blocked: 'Za dużo spotkań w środy.', help: 'Blok bez spotkań w środę rano.' },
            { date: d(25), mood: 5, done: 'Pierwszy PR z monitoringiem zmergowany.', blocked: '', help: '' },
            { date: d(32), mood: 3, done: 'Poznałam runbooki on-call.', blocked: 'Czekałam na review 3 dni.', help: 'Jasny właściciel review.' },
            { date: d(39), mood: 4, done: 'Pierwszy mały PR w produkcji.', blocked: 'Spotkania w środy.', help: '' },
            { date: d(46), mood: 4, done: 'Dostępy i środowisko lokalne działają.', blocked: '', help: '' },
            { date: d(53), mood: 3, done: 'Poznałam zespół i kod Platformy.', blocked: 'Dużo nowych narzędzi naraz.', help: 'Krótka mapa serwisów.' },
          ],
          themes: [
            { text: 'Czas oczekiwania na code review', count: 3, tone: 'warn' },
            { text: 'Spotkania w środy', count: 2, tone: 'neutral' },
            { text: 'On-call idzie dobrze', count: 2, tone: 'good' },
          ],
        },
        courses: [
          { id: 'c1', title: 'Projektowanie systemów przetwarzających dane', provider: 'Klub książki', units: '12 rozdziałów', progress: 70, due: '2026-11-30' },
          { id: 'c2', title: 'Certyfikacja incident commandera', provider: 'Nordlight Academy', units: '18 powtórek', progress: 100, completed: '2026-10-15', reward: 'Certyfikat + voucher 50 €', rewardTone: 'good' },
          { id: 'c3', title: 'Go: wydajność i profilowanie', provider: 'Kurs wewnętrzny', units: '10 powtórek', progress: 20, due: '2026-12-15', reward: 'Voucher 30 €', rewardTone: 'neutral' },
        ],
        streak: { days: 12, best: 'on-call, runbooki', toReview: 'indeksy częściowe', pattern: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0] },
        recruitment: { score: '4,3', strongest: 'projektowanie systemów', growth: 'delegowanie', position: 'Backend Engineer (Platforma)', hiredOn: '2026-08-14', stages: 5, raters: ['Dev Patel', 'Tomasz Wiśniewski', 'Anna Kowalczyk'] },
      },
      {
        id: 'leo', name: 'Leo Fischer', role: 'Product Designer', team: 'Produkt', start: '2026-10-01', day: 34,
        manager: 'Maya Lindqvist', lastOneOnOne: d(14),
        plan90: [
          { day: 1, label: 'Start i dostępy', done: true },
          { day: 7, label: 'Pierwszy check-in', done: true },
          { day: 30, label: 'Przegląd 30 dni', done: false },
          { day: 60, label: 'Przegląd 60 dni', done: false },
          { day: 90, label: 'Przegląd końcowy', done: false },
        ],
        oneOnOne: {
          next: { date: '2026-11-12T14:00', minutes: 30, cadence: 'Co 2 tygodnie', tool: 'Google Meet' },
          agenda: [
            { id: 'a1', text: 'Przegląd 30 dni — co zaskoczyło?', by: 'Maya', done: false },
            { id: 'a2', text: 'Dashboard dostępności: zakres MVP', by: 'Leo', done: false },
          ],
          note: '',
          history: [
            { date: d(14), title: 'Pierwsze dwa tygodnie, dostępy do Figmy i researchu', tasks: 2 },
          ],
          ai: 'Ostatnie 1:1 było 14 dni temu, a nastrój spadł do 3/5 — zacznij od pytania, co najbardziej spowalnia.',
        },
        checkins: {
          rhythm: { weekday: 5, questions: 5, minutes: 1 },
          entries: [
            { date: d(4), mood: 4, done: 'Pierwsze makiety dashboardu dostępności.', blocked: 'Brak dostępu do danych z produkcji.', help: 'Dostęp do Metabase.', summary: 'Dobrze — pierwsze makiety poszły do zespołu.' },
            { date: d(11), mood: 4, done: 'Rozmowy z 3 klientami o dostępności.', blocked: '', help: '' },
            { date: d(18), mood: 3, done: 'Poznałem produkt i design system.', blocked: 'Dużo kontekstu naraz.', help: 'Spotkanie z Platformą.' },
            { date: d(25), mood: 4, done: 'Dostępy i narzędzia gotowe.', blocked: '', help: '' },
          ],
          themes: [
            { text: 'Dostęp do danych produkcyjnych', count: 2, tone: 'warn' },
            { text: 'Rozmowy z klientami idą dobrze', count: 2, tone: 'good' },
          ],
        },
        courses: [
          { id: 'c1', title: 'Research z klientami B2B', provider: 'Kurs wewnętrzny', units: '8 powtórek', progress: 35, due: '2026-12-10' },
        ],
        streak: { days: 4, best: 'wywiady, synteza', toReview: 'segmentacja klientów', pattern: [1, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1, 1] },
        recruitment: { score: '4,1', strongest: 'research z klientami', growth: 'prototypowanie w kodzie', position: 'Product Designer (Produkt)', hiredOn: '2026-09-18', stages: 4, raters: ['Maya Lindqvist', 'Piotr Zieliński'] },
      },
      {
        id: 'ewa', name: 'Ewa Dąbrowska', role: 'Customer Success Lead', team: '', start: '2026-07-10', day: 118,
        manager: 'Piotr Zieliński', lastOneOnOne: d(6),
        plan90: [
          { day: 1, label: 'Start i dostępy', done: true },
          { day: 7, label: 'Pierwszy check-in', done: true },
          { day: 30, label: 'Przegląd 30 dni', done: true },
          { day: 60, label: 'Przegląd 60 dni', done: true },
          { day: 90, label: 'Przegląd końcowy', done: true },
        ],
        oneOnOne: {
          next: { date: '2026-11-10T11:00', minutes: 30, cadence: 'Co 2 tygodnie', tool: 'Google Meet' },
          agenda: [
            { id: 'a1', text: 'Odnowienia umów w Q4 — ryzyka', by: 'Piotr', done: false },
            { id: 'a2', text: 'Rekrutacja drugiej osoby do CS', by: 'Ewa', done: false },
          ],
          note: 'Samodzielna. Zaproponować prowadzenie onboardingu nowych klientów.',
          history: [
            { date: d(6), title: 'Plan odnowień na Q4', tasks: 2 },
            { date: d(20), title: 'Pierwsze 100 dni — podsumowanie', tasks: 3 },
            { date: d(34), title: 'Proces eskalacji od klientów', tasks: 2 },
          ],
          ai: 'Ewa nie wypełniła ostatniego check-inu — zapytaj, czy rytm co tydzień nadal jej odpowiada.',
        },
        checkins: {
          rhythm: { weekday: 5, questions: 5, minutes: 1 },
          entries: [
            { date: d(11), mood: 3, done: 'Dwa odnowienia podpisane.', blocked: 'Eskalacje zajmują pół dnia.', help: 'Drugi człowiek w CS.', summary: 'OK — odnowienia idą, eskalacje męczą.' },
            { date: d(18), mood: 4, done: 'Onboarding klienta bez wsparcia Produktu.', blocked: '', help: '' },
            { date: d(25), mood: 4, done: 'Nowy playbook eskalacji.', blocked: '', help: '' },
            { date: d(32), mood: 5, done: 'NPS 9 od największego klienta.', blocked: '', help: '' },
            { date: d(39), mood: 5, done: 'Przegląd umów na Q4.', blocked: '', help: '' },
            { date: d(46), mood: 5, done: 'Pierwsze samodzielne odnowienie.', blocked: '', help: '' },
            { date: d(53), mood: 4, done: 'Mapa klientów gotowa.', blocked: 'Brak CRM-u.', help: '' },
          ],
          themes: [
            { text: 'Eskalacje od klientów', count: 2, tone: 'warn' },
            { text: 'Odnowienia idą dobrze', count: 3, tone: 'good' },
          ],
        },
        courses: [
          { id: 'c1', title: 'Rozmowy o odnowieniu umowy', provider: 'Nordlight Academy', units: '6 powtórek', progress: 10, due: '2026-12-20' },
        ],
        streak: { days: 0, best: 'eskalacje', toReview: 'negocjacje cenowe', pattern: [1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0] },
        recruitment: { score: '4,5', strongest: 'relacje z klientami', growth: 'raportowanie', position: 'Customer Success Lead', hiredOn: '2026-06-20', stages: 4, raters: ['Piotr Zieliński', 'Maya Lindqvist'] },
      },
    ],
    goals: [
      { id: 'g1', level: 'company', title: 'Osiągnąć 1 mln € ARR do końca 2027', owner: 'Piotr Zieliński', progress: 38, due: '2027-12-31' },
      { id: 'g2', level: 'team', parent: 'g1', title: 'Sprzedaż: 3 nowych operatorów sieci', owner: 'Piotr Zieliński', progress: 33, due: '2027-06-30' },
      { id: 'g3', level: 'person', parent: 'g2', title: 'Lena: 12 demo z operatorami w Q4', owner: 'Lena Hoffmann', progress: 50, due: '2026-12-31' },
      { id: 'g4', level: 'team', parent: 'g1', title: 'Produkt: samodzielny onboarding klienta', owner: 'Maya Lindqvist', progress: 20, due: '2027-03-31', tone: 'warn' },
      { id: 'g9', level: 'person', parent: 'g4', person: 'ewa', title: 'Ewa: 5 klientów wdrożonych bez wsparcia', owner: 'Ewa Dąbrowska', progress: 40, due: '2026-12-31',
        krs: [{ id: 'k1', text: '5 klientów przechodzi onboarding samodzielnie', status: 'W toku', progress: 40, meta: '2 z 5 klientów' }],
        updates: [{ date: d(9), text: 'Drugi klient wdrożony bez wsparcia Produktu.' }] },
      { id: 'g5', level: 'company', title: '99,9% dostępności dostarczania prognoz', owner: 'Anna Kowalczyk', progress: 72, due: '2026-12-31' },
      { id: 'g6', level: 'team', parent: 'g5', title: 'Platforma: migracja kolejki na partycje', owner: 'Tomasz Wiśniewski', progress: 80, due: '2026-11-30' },
      { id: 'g7', level: 'person', parent: 'g6', person: 'katarzyna', title: 'Katarzyna: p95 poniżej 500 ms', short: 'p95 poniżej 500 ms dla wszystkich klientów', owner: 'Katarzyna Mazur', progress: 65, due: '2026-11-30',
        krs: [
          { id: 'k1', text: 'p95 API prognoz < 500 ms', status: 'W toku', progress: 40, meta: '620 ms → cel 500 ms' },
          { id: 'k2', text: 'Alert przy przekroczeniu p95 dla klienta', status: 'Zrobione', progress: 100, meta: 'Gotowe' },
          { id: 'k3', text: 'Raport p95 per klient w panelu', status: 'W toku', progress: 50, meta: '2 z 4 klientów' },
        ],
        updates: [
          { date: d(4), text: 'Staging: p95 0,52 s po migracji. Czekamy na produkcję.' },
          { date: d(18), text: 'Alerty działają, pierwszy fałszywy alarm poprawiony.' },
        ] },
      { id: 'g8', level: 'person', parent: 'g6', person: 'leo', title: 'Leo: dashboard dostępności dla klientów', owner: 'Leo Fischer', progress: 25, due: '2026-12-15', tone: 'warn',
        krs: [
          { id: 'k1', text: 'Makiety dashboardu zatwierdzone', status: 'W toku', progress: 50, meta: 'Wersja 2 w review' },
          { id: 'k2', text: 'Test z 3 klientami', status: 'Do zrobienia', progress: 0, meta: '0 z 3' },
        ],
        updates: [{ date: d(4), text: 'Pierwsze makiety u zespołu Platformy, czekam na dane z produkcji.' }] },
    ],
    drafts: {
      checkin: { person: 'katarzyna', step: 2, mood: 4, done: 'Migracja kolejki działa na stagingu, p95 0,52 s.', blocked: '', help: '', extra: '' },
      review: { person: 'katarzyna', course: 'Incident commander', total: 18, index: 6, answered: 0, streak: 12, reward: 'certyfikat + voucher 50 €' },
    },
  };
}

/* ---------------------------------------------------------------- pytania powtórki z kursu */
export const REVIEW_QUESTIONS = [
  { q: 'Incydent trwa 20 minut, klient pyta o status. Co robisz jako pierwsze?', a: ['Naprawiam błąd i odpowiadam po naprawie', 'Wysyłam krótki status z czasem następnej aktualizacji', 'Przekazuję klienta do Customer Success', 'Czekam na decyzję menedżera'], correct: 1, why: 'Krótki status co 30 min zmniejsza presję na zespół i daje klientowi przewidywalność.' },
  { q: 'Kto podejmuje decyzję o wycofaniu wdrożenia w trakcie incydentu?', a: ['Autor zmiany', 'Incident commander', 'Menedżer zespołu', 'Głosowanie na kanale'], correct: 1, why: 'Jedna osoba decyduje, reszta wykonuje — to skraca czas reakcji i usuwa niejasność.' },
  { q: 'Po zakończeniu incydentu pierwszy krok to:', a: ['Zamknięcie kanału incydentu', 'Wpis w changelogu', 'Krótka notatka z osią czasu, zanim zapomnimy szczegóły', 'Rozmowa z autorem błędu'], correct: 2, why: 'Oś czasu spisana od razu jest podstawą postmortemu bez szukania winnych.' },
  { q: 'Jak często wysyłasz aktualizacje w trakcie incydentu P1?', a: ['Tylko po rozwiązaniu', 'Co 30 minut lub przy zmianie statusu', 'Raz dziennie', 'Gdy ktoś zapyta'], correct: 1, why: 'Regularny rytm aktualizacji buduje zaufanie, nawet gdy nie ma nowych faktów.' },
  { q: 'Postmortem ma być przede wszystkim:', a: ['Listą osób odpowiedzialnych', 'Bez obwiniania, z działaniami naprawczymi', 'Krótkim e-mailem do zarządu', 'Opcjonalny przy małych incydentach'], correct: 1, why: 'Kultura bez obwiniania sprawia, że ludzie mówią o problemach wcześniej.' },
  { q: 'Alert budzi Cię w nocy, ale wpływ na klientów jest zerowy. Co robisz?', a: ['Eskaluję do całego zespołu', 'Obniżam priorytet, zapisuję i wracam do tematu rano', 'Ignoruję alert', 'Wyłączam alert na stałe'], correct: 1, why: 'Priorytet zależy od wpływu na klienta; alerty bez wpływu poprawiamy w dzień.' },
];

/* ---------------------------------------------------------------- zapis */
let cache = null;
export function load() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const parsed = JSON.parse(raw); if (parsed && parsed.v === 1 && Array.isArray(parsed.people)) { cache = parsed; return cache; } }
  } catch { /* brak localStorage — pracujemy w pamięci */ }
  cache = seed();
  save(cache);
  return cache;
}
export function save(state) {
  cache = state;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* tryb prywatny: dane zostają do odświeżenia */ }
  return state;
}
export function update(fn) { const s = load(); fn(s); return save(s); }
export function reset() { cache = null; try { localStorage.removeItem(KEY); } catch { /* bez znaczenia */ } return load(); }
export function uid(prefix = 'id') { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`; }

/* ---------------------------------------------------------------- wyliczenia */
export function getPerson(state, id) { return (state.people || []).find((p) => p.id === id) || null; }
export function personDay(p) {
  if (typeof p.day === 'number') return p.day;
  return Math.max(1, daysBetween(p.start, today()) + 1);
}
export function personSubtitle(p) {
  return [p.role, p.team, p.start ? `start ${fmtStart(p.start)}` : '', p.manager ? `menedżer: ${p.manager}` : ''].filter(Boolean).join(' · ');
}
export function personGoals(state, p) { return (state.goals || []).filter((g) => g.person === p.id || g.owner === p.name); }
export function goalChain(state, goal) {
  const out = [goal];
  let cur = goal;
  const byId = Object.fromEntries(state.goals.map((g) => [g.id, g]));
  while (cur && cur.parent && byId[cur.parent]) { cur = byId[cur.parent]; out.unshift(cur); }
  return out;
}
export function goalsProgress(state, p) {
  const gs = personGoals(state, p);
  if (!gs.length) return null;
  return Math.round(gs.reduce((a, g) => a + (g.progress || 0), 0) / gs.length);
}
export function oneOnOneAgo(p) {
  if (!p.lastOneOnOne) return { days: null, label: 'Jeszcze nie było', tone: 'warn' };
  const days = daysBetween(p.lastOneOnOne, today());
  return { days, label: agoLabel(p.lastOneOnOne), tone: days >= 14 ? 'bad' : days >= 8 ? 'warn' : 'good' };
}
export function lastCheckin(p) {
  const e = (p.checkins && p.checkins.entries) || [];
  return e.slice().sort((a, b) => (a.date < b.date ? 1 : -1))[0] || null;
}
export function checkinStatus(p) {
  const last = lastCheckin(p);
  if (!last) return { label: 'Brak check-inów', tone: 'warn', ok: false };
  const days = daysBetween(last.date, today());
  if (days <= 7) return { label: 'W rytmie', tone: 'good', ok: true };
  if (days <= 14) return { label: 'Brak ostatniego', tone: 'warn', ok: false };
  return { label: 'Zaległy', tone: 'bad', ok: false };
}
/** Ostatnie n check-inów chronologicznie (od najstarszego). */
export function moodSeries(p, n = 8) {
  const e = ((p.checkins && p.checkins.entries) || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  return e.slice(-n);
}
export function moodAvg(entries) {
  if (!entries.length) return null;
  return entries.reduce((a, e) => a + Number(e.mood || 0), 0) / entries.length;
}
export function fmt1(n) { return n === null || n === undefined ? '–' : n.toFixed(1).replace('.', ','); }
export function courseCounts(p) {
  const c = p.courses || [];
  return { done: c.filter((x) => x.progress >= 100).length, total: c.length, active: c.filter((x) => x.progress < 100).length };
}
export function kpis(state) {
  const people = state.people || [];
  const t = today();
  const in90 = people.filter((p) => personDay(p) <= 90);
  const overdue = people.map((p) => ({ p, a: oneOnOneAgo(p) })).filter((x) => x.a.days === null || x.a.days >= 14);
  const rhythm = people.filter((p) => checkinStatus(p).ok);
  const missing = people.filter((p) => !checkinStatus(p).ok);
  const cur = [], prev = [];
  for (const p of people) for (const e of (p.checkins && p.checkins.entries) || []) {
    const age = daysBetween(e.date, t);
    if (age <= 28) cur.push(e); else if (age <= 56) prev.push(e);
  }
  const a = moodAvg(cur), b = moodAvg(prev);
  const ar = a === null ? null : Math.round(a * 10) / 10, br = b === null ? null : Math.round(b * 10) / 10;
  const delta = ar !== null && br !== null ? Math.round((ar - br) * 10) / 10 : null;
  return [
    { label: 'W pierwszych 90 dniach', value: String(in90.length), sub: in90.length ? in90.map((p) => firstName(p.name)).join(', ') : 'Nikt nie jest w onboardingu' },
    { label: 'Zaległe 1:1', value: String(overdue.length), sub: overdue.length ? `${overdue[0].p.name} · ${overdue[0].a.days === null ? 'brak' : overdue[0].a.days + ' dni'}` : 'Wszystkie w terminie' },
    { label: 'Check-iny w rytmie', value: `${rhythm.length} z ${people.length}`, sub: missing.length ? `${firstName(missing[0].name)} nie wypełnił${/a$/.test(firstName(missing[0].name)) ? 'a' : ''} ostatniego` : 'Wszyscy wypełnili ostatni' },
    { label: 'Średni nastrój', value: ar === null ? '–' : `${fmt1(ar)} / 5`, sub: delta === null ? 'Za mało danych na porównanie' : `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${fmt1(Math.abs(delta))} vs poprzedni miesiąc` },
  ];
}

/* ---------------------------------------------------------------- ikony lokalne (SVG inline, obrys 24×24) */
const LOCAL_ICONS = {
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  shield: '<path d="M12 3.5l7 2.8v5.2c0 4.3-3 7.6-7 9-4-1.4-7-4.7-7-9V6.3z"/>',
  book: '<path d="M12 6.5c-1.6-1.4-3.8-2-7-2v13c3.2 0 5.4.6 7 2 1.6-1.4 3.8-2 7-2v-13c-3.2 0-5.4.6-7 2zM12 6.5v13"/>',
  'chevron-down': '<path d="M6 9l6 6 6-6"/>',
  'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15zM10 21h4"/>',
};
export function localIcon(name, size = 16) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size); svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.6'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
  svg.classList.add('ico', `ico-${name}`);
  svg.innerHTML = LOCAL_ICONS[name] || LOCAL_ICONS.book;
  return svg;
}
/** Znak Tekmy (ten sam kształt co logo w pasku bocznym), wypełnienie currentColor. */
export function mark(size = 28) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 32 32');
  svg.setAttribute('width', size); svg.setAttribute('height', size);
  svg.setAttribute('fill', 'currentColor'); svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<path d="M3 6H17.5V22.5L12.5 28V12H3Z"/><path d="M20 6H29L20 12.5Z"/>';
  return svg;
}
