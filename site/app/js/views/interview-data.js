/**
 * views/interview-data.js — dane demo rozmowy (agent C2): transkrypcja, pokrycie rubryki, podpowiedzi coacha AI,
 * dopasowanie CV (punkty), podsumowanie AI, krótkie etykiety kotwic — oraz zapis notatek / rekomendacji / sesji
 * rozmowy w localStorage (`tekma.demo.interview`). Bez zmian schematu bazy.
 *
 * API:
 *   interviewDemo({ candidate, position, rubric, stage }) -> { transcript:[{t, who, text, mark}], coverage:{qid:[{label, ok}]},
 *       coach:{qid:{missing, questions:[…]}}, cv:[{ok, text}], summary, duration:'48:12', evidence:{qid:{time}} }
 *   shortAnchor(question, n) -> krótka etykieta kotwicy (np. „Ogólniki”)
 *   notes.get(cid, stage, qid) / notes.set(cid, stage, qid, text)
 *   reco.get(cid, stage) / reco.set(cid, stage, value)       // 'strong_no'|'no'|'yes'|'strong_yes'
 *   session.get(cid, stage) / session.set(cid, stage, data) / session.clear(cid, stage)
 *   firstName(fullName), speakerName(candidate), RATER_NAMES
 *
 * Zasada AI Act: wszystko, co tu pochodzi „od AI”, jest tylko podpowiedzią — decyzję podejmuje człowiek.
 */

const KEY = 'tekma.demo.interview';

/* ------------------------------------------------ localStorage */
function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; }
}
function save(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* prywatne okno — nic nie robimy */ }
}
function bucket(name) {
  const d = load();
  if (!d[name] || typeof d[name] !== 'object') d[name] = {};
  return [d, d[name]];
}
const k = (...parts) => parts.map((p) => String(p ?? '')).join('|');

export const notes = {
  get(cid, stage, qid) { const [, b] = bucket('notes'); return b[k(cid, stage, qid)] || ''; },
  set(cid, stage, qid, text) { const [d, b] = bucket('notes'); if (text) b[k(cid, stage, qid)] = String(text); else delete b[k(cid, stage, qid)]; save(d); },
};
export const reco = {
  get(cid, stage) { const [, b] = bucket('reco'); return b[k(cid, stage)] || null; },
  set(cid, stage, value) { const [d, b] = bucket('reco'); if (value) b[k(cid, stage)] = value; else delete b[k(cid, stage)]; save(d); },
};
export const session = {
  get(cid, stage) { const [, b] = bucket('sessions'); return b[k(cid, stage)] || null; },
  set(cid, stage, data) { const [d, b] = bucket('sessions'); b[k(cid, stage)] = data; save(d); },
  clear(cid, stage) { const [d, b] = bucket('sessions'); delete b[k(cid, stage)]; save(d); },
};

/* ------------------------------------------------ pomocnicze */
function hash(str) {
  let h = 0x811c9dc5;
  const s = String(str);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
export function firstName(full = '') { return String(full).trim().split(/\s+/)[0] || ''; }
export function speakerName(candidate) { return firstName(candidate && candidate.full_name) || 'Kandydat'; }
/** Rozmówcy w demo (Figma): Anna i Tomasz. */
export const RATER_NAMES = ['Anna', 'Tomasz'];

const mmss = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

/* ------------------------------------------------ krótkie kotwice (Figma) */
const SHORT = {
  'q-system-design': ['Cudze rozwiązania', 'Wzorce bez liczb', 'Jedno rozwiązanie', 'Dwa podejścia + wyniki', '+ kompromisy i pomiar'],
  'q-problem-solving': ['Ogólniki', 'Brak metody', 'Metoda bez przykładu', 'Metoda + przykład', '+ weryfikacja i wnioski'],
  'q-collaboration': ['Unika lub narzuca', 'Sprzeciw bez argumentów', 'Argumenty, lojalność', 'Dane lub eksperyment', 'Spór → decyzja z dowodów'],
  'q-quality': ['Jakość to QA', 'Testy sporadycznie', 'Kluczowe ścieżki + review', 'Praktyki i pomiar', 'Kultura jakości'],
  'q-process': ['Same ekrany', 'Decyzje z gustu', 'Dane, brak iteracji', 'Iteracje i metryki', 'Jak lider produktu'],
  'q-craft': ['Nic do poprawy', 'Drobiazgi wizualne', 'Problemy użyteczności', 'Lepsza struktura', 'Precyzja mentora'],
  'q-discovery': ['Mówi o produkcie', 'Pytania z listy', 'Jeden realny problem', 'Ból + następny krok', 'Klient sam formułuje'],
  'q-resilience': ['Obwinia innych', 'Bez wniosków', 'Jeden wniosek', 'Zmiana w procesie', 'Playbook dla zespołu'],
};
export function shortAnchor(question, n) {
  const pre = question && SHORT[question.id];
  if (pre && pre[n - 1]) return pre[n - 1];
  const a = question && question.anchors && (question.anchors[n] || question.anchors[String(n)]);
  if (!a) return `Poziom ${n}`;
  const cut = String(a).split(/[;.,(]/)[0].trim();
  return cut.length > 26 ? cut.slice(0, 25).trimEnd() + '…' : cut;
}

/* ------------------------------------------------ dane demo rozmowy */
/** Marta Lewandowska — Senior Backend Engineer (teksty 1:1 z Figmy). */
const MARTA = {
  duration: '48:12',
  cv: [
    { ok: true, text: '6 lat z Go i PostgreSQL' },
    { ok: true, text: 'Skalowała kolejki zadań do 2 mln/dzień' },
    { ok: true, text: 'Mentoring juniorów' },
    { ok: false, text: 'Brak doświadczenia z Kafką' },
    { ok: false, text: 'Krótko w ostatniej firmie (8 mies.)' },
  ],
  summary: 'Mocna w projektowaniu systemów, konkretne liczby. Do sprawdzenia: krótki staż w ostatniej firmie.',
  compareSummary: 'Bardzo dobra technicznie, krótki staż w ostatniej firmie.',
  transcript: [
    { t: '12:04', who: 'Tomasz', text: 'Co pękło jako pierwsze, gdy ruch się podwoił?' },
    { t: '12:11', who: 'Marta', text: 'Kolejka w monolicie. Przenieśliśmy ją na partycjonowane tabele — p95 spadło z 4 s do 0,4 s.', mark: true },
    { t: '12:48', who: 'Tomasz', text: 'Która część tej decyzji była Twoja?' },
  ],
  live: {
    lines: [
      { t: '16:58', who: 'Tomasz', text: 'Opowiedz o swoim największym wyzwaniu ze skalowaniem systemu.' },
      { t: '17:05', who: 'Marta', text: 'Mieliśmy kolejkę zadań w monolicie. Przy podwojeniu ruchu p95 skoczyło do 4 sekund.' },
      { t: '17:31', who: 'Marta', text: 'Przeniosłam kolejkę na partycjonowane tabele w Postgresie i rozdzieliłam workery per klient.', mark: true },
      { t: '18:02', who: 'Marta', text: 'Po dwóch tygodniach p95 spadło do 0,4 s, a koszt bazy był niższy o 30%.', mark: true },
      { t: '18:40', who: 'Tomasz', text: 'A co byś dziś zrobiła inaczej?' },
    ],
    coverage: [
      { label: 'Własna decyzja', ok: true },
      { label: 'Głębia techniczna', ok: true },
      { label: 'Kompromisy', ok: false },
      { label: 'Mierzalny efekt', ok: true },
    ],
    missing: 'Brakuje „kompromisów”. Dopytaj, zanim przejdziesz dalej:',
    questions: [
      'Co poświęciłaś, wybierając partycjonowanie zamiast osobnej kolejki?',
      'Która część tej decyzji była Twoja, a która zespołu?',
      'Jak sprawdziłaś, że spadek p95 wynikał z tej zmiany?',
    ],
  },
  evidence: {
    'q-problem-solving': {
      time: '25:12',
      quote: 'Najpierw dodaję korelację requestów i odtwarzam ruch z logów na stagingu. Ostatnio tak znalazłam wyścig w cache — poprawka i test regresji w jeden dzień.',
      reason: 'Spełnia kotwicę „5”: konkretna metoda, przykład i weryfikacja. Bez istotnych braków.',
    },
  },
};

/** Podsumowania do porównania (Figma) i reszta kandydatów z seed.js. */
const SUMMARIES = {
  'Claire Dubois': { summary: 'Najmocniejsza w projektowaniu systemów, konkretne liczby.', compareSummary: 'Najmocniejsza w projektowaniu systemów, konkretne liczby.' },
  'Jakub Szymański': { summary: 'Mocny w debugowaniu; rozbieżne oceny współpracy. Do omówienia przed decyzją.', compareSummary: 'Mocny w debugowaniu; rozbieżne oceny współpracy.' },
};

const CV_POOL = {
  ok: ['Technologie z ogłoszenia w ostatnich dwóch rolach', 'Mierzalne wyniki w CV (liczby, nie przymiotniki)', 'Doświadczenie w zespole 5–15 osób', 'Prowadzenie projektu od zera', 'Mentoring lub onboarding nowych osób', 'Polski i angielski w pracy'],
  flag: ['Krótkie staże w ostatnich firmach', 'Brak jednego z kluczowych wymagań', 'Luka w CV bez wyjaśnienia', 'Brak doświadczenia w podobnej skali'],
};
const COVERAGE_POOL = ['Własna decyzja', 'Konkretny przykład', 'Liczby i pomiar', 'Kompromisy', 'Wnioski na przyszłość', 'Rola zespołu'];
const COACH_POOL = {
  'Projektowanie systemów': ['Co poświęciliście, wybierając to rozwiązanie?', 'Jakie liczby były przed i po zmianie?', 'Które alternatywy odrzuciliście i dlaczego?'],
  'Rozwiązywanie problemów': ['Jaka była pierwsza hipoteza i jak ją sprawdziłeś lub sprawdziłaś?', 'Co dodaliście, żeby problem nie wrócił?', 'Ile czasu zajęło dojście do przyczyny?'],
  'Współpraca': ['Która część tej decyzji była Twoja, a która zespołu?', 'Jak zareagował autor pierwotnej propozycji?', 'Co byś dziś zrobił lub zrobiła inaczej w tej rozmowie?'],
  'Jakość': ['Jak zmierzyliście, że praktyka zadziałała?', 'Co zrobiłeś lub zrobiłaś, gdy zespół nie chciał testować?', 'Który test zatrzymał realny błąd?'],
  default: ['Podaj konkretny przykład z ostatniego roku.', 'Jakie były liczby przed i po?', 'Co zrobiłbyś lub zrobiłabyś dziś inaczej?'],
};
const ANSWER_POOL = {
  low: ['Trudno mi podać konkretny przykład, zwykle robiliśmy to zespołowo.', 'Zrobiliśmy tak, jak było w poprzednim projekcie.'],
  mid: ['Mieliśmy jasny cel i doszliśmy do niego w dwa tygodnie; mierzyliśmy wynik co sprint.', 'Zacząłem od rozmowy z zespołem i spisania ograniczeń, potem jeden eksperyment.'],
  high: ['Zacząłem od pomiaru: 80% czasu to był jeden JOIN. Najpierw indeks, potem denormalizacja — każdy krok z liczbami.', 'Zaproponowałem tygodniowy eksperyment z metryką, która rozstrzygnie. Wygrała wersja zespołu — i dobrze, bo mieliśmy dane.'],
};

/**
 * Dane demo rozmowy dla kandydata. Dla Marty Lewandowskiej — 1:1 z Figmy; dla pozostałych — deterministycznie z hasha.
 */
export function interviewDemo({ candidate, position, rubric, stage } = {}) {
  const name = (candidate && candidate.full_name) || '';
  const who = speakerName(candidate);
  const qs = (rubric && Array.isArray(rubric.questions)) ? rubric.questions : [];
  const seed = hash(`${(candidate && candidate.id) || name}|${stage || ''}`);
  const known = SUMMARIES[name] || {};
  const isMarta = name === 'Marta Lewandowska';

  const out = {
    duration: isMarta ? MARTA.duration : mmss(1500 + (seed % 1800)),
    cv: [], summary: '', compareSummary: '', transcript: [], live: null, evidence: {}, coverage: {}, coach: {},
  };

  // dopasowanie CV — punkty
  if (isMarta) out.cv = MARTA.cv.slice();
  else {
    const score = typeof candidate?.cv_score === 'number' ? candidate.cv_score : 60;
    const oks = score >= 80 ? 4 : score >= 65 ? 3 : score >= 50 ? 2 : 1;
    const flags = score >= 80 ? 1 : 2;
    for (let i = 0; i < oks; i++) out.cv.push({ ok: true, text: CV_POOL.ok[(seed + i * 7) % CV_POOL.ok.length] });
    for (let i = 0; i < flags; i++) out.cv.push({ ok: false, text: CV_POOL.flag[(seed + i * 3) % CV_POOL.flag.length] });
    out.cv = out.cv.filter((x, i, arr) => arr.findIndex((y) => y.text === x.text) === i);
  }

  // podsumowanie AI
  if (isMarta) { out.summary = MARTA.summary; out.compareSummary = MARTA.compareSummary; }
  else if (known.summary) { out.summary = known.summary; out.compareSummary = known.compareSummary; }
  else {
    const comps = qs.map((q) => q.competency).filter(Boolean);
    const strong = comps.length ? comps[seed % comps.length] : 'rozmowie';
    const weak = comps.length > 1 ? comps[(seed + 1) % comps.length] : null;
    out.summary = `Mocne strony: ${strong.toLowerCase()}. ${weak ? `Do sprawdzenia: ${weak.toLowerCase()} — mało konkretów.` : 'Warto dopytać o liczby.'}`;
    out.compareSummary = out.summary;
  }

  // transkrypcja (fragment do karty oceny)
  if (isMarta) out.transcript = MARTA.transcript.slice();
  else {
    const q0 = qs[0];
    const lvl = (candidate?.cv_score || 60) >= 75 ? 'high' : (candidate?.cv_score || 60) >= 55 ? 'mid' : 'low';
    out.transcript = [
      { t: '12:04', who: RATER_NAMES[1], text: q0 ? q0.text : 'Opowiedz o ostatnim projekcie, z którego jesteś dumny lub dumna.' },
      { t: '12:11', who, text: ANSWER_POOL[lvl][seed % ANSWER_POOL[lvl].length], mark: true },
      { t: '12:48', who: RATER_NAMES[1], text: 'Która część tej decyzji była Twoja?' },
    ];
  }

  // pokrycie rubryki i coach — per pytanie
  qs.forEach((q, i) => {
    const s = hash(`${q.id}|${seed}`);
    if (isMarta && i === 0) {
      out.coverage[q.id] = MARTA.live.coverage.map((c) => ({ ...c }));
      out.coach[q.id] = { missing: MARTA.live.missing, questions: MARTA.live.questions.slice() };
      return;
    }
    const labels = [0, 1, 2, 3].map((j) => COVERAGE_POOL[(s + j * 5) % COVERAGE_POOL.length]).filter((x, j, a) => a.indexOf(x) === j);
    const missIdx = s % labels.length;
    out.coverage[q.id] = labels.map((label, j) => ({ label, ok: j !== missIdx }));
    const pool = COACH_POOL[q.competency] || COACH_POOL.default;
    out.coach[q.id] = { missing: `Brakuje „${labels[missIdx].toLowerCase()}”. Dopytaj, zanim przejdziesz dalej:`, questions: pool.slice() };
  });

  // transkrypcja na żywo (bieżące pytanie)
  if (isMarta) out.live = { lines: MARTA.live.lines.map((l) => ({ ...l })) };
  else {
    const q0 = qs[0];
    const lvl = (candidate?.cv_score || 60) >= 75 ? 'high' : 'mid';
    out.live = { lines: [
      { t: '16:58', who: RATER_NAMES[1], text: q0 ? q0.text : 'Opowiedz o ostatnim projekcie.' },
      { t: '17:05', who, text: ANSWER_POOL.mid[(seed + 1) % ANSWER_POOL.mid.length] },
      { t: '17:31', who, text: ANSWER_POOL[lvl][seed % ANSWER_POOL[lvl].length], mark: true },
      { t: '18:40', who: RATER_NAMES[1], text: 'A co byś dziś zrobił lub zrobiła inaczej?' },
    ] };
  }

  // dowody (cytat + czas) do oceny po rozmowie
  qs.forEach((q, i) => {
    if (isMarta && MARTA.evidence[q.id]) { out.evidence[q.id] = { ...MARTA.evidence[q.id] }; return; }
    const s = hash(`${q.id}|${seed}|t`);
    out.evidence[q.id] = { time: mmss(600 + i * 540 + (s % 300)) };
  });

  return out;
}

export default { interviewDemo, shortAnchor, notes, reco, session, firstName, speakerName, RATER_NAMES };
