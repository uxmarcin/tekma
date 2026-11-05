/**
 * ad-check.js — sprawdzanie zgodności ogłoszenia z zasadami jawności wynagrodzeń i równego traktowania.
 * Czysta funkcja bez zależności: adCheck(position) → { checks, issues, ready }.
 *   checks: [{ key, ok, title, detail }]  — lista kontrolna (widełki, tryb pracy, treść…)
 *   issues: [{ label, match, hint }]      — sformułowania w treści do zmiany
 *   ready:  true, gdy są widełki i w treści nie wykryto problemów
 * To heurystyka na słowach kluczowych, nie porada prawna: człowiek decyduje, co opublikować.
 */
const RULES = [
  { label: 'Możliwy wymóg wieku', re: /\b(młod\w+|dynamiczn\w+\s+zespo\w+|w\s+wieku|do\s+\d{2}\s+lat)\b/i,
    hint: 'Opisz zespół faktami (liczba osób, etap firmy), a nie wiekiem czy „młodością”.' },
  { label: 'Forma tylko męska', re: /\b(doświadczon|wykwalifikowan|zaangażowan|ambitn|samodzieln)\w+\s+(programist|inżynier|developer|analityk|tester|designer|manager|kandydat|pracownik|specjalist)\w*/i,
    hint: 'Użyj formy neutralnej, np. „osoba z doświadczeniem w Go” albo „Senior Backend Engineer (K/M)”.' },
  { label: 'Forma tylko męska', re: /\bszukamy\s+(programist|inżynier|analityk|testera|specjalist|kandydat|pracownik)\w*/i,
    hint: 'Napisz „do zespołu dołączy osoba, która…” albo użyj nazwy stanowiska.' },
  { label: 'Pytanie o dotychczasowe zarobki', re: /(dotychczasow|obecn|aktualn)\w+\s+(zarobk|wynagrodzeni|stawk)\w*|podaj\w*\s+(swoje\s+)?(zarobk|wynagrodzeni)\w*/i,
    hint: 'Pytanie o historię płac jest zakazane. Zapytaj o oczekiwania finansowe.' },
  { label: 'Wynagrodzenie bez widełek', re: /wynagrodzeni\w*\s+(do\s+(negocjacji|uzgodnienia)|negocjowaln\w+)|do\s+negocjacji/i,
    hint: 'Podaj widełki przed pierwszą rozmową zamiast „do negocjacji”.' },
  { label: 'Wymóg dotyczący życia prywatnego', re: /\b(bez\s+zobowiązań|niezamężn\w+|singiel|bez\s+dzieci|stan\s+cywilny)\b/i,
    hint: 'Usuń. Takie wymagania są dyskryminujące.' },
];

export function adCheck(p = {}) {
  const text = String(p.description || '');
  const hasSalary = Number.isInteger(p.salary_min) && Number.isInteger(p.salary_max) && p.salary_min > 0;
  const wide = hasSalary && p.salary_max / p.salary_min > 2;
  const checks = [
    { key: 'salary', ok: hasSalary, title: 'Widełki wynagrodzenia', detail: hasSalary ? 'Podane przed pierwszą rozmową' : 'Wymagane przed pierwszą rozmową' },
  ];
  if (hasSalary) checks.push({ key: 'range', ok: !wide, title: 'Rozsądny rozstrzał widełek', detail: wide ? 'Górna granica jest ponad 2× wyższa niż dolna' : 'Rozstrzał do 2×' });
  checks.push(
    { key: 'work', ok: !!p.work_mode && Array.isArray(p.contract_types) && p.contract_types.length > 0, title: 'Tryb pracy i forma współpracy', detail: p.work_mode ? 'Podane' : 'Uzupełnij w stanowisku' },
    { key: 'location', ok: !!String(p.location || '').trim() || p.work_mode === 'remote', title: 'Lokalizacja', detail: 'Miejsce pracy albo zdalnie' },
    { key: 'text', ok: text.trim().length >= 80, title: 'Treść ogłoszenia', detail: text.trim().length >= 80 ? 'Opisano rolę' : 'Opisz rolę i etapy rekrutacji (min. 80 znaków)' },
    { key: 'stages', ok: Array.isArray(p.stages) && p.stages.length >= 2, title: 'Etapy procesu', detail: 'Kandydat wie, jak wygląda proces' },
  );
  const issues = [];
  for (const r of RULES) { const m = text.match(r.re); if (m) issues.push({ label: r.label, match: m[0], hint: r.hint }); }
  const ready = hasSalary && !wide && issues.length === 0;
  return { checks, issues, ready };
}

/** „22 000–30 000 PLN” albo '' gdy brak widełek. */
export function salaryLabel(p = {}) {
  if (!Number.isInteger(p.salary_min) || !Number.isInteger(p.salary_max)) return '';
  const f = (n) => n.toLocaleString('pl-PL').replace(/ /g, ' ');
  return `${f(p.salary_min)}–${f(p.salary_max)} ${p.salary_currency || 'PLN'}`;
}
