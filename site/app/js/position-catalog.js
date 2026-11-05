// Katalog nazw stanowisk: podpowiedzi wbudowane + stanowiska już użyte w organizacji.
// Nie wymaga osobnej tabeli — „baza” rośnie sama z każdym dodanym stanowiskiem.
export const BUILTIN_TITLES = [
  'Frontend Developer', 'Backend Developer', 'Fullstack Developer', 'Mobile Developer', 'DevOps Engineer',
  'QA Engineer', 'Data Analyst', 'Data Engineer', 'Product Manager', 'Project Manager', 'Product Designer',
  'UX Researcher', 'Graphic Designer', 'Marketing Specialist', 'Content Specialist', 'SEO Specialist',
  'Social Media Specialist', 'Sales Representative', 'Account Manager', 'Customer Success Manager',
  'Customer Support Specialist', 'Office Manager', 'HR Business Partner', 'Rekruter', 'Specjalista ds. kadr i płac',
  'Księgowy', 'Kontroler finansowy', 'Prawnik', 'Asystent zarządu', 'Operations Manager',
];

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');

/** Zwraca [{title, source:'org'|'builtin', position?}] — najpierw własne (najnowsze), potem wbudowane. */
export function buildCatalog(positions = []) {
  const seen = new Set();
  const out = [];
  const sorted = [...positions].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  for (const p of sorted) {
    const k = norm(p.title);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push({ title: p.title, source: 'org', position: p });
  }
  for (const t of BUILTIN_TITLES) {
    const k = norm(t);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ title: t, source: 'builtin' });
  }
  return out;
}

export function filterCatalog(catalog, query, limit = 6) {
  const q = norm(query).trim();
  const list = q ? catalog.filter((c) => norm(c.title).includes(q) && norm(c.title) !== q) : catalog;
  return list.slice(0, limit);
}

export function uniqueValues(positions, key) {
  const seen = new Set();
  const out = [];
  for (const p of positions) {
    const v = String(p[key] || '').trim();
    if (v && !seen.has(v.toLowerCase())) { seen.add(v.toLowerCase()); out.push(v); }
  }
  return out;
}
