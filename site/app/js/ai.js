/**
 * ai.js — atrapa AI (bez sieci, deterministyczna).
 *
 * API:
 *   ai.suggest({candidate, rubric, stage}) -> { [questionId]: {score:1-5, quote, reason} }
 *   ai.cvScore(candidate, position)        -> 0..100
 *   ai.hash(str)                           -> liczba (FNV-1a), pomocniczo
 *
 * Zasada produktu (AI Act): to tylko SUGESTIA. Ocenę i decyzję zatwierdza człowiek,
 * interfejs zawsze oznacza, co pochodzi od AI, a AI nigdy nie odrzuca ani nie przesuwa kandydata.
 * Wyniki są stałe dla tej samej pary (kandydat, pytanie), żeby UI nie „migotał” między odświeżeniami.
 */

export function hash(str) {
  let h = 0x811c9dc5;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Cytaty z „transkrypcji” pogrupowane po kompetencji i poziomie (1–2 słabe, 3 średnie, 4–5 mocne). */
const QUOTES = {
  'Projektowanie systemów': {
    low: [
      'Zrobiliśmy tak, jak było w poprzednim projekcie. Nie mierzyliśmy, czy to pomogło.',
      'Dodaliśmy cache, bo architekt tak zaproponował. Nie pamiętam, jakie były liczby.',
    ],
    mid: [
      'Przenieśliśmy kolejkę na partycjonowane tabele — p95 spadło z 4 s do 0,4 s.',
      'Wąskim gardłem były blokady na jednej tabeli; rozbiliśmy ją po kliencie i obciążenie się wyrównało.',
    ],
    high: [
      'Przenieśliśmy kolejkę na partycjonowane tabele — p95 spadło z 4 s do 0,4 s. Rozważaliśmy też Kafkę, ale koszt operacyjny był za duży dla zespołu z trzema osobami.',
      'Zaczęliśmy od pomiaru: 80% czasu to był jeden JOIN. Najpierw indeks, potem denormalizacja, na końcu read replica — każdy krok z liczbami przed i po.',
    ],
  },
  'Rozwiązywanie problemów': {
    low: ['Restartowałbym serwis i sprawdził, czy pomogło.', 'Zajrzałbym do logów i szukał błędów.'],
    mid: ['Najpierw sprawdziłbym, czy to baza czy sieć — porównałbym latencję zapytań z latencją endpointu.', 'Postawiłbym hipotezę o blokadach i sprawdził pg_stat_activity.'],
    high: ['Zacząłbym od metryk: czy rośnie czas w bazie, w sieci czy w kodzie. Potem porównałbym rozkład zapytań sprzed i po — raz tak znaleźliśmy brak indeksu po migracji danych i dodaliśmy alert na seq scan.', 'Izoluję zmienne: ruch, dane, infrastruktura. Odtworzyłem problem na stagingu z kopią danych i okazało się, że to autovacuum nie nadążał.'],
  },
  'Współpraca': {
    low: ['Powiedziałem, że to zły pomysł, i zrobiłem po swojemu w swojej części.', 'Nie chciałem robić problemu, więc nic nie mówiłem.'],
    mid: ['Przedstawiłem swoje argumenty na spotkaniu, zespół zdecydował inaczej, więc zrobiłem to po ich stronie i działa.', 'Opisałem ryzyka w dokumencie RFC i zostawiłem decyzję zespołowi.'],
    high: ['Zaproponowałem tygodniowy eksperyment z obiema wersjami i metryką, która rozstrzygnie. Wygrała ich wersja — i dobrze, bo mieliśmy dane, nie opinie.', 'Spisałem obie opcje z kosztami, umówiłem się z autorem na rozmowę jeden na jeden, a potem wspólnie przedstawiliśmy kompromis zespołowi.'],
  },
  'Jakość': {
    low: ['Od testów mamy QA, ja się skupiam na dowożeniu.', 'Testy piszę, jak zostanie czas, czyli rzadko.'],
    mid: ['Testuję kluczowe ścieżki i pilnuję review — to minimum, które daje spokój.', 'Mamy CI z lintem i testami jednostkowymi dla logiki domenowej.'],
    high: ['Wprowadziłem testy kontraktowe między serwisami i policzyłem, że liczba incydentów po wdrożeniu spadła o połowę — to przekonało zespół bardziej niż argumenty.', 'Zacząłem od jednego testu na każdy incydent produkcyjny. Po kwartale zespół sam dopisywał testy, bo widział, że chronią przed wstydem.'],
  },
  default: {
    low: ['Trudno mi podać konkretny przykład.', 'Robiłem to, co było w zadaniu.'],
    mid: ['Podam przykład z ostatniego projektu: mieliśmy jasny cel i doszliśmy do niego w dwa tygodnie.', 'Zazwyczaj zaczynam od rozmowy z zespołem i spisania ograniczeń.'],
    high: ['Zacząłem od zdefiniowania problemu w liczbach, potem iterowałem z zespołem, a wynik mierzyliśmy co tydzień — po kwartale metryka urosła o 40%.', 'Najpierw zrozumiałem, czego naprawdę potrzebuje klient, a dopiero potem wybraliśmy rozwiązanie — i odrzuciliśmy dwa, które były modne, ale drogie.'],
  },
};

function level(score) {
  return score <= 2 ? 'low' : score === 3 ? 'mid' : 'high';
}

function pick(list, seed) {
  return list[seed % list.length];
}

function truncate(text, max = 110) {
  if (!text) return '';
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
}

/**
 * Sugestie ocen dla każdego pytania rubryki. Wynik jest stały dla (candidate.id, question.id).
 * Zwraca pusty obiekt, gdy brak rubryki/pytań.
 */
export function suggest({ candidate, rubric, stage } = {}) {
  const out = {};
  if (!candidate || !rubric || !Array.isArray(rubric.questions)) return out;
  const base = hash(`${candidate.id || candidate.full_name}|${stage || ''}`);
  // osoby z wysokim dopasowaniem CV częściej dostają wyższe sugestie — ale nigdy nie deterministycznie „5”
  const bias = typeof candidate.cv_score === 'number' ? Math.round((candidate.cv_score - 60) / 20) : 0; // -3..2
  for (const q of rubric.questions) {
    const seed = hash(`${q.id}|${base}|${q.competency || ''}`);
    const r3 = (seed >>> 8) % 3, r2 = (seed >>> 16) % 2;
    let score = 2 + r3 + (bias > 0 ? r2 : 0); // 2..5
    if (bias < 0 && r3 === 0) score -= 1;
    score = Math.max(1, Math.min(5, score));
    const pool = QUOTES[q.competency] || QUOTES.default;
    const quote = pick(pool[level(score)], (seed >>> 3) % 1000);
    const anchor = q.anchors && (q.anchors[score] || q.anchors[String(score)]);
    const reason = anchor
      ? `Odpowiedź pasuje do kotwicy ${score}/5 („${truncate(anchor)}”). ${explain(score)}`
      : `Sugestia ${score}/5 na podstawie konkretności przykładu i liczb w odpowiedzi. ${explain(score)}`;
    out[q.id] = { score, quote, reason };
  }
  return out;
}

function explain(score) {
  switch (score) {
    case 5: return 'Kandydat podał pomiary, alternatywy i kompromisy — to najwyższy poziom opisu w rubryce.';
    case 4: return 'Przykład jest konkretny i zawiera liczby, brakuje tylko pełnego porównania alternatyw.';
    case 3: return 'Przykład jest konkretny, ale bez porównania podejść ani wniosków na przyszłość.';
    case 2: return 'Wypowiedź jest ogólna — bez liczb i bez własnej decyzji; warto dopytać w kolejnej rozmowie.';
    default: return 'Brak konkretnego przykładu; sugerujemy pytanie uzupełniające zamiast oceny.';
  }
}

/**
 * Dopasowanie CV 0..100 — deterministyczne z hasha (kandydat + stanowisko).
 * Jeśli kandydat ma już cv_score, zwraca je bez zmian (nie nadpisujemy decyzji rekrutera).
 */
export function cvScore(candidate, position) {
  if (candidate && typeof candidate.cv_score === 'number') return candidate.cv_score;
  const seed = hash(`${candidate?.email || candidate?.full_name || ''}|${position?.title || position?.id || ''}`);
  // rozkład skupiony w 45–90, żeby wyglądał realistycznie
  return 45 + (seed % 46);
}

/** Krótkie, deterministyczne uzasadnienie dopasowania CV (do podglądu w bazie kandydatów). */
export function cvReason(candidate, position) {
  const s = cvScore(candidate, position);
  const title = position?.title ? ` na stanowisko ${position.title}` : '';
  if (s >= 80) return `Mocne dopasowanie${title}: doświadczenie i technologie z ogłoszenia pokrywają się z CV.`;
  if (s >= 65) return `Dobre dopasowanie${title}: większość wymagań spełniona, brak jednego z kluczowych elementów.`;
  if (s >= 50) return `Częściowe dopasowanie${title}: profil obok wymagań, warto zweryfikować w rozmowie wstępnej.`;
  return `Słabe dopasowanie${title}: CV nie potwierdza kluczowych wymagań z ogłoszenia.`;
}

export const ai = { suggest, cvScore, cvReason, hash };
export default ai;
