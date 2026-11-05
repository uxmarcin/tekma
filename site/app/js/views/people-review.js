/**
 * views/people-review.js — „Ocena po 90 dniach” na karcie osoby: oceny 30/60/90 (1–5), keeper test i dowody z rekrutacji.
 *   reviewSection(ctx, person, { write }) -> HTMLElement   (async ładowanie wewnątrz; brak migracji 2.1 = czytelny komunikat)
 * Dowody z rekrutacji = średnia z kart oceny kandydata, na którego zatrudniono osobę. Decyzje podejmuje człowiek.
 */
import { PHASES, dayOf } from '../plan.js';

const KEEPER = {
  yes: ['Tak, walczyłbym o tę osobę', 'good', 'Zadbaj, żeby nie musiała prosić: sprawdź wynagrodzenie na tle rynku, premię lub dodatek ważny dla niej.'],
  unsure: ['Nie jestem pewien', 'warn', 'Umówcie rozmowę: czego brakuje, co ułatwiłoby pracę? Ustal konkretne cele na kolejne 30 dni.'],
  no: ['Nie', 'bad', 'Porozmawiaj otwarcie i szybko. Ustal plan poprawy z terminem albo rozstanie się w uczciwy sposób.'],
};

export function reviewSection(ctx, person, { write } = {}) {
  const { h, button, tag, field, modal, toast, formError, emptyState } = ctx.ui;
  const box = h('section', { class: 'card pe-rev', 'aria-labelledby': 'pe-rev-h' });

  async function paint() {
    let rows, ev = null;
    try { rows = await ctx.store.reviews.list(person.id); ev = await ctx.store.reviews.evidence(person); }
    catch (err) {
      box.replaceChildren(h('h2', { id: 'pe-rev-h', class: 'pe-h' }, 'Ocena po 90 dniach'),
        emptyState({ icon: 'clock', title: err.code === 'no_table' ? 'Ten moduł czeka na migrację' : 'Nie udało się wczytać ocen', text: err.code === 'no_table' ? 'Uruchom migrację 2.1 (person-reviews) w Supabase.' : (err.message || '') }));
      return;
    }
    const day = dayOf(person.start_date);
    const by = Object.fromEntries(rows.map((r) => [r.phase, r]));
    const cells = PHASES.map((ph) => {
      const r = by[ph.phase];
      const due = day >= ph.phase - 2;
      return h('div', { class: `pe-rv${r ? ' done' : ''}` },
        h('small', { class: 'muted' }, `Dzień ${ph.phase}`),
        r ? h('div', null, h('b', { class: 'pe-rate' }, `${r.rating}/5`), tag(KEEPER[r.keeper][0], KEEPER[r.keeper][1]), r.notes ? h('p', { class: 'muted' }, r.notes) : null)
          : h('p', { class: 'muted' }, due ? 'Czas na ocenę' : `Za ${Math.max(1, ph.phase - day)} dni`),
        write ? button({ label: r ? 'Zmień' : 'Oceń', size: 'sm', variant: r ? 'ghost' : (due ? 'primary' : 'secondary'), onClick: () => open(ph.phase, r) }) : null);
    });
    const last = [...rows].sort((a, b) => b.phase - a.phase)[0];
    box.replaceChildren(
      h('div', { class: 'pe-ph' }, h('h2', { id: 'pe-rev-h', class: 'pe-h' }, 'Ocena po 90 dniach'), h('small', { class: 'muted' }, `${rows.length}/3`)),
      h('p', { class: 'muted pe-goal' }, 'Czy rekrutacja trafiła? Porównaj to, co zobaczyliśmy na rozmowach, z tym, co dzieje się w pracy.'),
      ev ? h('div', { class: 'pe-ev' }, h('small', { class: 'muted' }, 'Dowody z rekrutacji'),
        h('b', null, `Średnia ${ev.avg.toFixed(1).replace('.', ',')}/5`), h('span', { class: 'muted' }, `z ${ev.count} ocen w ${ev.stages} ${ev.stages === 1 ? 'etapie' : 'etapach'}`),
        last ? h('span', { class: 'pe-ev-n' }, `Po ${last.phase} dniach: ${last.rating}/5`) : null)
        : h('p', { class: 'muted pe-goal' }, 'Powiąż osobę z zatrudnionym kandydatem, a pokażemy tu oceny z rozmów obok ocen z pracy.'),
      h('div', { class: 'pe-rvs' }, cells),
      last ? h('div', { class: `pe-rec ${KEEPER[last.keeper][1]}` }, h('b', null, 'Rekomendacja'), h('p', null, KEEPER[last.keeper][2])) : null);
  }

  function open(phase, existing) {
    const rate = field({ label: 'Ocena pracy (1–5)', name: 'rating', type: 'select', value: String(existing ? existing.rating : ''), options: [{ value: '', label: 'Wybierz…' }, ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n}` }))] });
    const keep = field({ label: 'Czy walczyłbyś o zatrzymanie tej osoby?', name: 'keeper', type: 'select', value: existing ? existing.keeper : '', options: [{ value: '', label: 'Wybierz…' }, ...Object.entries(KEEPER).map(([v, a]) => ({ value: v, label: a[0] }))] });
    const notes = field({ label: 'Notatka (opcjonalnie)', name: 'notes', type: 'textarea', rows: 4, value: existing ? existing.notes : '', hint: 'Fakty i przykłady, nie cechy osobowości.' });
    const err = h('div');
    const form = h('form', { id: 'rv-form', novalidate: true }, err, rate, keep, notes);
    const save = button({ label: 'Zapisz ocenę', variant: 'primary', type: 'submit' }); save.setAttribute('form', 'rv-form');
    const m = modal({ title: `Ocena po ${phase} dniach`, body: form, actions: [button({ label: 'Anuluj', variant: 'ghost', onClick: () => m.close() }), save] });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try { await ctx.store.reviews.save({ person_id: person.id, phase, rating: rate.value, keeper: keep.value, notes: notes.value }); m.close(); toast('Ocena zapisana.', 'good'); paint(); }
      catch (ex) { err.replaceChildren(formError(ex.message || 'Nie udało się zapisać oceny.')); }
    });
  }

  paint();
  return box;
}
