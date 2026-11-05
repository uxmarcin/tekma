/**
 * search.js — wyszukiwarka globalna (⌘K / Ctrl+K). Szuka w stronach, stanowiskach, kandydatach,
 * ludziach, celach i rubrykach. ↑↓ wybór, Enter otwiera, Esc zamyka. Dane ładowane przy otwarciu.
 */
const fold = (s) => String(s || '').toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '');

const PAGES = [
  ['Pulpit', '#/', 'dashboard'], ['Stanowiska', '#/positions', 'briefcase'], ['Rubryki', '#/rubrics', 'rubric'], ['Kandydaci', '#/candidates', 'users'],
  ['Ludzie', '#/people', 'user'], ['Cele', '#/goals', 'target'], ['Wyślij feedback', '#/feedback', 'message'], ['Ustawienia', '#/settings', 'settings'], ['Zespół i uprawnienia', '#/settings/zespol', 'users'],
  ['Integracje', '#/settings/integracje', 'settings'], ['Plan i płatności', '#/settings/plan', 'settings'], ['RODO i AI Act', '#/settings/zgodnosc', 'shield'],
];

let openNow = null;

export async function openSearch({ store, ui, navigate }) {
  if (openNow) { openNow.focus(); return; }
  const { h, icon } = ui;
  const input = h('input', { type: 'text', class: 'cmdk-in', placeholder: 'Szukaj stanowisk, kandydatów, ludzi, celów…', 'aria-label': 'Szukaj', autocomplete: 'off', spellcheck: 'false', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'cmdk-list' });
  const list = h('div', { class: 'cmdk-list', id: 'cmdk-list', role: 'listbox' });
  const panel = h('div', { class: 'cmdk', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Wyszukiwarka' },
    h('div', { class: 'cmdk-top' }, icon('search', 18), input, h('kbd', { class: 'kbd' }, 'Esc')),
    list,
    h('div', { class: 'cmdk-foot' }, h('span', null, h('kbd', { class: 'kbd' }, '↑↓'), ' wybierz'), h('span', null, h('kbd', { class: 'kbd' }, 'Enter'), ' otwórz')));
  const backdrop = h('div', { class: 'cmdk-back' }, panel);
  const prev = document.activeElement;
  let items = [], sel = 0, index = [];

  function close() {
    document.removeEventListener('keydown', onKey, true);
    backdrop.remove(); openNow = null; document.body.classList.remove('has-modal');
    if (prev && prev.focus) prev.focus();
  }
  function go(it) { close(); navigate(it.href); }
  function render() {
    const q = fold(input.value).trim();
    const hits = [];
    for (const it of index) {
      const t = fold(it.title), s = fold(it.sub);
      let score = 0;
      if (!q) score = it.group === 'Strony' ? 1 : 0;
      else if (t.startsWith(q)) score = 4; else if (t.split(/\s+/).some((w) => w.startsWith(q))) score = 3; else if (t.includes(q)) score = 2; else if (s.includes(q)) score = 1;
      if (score) hits.push({ ...it, score });
    }
    hits.sort((a, b) => b.score - a.score);
    const groups = new Map();
    for (const it of hits) { const g = groups.get(it.group) || []; if (g.length < (q ? 6 : 8)) { g.push(it); groups.set(it.group, g); } }
    items = [...groups.values()].flat().slice(0, 24);
    sel = Math.min(sel, Math.max(0, items.length - 1));
    list.replaceChildren();
    if (!items.length) { list.append(h('p', { class: 'cmdk-none' }, q ? `Brak wyników dla „${input.value.trim()}”.` : 'Zacznij pisać, aby wyszukać.')); return; }
    let i = 0;
    for (const [g, arr] of groups) {
      list.append(h('div', { class: 'cmdk-g', role: 'presentation' }, g));
      for (const it of arr) {
        const idx = i++;
        const row = h('button', { type: 'button', class: `cmdk-i${idx === sel ? ' is-sel' : ''}`, role: 'option', id: `cmdk-o-${idx}`, 'aria-selected': String(idx === sel), 'data-i': String(idx) },
          icon(it.icon, 16), h('span', { class: 'cmdk-t' }, h('b', null, it.title), it.sub ? h('small', null, it.sub) : null));
        row.addEventListener('mousemove', () => { if (sel !== idx) { sel = idx; mark(); } });
        row.addEventListener('click', () => go(it));
        list.append(row);
      }
    }
    input.setAttribute('aria-activedescendant', `cmdk-o-${sel}`);
  }
  function mark() {
    list.querySelectorAll('.cmdk-i').forEach((el, i) => { el.classList.toggle('is-sel', i === sel); el.setAttribute('aria-selected', String(i === sel)); if (i === sel) { el.scrollIntoView({ block: 'nearest' }); input.setAttribute('aria-activedescendant', el.id); } });
  }
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (items.length) { sel = (sel + 1) % items.length; mark(); } }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (items.length) { sel = (sel - 1 + items.length) % items.length; mark(); } }
    else if (e.key === 'Enter' && items[sel] && document.activeElement === input) { e.preventDefault(); go(items[sel]); }
    else if (e.key === 'Tab') { e.preventDefault(); input.focus(); }
  }
  input.addEventListener('input', () => { sel = 0; render(); });
  backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', onKey, true);
  document.body.classList.add('has-modal');
  document.body.appendChild(backdrop);
  openNow = input;
  input.focus();

  index = PAGES.map(([title, href, ic]) => ({ group: 'Strony', title, href, icon: ic, sub: '' }));
  render();
  const safe = (p) => p.catch(() => []);
  const [positions, candidates, people, goals, rubrics] = await Promise.all([
    safe(store.positions.list()), safe(store.candidates.list()), safe(store.people.list()), safe(store.goals.list()), safe(store.rubrics.list())]);
  if (!openNow) return;
  const pos = Object.fromEntries(positions.map((p) => [p.id, p]));
  index.push(
    ...positions.map((p) => ({ group: 'Stanowiska', title: p.title, sub: [p.department, p.location].filter(Boolean).join(' · ') || (p.status === 'closed' ? 'Zamknięte' : 'Otwarte'), href: `#/positions/${p.id}`, icon: 'briefcase' })),
    ...candidates.map((c) => ({ group: 'Kandydaci', title: c.full_name, sub: [(pos[c.position_id] || {}).title, c.email].filter(Boolean).join(' · '), href: `#/candidates/${c.id}`, icon: 'users' })),
    ...people.map((p) => ({ group: 'Ludzie', title: p.full_name, sub: p.job_title || '', href: `#/people/${p.id}`, icon: 'user' })),
    ...goals.map((g) => ({ group: 'Cele', title: g.title, sub: g.person_id ? '' : 'Cała firma', href: '#/goals', icon: 'target' })),
    ...rubrics.map((r) => ({ group: 'Rubryki', title: r.name, sub: `wersja ${r.version || 1}`, href: `#/rubrics/${r.id}`, icon: 'rubric' })));
  render();
}
