/**
 * views/settings-data.js — dane demo ustawień (firma, zespół, integracje, plan, RODO i AI Act) z Figmy
 * (ramki 31:4384, 31:4585, 31:4872, 31:5113, 12:1352). Zapis w localStorage (`tekma.demo.settings`),
 * bez zmian schematu bazy. Każda akcja w widokach działa na tych danych.
 *
 *   settings.get()                 -> stan (kopia)
 *   settings.update(fn | patch)    -> zapisuje i zwraca nowy stan
 *   settings.reset()               -> wraca do danych demo
 *   ROLES                          -> model ról z kontraktu (owner / recruiter / interviewer) + etykiety z Figmy
 *   ROLE_INFO                      -> „Co widzi każda rola” (pięć kafelków z Figmy; manager i external to role demo,
 *                                     poza modelem bazy — w zaproszeniach dostępne są tylko trzy role z kontraktu)
 */

export const STORAGE_KEY = 'tekma.demo.settings';

/** Role z modelu danych (members.role check in ('owner','recruiter','interviewer')). Etykiety jak w Figmie. */
export const ROLES = [
  { key: 'owner', label: 'Admin', access: 'Wszystko', desc: 'Wszystko, w tym rozliczenia i RODO' },
  { key: 'recruiter', label: 'Rekrutacja', access: 'Wszystkie stanowiska', desc: 'Stanowiska, kandydaci, raporty' },
  { key: 'interviewer', label: 'Rozmówca', access: 'Przypisane rozmowy', desc: 'Tylko swoje rozmowy i karty ocen' },
];
/** Role pokazywane w siatce „Co widzi każda rola” — pięć jak w Figmie. */
export const ROLE_INFO = [
  ...ROLES,
  { key: 'manager', label: 'Menedżer', access: 'Swój zespół', desc: 'Swój zespół: 1:1, check-iny, cele', demoOnly: true },
  { key: 'external', label: 'Rekruter zewn.', access: 'Tylko przypisane stanowiska', desc: 'Tylko przypisane stanowiska', demoOnly: true },
];
export const ROLE_LABEL = Object.fromEntries(ROLE_INFO.map((r) => [r.key, r.label]));

const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString();
const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString();

export function defaults() {
  return {
    v: 1,
    company: {
      name: 'Nordlight Labs',
      website: 'nordlight.io',
      description: 'Prognozujemy zapotrzebowanie na energię dla operatorów sieci w Europie. 35 osób, Warszawa · Kraków · Berlin.',
      language: 'Polski',
      timezone: 'Europa/Warszawa',
      logoColor: 'info', // info | good | warn | bad | ink
      careers: { url: 'nordlight.tekma.app/kariera', customDomain: 'kariera.nordlight.io', useCustomDomain: false, showSalary: true, english: true },
      values: ['Kultura pisania', 'Małe, zgrane zespoły', 'Uczciwość z założenia'],
    },
    members: [
      { id: 'm1', name: 'Anna Kowalczyk', email: 'anna@nordlight.io', role: 'owner', access: 'Wszystko', last_seen: minutesAgo(0) },
      { id: 'm2', name: 'Piotr Zieliński', email: 'piotr@nordlight.io', role: 'owner', access: 'Wszystko', last_seen: daysAgo(1) },
      { id: 'm3', name: 'Aleksandra Nowak', email: 'ola@nordlight.io', role: 'recruiter', access: 'Wszystkie stanowiska', last_seen: minutesAgo(120) },
      { id: 'm4', name: 'Tomasz Wiśniewski', email: 'tomasz@nordlight.io', role: 'interviewer', access: 'Przypisane rozmowy', last_seen: daysAgo(3) },
      { id: 'm5', name: 'Dev Patel', email: 'dev@nordlight.io', role: 'manager', access: 'Swój zespół (Platforma)', last_seen: minutesAgo(30) },
      { id: 'm6', name: 'Joanna Nowak', email: 'joanna@techrecruit.pl', role: 'external', access: '1 stanowisko', last_seen: daysAgo(5) },
    ],
    invites: [], // {id, email, role, sent_at}
    integrations: [
      { key: 'gcal', name: 'Kalendarz Google', desc: 'Notetaker dołącza do rozmów sam', icon: 'calendar', connected: true, action: 'Połącz' },
      { key: 'gmail', name: 'Gmail', desc: 'Wiadomości do kandydatów w jednym wątku', icon: 'mail', connected: true, action: 'Połącz' },
      { key: 'outlook', name: 'Outlook i Teams', desc: 'Kalendarz, poczta i nagrywanie w Teams', icon: 'plug', connected: false, action: 'Połącz' },
      { key: 'slack', name: 'Slack', desc: 'Powiadomienia o ocenach i zaległych 1:1', icon: 'plug', connected: false, action: 'Połącz' },
      { key: 'linkedin', name: 'LinkedIn (wtyczka Chrome)', desc: 'Dodaj kandydata jednym kliknięciem', icon: 'link', connected: false, action: 'Zainstaluj', connectedLabel: 'Zainstalowano' },
      { key: 'zoom', name: 'Zoom', desc: 'Notetaker w rozmowach Zoom', icon: 'plug', connected: false, action: 'Połącz' },
      { key: 'claude', name: 'Claude i MCP', desc: 'Sprawdzaj kandydatów i lejki z poziomu Claude', icon: 'sparkle', connected: true, action: 'Połącz' },
      { key: 'stripe', name: 'Stripe', desc: 'Wypłaty dla rekruterów z marketplace', icon: 'card', connected: false, action: 'Połącz' },
      { key: 'ats', name: 'Import z ATS', desc: 'Greenhouse, Lever, Ashby, CSV', icon: 'upload', connected: false, action: 'Importuj', connectedLabel: 'Zaimportowano' },
    ],
    plan: {
      key: 'pro', name: 'Pro', price: '129 € / mies.', renews: 'Odnawia się 1 grudnia', invoiceTo: 'faktura na Nordlight Labs sp. z o.o., NIP 525-xxx-xx-xx',
      status: 'active', // active | cancelled
      usage: { aiInterviews: { used: 41, limit: 60 }, positions: { used: 4, limit: null }, seats: { used: 6, limit: null } },
      payment: { brand: 'Visa', last4: '4242', expires: '08/28' },
    },
    plans: [
      { key: 'starter', name: 'Starter', price: '49 € / mies.', aiLimit: 20, note: '1 stanowisko aktywne, 3 miejsca w zespole' },
      { key: 'pro', name: 'Pro', price: '129 € / mies.', aiLimit: 60, note: 'Stanowiska i miejsca bez limitu, 60 rozmów z analizą AI' },
      { key: 'scale', name: 'Scale', price: '349 € / mies.', aiLimit: 250, note: 'Wszystko z Pro, 250 rozmów, SSO i rejestr audytowy' },
    ],
    invoices: [
      { id: 'inv-3', date: '2026-11-01', label: '1 lis 2026', desc: '129,00 € + 6 rozmów × 2 €', status: 'paid' },
      { id: 'inv-2', date: '2026-10-01', label: '1 paź 2026', desc: '129,00 €', status: 'paid' },
      { id: 'inv-1', date: '2026-09-01', label: '1 wrz 2026', desc: '49,00 € (Starter)', status: 'paid' },
    ],
    compliance: {
      recordingConsent: true,
      candidateExplanations: true,
      retentionMonths: 12,
      aiOnlySuggests: true,     // zablokowane (AI Act) — nie da się wyłączyć
      aiDecisionLog: true,      // zablokowane
      biasControl: false,
      dataLocation: 'UE · Frankfurt',
      processors: [
        { name: 'Supabase (baza i pliki)', region: 'UE · Frankfurt', dpa: 'DPA podpisana' },
        { name: 'Anthropic (analiza rozmów)', region: 'UE / USA, bez treningu na danych', dpa: 'DPA podpisana' },
        { name: 'Stripe (płatności)', region: 'UE · Dublin', dpa: 'DPA podpisana' },
        { name: 'Google Workspace (kalendarz, poczta)', region: 'UE', dpa: 'DPA podpisana' },
      ],
      requests: [
        { id: 'r1', name: 'Claire Dubois', type: 'Dostęp do danych', status: 'open', due_days: 26, received: daysAgo(4) },
        { id: 'r2', name: 'Oskar Kamiński', type: 'Usunięcie danych', status: 'done', closed: 'zamknięty 2 paź', received: daysAgo(40) },
        { id: 'r3', name: 'Julia Majewska', type: 'Wyjaśnienie wyników AI', status: 'done', closed: 'zamknięty 18 wrz', received: daysAgo(55) },
      ],
    },
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw);
    const d = defaults();
    return { ...d, ...parsed, company: { ...d.company, ...(parsed.company || {}) }, plan: { ...d.plan, ...(parsed.plan || {}) }, compliance: { ...d.compliance, ...(parsed.compliance || {}) } };
  } catch { return defaults(); }
}
function save(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* prywatne okno — trzymamy w pamięci */ }
}
const clone = (x) => JSON.parse(JSON.stringify(x));

let state = load();

export const settings = {
  get: () => clone(state),
  update(fnOrPatch) {
    const next = clone(state);
    if (typeof fnOrPatch === 'function') fnOrPatch(next); else Object.assign(next, fnOrPatch);
    state = next; save(state);
    return clone(state);
  },
  reset() { state = defaults(); save(state); return clone(state); },
};

export const uid = () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2));

export default settings;
