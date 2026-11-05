/**
 * views/goals.js — moduł „Cele”: cele firmy i osób z postępem 0–100%.
 *   #/goals   lista (filtr: aktywne / zakończone / wszystkie), zmiana postępu suwakiem, dodawanie i edycja w oknie.
 * Dane: store.goals (person_id = null → cel całej firmy), store.people (do wyboru właściciela celu).
 * Zapis: owner i recruiter; rozmówca tylko czyta. Postęp 100% = cel zakończony.
 */
import { setHeader } from './positions.js';

const FILTERS = [['active', 'Aktywne'], ['done', 'Zakończone'], ['all', 'Wszystkie']];
const canWrite = (ctx) => ctx.org && (ctx.org.role === 'owner' || ctx.org.role === 'recruiter');
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export default async function render(ctx) {
  const { h, button, tag, formatDate, plural, emptyState, icon, toast } = ctx.ui;
  await ctx.ui.loadCss(new URL('./goals.css', import.meta.url));
  const write = canWrite(ctx);
  const add = button({ label: 'Dodaj cel', variant: 'primary', icon: 'plus', disabled: !write, onClick: () => openGoal(ctx, { people, onSaved: load }) });
  setHeader(ctx, { title: 'Cele', actions: write ? [add] : [], width: 'wide' });
  const root = h('div', { class: 'go' });
  let filter = 'active', goals = [], people = [];

  async function load() {
    root.replaceChildren(h('div', { class: 'go-skel', 'aria-busy': 'true', 'aria-label': 'Ładowanie' }, h('i'), h('i'), h('i')));
    try {
      [goals, people] = await Promise.all([ctx.store.goals.list(), ctx.store.people.list().catch(() => [])]);
      paint();
    } catch (err) {
      console.error('[goals]', err);
      const noTable = err && err.code === 'no_table';
      root.replaceChildren(h('div', { class: 'state', role: 'alert' },
        h('div', { class: 'glyph' }, icon(noTable ? 'construction' : 'alert', 20)),
        h('h2', null, noTable ? 'Ten moduł czeka na migrację bazy' : 'Nie udało się wczytać celów'),
        h('p', null, err.message || 'Spróbuj ponownie.'),
        noTable ? null : h('div', { class: 'actions' }, button({ label: 'Spróbuj ponownie', variant: 'primary', onClick: load }))));
    }
  }

  async function setProgress(g, value, row) {
    try {
      const upd = await ctx.store.goals.update(g.id, { progress: value });
      Object.assign(g, upd);
      if (upd.status === 'done' || g.status === 'done') toast(upd.status === 'done' ? 'Cel zakończony. Gratulacje!' : 'Cel znów aktywny.', 'good');
      paint();
    } catch (err) { toast(err.message || 'Nie udało się zapisać postępu.', 'bad'); load(); }
  }

  function paint() {
    if (!goals.length) {
      root.replaceChildren(emptyState({
        icon: 'target', title: 'Nie masz jeszcze celów',
        text: 'Wyznacz cel firmy albo osoby, ustaw termin i aktualizuj postęp. Dzięki temu wszyscy widzą, co jest ważne.',
        action: write ? { label: 'Dodaj cel', icon: 'plus', onClick: () => add.click() } : null,
      }));
      return;
    }
    const pName = Object.fromEntries(people.map((p) => [p.id, p.full_name]));
    const act = goals.filter((g) => g.status !== 'done');
    const avg = act.length ? Math.round(act.reduce((s, g) => s + g.progress, 0) / act.length) : 0;
    const shown = goals.filter((g) => filter === 'all' || (filter === 'done' ? g.status === 'done' : g.status !== 'done'))
      .sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999') || String(b.created_at).localeCompare(String(a.created_at)));
    const seg = h('div', { class: 'segment', role: 'group', 'aria-label': 'Filtr celów' }, FILTERS.map(([k, l]) =>
      h('button', { type: 'button', 'aria-pressed': String(filter === k), on: { click: () => { filter = k; paint(); } } }, l)));
    const ul = h('ul', { class: 'go-list' }, shown.map((g) => {
      const overdue = g.status !== 'done' && g.due_date && g.due_date < todayIso();
      const range = h('input', { type: 'range', class: 'go-range', min: '0', max: '100', step: '5', value: String(g.progress), disabled: !write, 'aria-label': `Postęp celu: ${g.title}` });
      const pct = h('b', { class: 'go-pct' }, `${g.progress}%`);
      range.style.setProperty('--p', `${g.progress}%`);
      range.addEventListener('input', () => { pct.textContent = `${range.value}%`; range.style.setProperty('--p', `${range.value}%`); });
      range.addEventListener('change', () => setProgress(g, Number(range.value)));
      const edit = write ? h('button', { type: 'button', class: 'go-edit', 'aria-label': `Edytuj cel: ${g.title}`, title: 'Edytuj', on: { click: () => openGoal(ctx, { goal: g, people, onSaved: load }) } }, icon('edit', 16)) : null;
      return h('li', { class: `go-row${g.status === 'done' ? ' is-done' : ''}` },
        h('div', { class: 'go-main' },
          h('b', { class: 'go-t' }, g.title),
          h('small', { class: 'muted' }, g.person_id ? (pName[g.person_id] || 'Osoba') : 'Cała firma', g.description ? ` · ${g.description}` : '')),
        h('div', { class: 'go-due' }, g.status === 'done' ? tag('Zakończony', 'good') : g.due_date ? tag(`${overdue ? 'Po terminie · ' : 'Do '}${formatDate(g.due_date)}`, overdue ? 'warn' : 'neutral') : h('small', { class: 'muted' }, 'Bez terminu')),
        h('div', { class: 'go-prog' }, range, pct),
        edit);
    }));
    root.replaceChildren(
      h('div', { class: 'go-bar' },
        h('p', { class: 'muted go-sum' }, `Aktywne: ${act.length} · średni postęp ${avg}%`), seg),
      shown.length ? h('div', { class: 'card go-card' }, ul)
        : h('p', { class: 'muted go-none' }, filter === 'done' ? 'Żaden cel nie jest jeszcze zakończony.' : 'Nie ma tu żadnych aktywnych celów.'));
    void plural;
  }
  await load();
  return root;
}

export function openGoal(ctx, { goal = null, people = [], onSaved } = {}) {
  const { h, field, button, modal, formError, toast, confirm } = ctx.ui;
  const title = field({ label: 'Cel', name: 'title', required: true, value: goal ? goal.title : '', placeholder: 'np. Skrócić czas rekrutacji do 30 dni', autocomplete: 'off' });
  const desc = field({ label: 'Opis (opcjonalnie)', name: 'description', type: 'textarea', rows: 3, value: goal ? goal.description : '', hint: 'Po czym poznasz, że cel jest osiągnięty?' });
  const due = field({ label: 'Termin', name: 'due_date', type: 'date', value: goal ? goal.due_date || '' : '' });
  const owner = field({ label: 'Czyj to cel?', name: 'person_id', type: 'select', value: goal ? goal.person_id || '' : '',
    options: [{ value: '', label: 'Cała firma' }, ...people.map((p) => ({ value: p.id, label: p.full_name }))] });
  const errorSlot = h('div');
  const submit = button({ label: goal ? 'Zapisz' : 'Dodaj cel', variant: 'primary', type: 'submit' });
  submit.setAttribute('form', 'go-form');
  const cancel = button({ label: 'Anuluj', variant: 'secondary' });
  const del = goal ? button({ label: 'Usuń', variant: 'ghost', icon: 'trash', onClick: async () => {
    if (!(await confirm({ title: 'Usunąć cel?', text: `„${goal.title}” zniknie z listy. Tej operacji nie można cofnąć.`, confirmLabel: 'Usuń', danger: true }))) return;
    try { await ctx.store.goals.remove(goal.id); m.close(); toast('Cel usunięty.', 'good'); if (onSaved) onSaved(); } catch (err) { toast(err.message || 'Nie udało się usunąć.', 'bad'); }
  } }) : null;
  const form = h('form', { id: 'go-form', novalidate: true }, errorSlot, title, desc, h('div', { class: 'form-row' }, due, owner));
  const m = modal({ title: goal ? 'Edytuj cel' : 'Nowy cel', body: form, actions: [del, cancel, submit].filter(Boolean) });
  cancel.addEventListener('click', () => m.close());
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); errorSlot.replaceChildren(); title.setError('');
    if (title.value.trim().length < 2) { title.setError('Wpisz nazwę celu.'); title.input.focus(); return; }
    submit.setBusy(true);
    try {
      const data = { title: title.value.trim(), description: desc.value.trim(), due_date: due.value || null, person_id: owner.input.value || null };
      if (goal) await ctx.store.goals.update(goal.id, data); else await ctx.store.goals.create(data);
      m.close(); toast(goal ? 'Zapisano zmiany.' : 'Dodano cel.', 'good'); if (onSaved) onSaved();
    } catch (err) { errorSlot.replaceChildren(formError(err.message || 'Nie udało się zapisać.')); } finally { submit.setBusy(false); }
  });
}
