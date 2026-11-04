/**
 * views/people.js — „Ludzie” (#/people): osoby w pierwszych miesiącach pracy, KPI i lista (Figma 29:3709).
 *
 *   export default async function render(ctx) -> HTMLElement
 *   export function openAddPersonModal(ctx, { onCreated }) -> {close}
 *
 * Dane: views/people-data.js (localStorage `tekma.demo.people`). Wiersz listy prowadzi do #/people/:id.
 */

import * as data from './people-data.js';

const COLS = [
  { key: 'day', label: 'Dzień', w: 110 },
  { key: 'one', label: 'Ostatnie 1:1', w: 140 },
  { key: 'checkin', label: 'Check-in', w: 140 },
  { key: 'goals', label: 'Cele', w: 160 },
  { key: 'courses', label: 'Szkolenia', w: 120 },
];

export default async function render(ctx) {
  const { h, button, avatar, emptyState } = ctx.ui;
  await ctx.ui.loadCss(new URL('./people.css', import.meta.url));

  const addBtn = button({ label: 'Dodaj osobę', variant: 'primary', onClick: () => openAddPersonModal(ctx, { onCreated: draw }) });
  ctx.setHeader({ title: 'Ludzie', width: 'wide' });

  const root = h('div', { class: 'pp pp-people' });
  const kpiEl = h('div', { class: 'pp-kpis', role: 'list', 'aria-label': 'Wskaźniki' });
  const tableEl = h('div', { class: 'pp-panel pp-table pp-people-table', role: 'table', 'aria-label': 'Osoby' });
  root.append(
    h('div', { class: 'pp-head' },
      h('div', { class: 't' }, h('h1', null, 'Ludzie'), h('p', null, 'Osoby w pierwszych 6 miesiącach pracy: 1:1, check-iny i cele.')),
      h('div', { class: 'actions' }, addBtn)),
    kpiEl, tableEl,
  );

  function draw() {
    const state = data.load();
    kpiEl.replaceChildren(...data.kpis(state).map((k) => h('div', { class: 'pp-kpi', role: 'listitem' }, h('small', null, k.label), h('b', null, k.value), h('small', null, k.sub))));
    if (!state.people.length) {
      tableEl.replaceChildren(emptyState({ icon: 'user', title: 'Nie ma jeszcze nikogo po zatrudnieniu', text: 'Dodaj osobę, żeby prowadzić jej plan 90 dni, 1:1, check-iny i cele.', action: { label: 'Dodaj osobę', onClick: () => openAddPersonModal(ctx, { onCreated: draw }) } }));
      return;
    }
    tableEl.replaceChildren(
      h('div', { class: 'pp-th', role: 'row' },
        h('div', { class: 'c grow', role: 'columnheader' }, 'Osoba'),
        COLS.map((c) => h('div', { class: 'c', role: 'columnheader', style: `width:${c.w}px`, dataset: { col: c.key } }, c.label))),
      state.people.map((p) => row(state, p)),
    );
  }

  function row(state, p) {
    const day = data.personDay(p);
    const one = data.oneOnOneAgo(p);
    const ck = data.checkinStatus(p);
    const goals = data.goalsProgress(state, p);
    const goalTone = (data.personGoals(state, p).find((g) => g.tone) || {}).tone || '';
    const cc = data.courseCounts(p);
    return h('a', { class: 'pp-tr', role: 'row', href: `#/people/${encodeURIComponent(p.id)}`, 'aria-label': `${p.name} — otwórz profil` },
      h('div', { class: 'c grow', role: 'cell' }, avatar(p.name), h('div', { class: 'pp-who' }, h('b', null, p.name), h('small', null, [p.role, p.team].filter(Boolean).join(' · ')))),
      h('div', { class: 'c', role: 'cell', style: 'width:110px', dataset: { col: 'day' } }, h('span', { class: 'lbl' }, 'Dzień '), day <= 90 ? `${day} z 90` : String(day)),
      h('div', { class: 'c', role: 'cell', style: 'width:140px', dataset: { col: 'one' } }, h('span', { class: 'lbl' }, '1:1 '), h('span', { class: `pp-badge ${one.tone}` }, one.label)),
      h('div', { class: 'c', role: 'cell', style: 'width:140px', dataset: { col: 'checkin' } }, h('span', { class: 'lbl' }, 'Check-in '), h('span', { class: `pp-badge ${ck.tone}` }, ck.label)),
      h('div', { class: 'c', role: 'cell', style: 'width:160px', dataset: { col: 'goals' } }, h('span', { class: 'lbl' }, 'Cele '),
        goals === null ? h('span', { class: 'pct pp-muted' }, 'Brak celu')
          : [h('span', { class: `pp-bar ${goalTone}`, style: 'width:90px', 'aria-hidden': 'true' }, h('i', { style: `width:${goals}%` })), h('span', { class: 'pct' }, `${goals}%`)]),
      h('div', { class: 'c', role: 'cell', style: 'width:120px', dataset: { col: 'courses' } }, h('span', { class: 'lbl' }, 'Szkolenia '), cc.total ? `${cc.done} z ${cc.total}` : h('span', { class: 'pp-muted' }, '—')),
    );
  }

  draw();
  return root;
}

/* ================================================================== okno „Dodaj osobę” */
export function openAddPersonModal(ctx, { onCreated } = {}) {
  const { h, field, button, modal, toast } = ctx.ui;
  const fName = field({ label: 'Imię i nazwisko', name: 'name', required: true, placeholder: 'np. Anna Nowak', autocomplete: 'off' });
  const fRole = field({ label: 'Stanowisko', name: 'role', required: true, placeholder: 'np. Backend Engineer' });
  const fTeam = field({ label: 'Zespół', name: 'team', placeholder: 'np. Platforma' });
  const fStart = field({ label: 'Data startu', name: 'start', type: 'date', value: data.today(), required: true });
  const fManager = field({ label: 'Menedżer', name: 'manager', placeholder: 'np. Dev Patel' });
  const submit = button({ label: 'Dodaj osobę', variant: 'primary' });
  const cancel = button({ label: 'Anuluj', variant: 'secondary' });
  const form = h('form', { class: 'pp-form', novalidate: true },
    fName, h('div', { class: 'form-row' }, fRole, fTeam), h('div', { class: 'form-row' }, fStart, fManager),
    h('p', { class: 'pp-cap' }, 'Osoba dostanie plan 90 dni, cotygodniowe check-iny i miejsce na 1:1. Nic nie wysyłamy — to dane demo w tej przeglądarce.'),
  );
  const m = modal({ title: 'Dodaj osobę', body: form, actions: [cancel, submit] });
  cancel.addEventListener('click', () => m.close());
  const onSubmit = (e) => {
    if (e) e.preventDefault();
    let bad = null;
    if (fName.value.trim().length < 2) { fName.setError('Podaj imię i nazwisko.'); bad ||= fName; }
    if (!fRole.value.trim()) { fRole.setError('Podaj stanowisko.'); bad ||= fRole; }
    if (!fStart.value) { fStart.setError('Podaj datę startu.'); bad ||= fStart; }
    if (bad) { bad.input.focus(); return; }
    const name = fName.value.trim();
    const first = data.firstName(name);
    const person = {
      id: data.uid('p'), name, role: fRole.value.trim(), team: fTeam.value.trim(), start: fStart.value, manager: fManager.value.trim(), lastOneOnOne: null,
      plan90: [1, 7, 30, 60, 90].map((d, i) => ({ day: d, label: ['Start i dostępy', 'Pierwszy check-in', 'Przegląd 30 dni', 'Przegląd 60 dni', 'Przegląd końcowy'][i], done: false })),
      oneOnOne: { next: null, agenda: [{ id: 'a1', text: 'Oczekiwania na 90 dni', by: 'Szablon', done: false }, { id: 'a2', text: 'Co Cię w tym tygodniu najbardziej spowolniło?', by: 'Szablon', done: false }], note: '', history: [], ai: `Pierwsze 1:1 z ${first}: ustal, po czym poznacie udane 90 dni.` },
      checkins: { rhythm: { weekday: 5, questions: 5, minutes: 1 }, entries: [], themes: [] },
      courses: [], streak: { days: 0, best: '', toReview: '', pattern: new Array(14).fill(0) }, recruitment: null,
    };
    data.update((s) => { s.people.push(person); });
    toast(`Dodaliśmy: ${name}. Plan 90 dni zaczyna się ${data.fmtStart(person.start)}.`, 'good');
    m.close();
    if (onCreated) onCreated(person);
  };
  form.addEventListener('submit', onSubmit);
  submit.addEventListener('click', onSubmit);
  return m;
}
