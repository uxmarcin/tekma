/**
 * views/inbox.js — Inbox (#/inbox): jedna lista rzeczy, które czekają na człowieka.
 * Źródła: pulpit („wymaga uwagi”), zadania wdrożenia po terminie, cele, zgody w bazie talentów,
 * retencja danych i gotowość ogłoszeń. Stan „załatwione” to lokalne przeczytanie (jak dzwonek).
 */
import * as notif from '../notifications.js';
import { setHeader } from './positions.js';

export default async function render(ctx) {
  const { h, button, tag, emptyState, icon } = ctx.ui;
  await ctx.ui.loadCss(new URL('./inbox.css', import.meta.url));
  const orgId = ctx.org && ctx.org.id;
  const items = await notif.collect(ctx.store);
  let seen = notif.readSeen(orgId);
  let filter = 'open';
  const body = h('div', { class: 'ib' });
  const root = h('div', { class: 'ib-wrap' });
  const TONE = { bad: 'bad', warn: 'warn', good: 'good' };

  function persist() { try { localStorage.setItem(`tekma.seen.${orgId || 'x'}`, JSON.stringify([...seen].slice(-200))); } catch { /* brak storage */ } }
  function paint() {
    const shown = items.filter((i) => filter === 'all' || !seen.has(i.key));
    const groups = new Map();
    for (const i of shown) { const c = notif.categoryOf(i); (groups.get(c) || groups.set(c, []).get(c)).push(i); }
    const row = (i) => h('li', { class: `ib-i${seen.has(i.key) ? ' done' : ''}` },
      notif.notifRow(ctx.ui, i, { unread: !seen.has(i.key) }),
      h('div', { class: 'ib-a' },
        button({ label: seen.has(i.key) ? 'Przywróć' : 'Załatwione', variant: 'ghost', size: 'sm', onClick: () => { if (seen.has(i.key)) seen.delete(i.key); else seen.add(i.key); persist(); paint(); } })));
    const sections = [...groups].map(([cat, list]) => h('section', { class: 'card ib-g' },
      h('h2', { class: 'ib-h' }, cat, h('span', { class: 'muted' }, String(list.length))),
      h('ul', { class: 'ib-list' }, list.map(row))));
    if (!sections.length) sections.push(emptyState({ title: 'Inbox zero', text: filter === 'open' ? 'Nic nie czeka na Twoją decyzję. Dobra robota.' : 'Brak powiadomień.', icon: 'inbox' }));
    body.replaceChildren(...sections);
    seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === filter)));
    count.textContent = `${items.filter((i) => !seen.has(i.key)).length} do załatwienia`;
  }
  const count = h('span', { class: 'muted ib-count' });
  const seg = h('div', { class: 'segment', role: 'group', 'aria-label': 'Filtr' },
    [['open', 'Do załatwienia'], ['all', 'Wszystkie']].map(([k, l]) => h('button', { type: 'button', 'data-k': k, on: { click: () => { filter = k; paint(); } } }, l)));
  setHeader(ctx, { title: 'Inbox', width: 'wide', actions: [button({ label: 'Oznacz wszystko', variant: 'secondary', onClick: () => { items.forEach((i) => seen.add(i.key)); persist(); paint(); } })] });
  root.append(h('div', { class: 'ib-bar' }, seg, count), body);
  paint();
  return root;
}
