/**
 * views/marketplace-data.js — dane demo marketplace rekruterów z Figmy (ramki 32:4954, 32:5281).
 * Zapis w localStorage (`tekma.demo.marketplace`): rekruterzy, moje zlecenia, wysłane wiadomości.
 *
 *   marketplace.get() / .update(fn) / .reset()
 *   FUNCTIONS, REGIONS, MODELS — słowniki filtrów
 */

export const STORAGE_KEY = 'tekma.demo.marketplace';

export const FUNCTIONS = ['Inżynieria', 'Dane', 'Produkt', 'Design', 'Sprzedaż', 'Customer Success', 'Operacje', 'HR'];
export const REGIONS = ['Polska', 'DACH', 'CEE', 'UE', 'Nordics'];
export const MODELS = [
  { key: 'retainer', label: 'Stała opłata + bonus' },
  { key: 'percent', label: '% pensji rocznej' },
  { key: 'success', label: 'Opłata za zatrudnienie' },
  { key: 'monthly', label: 'Abonament miesięczny' },
];

export function defaults() {
  return {
    v: 1,
    recruiters: [
      {
        id: 'joanna-nowak', name: 'Joanna Nowak', initials: 'JN', kind: 'person', verified: true,
        headline: 'Tech Recruiting', city: 'Warszawa', meta: 'Tech Recruiting · Warszawa',
        functions: ['Inżynieria', 'Dane'], regions: ['Polska', 'DACH'], model: 'retainer',
        stats: { candidates: 148, hires: 9, rating: 4.9, reviews: 12, shortlistDays: 11 },
        price: '4 000 zł / mies. + 8 000 zł',
        profile: {
          meta: 'Tech Recruiting · Warszawa · 9 lat w rekrutacji IT · LinkedIn',
          about: 'Rekrutuję backend i data engineerów dla startupów od seed do serii B. Pracuję na krótkich listach — zwykle 5–7 kandydatów na rolę, każdy po rozmowie ze mną i ocenie według Waszej rubryki.',
          tags: ['Go', 'Python', 'Data Engineering', 'SRE', 'Polska', 'DACH'],
          reviews: [
            { stars: 5, who: 'Startup z branży fintech · CTO', text: 'Pierwsza shortlista po 9 dniach, 2 z 5 osób doszły do oferty.' },
            { stars: 5, who: 'SaaS B2B · CEO', text: 'Kandydaci przychodzą z oceną według naszej rubryki — oszczędza nam to po 2 rozmowy na osobę.' },
          ],
          terms: [
            { k: 'Stała opłata', v: '4 000 zł / 30 dni' },
            { k: 'Bonus za zatrudnienie', v: '8 000 zł' },
            { k: 'Gwarancja', v: 'Wymiana kandydata do 90 dni' },
            { k: 'Płatność', v: 'Kartą przez Tekmę · faktura automatyczna' },
          ],
          scopeNote: 'Rekruterka zobaczy tylko stanowiska, do których ją zaprosisz.',
        },
      },
      {
        id: 'talentbridge', name: 'TalentBridge', initials: 'T', kind: 'agency', verified: true,
        headline: 'Agencja', city: 'Kraków', meta: 'Agencja · 6 rekruterów · Kraków',
        functions: ['Sprzedaż', 'Customer Success'], regions: ['Polska', 'CEE'], model: 'percent',
        stats: { candidates: 412, hires: 31, rating: 4.8, reviews: 27, shortlistDays: 14 },
        price: '12% pensji rocznej',
        profile: {
          meta: 'Agencja · 6 rekruterów · Kraków · od 2016 · LinkedIn',
          about: 'Rekrutujemy zespoły sprzedażowe i Customer Success dla firm SaaS w Polsce i CEE. Każdy kandydat przechodzi u nas symulację rozmowy sprzedażowej, a wynik dostajecie razem z CV.',
          tags: ['Account Executive', 'SDR', 'Customer Success', 'Polska', 'CEE'],
          reviews: [
            { stars: 5, who: 'SaaS HR-tech · Head of Sales', text: 'Trzech AE zatrudnionych w kwartał, wszyscy nadal z nami po roku.' },
            { stars: 4, who: 'Marketplace B2B · COO', text: 'Solidne shortlisty, choć czas do pierwszej listy bywał dłuższy niż obiecany.' },
          ],
          terms: [
            { k: 'Prowizja', v: '12% pensji rocznej' },
            { k: 'Płatne', v: 'Po 30 dniach od startu kandydata' },
            { k: 'Gwarancja', v: 'Wymiana kandydata do 60 dni' },
            { k: 'Płatność', v: 'Kartą przez Tekmę · faktura automatyczna' },
          ],
          scopeNote: 'Agencja zobaczy tylko stanowiska, do których ją zaprosisz.',
        },
      },
      {
        id: 'marek-duda', name: 'Marek Duda', initials: 'MD', kind: 'person', verified: true,
        headline: 'Design & Product', city: 'zdalnie', meta: 'Design & Product · zdalnie',
        functions: ['Produkt', 'Design'], regions: ['UE'], model: 'monthly',
        stats: { candidates: 96, hires: 7, rating: 5.0, reviews: 8, shortlistDays: 12 },
        price: '3 500 zł / mies.',
        profile: {
          meta: 'Design & Product · zdalnie · 7 lat w rekrutacji produktowej · LinkedIn',
          about: 'Szukam product designerów i product managerów dla firm od serii A. Oceniam portfolio razem z Waszym zespołem i przynoszę 4–6 osób na rolę, każdą po zadaniu projektowym.',
          tags: ['Product Design', 'Product Management', 'UX Research', 'UE'],
          reviews: [
            { stars: 5, who: 'Fintech · Head of Design', text: 'Pierwszy raz dostaliśmy kandydatów z gotową oceną portfolio w naszej rubryce.' },
          ],
          terms: [
            { k: 'Abonament', v: '3 500 zł / mies.' },
            { k: 'Bonus za zatrudnienie', v: 'brak' },
            { k: 'Gwarancja', v: 'Wymiana kandydata do 90 dni' },
            { k: 'Płatność', v: 'Kartą przez Tekmę · faktura automatyczna' },
          ],
          scopeNote: 'Rekruter zobaczy tylko stanowiska, do których go zaprosisz.',
        },
      },
      {
        id: 'hire-north', name: 'Hire North', initials: 'HN', kind: 'agency', verified: true,
        headline: 'Agencja', city: 'Berlin', meta: 'Agencja · 3 rekruterów · Berlin',
        functions: ['Inżynieria'], regions: ['DACH', 'Nordics'], model: 'success',
        stats: { candidates: 203, hires: 14, rating: 4.7, reviews: 15, shortlistDays: 16 },
        price: '6 000 € za zatrudnienie',
        profile: {
          meta: 'Agencja · 3 rekruterów · Berlin · od 2019 · LinkedIn',
          about: 'Inżynierowie backend i platform dla firm z DACH i Skandynawii. Pracujemy po niemiecku, angielsku i szwedzku; kandydaci po rozmowie technicznej z naszym inżynierem.',
          tags: ['Backend', 'Platform', 'Kubernetes', 'DACH', 'Nordics'],
          reviews: [
            { stars: 5, who: 'Climate-tech · CTO', text: 'Dwóch senior backendowców w 6 tygodni, obaj z relokacją do Berlina.' },
            { stars: 4, who: 'E-commerce · VP Engineering', text: 'Dobra jakość, cena wyższa niż u polskich rekruterów.' },
          ],
          terms: [
            { k: 'Opłata za zatrudnienie', v: '6 000 €' },
            { k: 'Płatne', v: 'W dniu podpisania umowy' },
            { k: 'Gwarancja', v: 'Wymiana kandydata do 90 dni' },
            { k: 'Płatność', v: 'Kartą przez Tekmę · faktura automatyczna' },
          ],
          scopeNote: 'Agencja zobaczy tylko stanowiska, do których ją zaprosisz.',
        },
      },
      {
        id: 'ola-mazur', name: 'Ola Mazur', initials: 'OM', kind: 'person', verified: true,
        headline: 'People & Ops', city: 'Gdańsk', meta: 'People & Ops · Gdańsk',
        functions: ['Operacje', 'HR'], regions: ['Polska'], model: 'retainer',
        stats: { candidates: 71, hires: 6, rating: 4.9, reviews: 9, shortlistDays: 10 },
        price: '2 800 zł / mies. + 5 000 zł',
        profile: {
          meta: 'People & Ops · Gdańsk · 6 lat w HR · LinkedIn',
          about: 'Rekrutuję role operacyjne i HR: office managerów, people partnerów, specjalistów ds. płac. Krótkie listy, kandydaci po rozmowie referencyjnej.',
          tags: ['People Partner', 'Office Management', 'Payroll', 'Polska'],
          reviews: [
            { stars: 5, who: 'Software house · CEO', text: 'People Partnerka zatrudniona w 3 tygodnie, idealne dopasowanie do kultury.' },
          ],
          terms: [
            { k: 'Stała opłata', v: '2 800 zł / 30 dni' },
            { k: 'Bonus za zatrudnienie', v: '5 000 zł' },
            { k: 'Gwarancja', v: 'Wymiana kandydata do 60 dni' },
            { k: 'Płatność', v: 'Kartą przez Tekmę · faktura automatyczna' },
          ],
          scopeNote: 'Rekruterka zobaczy tylko stanowiska, do których ją zaprosisz.',
        },
      },
      {
        id: 'kodo-talent', name: 'Kodo Talent', initials: 'KT', kind: 'agency', verified: true,
        headline: 'Agencja', city: 'Wrocław', meta: 'Agencja · 4 rekruterów · Wrocław',
        functions: ['Inżynieria', 'Dane'], regions: ['Polska'], model: 'percent',
        stats: { candidates: 266, hires: 22, rating: 4.6, reviews: 31, shortlistDays: 13 },
        price: '10% pensji rocznej',
        profile: {
          meta: 'Agencja · 4 rekruterów · Wrocław · od 2017 · LinkedIn',
          about: 'Inżynierowie i data scientists dla firm produktowych w Polsce. Duża baza kandydatów pasywnych, pierwsza lista zwykle w 2 tygodnie.',
          tags: ['Java', 'Python', 'Data Science', 'Polska'],
          reviews: [
            { stars: 5, who: 'Logistyka · CTO', text: 'Szybko i bez niespodzianek. 4 zatrudnienia w pół roku.' },
            { stars: 4, who: 'Gaming · Head of Engineering', text: 'Dobrzy w mid-levelach, seniorzy trudniej.' },
          ],
          terms: [
            { k: 'Prowizja', v: '10% pensji rocznej' },
            { k: 'Płatne', v: 'Po 30 dniach od startu kandydata' },
            { k: 'Gwarancja', v: 'Wymiana kandydata do 60 dni' },
            { k: 'Płatność', v: 'Kartą przez Tekmę · faktura automatyczna' },
          ],
          scopeNote: 'Agencja zobaczy tylko stanowiska, do których ją zaprosisz.',
        },
      },
    ],
    orders: [ // „Moje zlecenia”
      { id: 'o1', recruiter_id: 'joanna-nowak', position_title: 'Senior Backend Engineer', status: 'active', started: '2026-10-20', note: 'Shortlista 5 osób do 20 listopada' },
    ],
    messages: [], // {id, recruiter_id, text, sent_at}
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults();
    return { ...defaults(), ...JSON.parse(raw) };
  } catch { return defaults(); }
}
function save(s) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* bez znaczenia */ } }
const clone = (x) => JSON.parse(JSON.stringify(x));
let state = load();

export const marketplace = {
  get: () => clone(state),
  update(fn) { const next = clone(state); fn(next); state = next; save(state); return clone(state); },
  reset() { state = defaults(); save(state); return clone(state); },
};
export const uid = () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2));
export default marketplace;
