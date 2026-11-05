/**
 * ad-page.js — projekt ogłoszenia „pokazujemy wszystko z góry” + post i karta na LinkedIn.
 *   renderAdPage({ position, rubric, org, h }) -> HTMLElement   (strona ogłoszenia: widełki, kryteria oceny, oś procesu, 90 dni)
 *   postText(position, org, url)               -> string        (treść posta na LinkedIn, z widełkami)
 *   drawShareCard(position, org)               -> HTMLCanvasElement (1200×627, mesh gradient + tytuł + widełki)
 * Wszystko z danych stanowiska i rubryki; nic nie jest zmyślane — brak danych = brak sekcji.
 */
import { salaryLabel } from './ad-check.js';
import { PHASES, DEFAULT_PLAN } from './plan.js';

const WORK = { remote: 'Praca zdalna', hybrid: 'Hybrydowo', onsite: 'Stacjonarnie' };
const CONTRACT = { b2b: 'B2B', uop: 'Umowa o pracę', zlecenie: 'Umowa zlecenie', dzielo: 'Umowa o dzieło' };

export const workLabel = (p) => [WORK[p.work_mode], p.location].filter(Boolean).join(' · ');
export const contractLabel = (p) => (p.contract_types || []).map((c) => CONTRACT[c] || c).join(' / ');

/** Kryteria, według których oceniamy: kompetencje z rubryki z wagą (suma → %), max 5. */
export function criteria(rubric) {
  const qs = (rubric && rubric.questions) || [];
  const by = new Map();
  for (const q of qs) { const k = q.competency || q.text; by.set(k, (by.get(k) || 0) + (Number(q.weight) || 1)); }
  const total = [...by.values()].reduce((a, b) => a + b, 0) || 1;
  return [...by.entries()].map(([name, w]) => ({ name, pct: Math.round((w / total) * 100) })).sort((a, b) => b.pct - a.pct).slice(0, 5);
}

export function renderAdPage({ position: p, rubric, org, h }) {
  const sal = salaryLabel(p);
  const crit = criteria(rubric);
  const stages = Array.isArray(p.stages) ? p.stages : [];
  const minutesBy = {};
  const interviewMin = ((rubric && rubric.questions) || []).reduce((a, q) => a + (Number(q.minutes) || 0), 0);

  const hero = h('header', { class: 'ap-hero' },
    h('div', { class: 'mesh ap-mesh', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i')),
    h('div', { class: 'ap-hero-in' },
      h('p', { class: 'ap-eyebrow' }, [org && org.name, p.department].filter(Boolean).join(' · ')),
      h('h1', { class: 'ap-title' }, p.title),
      h('p', { class: 'ap-meta' }, [workLabel(p), contractLabel(p)].filter(Boolean).join('  ·  ')),
      sal ? h('div', { class: 'ap-sal' }, h('span', { class: 'ap-sal-l' }, 'Widełki brutto / mies.'), h('b', null, sal.replace(/\s?[A-Z]{3}$/, '')), h('span', { class: 'ap-cur' }, p.salary_currency || 'PLN'))
        : h('div', { class: 'ap-sal warn' }, h('span', { class: 'ap-sal-l' }, 'Dodaj widełki — to pierwsza rzecz, którą kandydat chce zobaczyć'))));

  const sections = [hero];
  if (p.description && p.description.trim()) {
    sections.push(h('section', { class: 'ap-sec' }, h('h2', null, 'O roli'), ...p.description.trim().split(/\n{2,}/).map((t) => h('p', null, t))));
  }
  if (crit.length) {
    sections.push(h('section', { class: 'ap-sec' }, h('h2', null, 'Oceniamy Cię za to'),
      h('p', { class: 'ap-sub' }, 'Te same kryteria dla każdej osoby. Znasz je, zanim się zgłosisz.'),
      h('ul', { class: 'ap-crit' }, crit.map((c) => h('li', null,
        h('span', { class: 'n' }, c.name), h('span', { class: 'bar', 'aria-hidden': 'true' }, h('i', { style: `width:${c.pct}%` })), h('span', { class: 'v' }, `${c.pct}%`))))));
  }
  if (stages.length) {
    sections.push(h('section', { class: 'ap-sec' }, h('h2', null, 'Jak wygląda proces'),
      h('p', { class: 'ap-sub' }, `${stages.length} etapów${interviewMin ? `, rozmowa merytoryczna ok. ${interviewMin} min` : ''}. Odpowiadamy w ciągu 10 dni.`),
      h('ol', { class: 'ap-steps' }, stages.map((s, i) => h('li', null, h('span', { class: 'i' }, String(i + 1)), h('span', null, s))))));
  }
  sections.push(h('section', { class: 'ap-sec' }, h('h2', null, 'Twoje pierwsze 90 dni'),
    h('div', { class: 'ap-days' }, PHASES.map((ph) => h('div', { class: 'ap-day' }, h('b', null, ph.label), h('p', null, ph.goal),
      h('small', null, DEFAULT_PLAN.filter((t) => t[0] === ph.phase).slice(0, 2).map((t) => t[2]).join(' · ')))))));
  sections.push(h('footer', { class: 'ap-cta' }, h('div', null, h('b', null, 'Aplikuj w 60 sekund'), h('p', null, 'Bez CV: trzy pytania z rubryki. CV możesz dodać opcjonalnie.')),
    h('span', { class: 'ap-btn', role: 'img', 'aria-label': 'Przycisk aplikowania (podgląd)' }, 'Aplikuję')));
  return h('article', { class: 'ap' }, ...sections);
}

export function postText(p, org, url) {
  const sal = salaryLabel(p);
  const lines = [
    `${org && org.name ? org.name + ' szuka: ' : 'Szukamy: '}${p.title}`,
    '',
    [workLabel(p), contractLabel(p)].filter(Boolean).join(' · '),
    sal ? `💰 Widełki: ${sal} brutto / mies. (podajemy je od początku)` : '',
    '',
    'Co wyróżnia ten proces:',
    '✔ znasz kryteria oceny, zanim aplikujesz',
    '✔ te same pytania dla każdej osoby',
    '✔ odpowiedź w ciągu 10 dni',
    '',
    url ? `Szczegóły i aplikacja: ${url}` : '',
    '',
    '#rekrutacja #praca #jawnośćwynagrodzeń',
  ];
  return lines.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n').trim();
}

/** Karta 1200×627 (format LinkedIn). Mesh gradient rysowany radialnie, bez zewnętrznych zasobów. */
export function drawShareCard(p, org) {
  const c = document.createElement('canvas'); c.width = 1200; c.height = 627;
  const x = c.getContext('2d');
  x.fillStyle = '#fafafa'; x.fillRect(0, 0, 1200, 627);
  const blob = (cx, cy, r, rgba) => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, rgba); g.addColorStop(1, rgba.replace(/[\d.]+\)$/, '0)')); x.fillStyle = g; x.fillRect(0, 0, 1200, 627); };
  blob(180, 90, 520, 'rgba(45,104,255,.50)'); blob(1060, 120, 480, 'rgba(192,132,252,.50)');
  blob(620, 640, 520, 'rgba(52,211,153,.42)'); blob(980, 520, 360, 'rgba(251,146,180,.38)');
  const font = (w, s) => `${w} ${s}px Inter, "Helvetica Neue", Arial, sans-serif`;
  x.fillStyle = '#5f5f6b'; x.font = font(500, 28); x.fillText([org && org.name, p.department].filter(Boolean).join(' · ').slice(0, 60), 72, 110);
  x.fillStyle = '#0f0f12'; x.font = font(700, 76);
  const words = String(p.title).split(' '); let line = ''; let y = 230; const out = [];
  for (const w of words) { const t = line ? line + ' ' + w : w; if (x.measureText(t).width > 1040 && line) { out.push(line); line = w; } else line = t; }
  out.push(line);
  for (const l of out.slice(0, 2)) { x.fillText(l, 72, y); y += 88; }
  const sal = salaryLabel(p);
  if (sal) {
    x.fillStyle = '#0f0f12'; x.font = font(700, 64); x.fillText(sal.replace(/\s?[A-Z]{3}$/, ''), 72, 470);
    x.fillStyle = '#5f5f6b'; x.font = font(500, 26); x.fillText(`${p.salary_currency || 'PLN'} brutto / mies. · widełki od początku`, 72, 512);
  }
  x.fillStyle = '#0f0f12'; x.font = font(700, 30); x.fillText('tekma', 72, 574);
  x.fillStyle = '#5f5f6b'; x.font = font(500, 24); x.fillText([workLabel(p)].filter(Boolean).join(''), 1128 - x.measureText(workLabel(p)).width, 574);
  return c;
}
