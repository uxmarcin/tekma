/**
 * views/decisions-data.js — dane demo i pamięć decyzji (odrzucenia, przesunięcia, zaproszenia).
 *
 * Eksport:
 *   REJECT_REASONS                      lista powodów odrzucenia (jak w Figmie 27:3550)
 *   TEAM                                rozmówcy firmy demo (kalendarz: proponowane terminy)
 *   interviewerForStage(stage)          -> członek TEAM domyślny dla etapu
 *   slotsFor(member)                    -> [{at: Date, label:'pt 11:00', long:'pt 7 lis · 11:00'}] (3 najbliższe)
 *   rejectMessage({candidate, position, reason})  -> tekst wiadomości do kandydata
 *   inviteMessage({candidate, position, stage, slot, interviewer}) -> tekst zaproszenia
 *   log()                               -> { interviews:[], messages:[], rejections:[] }
 *   addInterview(rec) / addMessage(rec) / addRejection(rec)   zapis w localStorage (tekma.demo.decisions)
 *   interviewsFor(candidate_id)         -> [] zaplanowane rozmowy kandydata
 *   isFemale(fullName), accusative(fullName), genitiveFirst(fullName)  — polska odmiana imion (heurystyka)
 *
 * Wszystko lokalnie w przeglądarce, bez zmian schematu bazy. Każdy zapis jest decyzją człowieka — AI nic tu nie zapisuje.
 */

const KEY = 'tekma.demo.decisions';

export const REJECT_REASONS = [
  'Brak wymaganych umiejętności',
  'Inna osoba lepiej pasuje',
  'Oczekiwania finansowe',
  'Rezygnacja kandydata',
];

export const TEAM = [
  { id: 'demo-piotr', name: 'Piotr Zieliński', role: 'CEO', stages: ['Rozmowa z CEO', 'Oferta'], hours: [[5, 11, 0], [5, 15, 30], [1, 10, 0]] },
  { id: 'demo-anna', name: 'Anna Kowalczyk', role: 'Head of People', stages: ['Screening CV', 'Rozmowa wstępna'], hours: [[4, 9, 30], [4, 13, 0], [2, 11, 0]] },
  { id: 'demo-tomasz', name: 'Tomasz Nowak', role: 'Engineering Manager', stages: ['Rozmowa techniczna', 'Zadanie projektowe', 'Zadanie SQL', 'Symulacja rozmowy', 'Rozmowa z zespołem'], hours: [[3, 10, 0], [3, 14, 0], [5, 12, 0]] },
];

const DAYS = ['nd', 'pon', 'wt', 'śr', 'czw', 'pt', 'sob'];
const MONTHS = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
const pad = (n) => String(n).padStart(2, '0');

export function interviewerForStage(stage) {
  return TEAM.find((m) => m.stages.includes(stage)) || TEAM[2];
}

/** Najbliższe wolne terminy rozmówcy: (dzień tygodnia, godzina, minuta) → konkretne daty po dziś. */
export function slotsFor(member) {
  const now = new Date();
  return (member.hours || []).map(([dow, hh, mm]) => {
    const d = new Date(now);
    d.setHours(hh, mm, 0, 0);
    let diff = (dow - d.getDay() + 7) % 7;
    if (diff === 0 && d <= now) diff = 7;
    d.setDate(d.getDate() + diff);
    return { at: d, label: `${DAYS[d.getDay()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`, long: `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} · ${pad(d.getHours())}:${pad(d.getMinutes())}` };
  }).sort((a, b) => a.at - b.at);
}

/* ---------------------------------------------------------------- odmiana (heurystyka) */
const first = (n) => String(n || '').trim().split(/\s+/)[0] || '';
export function isFemale(fullName) {
  const f = first(fullName).toLowerCase();
  return f.endsWith('a') && !['kuba', 'barnaba', 'bonawentura'].includes(f);
}
/** Biernik: „Martę Lewandowską”, „Jakuba Szymańskiego”, „Lenę Hoffmann”. */
export function accusative(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/);
  if (!parts.length) return '';
  const female = isFemale(fullName);
  return parts.map((p, i) => {
    const low = p.toLowerCase();
    if (female) {
      if (/(ska|cka|dzka)$/.test(low)) return p.slice(0, -1) + 'ą';
      if (low.endsWith('a')) return p.slice(0, -1) + 'ę';
      return p; // obce nazwiska żeńskie nie odmieniają się
    }
    if (/(ski|cki|dzki)$/.test(low)) return p.slice(0, -1) + 'iego';
    if (/(y|i)$/.test(low) && i === 0) return p.slice(0, -1) + 'ego';
    if (low.endsWith('a')) return p.slice(0, -1) + 'ę';
    if (/[oeiuy]$/.test(low)) return p;
    return p + 'a';
  }).join(' ');
}
/** Dopełniacz imienia: „kalendarza Piotra”, „kalendarza Anny”. */
export function genitiveFirst(fullName) {
  const f = first(fullName);
  const low = f.toLowerCase();
  if (!f) return '';
  if (low.endsWith('ia') || low.endsWith('ja')) return f.slice(0, -1);
  if (/(ka|ga)$/.test(low)) return f.slice(0, -1) + 'i';
  if (low.endsWith('a')) return f.slice(0, -1) + 'y';
  if (/[oe]$/.test(low)) return f;
  return f + 'a';
}

/* ---------------------------------------------------------------- szablony wiadomości */
export function rejectMessage({ candidate, position, reason } = {}) {
  const female = isFemale(candidate && candidate.full_name);
  const name = first(candidate && candidate.full_name);
  const title = position && position.title ? ` na stanowisko ${position.title}` : '';
  const why = {
    'Brak wymaganych umiejętności': `Tym razem szukamy osoby z większym doświadczeniem w obszarach kluczowych dla tej roli.`,
    'Inna osoba lepiej pasuje': `Tym razem ${female ? 'wybraliśmy' : 'wybraliśmy'} inną osobę, której doświadczenie bliżej odpowiada naszym potrzebom.`,
    'Oczekiwania finansowe': `Nie udało nam się spotkać w kwestii wynagrodzenia, co w pełni rozumiemy.`,
    'Rezygnacja kandydata': `Przyjmujemy Twoją decyzję o wycofaniu się z procesu.`,
  }[reason] || `Tym razem nie zdecydowaliśmy się kontynuować procesu.`;
  return `Cześć ${name || ''},\n\ndziękujemy za Twój czas i rozmowę${title}. ${why} Chętnie odezwiemy się przy kolejnej rekrutacji, jeśli ${female ? 'wyrazisz' : 'wyrazisz'} zgodę na zachowanie Twoich danych.\n\nPozdrawiamy,\nZespół Nordlight Labs`;
}
export function inviteMessage({ candidate, position, stage, slot, interviewer } = {}) {
  const name = first(candidate && candidate.full_name);
  return `Cześć ${name || ''},\n\nzapraszamy na kolejny etap: ${stage}${position && position.title ? ` (${position.title})` : ''}. Termin: ${slot ? slot.long : 'do ustalenia'}${interviewer ? `, rozmowę poprowadzi ${interviewer.name}` : ''}. Szczegóły i link do spotkania znajdziesz w portalu kandydata.\n\nPozdrawiamy,\nZespół Nordlight Labs`;
}

/* ---------------------------------------------------------------- pamięć (localStorage) */
function read() {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : null;
    return { interviews: [], messages: [], rejections: [], ...(v && typeof v === 'object' ? v : {}) };
  } catch { return { interviews: [], messages: [], rejections: [] }; }
}
function write(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* tryb prywatny — bez trwałości */ }
}
const uid = () => `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function log() { return read(); }
export function addInterview(rec) { const d = read(); const r = { id: uid(), created_at: new Date().toISOString(), ...rec }; d.interviews.push(r); write(d); return r; }
export function addMessage(rec) { const d = read(); const r = { id: uid(), created_at: new Date().toISOString(), ...rec }; d.messages.push(r); write(d); return r; }
export function addRejection(rec) { const d = read(); const r = { id: uid(), created_at: new Date().toISOString(), ...rec }; d.rejections.push(r); write(d); return r; }
export function interviewsFor(candidate_id) { return read().interviews.filter((i) => i.candidate_id === candidate_id); }
/** Zmiana etapu (każda ręczna: przeciągnięcie, menu, okno) — do raportu „dni bez ruchu”. */
export function addMove(rec) { const d = read(); d.moves = d.moves || []; d.moves.push({ id: uid(), at: new Date().toISOString(), ...rec }); if (d.moves.length > 500) d.moves = d.moves.slice(-500); write(d); }
export function lastMoveAt(candidate_id) { const m = (read().moves || []).filter((x) => x.candidate_id === candidate_id); return m.length ? m[m.length - 1].at : null; }

export default { REJECT_REASONS, TEAM, interviewerForStage, slotsFor, rejectMessage, inviteMessage, log, addInterview, addMessage, addRejection, interviewsFor, addMove, lastMoveAt, isFemale, accusative, genitiveFirst };
