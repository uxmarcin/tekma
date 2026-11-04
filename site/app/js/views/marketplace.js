/**
 * views/marketplace.js — Marketplace rekruterów (#/marketplace), 1:1 z Figmą 40 · Marketplace rekruterów (32:4954).
 * Nagłówek z opisem i „Moje zlecenia · N”, pasek: szukaj po specjalizacji + filtry (funkcja, region, model, weryfikacja),
 * siatka kart 332 px. Filtry i szukanie działają na danych z views/marketplace-data.js (localStorage) i są trzymane
 * w hashu (#/marketplace?q=…&fn=…&region=…&model=…&verified=1). Karta prowadzi do #/marketplace/:id.
 *
 * export default async function render(ctx) -> HTMLElement
 */

import { marketplace, FUNCTIONS, REGIONS, MODELS } from './marketplace-data.js';
import { kbtn, kicon, badge, loadKitCss } from './admin-kit.js';

const fmtRating = (n) => `★ ${Number(n).toFixed(1).replace('.', ',')}`;

export default async function render(ctx) {
  const { h, modal, toast, plural, formatDate } = ctx.ui;
  await Promise.all([loadKitCss(), ctx.ui.loadCss(new URL('./marketplace.css', import.meta.url))]);

  const state = {
    q: String(ctx.query.q || ''),
    fn: FUNCTIONS.includes(ctx.query.fn) ? ctx.query.fn : '',
    region: ctx.query.region === 'wszystkie' ? '' : REGIONS.includes(ctx.query.region) ? ctx.query.region : 'Polska',
    model: MODELS.some((m) => m.key === ctx.query.model) ? ctx.query.model : '',
    verified: ctx.query.verified !== '0',
  };

  const root = h('div', { class: 'e-root mk' });
  const ordersBtn = kbtn({ label: 'Moje zlecenia', onClick: openOrders });
  ctx.setHeader({ title: 'Rekruterzy', subtitle: 'Niezależni rekruterzy i agencje dodają kandydatów prosto do Twojego lejka. Płacisz przez Tekmę.', actions: [ordersBtn], width: 'wide' });

  /* --- filtry --- */
  const searchInput = h('input', { type: 'search', value: state.q, placeholder: 'Szukaj po specjalizacji…', 'aria-label': 'Szukaj po specjalizacji', autocomplete: 'off' });
  const search = h('label', { class: 'mk-search' }, kicon('search'), searchInput);
  searchInput.addEventListener('input', () => { state.q = searchInput.value; update(); });

  const filter = (label, key, options, { allLabel } = {}) => {
    const sel = h('select', { 'aria-label': label },
      allLabel ? h('option', { value: '' }, allLabel) : null,
      options.map((o) => { const opt = typeof o === 'string' ? { value: o, label: o } : o; return h('option', { value: opt.value, selected: String(opt.value) === String(state[key]) }, opt.label); }));
    sel.addEventListener('change', () => { state[key] = key === 'verified' ? sel.value === '1' : sel.value; update(); });
    const text = h('span');
    const wrap = h('span', { class: 'mk-filter' }, text, kicon('chevron-down'), sel);
    wrap.sync = () => { const o = sel.options[sel.selectedIndex]; text.textContent = `${label}: ${o ? o.textContent : ''}`.replace('Weryfikacja: ', ''); };
    wrap.sync();
    return wrap;
  };
  const fFn = filter('Funkcja', 'fn', FUNCTIONS, { allLabel: 'wszystkie' });
  const fRegion = filter('Region', 'region', REGIONS, { allLabel: 'wszystkie' });
  const fModel = filter('Model', 'model', MODELS.map((m) => ({ value: m.key, label: m.label })), { allLabel: 'wszystkie' });
  const fVer = filter('Weryfikacja', 'verified', [{ value: '1', label: 'Tylko zweryfikowani' }, { value: '0', label: 'Wszyscy' }]);
  fVer.querySelector('select').value = state.verified ? '1' : '0'; fVer.sync();
  const filters = h('div', { class: 'mk-filters' }, search, fFn, fRegion, fModel, fVer);

  const summary = h('p', { class: 'mk-sum e-caption', 'aria-live': 'polite' });
  const grid = h('div', { class: 'mk-grid' });
  root.append(filters, summary, grid);

  function syncHash() {
    const p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.fn) p.set('fn', state.fn);
    if (state.region !== 'Polska') p.set('region', state.region || 'wszystkie');
    if (state.model) p.set('model', state.model);
    if (!state.verified) p.set('verified', '0');
    const qs = p.toString();
    try { history.replaceState(null, '', `#/marketplace${qs ? '?' + qs : ''}`); } catch { /* bez znaczenia */ }
  }

  function visible() {
    const data = marketplace.get();
    const q = state.q.trim().toLowerCase();
    return data.recruiters.filter((r) => {
      if (state.verified && !r.verified) return false;
      if (state.fn && !r.functions.includes(state.fn)) return false;
      if (state.region && !r.regions.includes(state.region)) return false;
      if (state.model && r.model !== state.model) return false;
      if (q) {
        const hay = [r.name, r.meta, r.price, ...r.functions, ...r.regions, ...(r.profile ? r.profile.tags : [])].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function update() {
    for (const f of [fFn, fRegion, fModel, fVer]) f.sync();
    syncHash();
    const data = marketplace.get();
    ordersBtn.querySelector('span').textContent = `Moje zlecenia · ${data.orders.length}`;
    const rows = visible();
    const filtered = Boolean(state.q.trim() || state.fn || state.region !== 'Polska' || state.model || !state.verified);
    summary.replaceChildren(`${plural(rows.length, 'rekruter', 'rekruterów', 'rekruterów')} z ${data.recruiters.length}`,
      filtered ? h('button', { type: 'button', class: 'e-link', on: { click: () => { Object.assign(state, { q: '', fn: '', region: 'Polska', model: '', verified: true }); searchInput.value = ''; for (const [f, v] of [[fFn, ''], [fRegion, 'Polska'], [fModel, ''], [fVer, '1']]) f.querySelector('select').value = v; update(); } } }, ' · Wyczyść filtry') : null);
    if (!rows.length) {
      grid.replaceChildren(h('div', { class: 'e-empty mk-empty' }, h('b', null, 'Nikt nie pasuje do filtrów'), 'Zmień region albo funkcję. Większość rekruterów działa w Polsce i w UE.'));
      return;
    }
    grid.replaceChildren(...rows.map(card));
  }

  function card(r) {
    const href = `#/marketplace/${encodeURIComponent(r.id)}`;
    return h('a', { class: 'e-card mk-card', href, 'aria-label': `${r.name} — otwórz profil` },
      h('div', { class: 'mk-top' },
        h('span', { class: 'e-av s44', 'aria-hidden': 'true' }, r.initials),
        h('div', { class: 't' },
          h('div', { class: 'n' }, h('b', null, r.name), r.verified ? h('span', { class: 'mk-ver', title: 'Zweryfikowany' }, kicon('check-sm', 14), h('span', { class: 'sr-only' }, 'Zweryfikowany')) : null),
          h('small', null, r.meta))),
      h('div', { class: 'e-tags' }, badge(r.functions.join(', ')), badge(r.regions.join(', '))),
      h('div', { class: 'mk-stats' },
        h('div', { class: 's' }, h('b', null, String(r.stats.candidates)), h('small', null, 'kandydatów')),
        h('div', { class: 's' }, h('b', null, String(r.stats.hires)), h('small', null, 'zatrudnień / 12 mies.')),
        h('div', { class: 's' }, h('b', null, fmtRating(r.stats.rating)), h('small', null, 'ocena'))),
      h('div', { class: 'mk-price' }, r.price));
  }

  function openOrders() {
    const data = marketplace.get();
    const byId = Object.fromEntries(data.recruiters.map((r) => [r.id, r]));
    const list = h('div', { class: 'mk-orders' });
    const draw = () => list.replaceChildren(...(data.orders.length ? data.orders.map((o) => {
      const r = byId[o.recruiter_id];
      return h('div', { class: 'mk-order' },
        h('span', { class: 'e-av s32', 'aria-hidden': 'true' }, r ? r.initials : '?'),
        h('div', { class: 't' }, h('b', null, r ? r.name : o.recruiter_id), h('small', null, `${o.position_title} · od ${formatDate(o.started)}${o.note ? ' · ' + o.note : ''}`)),
        badge(o.status === 'active' ? 'Aktywne' : o.status === 'proposed' ? 'Wysłane' : 'Zakończone', o.status === 'active' ? 'good' : o.status === 'proposed' ? 'info' : 'neutral'),
        o.status !== 'closed' ? ctx.ui.button({ label: 'Zakończ', size: 'sm', variant: 'ghost', onClick: async () => {
          const ok = await ctx.ui.confirm({ title: 'Zakończyć zlecenie?', text: 'Rekruter straci dostęp do stanowiska. Rozliczymy tylko to, co już wykonał.', confirmLabel: 'Zakończ', danger: true });
          if (!ok) return;
          marketplace.update((st) => { const x = st.orders.find((y) => y.id === o.id); if (x) x.status = 'closed'; }); o.status = 'closed'; draw(); update(); toast('Zlecenie zakończone.', 'neutral');
        } }) : null);
    }) : [h('p', { class: 'e-muted' }, 'Nie masz jeszcze zleceń. Otwórz profil rekrutera i zaproponuj współpracę.')]));
    draw();
    const m = modal({ title: `Moje zlecenia · ${data.orders.length}`, body: list, actions: [{ label: 'Zamknij', variant: 'secondary', onClick: () => m.close() }] });
  }

  update();
  return root;
}
