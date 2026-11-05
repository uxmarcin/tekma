/**
 * views/people.js — moduł „Ludzie”: osoby po zatrudnieniu i ich plan pierwszych 90 dni.
 *   #/people        lista osób z postępem planu (+ „Dodaj osobę”)
 *   #/people/:id    plan 30/60/90: zadania do odhaczania, dodawanie i usuwanie, edycja osoby
 * Dane: store.people / store.tasks (domyślny plan z plan.js tworzy się przy dodaniu osoby).
 * Zapis: owner i recruiter; rozmówca widzi, ale nie zmienia (RLS pilnuje tego w bazie).
 */
import { PHASES, dayOf } from '../plan.js';
import { setHeader } from './positions.js';
import { reviewSection } from './people-review.js';

const STATUS = { onboarding: ['Wdrożenie', 'blue'], active: ['Zespół', 'good'], left: ['Odeszła/odszedł', 'neutral'] };
const canWrite = (ctx) => ctx.org && (ctx.org.role === 'owner' || ctx.org.role === 'recruiter');
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const addDays = (iso, n) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n); return d; };

export default async function render(ctx) {
  await ctx.ui.loadCss(new URL('./people.css', import.meta.url));
  return ctx.params && ctx.params.id ? detail(ctx) : list(ctx);
}

function errorState(ctx, err, retry) {
  const { h, icon, button } = ctx.ui;
  const noTable = err && err.code === 'no_table';
  return h('div', { class: 'state', role: 'alert' },
    h('div', { class: 'glyph' }, icon(noTable ? 'construction' : 'alert', 20)),
    h('h2', null, noTable ? 'Ten moduł czeka na migrację bazy' : 'Nie udało się wczytać danych'),
    h('p', null, (err && err.message) || 'Sprawdź połączenie i spróbuj ponownie.'),
    noTable ? null : h('div', { class: 'actions' }, button({ label: 'Spróbuj ponownie', variant: 'primary', onClick: retry })));
}

/* ------------------------------------------------ lista */
async function list(ctx) {
  const { h, button, tag, avatar, formatDate, plural, emptyState } = ctx.ui;
  const write = canWrite(ctx);
  const add = button({ label: 'Dodaj osobę', variant: 'primary', icon: 'plus', disabled: !write, onClick: () => openPerson(ctx, { onSaved: (p) => ctx.navigate(`#/people/${p.id}`) }) });
  setHeader(ctx, { title: 'Ludzie', actions: write ? [add] : [], width: 'wide' });
  const root = h('div', { class: 'pe' });

  async function load() {
    root.replaceChildren(h('div', { class: 'pe-skel', 'aria-busy': 'true', 'aria-label': 'Ładowanie' }, h('i'), h('i'), h('i')));
    try {
      const [people, tasks] = await Promise.all([ctx.store.people.list(), ctx.store.tasks.list()]);
      const by = {};
      for (const t of tasks) { const s = (by[t.person_id] ||= { done: 0, total: 0 }); s.total++; if (t.done) s.done++; }
      if (!people.length) {
        root.replaceChildren(emptyState({
          icon: 'user', title: 'Nikogo jeszcze nie wdrażasz',
          text: 'Dodaj nową osobę, a przygotujemy dla niej plan pierwszych 90 dni: zadania na 30., 60. i 90. dzień do odhaczania.',
          action: write ? { label: 'Dodaj osobę', icon: 'plus', onClick: () => add.click() } : null,
        }));
        return;
      }
      const sorted = [...people].sort((a, b) => (a.status === 'left') - (b.status === 'left') || String(b.start_date).localeCompare(String(a.start_date)));
      const active = people.filter((p) => p.status === 'onboarding').length;
      const ul = h('ul', { class: 'pe-list' }, sorted.map((p) => {
        const st = by[p.id] || { done: 0, total: 0 };
        const pct = st.total ? Math.round((st.done / st.total) * 100) : 0;
        const day = dayOf(p.start_date);
        const when = day < 1 ? `Start ${formatDate(p.start_date)}` : (p.status === 'onboarding' && day <= 90 ? `Dzień ${day} z 90` : `Od ${formatDate(p.start_date)}`);
        return h('li', null, h('a', { class: 'pe-row', href: `#/people/${p.id}` },
          h('span', { class: 'pe-who' }, avatar(p.full_name), h('span', { class: 't' }, h('b', null, p.full_name), h('small', { class: 'muted' }, p.job_title || 'Bez stanowiska'))),
          h('span', { class: 'pe-when' }, when),
          h('span', { class: 'pe-prog', 'aria-label': `Plan wykonany w ${pct}%` },
            h('span', { class: 'progress' }, h('i', { style: `width:${pct}%` })), h('small', { class: 'muted' }, `${st.done}/${st.total}`)),
          h('span', { class: 'pe-st' }, tag(STATUS[p.status][0], STATUS[p.status][1]))));
      }));
      root.replaceChildren(
        h('p', { class: 'pe-sum muted' }, `${plural(people.length, 'osoba', 'osoby', 'osób')} · w trakcie wdrożenia: ${active}`),
        h('div', { class: 'card pe-card' }, ul));
    } catch (err) { console.error('[people]', err); root.replaceChildren(errorState(ctx, err, load)); }
  }
  await load();
  return root;
}

/* ------------------------------------------------ szczegóły i plan */
async function detail(ctx) {
  const { h, button, tag, avatar, formatDate, toast, confirm, icon, field } = ctx.ui;
  const write = canWrite(ctx);
  const root = h('div', { class: 'pe' });
  ctx.setHeader({ title: 'Ludzie', width: 'wide' });
  let person, tasks;

  async function load() {
    try {
      [person, tasks] = await Promise.all([ctx.store.people.get(ctx.params.id), ctx.store.tasks.list(ctx.params.id)]);
      if (!person) {
        root.replaceChildren(ctx.ui.emptyState({ icon: 'user', title: 'Nie znaleziono osoby', text: 'Mogła zostać usunięta.', action: { label: 'Wróć do listy', variant: 'secondary', onClick: () => ctx.navigate('#/people') } }));
        return;
      }
      ctx.setHeader({ title: person.full_name, width: 'wide' });
      paint();
    } catch (err) { console.error('[people]', err); root.replaceChildren(errorState(ctx, err, load)); }
  }

  async function run(fn, okMsg) {
    try { await fn(); if (okMsg) toast(okMsg, 'good'); await load(); }
    catch (err) { toast((err && err.message) || 'Nie udało się zapisać zmiany.', 'bad'); await load(); }
  }

  function taskRow(t) {
    const due = addDays(person.start_date, t.due_day - 1);
    const overdue = !t.done && person.status === 'onboarding' && dayOf(person.start_date) > t.due_day;
    const cb = h('input', { type: 'checkbox', id: `t-${t.id}`, checked: t.done, disabled: !write, 'aria-label': t.title });
    cb.addEventListener('change', () => run(() => ctx.store.tasks.toggle(t.id, cb.checked)));
    const del = write ? h('button', { type: 'button', class: 'pe-x', title: 'Usuń zadanie', 'aria-label': `Usuń zadanie: ${t.title}`, on: { click: () => run(() => ctx.store.tasks.remove(t.id)) } }, icon('x', 14)) : null;
    return h('li', { class: `pe-task${t.done ? ' is-done' : ''}` },
      h('label', { class: 'pe-check', for: `t-${t.id}` }, cb, h('span', { class: 'pe-t' }, h('span', { class: 'pe-tt' }, t.title),
        h('small', { class: overdue ? 'pe-over' : 'muted' }, `Dzień ${t.due_day} · ${formatDate(due)}${overdue ? ' · po terminie' : ''}`))),
      del);
  }

  function phaseCol(ph) {
    const items = tasks.filter((t) => t.phase === ph.phase).sort((a, b) => (a.position || 0) - (b.position || 0) || a.due_day - b.due_day);
    const done = items.filter((t) => t.done).length;
    const input = h('input', { class: 'pe-new', type: 'text', placeholder: 'Dodaj zadanie…', maxlength: '200', 'aria-label': `Nowe zadanie: ${ph.label}`, disabled: !write });
    const addForm = write ? h('form', { class: 'pe-add', on: { submit: (e) => {
      e.preventDefault(); const v = input.value.trim(); if (!v) return;
      run(() => ctx.store.tasks.create({ person_id: person.id, phase: ph.phase, title: v, due_day: ph.phase }));
    } } }, input, h('button', { type: 'submit', class: 'pe-add-b', 'aria-label': 'Dodaj zadanie' }, icon('plus', 16))) : null;
    return h('section', { class: 'card pe-phase', 'aria-label': ph.label },
      h('div', { class: 'pe-ph' }, h('h2', { class: 'pe-h' }, ph.label), h('small', { class: 'muted' }, `${done}/${items.length}`)),
      h('p', { class: 'muted pe-goal' }, ph.goal),
      h('ul', { class: 'pe-tasks' }, items.length ? items.map(taskRow) : h('li', { class: 'muted pe-none' }, 'Brak zadań w tej fazie.')),
      addForm);
  }

  function paint() {
    const total = tasks.length, done = tasks.filter((t) => t.done).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const day = dayOf(person.start_date);
    const dayTxt = day < 1 ? `Start za ${1 - day} dni` : (day <= 90 ? `Dzień ${day} z 90` : `${day}. dzień pracy`);
    const status = field({ label: 'Status', name: 'status', type: 'select', value: person.status, disabled: !write,
      options: Object.entries(STATUS).map(([v, [l]]) => ({ value: v, label: l })) });
    status.input.addEventListener('change', () => run(() => ctx.store.people.update(person.id, { status: status.input.value }), 'Status zapisany.'));
    const actions = write ? h('div', { class: 'pe-act' },
      button({ label: 'Edytuj', size: 'sm', variant: 'secondary', icon: 'edit', onClick: () => openPerson(ctx, { person, onSaved: load }) }),
      button({ label: 'Usuń osobę', size: 'sm', variant: 'ghost', icon: 'trash', onClick: async () => {
        if (!(await confirm({ title: `Usunąć: ${person.full_name}?`, text: 'Usuniemy osobę wraz z planem wdrożenia i jej celami. Tej operacji nie można cofnąć.', confirmLabel: 'Usuń', danger: true }))) return;
        try { await ctx.store.people.remove(person.id); toast('Osoba usunięta.', 'good'); ctx.navigate('#/people'); } catch (err) { toast(err.message || 'Nie udało się usunąć.', 'bad'); }
      } })) : null;
    root.replaceChildren(
      h('a', { class: 'pe-back', href: '#/people' }, icon('chevron', 14), 'Ludzie'),
      h('div', { class: 'card pe-head' },
        h('div', { class: 'pe-who lg' }, avatar(person.full_name, 'lg'), h('span', { class: 't' }, h('b', null, person.full_name), h('small', { class: 'muted' }, `${person.job_title || 'Bez stanowiska'} · start ${formatDate(person.start_date)}`))),
        h('div', { class: 'pe-stats' },
          h('div', null, h('small', { class: 'muted' }, 'Wdrożenie'), h('b', null, dayTxt)),
          h('div', { class: 'pe-ov' }, h('small', { class: 'muted' }, `Plan wykonany w ${pct}%`), h('span', { class: 'progress' }, h('i', { style: `width:${pct}%` })), h('small', { class: 'muted' }, `${done} z ${total} zadań`)),
          status),
        actions),
      reviewSection(ctx, person, { write }),
      h('div', { class: 'pe-phases' }, PHASES.map(phaseCol)));
  }
  await load();
  return root;
}

/* ------------------------------------------------ okno: dodaj / edytuj osobę */
export function openPerson(ctx, { person = null, onSaved } = {}) {
  const { h, field, button, modal, formError, toast } = ctx.ui;
  const name = field({ label: 'Imię i nazwisko', name: 'full_name', required: true, value: person ? person.full_name : '', autocomplete: 'off' });
  const title = field({ label: 'Stanowisko', name: 'job_title', value: person ? person.job_title : '', placeholder: 'np. Senior Backend Engineer', autocomplete: 'off' });
  const start = field({ label: 'Pierwszy dzień pracy', name: 'start_date', type: 'date', value: person ? person.start_date : todayIso(), required: true,
    hint: person ? 'Zmiana daty przesunie terminy zadań w planie.' : 'Od tego dnia liczymy plan 30/60/90 dni.' });
  const cand = person ? null : field({ label: 'Z zatrudnionych kandydatów (opcjonalnie)', name: 'candidate_id', type: 'select', options: [{ value: '', label: 'Ładowanie…' }], disabled: true });
  const errorSlot = h('div');
  const submit = button({ label: person ? 'Zapisz' : 'Dodaj osobę', variant: 'primary', type: 'submit' });
  submit.setAttribute('form', 'pe-form');
  const cancel = button({ label: 'Anuluj', variant: 'secondary' });
  const form = h('form', { id: 'pe-form', novalidate: true }, errorSlot, cand, name, title, start);
  const m = modal({ title: person ? 'Edytuj osobę' : 'Nowa osoba', body: form, actions: [cancel, submit] });
  cancel.addEventListener('click', () => m.close());

  if (cand) {
    Promise.all([ctx.store.candidates.list(), ctx.store.positions.list(), ctx.store.people.list().catch(() => [])]).then(([cs, ps, ppl]) => {
      const used = new Set(ppl.map((p) => p.candidate_id).filter(Boolean));
      const hired = cs.filter((c) => c.status === 'hired' && !used.has(c.id));
      const pos = Object.fromEntries(ps.map((p) => [p.id, p]));
      cand.input.replaceChildren(h('option', { value: '' }, hired.length ? 'Wybierz, aby uzupełnić dane…' : 'Brak zatrudnionych kandydatów — wpisz dane ręcznie'),
        ...hired.map((c) => h('option', { value: c.id }, `${c.full_name}${pos[c.position_id] ? ` — ${pos[c.position_id].title}` : ''}`)));
      cand.input.disabled = !hired.length;
      cand.input.addEventListener('change', () => {
        const c = hired.find((x) => x.id === cand.input.value);
        if (c) { name.input.value = c.full_name; title.input.value = (pos[c.position_id] || {}).title || ''; }
      });
    }).catch(() => { cand.input.replaceChildren(h('option', { value: '' }, 'Nie udało się wczytać kandydatów')); });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault(); errorSlot.replaceChildren(); name.setError(''); start.setError('');
    if (name.value.trim().length < 2) { name.setError('Podaj imię i nazwisko.'); name.input.focus(); return; }
    if (!start.value) { start.setError('Podaj datę rozpoczęcia pracy.'); start.input.focus(); return; }
    submit.setBusy(true);
    try {
      const data = { full_name: name.value.trim(), job_title: title.value.trim(), start_date: start.value };
      const row = person ? await ctx.store.people.update(person.id, data) : await ctx.store.people.create({ ...data, candidate_id: cand && cand.input.value });
      m.close(); toast(person ? 'Zapisano zmiany.' : 'Dodano osobę i plan 90 dni.', 'good');
      if (onSaved) onSaved(row);
    } catch (err) { errorSlot.replaceChildren(formError(err.message || 'Nie udało się zapisać.')); } finally { submit.setBusy(false); }
  });
}
