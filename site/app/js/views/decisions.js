/**
 * views/decisions.js — Dziennik decyzji (#/decisions).
 * Tylko do odczytu: zestawia decyzje z kart oceny (kto ocenił, jaka średnia, decyzja człowieka)
 * oraz odrzucenia z uzasadnieniem. Dane pochodzą z istniejących tabel — bez osobnej migracji.
 */
import { setHeader } from './positions.js';

const DEC = { yes: ['Tak', 'good'], maybe: ['Może', 'warn'], no: ['Nie', 'bad'] };

export default async function render(ctx) {
  const { h, button, tag, emptyState, formatDate, plural, toast } = ctx.ui;
  await ctx.ui.loadCss(new URL('./decisions.css', import.meta.url));
  const [cards, cands, poss] = await Promise.all([ctx.store.scorecards.list(), ctx.store.candidates.list(), ctx.store.positions.list()]);
  const cBy = Object.fromEntries(cands.map((c) => [c.id, c]));
  const pBy = Object.fromEntries(poss.map((p) => [p.id, p.title]));

  const events = [];
  for (const k of cards) {
    const c = cBy[k.candidate_id]; if (!c || !k.decision) continue;
    const sc = (k.ratings || []).map((r) => r.score).filter((n) => typeof n === 'number');
    const raters = new Set((k.ratings || []).map((r) => r.rater_name || r.rater_id));
    events.push({ kind: k.decision, c, stage: k.stage, at: k.updated_at, avg: sc.length ? sc.reduce((a, b) => a + b, 0) / sc.length : null, raters: raters.size, why: '' });
  }
  for (const c of cands) if (c.status === 'rejected') events.push({ kind: 'reject', c, stage: c.stage, at: null, avg: null, raters: 0, why: c.reject_reason || '' });
  events.sort((a, b) => (b.at ? new Date(b.at).getTime() : 0) - (a.at ? new Date(a.at).getTime() : 0));

  let filter = 'all';
  const list = h('ul', { class: 'dc-list' });
  const count = h('span', { class: 'dc-count muted' });
  const FILTERS = [['all', 'Wszystkie'], ['yes', 'Tak'], ['maybe', 'Może'], ['no', 'Nie'], ['reject', 'Odrzucenia']];
  const seg = h('div', { class: 'segment', role: 'group', 'aria-label': 'Filtr decyzji' },
    FILTERS.map(([k, l]) => h('button', { type: 'button', 'aria-pressed': k === filter ? 'true' : 'false', 'data-k': k, on: { click: () => { filter = k; paint(); } } }, l)));

  function row(e) {
    const [lbl, tone] = e.kind === 'reject' ? ['Odrzucony', 'bad'] : DEC[e.kind];
    const detail = e.kind === 'reject' ? (e.why || 'Brak uzasadnienia')
      : `${e.avg != null ? `Średnia ${e.avg.toFixed(1).replace('.', ',')}/5 · ` : ''}${e.raters ? plural(e.raters, 'ocena', 'oceny', 'ocen') : 'bez ocen'} — decyzja zatwierdzona przez człowieka`;
    return h('li', { class: 'dc-row' },
      h('span', { class: 'dc-date muted' }, e.at ? formatDate(e.at) : '—'),
      h('div', { class: 'dc-who' }, h('a', { href: `#/candidates/${e.c.id}?stage=${encodeURIComponent(e.stage || '')}` }, e.c.full_name), h('small', { class: 'muted' }, pBy[e.c.position_id] || '')),
      h('span', { class: 'muted' }, e.stage || ''), tag(lbl, tone), h('span', { class: 'dc-why muted' }, detail));
  }
  function paint() {
    const rows = events.filter((e) => filter === 'all' || e.kind === filter);
    list.replaceChildren(...rows.map(row));
    count.textContent = plural(rows.length, 'wpis', 'wpisy', 'wpisów');
    seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.k === filter ? 'true' : 'false'));
    empty.hidden = rows.length > 0; list.hidden = rows.length === 0;
  }
  const empty = emptyState({ title: 'Brak decyzji', text: 'Decyzje pojawią się tu po zatwierdzeniu kart oceny i odrzuceniach.', icon: 'scale' });

  function exportCsv() {
    const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const lines = [['data', 'kandydat', 'stanowisko', 'etap', 'decyzja', 'srednia', 'liczba_ocen', 'uzasadnienie'].join(';')]
      .concat(events.map((e) => [e.at || '', e.c.full_name, pBy[e.c.position_id] || '', e.stage || '', e.kind, e.avg != null ? e.avg.toFixed(2) : '', e.raters, e.why].map(q).join(';')));
    const url = URL.createObjectURL(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
    const a = h('a', { href: url, download: 'dziennik-decyzji.csv' }); document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000); toast('Wyeksportowano dziennik decyzji.', 'good');
  }

  setHeader(ctx, { title: 'Dziennik decyzji', width: 'wide', actions: [button({ label: 'Eksport CSV', variant: 'secondary', onClick: exportCsv })] });
  const root = h('div', { class: 'dc' },
    h('p', { class: 'dc-note muted' }, 'Każda decyzja zapada po ocenie człowieka według tej samej rubryki. AI nie odrzuca ani nie przesuwa kandydatów — ten dziennik pozwala to udowodnić.'),
    h('div', { class: 'dc-bar' }, seg, count), h('div', { class: 'card dc-card' }, list, empty));
  paint();
  return root;
}
