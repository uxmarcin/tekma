/**
 * views/candidates.js — baza kandydatów (#/candidates) + okno „Dodaj kandydata”.
 *
 *   export default async function render(ctx) -> HTMLElement
 *   export function openAddCandidateModal(ctx, { positions?, positionId?, onCreated? }) -> {close}
 *       (używa go też widok lejka: views/pipeline.js)
 *   export function discrepancyIds(scorecards) -> Set<candidate_id>
 *       kandydaci, u których dwie oceny tego samego pytania różnią się o ≥ 2 pkt (ta sama reguła, co store.stats)
 *
 * Filtry (szukaj, stanowisko, status, sortowanie) trzymamy w query hasha (#/candidates?q=…&position=…&status=…&sort=…)
 * przez history.replaceState — bez przeładowania widoku. Dopasowanie CV to zawsze sugestia AI (ai.cvScore) i jest tak oznaczone.
 * Karta kandydata (#/candidates/:id?stage=…) należy do innego widoku — tylko do niej linkujemy.
 */

import { SOURCES } from '../seed.js';

const STATUS_LABEL = { active: 'Aktywni', rejected: 'Odrzuceni', hired: 'Zatrudnieni', all: 'Wszyscy' };
const SORTS = [
  { key: 'applied_desc', label: 'Najnowsze zgłoszenia' },
  { key: 'applied_asc', label: 'Najstarsze zgłoszenia' },
  { key: 'name_asc', label: 'Nazwisko A–Z' },
  { key: 'name_desc', label: 'Nazwisko Z–A' },
  { key: 'score_desc', label: 'Dopasowanie CV: najwyższe' },
  { key: 'score_asc', label: 'Dopasowanie CV: najniższe' },
  { key: 'position_asc', label: 'Stanowisko A–Z' },
  { key: 'stage_asc', label: 'Etap: od pierwszego' },
  { key: 'stage_desc', label: 'Etap: od ostatniego' },
];
const COLUMNS = [
  { key: 'name', label: 'Kandydat', cls: 'c-who' },
  { key: 'position', label: 'Stanowisko', cls: 'c-pos' },
  { key: 'stage', label: 'Etap', cls: 'c-stage' },
  { key: 'source', label: 'Źródło', cls: 'c-src' },
  { key: 'score', label: 'Dopasowanie CV', cls: 'c-score', ai: true },
  { key: 'applied', label: 'Zgłoszenie', cls: 'c-date' },
];

const collator = new Intl.Collator('pl', { sensitivity: 'base' });
const surname = (name) => { const p = String(name || '').trim().split(/\s+/); return p[p.length - 1] || ''; };

export function discrepancyIds(cards) {
  const out = new Set();
  for (const card of cards || []) {
    const byQ = {};
    for (const r of card.ratings || []) (byQ[r.question_id] ||= []).push(Number(r.score));
    for (const scores of Object.values(byQ)) {
      if (scores.length >= 2 && Math.max(...scores) - Math.min(...scores) >= 2) { out.add(card.candidate_id); break; }
    }
  }
  return out;
}

export function candidateHref(c) {
  return `#/candidates/${encodeURIComponent(c.id)}?stage=${encodeURIComponent(c.stage || '')}`;
}

/* ================================================================== widok */
export default async function render(ctx) {
  const { h, icon, button, tag, avatar, emptyState, aiBadge, formatDate, plural } = ctx.ui;
  const { store, ai } = ctx;
  await ctx.ui.loadCss(new URL('./candidates.css', import.meta.url));

  const [positions, candidates, cards] = await Promise.all([store.positions.list(), store.candidates.list(), store.scorecards.list()]);
  const posById = Object.fromEntries(positions.map((p) => [p.id, p]));
  const flagged = discrepancyIds(cards);

  const state = {
    q: String(ctx.query.q || ''),
    position: ctx.query.position && posById[ctx.query.position] ? ctx.query.position : '',
    status: ['active', 'rejected', 'hired', 'all'].includes(ctx.query.status) ? ctx.query.status : 'active',
    sort: SORTS.some((s) => s.key === ctx.query.sort) ? ctx.query.sort : 'applied_desc',
    rows: candidates,
  };

  const addBtn = button({ label: 'Dodaj kandydata', variant: 'primary', icon: 'plus', onClick: () => openAdd() });
  ctx.setHeader({ title: 'Kandydaci', actions: [addBtn], width: 'wide' });

  const root = h('div', { class: 'cd' });
  const live = h('div', { class: 'sr-only', 'aria-live': 'polite' });

  /* --- pasek narzędzi --- */
  const searchInput = h('input', { type: 'search', value: state.q, placeholder: 'Szukaj: imię, e-mail, stanowisko', 'aria-label': 'Szukaj kandydatów', autocomplete: 'off' });
  const clearBtn = h('button', { type: 'button', class: 'clear', 'aria-label': 'Wyczyść wyszukiwanie', hidden: !state.q }, icon('x'));
  const search = h('div', { class: 'cd-search' }, icon('search'), searchInput, clearBtn);
  searchInput.addEventListener('input', () => { state.q = searchInput.value; clearBtn.hidden = !state.q; update(); });
  clearBtn.addEventListener('click', () => { searchInput.value = ''; state.q = ''; clearBtn.hidden = true; update(); searchInput.focus(); });

  const posSelect = h('select', { class: 'cd-select', 'aria-label': 'Filtruj po stanowisku' },
    h('option', { value: '' }, 'Wszystkie stanowiska'),
    positions.map((p) => h('option', { value: p.id, selected: p.id === state.position }, p.status === 'closed' ? `${p.title} (zamknięte)` : p.title)),
  );
  posSelect.addEventListener('change', () => { state.position = posSelect.value; update(); });

  const segment = h('div', { class: 'segment', role: 'group', 'aria-label': 'Status kandydatów' },
    ['active', 'rejected', 'hired', 'all'].map((s) => h('button', { type: 'button', 'aria-pressed': String(state.status === s), dataset: { status: s }, on: { click: () => setStatus(s) } }, STATUS_LABEL[s])),
  );
  const statusSelect = h('select', { class: 'cd-select cd-status-select', 'aria-label': 'Status kandydatów' },
    ['active', 'rejected', 'hired', 'all'].map((s) => h('option', { value: s, selected: s === state.status }, STATUS_LABEL[s])));
  statusSelect.addEventListener('change', () => setStatus(statusSelect.value));

  const sortSelect = h('select', { class: 'cd-select', 'aria-label': 'Sortowanie' },
    SORTS.map((s) => h('option', { value: s.key, selected: s.key === state.sort }, s.label)));
  sortSelect.addEventListener('change', () => { state.sort = sortSelect.value; update(); });

  const bar = h('div', { class: 'cd-bar' }, search, posSelect, segment, statusSelect, sortSelect);
  const summary = h('div', { class: 'cd-sum' });
  const body = h('div', { class: 'cd-wrap' });
  root.append(bar, summary, body, live);

  function setStatus(s) {
    state.status = s;
    for (const b of segment.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.status === s));
    statusSelect.value = s;
    update();
  }
  function resetFilters() {
    state.q = ''; searchInput.value = ''; clearBtn.hidden = true;
    state.position = ''; posSelect.value = '';
    setStatus('active');
  }
  function syncHash() {
    const p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.position) p.set('position', state.position);
    if (state.status !== 'active') p.set('status', state.status);
    if (state.sort !== 'applied_desc') p.set('sort', state.sort);
    const qs = p.toString();
    try { history.replaceState(null, '', `#/candidates${qs ? '?' + qs : ''}`); } catch { /* bez znaczenia */ }
  }

  /* --- filtrowanie i sortowanie --- */
  function visible() {
    const q = state.q.trim().toLowerCase();
    let rows = state.rows;
    if (state.status !== 'all') rows = rows.filter((c) => (c.status || 'active') === state.status);
    if (state.position) rows = rows.filter((c) => c.position_id === state.position);
    if (q) rows = rows.filter((c) => {
      const p = posById[c.position_id];
      return [c.full_name, c.email, c.source, c.stage, p && p.title].filter(Boolean).some((s) => String(s).toLowerCase().includes(q));
    });
    const stageIdx = (c) => { const p = posById[c.position_id]; const i = p && p.stages ? p.stages.indexOf(c.stage) : -1; return i < 0 ? 99 : i; };
    const score = (c) => ai.cvScore(c, posById[c.position_id]);
    const [field, dir] = state.sort.split('_');
    const m = dir === 'desc' ? -1 : 1;
    const cmps = {
      applied: (a, b) => (new Date(a.applied_at) - new Date(b.applied_at)) * m,
      name: (a, b) => (collator.compare(surname(a.full_name), surname(b.full_name)) || collator.compare(a.full_name, b.full_name)) * m,
      score: (a, b) => (score(a) - score(b)) * m,
      position: (a, b) => collator.compare((posById[a.position_id] || {}).title || '', (posById[b.position_id] || {}).title || '') * m,
      stage: (a, b) => (stageIdx(a) - stageIdx(b)) * m,
    };
    const cmp = cmps[field] || cmps.applied;
    return rows.slice().sort((a, b) => cmp(a, b) || collator.compare(a.full_name, b.full_name));
  }

  function headerSort(key) {
    const [f, d] = state.sort.split('_');
    const defaultDir = key === 'applied' || key === 'score' ? 'desc' : 'asc';
    const next = f === key ? (d === 'asc' ? 'desc' : 'asc') : defaultDir;
    state.sort = `${key}_${next}`;
    sortSelect.value = state.sort;
    update();
  }

  /* --- rysowanie --- */
  function update() {
    syncHash();
    const rows = visible();
    const total = state.rows.length;
    const filtered = Boolean(state.q.trim() || state.position || state.status !== 'active');
    summary.replaceChildren(
      h('span', null, total === 0 ? 'Brak kandydatów' : `${plural(rows.length, 'kandydat', 'kandydaci', 'kandydatów')}${state.status !== 'all' ? ` · ${STATUS_LABEL[state.status].toLowerCase()}` : ''}${rows.length !== total ? ` · z ${total} w bazie` : ''}`),
      filtered && total ? h('button', { type: 'button', class: 'link', on: { click: resetFilters } }, 'Wyczyść filtry') : null,
    );
    live.textContent = `${plural(rows.length, 'wynik', 'wyniki', 'wyników')}.`;

    if (total === 0) {
      body.replaceChildren(positions.length
        ? emptyState({ icon: 'users', title: 'Baza kandydatów jest pusta', text: 'Dodaj pierwszą osobę. Trafi na pierwszy etap lejka wybranego stanowiska.', action: { label: 'Dodaj kandydata', icon: 'plus', onClick: () => openAdd() } })
        : emptyState({ icon: 'briefcase', title: 'Zacznij od stanowiska', text: 'Kandydat zawsze należy do stanowiska i jego lejka. Najpierw dodaj stanowisko.', action: { label: 'Przejdź do stanowisk', onClick: () => ctx.navigate('#/positions') } }));
      return;
    }
    if (!rows.length) {
      body.replaceChildren(emptyState({ icon: 'search', title: 'Nic nie pasuje', text: 'Zmień wyszukiwanie albo filtry. Odrzuconych i zatrudnionych znajdziesz pod statusem.', action: { label: 'Wyczyść filtry', variant: 'secondary', onClick: resetFilters } }));
      return;
    }
    body.replaceChildren(table(rows));
  }

  function table(rows) {
    const [sf, sd] = state.sort.split('_');
    const thead = h('thead', null, h('tr', null,
      COLUMNS.map((c) => h('th', { scope: 'col', class: c.ai ? 'cd-th-ai' : null, 'aria-sort': sf === c.key ? (sd === 'asc' ? 'ascending' : 'descending') : null },
        h('button', { type: 'button', on: { click: () => headerSort(c.key) }, title: `Sortuj: ${c.label}` }, c.label, icon('chevron')),
        c.ai ? aiBadge('AI') : null,
      )),
      h('th', { scope: 'col', class: 'cd-go' }, h('span', { class: 'sr-only' }, 'Otwórz')),
    ));
    const tbody = h('tbody', null, rows.map(rowEl));
    return h('table', { class: 'cd-table' }, thead, tbody);
  }

  function rowEl(c) {
    const p = posById[c.position_id];
    const score = ai.cvScore(c, p);
    const href = candidateHref(c);
    const link = h('a', { href }, c.full_name);
    const tr = h('tr', { on: { click: (e) => {
      if (e.target.closest('a,button')) return;
      ctx.navigate(href);
    } } },
      h('td', { class: 'c-who' }, h('div', { class: 'cd-who' }, avatar(c.full_name), h('div', { class: 't' }, link, c.email ? h('small', null, c.email) : null))),
      h('td', { class: 'c-pos' }, h('span', { class: 'cd-pos' }, p ? p.title : h('span', { class: 'faint' }, 'Brak stanowiska'))),
      h('td', { class: 'c-stage' }, h('div', { class: 'cd-stage' },
        c.status === 'rejected' ? tag('Odrzucony', 'bad') : c.status === 'hired' ? tag('Zatrudniony', 'good') : tag(c.stage || '—', 'neutral'),
        flagged.has(c.id) ? tag('Rozbieżność', 'warn') : null,
      )),
      h('td', { class: 'c-src' }, h('span', { class: 'cd-src' }, c.source || '—')),
      h('td', { class: 'c-score' }, h('span', { class: 'cd-cv', title: `Sugestia AI: ${ai.cvReason(c, p)}` },
        icon('spark'), h('span', { class: 'sr-only' }, 'Sugestia AI: dopasowanie CV '), `${score}%`,
        h('span', { class: 'bar', 'aria-hidden': 'true' }, h('i', { style: `width:${score}%` })),
      )),
      h('td', { class: 'c-date' }, h('time', { class: 'cd-date', datetime: c.applied_at || '' }, formatDate(c.applied_at, { relative: true }))),
      h('td', { class: 'c-go' }, icon('chevron-right')),
    );
    return tr;
  }

  async function reload() {
    state.rows = await store.candidates.list();
    update();
  }

  function openAdd() {
    openAddCandidateModal(ctx, {
      positions,
      positionId: state.position || undefined,
      onCreated: async () => { await reload(); },
    });
  }

  update();
  return root;
}

/* ================================================================== okno „Dodaj kandydata” */
export function openAddCandidateModal(ctx, { positions, positionId, onCreated } = {}) {
  const { h, field, button, modal, toast, formError, aiBadge, icon } = ctx.ui;
  const { store, ai } = ctx;
  ctx.ui.loadCss(new URL('./candidates.css', import.meta.url));

  let list = Array.isArray(positions) ? positions : null;
  const errorSlot = h('div');
  const body = h('div');
  const submit = button({ label: 'Dodaj kandydata', variant: 'primary', type: 'submit' });
  const cancel = button({ label: 'Anuluj', variant: 'secondary' });
  const m = modal({ title: 'Dodaj kandydata', body, actions: [cancel, submit] });
  cancel.addEventListener('click', () => m.close());

  (async () => {
    if (!list) {
      try { list = await store.positions.list(); } catch (err) { body.replaceChildren(formError(err.message || 'Nie udało się wczytać stanowisk.')); return; }
    }
    if (!list.length) {
      submit.disabled = true;
      body.replaceChildren(
        h('p', null, 'Kandydat zawsze należy do stanowiska. Najpierw dodaj stanowisko, potem wróć tutaj.'),
        button({ label: 'Przejdź do stanowisk', variant: 'secondary', onClick: () => { m.close(); ctx.navigate('#/positions'); } }),
      );
      return;
    }
    buildForm();
  })();

  function buildForm() {
    const open = list.filter((p) => p.status !== 'closed');
    const options = (open.length ? open : list).map((p) => ({ value: p.id, label: p.status === 'closed' ? `${p.title} (zamknięte)` : p.title }));
    const preset = list.find((p) => p.id === positionId);
    if (preset && !options.some((o) => o.value === preset.id)) options.unshift({ value: preset.id, label: `${preset.title} (zamknięte)` });
    const fPos = field({ label: 'Stanowisko', name: 'position', type: 'select', options, value: preset ? preset.id : options[0].value, required: true });
    const fName = field({ label: 'Imię i nazwisko', name: 'full_name', type: 'text', required: true, placeholder: 'np. Anna Nowak', autocomplete: 'off' });
    const fEmail = field({ label: 'E-mail', name: 'email', type: 'email', placeholder: 'anna@przyklad.pl', autocomplete: 'off', hint: 'Opcjonalnie. Przyda się do zaproszeń na rozmowy.' });
    const fSource = field({ label: 'Źródło', name: 'source', type: 'select', options: [...SOURCES, 'Inne'], value: SOURCES[0] });

    const aiNum = h('div', { class: 'n off', 'aria-hidden': 'true' }, '—');
    const aiText = h('p', null, 'Wpisz imię i nazwisko, a AI oszacuje dopasowanie CV do stanowiska.');
    const useAi = h('input', { type: 'checkbox', checked: true, id: 'cd-use-ai' });
    const aiBox = h('div', { class: 'cd-ai', role: 'group', 'aria-label': 'Sugestia AI: dopasowanie CV' },
      aiNum,
      h('div', { class: 't' },
        h('div', { class: 'head' }, aiBadge('AI sugeruje'), h('small', null, 'dopasowanie CV')),
        aiText,
        h('label', { class: 'check', htmlFor: 'cd-use-ai' }, useAi, 'Zapisz sugestię przy kandydacie (możesz ją później zmienić)'),
      ),
    );
    let suggestion = null;
    const refreshAi = () => {
      const name = fName.value.trim();
      const pos = list.find((p) => p.id === fPos.value);
      if (name.length < 2 || !pos) {
        suggestion = null; aiNum.textContent = '—'; aiNum.classList.add('off');
        aiText.textContent = 'Wpisz imię i nazwisko, a AI oszacuje dopasowanie CV do stanowiska.';
        return;
      }
      const cand = { full_name: name, email: fEmail.value.trim().toLowerCase() };
      suggestion = ai.cvScore(cand, pos);
      aiNum.textContent = `${suggestion}%`; aiNum.classList.remove('off');
      aiText.textContent = `${ai.cvReason(cand, pos)} To tylko sugestia — decyzja o dalszych etapach należy do Ciebie.`;
    };
    for (const f of [fName, fEmail, fPos]) f.input.addEventListener('input', refreshAi);
    fPos.input.addEventListener('change', refreshAi);

    const form = h('form', { novalidate: true, on: { submit: async (e) => {
      e.preventDefault();
      errorSlot.replaceChildren();
      for (const f of [fPos, fName, fEmail]) f.setError('');
      let firstBad = null;
      const mark = (f, msg) => { f.setError(msg); firstBad ||= f; };
      if (!fPos.value) mark(fPos, 'Wybierz stanowisko.');
      if (fName.value.trim().length < 2) mark(fName, 'Podaj imię i nazwisko (co najmniej 2 znaki).');
      const email = fEmail.value.trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) mark(fEmail, 'Ten adres e-mail wygląda na niepoprawny. Sprawdź znak @ i domenę.');
      if (firstBad) { firstBad.input.focus(); return; }
      submit.setBusy(true);
      try {
        const created = await store.candidates.create({
          position_id: fPos.value, full_name: fName.value, email, source: fSource.value,
          cv_score: useAi.checked && typeof suggestion === 'number' ? suggestion : undefined,
        });
        const pos = list.find((p) => p.id === created.position_id);
        toast(`Dodaliśmy: ${created.full_name} → ${created.stage}${pos ? ` (${pos.title})` : ''}.`, 'good');
        m.close();
        if (onCreated) await onCreated(created);
      } catch (err) {
        errorSlot.replaceChildren(formError(err.message || 'Nie udało się dodać kandydata.'));
        submit.setBusy(false);
      }
    } } },
      errorSlot,
      fPos,
      h('div', { class: 'form-row' }, fName, fEmail),
      fSource,
      aiBox,
      h('p', { class: 'cd-note' }, icon('info', 12), ' Kandydat trafi na pierwszy etap lejka tego stanowiska.'),
    );
    submit.addEventListener('click', () => form.requestSubmit());
    body.replaceChildren(form);
    requestAnimationFrame(() => fName.input.focus());
  }

  return m;
}
