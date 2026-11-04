/**
 * views/positions.js — lista stanowisk (Figma 9:380 „02 · Stanowiska”).
 *   #/positions                siatka kart stanowisk: zakładki Wszystkie / Otwarte / Wstrzymane / Szkice,
 *                              sortowanie, „Dodaj stanowisko” → #/positions/new, sekcja „Zacznij od gotowego procesu”.
 *   #/positions?new=1          (stary link z pulpitu) → przekierowanie do kreatora #/positions/new
 * Dane: store.positions.list(), store.candidates.list(); meta (wstrzymanie, szkic) z rekrutacja-data.js.
 * Karta: badge statusu na miniaturze, mini-lejek (szerokość słupka ∝ liczbie kandydatów, którzy doszli do etapu;
 * etap 1 = 100 %; wąskie gardło w kolorze warn), tytuł, „N kandydatów · kiedy”.
 * Eksporty dla innych widoków (pulpit): miniFunnel, setHeader, openNewPosition (→ kreator).
 * export default async function render(ctx) -> HTMLElement
 */

import { DEFAULT_STAGES } from '../seed.js';
import { bbtn, bicon, pillTabs, roleCard, loadKitCss } from './b-kit.js';
import { getPositionMeta, getDraft, TEMPLATES, templateSummary } from './rekrutacja-data.js';
import { ago } from './b-kit.js';

const SORTS = [
  { key: 'recent', label: 'Ostatnio zmienione' },
  { key: 'name', label: 'Nazwa A–Z' },
  { key: 'cands', label: 'Najwięcej kandydatów' },
];
const HOME_TEMPLATES = ['first-engineer', 'first-sales', 'customer-success', 'product-manager'];

export default async function render(ctx) {
  const { h } = ctx.ui;
  await Promise.all([loadKitCss(), ctx.ui.loadCss(new URL('./positions.css', import.meta.url))]);

  if (ctx.query && ctx.query.new) { ctx.navigate('#/positions/new'); return h('div'); }

  const addBtnTop = ctx.ui.button({ label: 'Dodaj stanowisko', variant: 'primary', icon: 'plus', onClick: () => ctx.navigate('#/positions/new') });
  setHeader(ctx, { title: 'Stanowiska', actions: [addBtnTop], width: 'wide' });

  const root = h('div', { class: 'b-page pos' });
  let tab = ctx.query && ['open', 'paused', 'draft'].includes(ctx.query.status) ? ctx.query.status : 'all';
  let sort = 'recent';
  let data = null;

  const sortSel = h('select', { class: 'pos-sort', 'aria-label': 'Sortowanie' }, SORTS.map((s) => h('option', { value: s.key }, s.label)));
  sortSel.addEventListener('change', () => { sort = sortSel.value; drawGrid(); });
  const sortWrap = h('div', { class: 'pos-sort-wrap' }, sortSel, bicon('chevron-down', 16));
  const addBtn = bbtn({ label: 'Dodaj stanowisko', variant: 'primary', onClick: () => ctx.navigate('#/positions/new') });
  const head = h('header', { class: 'b-head' }, h('div', { class: 'b-head-t' }, h('h1', { class: 'b-h1' }, 'Stanowiska')), h('div', { class: 'b-head-actions' }, sortWrap, addBtn));
  const tabsSlot = h('div');
  const gridSlot = h('div', { class: 'b-grid pos-grid', 'aria-live': 'polite' });
  const templates = h('section', { class: 'pos-templates', 'aria-labelledby': 'pos-tpl-h' },
    h('div', { class: 'b-section-h' }, h('h2', { class: 'b-h3', id: 'pos-tpl-h' }, 'Zacznij od gotowego procesu'), h('a', { href: '#/templates' }, 'Zobacz bibliotekę →')),
    h('div', { class: 'b-grid pos-grid' }, HOME_TEMPLATES.map((k) => TEMPLATES.find((t) => t.key === k)).filter(Boolean).map((t) => roleCard({
      title: t.name, sub: templateSummary(t), status: 'Szablon', tone: 'neutral', template: true,
      href: `#/positions/new?szablon=${encodeURIComponent(t.key)}`, ariaLabel: `Szablon ${t.name}: ${templateSummary(t)}. Utwórz stanowisko z szablonu.`,
    }))),
  );

  function renderSkeleton() {
    root.replaceChildren(head, h('div', { class: 'pos-skel', 'aria-busy': 'true', 'aria-label': 'Ładowanie stanowisk' },
      h('i', { class: 'pos-skel-tabs' }),
      h('div', { class: 'b-grid pos-grid' }, [0, 1, 2, 3].map(() => h('div', { class: 'pos-skel-card' }, h('i', { class: 'a' }), h('i', { class: 'b' }), h('i', { class: 'c' }))))));
  }
  function renderError(err) {
    root.replaceChildren(head, h('div', { class: 'state', role: 'alert' },
      h('div', { class: 'glyph' }, ctx.ui.icon('alert', 20)),
      h('h2', null, 'Nie udało się wczytać stanowisk'),
      h('p', null, (err && err.message) || 'Sprawdź połączenie i spróbuj ponownie.'),
      h('div', { class: 'actions' }, ctx.ui.button({ label: 'Spróbuj ponownie', variant: 'primary', onClick: reload })),
    ));
  }

  async function reload() {
    renderSkeleton();
    try {
      const [positions, candidates] = await Promise.all([ctx.store.positions.list(), ctx.store.candidates.list()]);
      const draft = getDraft();
      data = { positions: positions.map((p) => ({ ...p, meta: getPositionMeta(p) })), candidates, draft };
      draw();
    } catch (err) {
      console.error('[positions]', err);
      renderError(err);
    }
  }

  function bucket(p) {
    if (p.status === 'closed') return 'closed';
    return p.meta.paused ? 'paused' : 'open';
  }

  function draw() {
    const { positions, draft } = data;
    if (!positions.length && !draft) {
      root.replaceChildren(head, ctx.ui.emptyState({
        icon: 'briefcase', title: 'Nie masz jeszcze stanowisk',
        text: 'Stanowisko to lejek etapów, kandydaci i rubryka ocen. Zacznij od pierwszego albo wybierz gotowy proces.',
        action: { label: 'Dodaj stanowisko', icon: 'plus', onClick: () => ctx.navigate('#/positions/new') },
      }), templates);
      return;
    }
    const counts = { all: positions.length, open: positions.filter((p) => bucket(p) === 'open').length, paused: positions.filter((p) => bucket(p) === 'paused').length, draft: draft ? 1 : 0 };
    const tabs = pillTabs({
      label: 'Filtr stanowisk', active: tab,
      items: [
        { key: 'all', label: 'Wszystkie', count: counts.all },
        { key: 'open', label: 'Otwarte', count: counts.open },
        { key: 'paused', label: 'Wstrzymane', count: counts.paused },
        { key: 'draft', label: 'Szkice', count: counts.draft || null },
      ],
      onChange: (k) => { tab = k; drawGrid(); },
    });
    tabsSlot.replaceChildren(tabs);
    root.replaceChildren(head, tabsSlot, gridSlot, templates);
    drawGrid();
  }

  function drawGrid() {
    const { positions, candidates, draft } = data;
    const items = [];
    if (tab === 'draft' || tab === 'all') {
      if (draft && draft.title) items.push(draftCard(draft));
    }
    if (tab !== 'draft') {
      let shown = positions.filter((p) => (tab === 'all' ? true : bucket(p) === tab));
      const withStats = shown.map((p) => ({ p, stats: positionStats(p, candidates) }));
      withStats.sort((a, b) => {
        if (sort === 'name') return a.p.title.localeCompare(b.p.title, 'pl');
        if (sort === 'cands') return b.stats.active.length - a.stats.active.length;
        return b.stats.last - a.stats.last;
      });
      for (const { p, stats } of withStats) items.push(positionCard(ctx, p, stats));
    }
    if (!items.length) {
      gridSlot.replaceChildren(ctx.ui.emptyState({
        icon: 'briefcase',
        title: tab === 'paused' ? 'Brak wstrzymanych stanowisk' : tab === 'draft' ? 'Brak szkiców' : 'Brak otwartych stanowisk',
        text: tab === 'draft' ? 'Szkic powstaje, gdy zaczniesz kreator „Nowe stanowisko” i nie dokończysz go.' : 'Dodaj nowe stanowisko albo wybierz gotowy proces z biblioteki.',
        action: { label: 'Dodaj stanowisko', icon: 'plus', onClick: () => ctx.navigate('#/positions/new') },
      }));
      gridSlot.classList.add('is-empty');
      return;
    }
    gridSlot.classList.remove('is-empty');
    gridSlot.replaceChildren(...items);
  }

  function draftCard(draft) {
    return roleCard({
      title: draft.title, sub: `Szkic · ${draft.department || 'bez zespołu'}`, status: 'Szkic', tone: 'neutral', template: true,
      href: `#/positions/new?krok=${draft.step || 1}`, ariaLabel: `Szkic stanowiska ${draft.title}. Dokończ w kreatorze.`,
    });
  }

  await reload();
  return root;
}

/* ------------------------------------------------ statystyki i karta stanowiska */
export function positionStats(p, candidates) {
  const mine = candidates.filter((c) => c.position_id === p.id);
  const active = mine.filter((c) => c.status === 'active');
  const stages = Array.isArray(p.stages) && p.stages.length ? p.stages : DEFAULT_STAGES;
  const at = stages.map((s) => active.filter((c) => c.stage === s).length);
  // dotarli do etapu i (skumulowanie): kandydaci na etapie ≥ i; etap 1 = wszyscy aktywni
  const reached = stages.map((s, i) => at.slice(i).reduce((a, b) => a + b, 0));
  const total = reached[0] || 0;
  const funnel = stages.map((s, i) => (total ? reached[i] / total : 0));
  let bottleneck = -1, best = 1;
  at.forEach((n, i) => { if (i > 0 && n > best) { best = n; bottleneck = i; } });
  const last = Math.max(new Date(p.created_at || 0).getTime(), ...mine.map((c) => new Date(c.applied_at || 0).getTime()));
  return { mine, active, at, funnel, bottleneck, last, stages };
}

function positionCard(ctx, p, stats) {
  const { plural } = ctx.ui;
  const b = p.status === 'closed' ? 'closed' : (p.meta.paused ? 'paused' : 'open');
  const status = b === 'open' ? 'Otwarte' : b === 'paused' ? 'Wstrzymane' : 'Zamknięte';
  const sub = `${plural(stats.active.length, 'kandydat', 'kandydatów', 'kandydatów')} · ${ago(new Date(stats.last).toISOString())}`;
  return roleCard({
    title: p.title, sub, status, tone: b === 'open' ? 'accent' : 'neutral',
    funnel: stats.active.length ? stats.funnel : null, bottleneck: stats.bottleneck, template: !stats.active.length,
    href: `#/positions/${encodeURIComponent(p.id)}`,
    ariaLabel: `${p.title}, ${status.toLowerCase()}, ${sub}`,
  });
}

/**
 * Nagłówek paska górnego routera (widoczny na mobile). Jeśli router nie wstawił elementów akcji, poprawiamy slot sami.
 */
export function setHeader(ctx, { title, actions = [], width, crumbs } = {}) {
  ctx.setHeader({ title, actions, width, crumbs });
  const slot = document.querySelector('.main-head [data-slot="actions"]');
  if (slot && actions.length && !actions.every((a) => slot.contains(a))) slot.replaceChildren(...actions);
}

/**
 * Mini-lejek (używany przez pulpit): słupek na etap, wysokość ∝ liczbie aktywnych kandydatów na tym etapie.
 */
export function miniFunnel(ctx, position, activeCandidates) {
  const { h } = ctx.ui;
  const stages = Array.isArray(position.stages) && position.stages.length ? position.stages : DEFAULT_STAGES;
  const counts = stages.map((s) => activeCandidates.filter((c) => c.stage === s).length);
  const max = Math.max(1, ...counts);
  const label = stages.map((s, i) => `${s}: ${counts[i]}`).join(', ');
  const empty = counts.every((n) => n === 0);
  return h('div', { class: `mf${empty ? ' is-empty' : ''}`, role: 'img', 'aria-label': `Lejek: ${label}`, title: label },
    stages.map((s, i) => h('i', { class: counts[i] ? 'on' : '', style: `--v:${counts[i] / max}` })),
  );
}

/** Zgodność wsteczna: dawne okno „Nowe stanowisko” → kreator. */
export function openNewPosition(ctx) {
  ctx.navigate('#/positions/new');
  return { close() {} };
}
