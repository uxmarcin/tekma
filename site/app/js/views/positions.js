/**
 * views/positions.js — lista stanowisk + okno „Nowe stanowisko”.
 *   #/positions            lista (filtr: otwarte / zamknięte), każdy wiersz → #/positions/:id (kanban)
 *   #/positions?new=1      od razu otwiera okno „Nowe stanowisko” (używa go pulpit)
 * Dane: store.positions.list(), store.candidates.list(), store.rubrics.list().
 * Okno: tytuł (wymagany), dział, lokalizacja, rubryka z listy, etapy kanbanu (domyślne z seed.js)
 *   → store.positions.create → przejście do #/positions/:id.
 * Stany: skeleton podczas ładowania, błąd z „Spróbuj ponownie”, pusty z jedną akcją główną.
 * Tytuł i akcja „Dodaj stanowisko” żyją w pasku górnym routera (ctx.setHeader) — także na mobile.
 * export default async function render(ctx) -> HTMLElement
 */

import { DEFAULT_STAGES } from '../seed.js';
import { chipsField } from '../chips.js';

const FILTERS = [
  { key: 'open', label: 'Otwarte' },
  { key: 'closed', label: 'Zamknięte' },
];

export default async function render(ctx) {
  const { h, button, loadCss } = ctx.ui;
  await loadCss(new URL('./positions.css', import.meta.url));

  const addBtn = button({ label: 'Dodaj stanowisko', variant: 'primary', icon: 'plus', onClick: () => openNewPosition(ctx, { onCreated: reload }) });
  setHeader(ctx, { title: 'Stanowiska', actions: [addBtn], width: 'wide' });

  const root = h('div', { class: 'pos' });
  let filter = ctx.query && ctx.query.status === 'closed' ? 'closed' : 'open';
  let data = null;

  function renderSkeleton() {
    const sk = h('div', { class: 'pos-skel', 'aria-busy': 'true', 'aria-label': 'Ładowanie stanowisk' });
    sk.appendChild(h('i', { class: 'pos-skel-seg' }));
    for (let i = 0; i < 4; i++) sk.appendChild(h('div', { class: 'pos-skel-row' }, h('i', { class: 'a' }), h('i', { class: 'b' }), h('i', { class: 'c' })));
    root.replaceChildren(sk);
  }

  function renderError(err) {
    const { icon } = ctx.ui;
    root.replaceChildren(h('div', { class: 'state', role: 'alert' },
      h('div', { class: 'glyph' }, icon('alert', 20)),
      h('h2', null, 'Nie udało się wczytać stanowisk'),
      h('p', null, (err && err.message) || 'Sprawdź połączenie i spróbuj ponownie.'),
      h('div', { class: 'actions' }, button({ label: 'Spróbuj ponownie', variant: 'primary', onClick: reload })),
    ));
  }

  async function reload() {
    renderSkeleton();
    try {
      const [positions, candidates] = await Promise.all([ctx.store.positions.list(), ctx.store.candidates.list()]);
      data = { positions, candidates };
      renderList();
    } catch (err) {
      console.error('[positions]', err);
      renderError(err);
    }
  }

  function renderList() {
    const { positions, candidates } = data;
    const counts = { open: positions.filter((p) => p.status === 'open').length, closed: positions.filter((p) => p.status === 'closed').length };

    // Brak jakichkolwiek stanowisk → jeden ekran z jedną akcją główną.
    if (!positions.length) {
      root.replaceChildren(ctx.ui.emptyState({
        icon: 'briefcase',
        title: 'Nie masz jeszcze stanowisk',
        text: 'Stanowisko to kanban etapów, kandydaci i rubryka ocen. Zacznij od pierwszego.',
        action: { label: 'Dodaj stanowisko', icon: 'plus', onClick: () => openNewPosition(ctx, { onCreated: reload }) },
      }));
      return;
    }

    const seg = h('div', { class: 'segment', role: 'group', 'aria-label': 'Filtr stanowisk' },
      FILTERS.map((f) => h('button', {
        type: 'button', 'aria-pressed': filter === f.key ? 'true' : 'false', dataset: { filter: f.key },
        on: { click: () => { if (filter !== f.key) { filter = f.key; renderList(); } } },
      }, `${f.label} `, h('span', { class: 'pos-count' }, String(counts[f.key])))),
    );

    const shown = positions.filter((p) => p.status === filter);
    const list = shown.length
      ? h('ul', { class: 'pos-list', 'aria-label': filter === 'open' ? 'Otwarte stanowiska' : 'Zamknięte stanowiska' }, shown.map((p) => positionRow(ctx, p, candidates)))
      : ctx.ui.emptyState({
        icon: 'briefcase',
        title: filter === 'open' ? 'Brak otwartych stanowisk' : 'Brak zamkniętych stanowisk',
        text: filter === 'open' ? 'Wszystkie stanowiska są zamknięte. Dodaj nowe albo otwórz jedno z zamkniętych.' : 'Zamknięte stanowiska pojawią się tutaj. Zamykasz je w widoku kanbanu.',
        action: filter === 'open' ? { label: 'Dodaj stanowisko', icon: 'plus', onClick: () => openNewPosition(ctx, { onCreated: reload }) } : null,
      });

    root.replaceChildren(
      h('div', { class: 'pos-toolbar' }, seg, h('p', { class: 'pos-summary', 'aria-live': 'polite' }, summary(ctx, shown, candidates))),
      list,
    );
  }

  await reload();
  if (ctx.query && ctx.query.new) {
    // Otwarte z pulpitu: sprzątamy parametr, żeby odświeżenie strony nie otwierało okna ponownie.
    try { history.replaceState(null, '', '#/positions'); } catch { /* nieistotne */ }
    openNewPosition(ctx, { onCreated: reload });
  }
  return root;
}

/**
 * Nagłówek przez ctx.setHeader. Jeśli router nie wstawił elementów akcji do slotu
 * (np. zrobił replaceChildren(tablica) zamiast replaceChildren(...tablica)), poprawiamy slot sami.
 */
export function setHeader(ctx, { title, actions = [], width } = {}) {
  ctx.setHeader({ title, actions, width });
  const slot = document.querySelector('.main-head [data-slot="actions"]');
  if (slot && actions.length && !actions.every((a) => slot.contains(a))) slot.replaceChildren(...actions);
}

function summary(ctx, positions, candidates) {
  const ids = new Set(positions.map((p) => p.id));
  const active = candidates.filter((c) => c.status === 'active' && ids.has(c.position_id)).length;
  if (!positions.length) return '';
  return `${ctx.ui.plural(positions.length, 'stanowisko', 'stanowiska', 'stanowisk')} · ${ctx.ui.plural(active, 'kandydat w procesie', 'kandydatów w procesie', 'kandydatów w procesie')}`;
}

/* ------------------------------------------------ wiersz stanowiska */
function positionRow(ctx, p, candidates) {
  const { h, tag, icon, plural, formatDate } = ctx.ui;
  const mine = candidates.filter((c) => c.position_id === p.id);
  const active = mine.filter((c) => c.status === 'active');
  const meta = [p.department, p.location].filter(Boolean).join(' · ');
  const open = p.status === 'open';
  return h('li', null,
    h('a', { class: 'pos-row', href: `#/positions/${encodeURIComponent(p.id)}`, 'aria-label': `${p.title}${meta ? ', ' + meta : ''}, ${open ? 'otwarte' : 'zamknięte'}, ${plural(active.length, 'kandydat w procesie', 'kandydatów w procesie', 'kandydatów w procesie')}` },
      h('div', { class: 'pos-main' },
        h('b', null, p.title),
        h('small', null, meta || 'Bez działu i lokalizacji', p.created_at ? h('span', { class: 'pos-date' }, ` · od ${formatDate(p.created_at)}`) : null),
      ),
      // lista jest już przefiltrowana po statusie, więc tag „Otwarte” byłby szumem; „Zamknięte” zostaje jako kontekst
      h('div', { class: 'pos-status' }, open ? null : tag('Zamknięte', 'neutral'), !p.rubric_id && open ? tag('Bez rubryki', 'neutral') : null),
      h('div', { class: 'pos-cands' }, h('b', null, String(active.length)), h('small', null, active.length === 1 ? 'kandydat' : 'kandydatów')),
      miniFunnel(ctx, p, active),
      h('span', { class: 'pos-chev', 'aria-hidden': 'true' }, icon('chevron-right')),
    ),
  );
}

/**
 * Mini-kanban: słupek na etap, wysokość ∝ liczbie aktywnych kandydatów na tym etapie.
 * Czarno-biały; etap bez kandydatów to jasny słupek-podstawa.
 */
export function miniFunnel(ctx, position, activeCandidates) {
  const { h, plural } = ctx.ui;
  const stages = Array.isArray(position.stages) && position.stages.length ? position.stages : DEFAULT_STAGES;
  const counts = stages.map((s) => activeCandidates.filter((c) => c.stage === s).length);
  const max = Math.max(1, ...counts);
  const label = stages.map((s, i) => `${s}: ${counts[i]}`).join(', ');
  const empty = counts.every((n) => n === 0);
  return h('div', { class: `mf${empty ? ' is-empty' : ''}`, role: 'img', 'aria-label': `Kanban: ${label}`, title: label },
    stages.map((s, i) => h('i', { class: counts[i] ? 'on' : '', style: `--v:${counts[i] / max}` })),
  );
}

/* ------------------------------------------------ okno „Nowe stanowisko” */
export function openNewPosition(ctx, { onCreated } = {}) {
  const { h, field, button, modal, formError, toast } = ctx.ui;
  const title = field({ label: 'Nazwa stanowiska', name: 'title', required: true, placeholder: 'np. Senior Backend Engineer', autocomplete: 'off' });
  const department = field({ label: 'Dział', name: 'department', placeholder: 'np. Inżynieria', autocomplete: 'organization-title' });
  const location = field({ label: 'Lokalizacja', name: 'location', placeholder: 'np. Warszawa / zdalnie', autocomplete: 'off' });
  const rubric = field({ label: 'Rubryka ocen', name: 'rubric_id', type: 'select', options: [{ value: '', label: 'Ładowanie rubryk…' }], disabled: true, hint: 'Rubryka sprawia, że oceny rozmówców są porównywalne. Możesz ją przypisać później.' });
  const stages = chipsField({ label: 'Etapy kanbanu', name: 'stages', items: DEFAULT_STAGES, defaults: DEFAULT_STAGES, max: 12, hint: 'Kolejność ma znaczenie: pierwszy etap to ten, na który trafia nowy kandydat. Kliknij etap, aby zmienić nazwę, przeciągnij, aby zmienić kolejność. Co najmniej 2 etapy.' });

  const errorSlot = h('div');
  const submit = button({ label: 'Dodaj stanowisko', variant: 'primary', type: 'submit' });
  const cancel = button({ label: 'Anuluj', variant: 'secondary' });

  const form = h('form', { class: 'pos-form', novalidate: true, id: 'pos-new-form' },
    errorSlot,
    title,
    h('div', { class: 'form-row' }, department, location),
    rubric,
    stages,
  );
  // Przyciski w stopce okna; „submit” spoza formularza łączymy atrybutem form.
  submit.setAttribute('form', 'pos-new-form');

  const m = modal({ title: 'Nowe stanowisko', body: form, actions: [cancel, submit] });
  cancel.addEventListener('click', () => m.close());

  // Rubryki ładujemy po otwarciu okna, żeby nie opóźniać listy.
  ctx.store.rubrics.list().then((list) => {
    const opts = [{ value: '', label: list.length ? 'Bez rubryki (dodasz później)' : 'Bez rubryki — nie masz jeszcze żadnej' }, ...list.map((r) => ({ value: r.id, label: `${r.name} (v${r.version || 1})` }))];
    rubric.input.replaceChildren(...opts.map((o) => h('option', { value: o.value }, o.label)));
    rubric.input.disabled = false;
  }).catch((err) => {
    console.error('[positions] rubryki:', err);
    rubric.input.replaceChildren(h('option', { value: '' }, 'Bez rubryki'));
    rubric.input.disabled = false;
    rubric.setError('Nie udało się wczytać rubryk. Stanowisko możesz dodać bez rubryki.');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorSlot.replaceChildren();
    for (const f of [title, department, location, stages]) f.setError('');

    const t = title.value.trim();
    const stageList = parseStages(stages.value);
    let firstBad = null;
    if (t.length < 2) { title.setError('Podaj nazwę stanowiska (co najmniej 2 znaki).'); firstBad = firstBad || title; }
    if (t.length > 120) { title.setError('Nazwa jest za długa (maksymalnie 120 znaków).'); firstBad = firstBad || title; }
    if (stageList.list.length < 2) { stages.setError('Kanban potrzebuje co najmniej 2 etapów. Dodaj kolejny i naciśnij Enter.'); firstBad = firstBad || stages; }
    else if (stageList.duplicate) { stages.setError(`Etap „${stageList.duplicate}” powtarza się. Każdy etap musi mieć inną nazwę.`); firstBad = firstBad || stages; }
    else if (stageList.list.length > 12) { stages.setError('Za dużo etapów (maksymalnie 12). Krótszy kanban jest czytelniejszy.'); firstBad = firstBad || stages; }
    if (firstBad) { firstBad.input.focus(); return; }

    submit.setBusy(true); cancel.disabled = true;
    try {
      const created = await ctx.store.positions.create({
        title: t, department: department.value, location: location.value,
        stages: stageList.list, rubric_id: rubric.value || null,
      });
      toast(`Stanowisko „${created.title}” dodane.`, 'good');
      m.close();
      if (onCreated) { try { await onCreated(created); } catch { /* lista odświeży się po nawigacji */ } }
      ctx.navigate(`#/positions/${encodeURIComponent(created.id)}`);
    } catch (err) {
      console.error('[positions] create:', err);
      errorSlot.replaceChildren(formError((err && err.message) || 'Nie udało się dodać stanowiska. Spróbuj ponownie.'));
      form.scrollTop = 0;
      submit.setBusy(false); cancel.disabled = false;
    }
  });

  return m;
}

function parseStages(text) {
  const list = [];
  const seen = new Set();
  let duplicate = null;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const s = raw.trim().replace(/\s+/g, ' ');
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) { duplicate = duplicate || s; continue; }
    seen.add(key);
    list.push(s);
  }
  return { list, duplicate };
}
