/**
 * views/ad.js — edytor ogłoszenia stanowiska: widełki wynagrodzenia, treść i sprawdzanie zgodności na żywo.
 *   openAdEditor(ctx, position, { onSaved(updatedPosition) }) -> {close}
 * Reguły w ad-check.js (jawność wynagrodzeń, język neutralny, brak pytań o zarobki). Publikacja zawsze po stronie człowieka.
 * Widełki wymagają migracji 2.0 (positions.salary_*); bez niej zapisujemy treść i pokazujemy komunikat.
 */
import { adCheck } from '../ad-check.js';

export async function openAdEditor(ctx, position, { onSaved } = {}) {
  const { h, field, button, modal, icon, toast, formError, loadCss } = ctx.ui;
  await loadCss(new URL('./ad.css', import.meta.url));
  const lo = field({ label: 'Od (brutto / mies.)', name: 'salary_min', type: 'number', inputmode: 'numeric', min: 1, value: position.salary_min ?? '', placeholder: '22000' });
  const hi = field({ label: 'Do (brutto / mies.)', name: 'salary_max', type: 'number', inputmode: 'numeric', min: 1, value: position.salary_max ?? '', placeholder: '30000' });
  const cur = field({ label: 'Waluta', name: 'salary_currency', type: 'select', options: ['PLN', 'EUR', 'USD'], value: position.salary_currency || 'PLN' });
  const text = field({ label: 'Treść ogłoszenia', name: 'description', type: 'textarea', rows: 9, value: position.description || '', hint: 'Opisz rolę, zespół i etapy rekrutacji. Nie pytaj o dotychczasowe zarobki.' });
  const errorSlot = h('div');
  const panel = h('div', { class: 'ad-panel', role: 'region', 'aria-label': 'Sprawdzenie zgodności', 'aria-live': 'polite' });

  const num = (v) => { const n = Math.round(Number(String(v).replace(/\s/g, '').replace(',', '.'))); return v === '' || !Number.isFinite(n) ? null : n; };
  const draft = () => ({ ...position, salary_min: num(lo.value), salary_max: num(hi.value), salary_currency: cur.value, description: text.value });

  function paint() {
    const r = adCheck(draft());
    const rows = r.checks.map((c) => h('li', { class: `ad-c ${c.ok ? 'ok' : 'no'}` },
      h('span', { class: 'ad-ic', 'aria-hidden': 'true' }, icon(c.ok ? 'check' : 'alert', 14)),
      h('div', null, h('b', null, c.title), h('small', { class: 'muted' }, c.detail))));
    const iss = r.issues.length ? h('div', { class: 'ad-issues' },
      h('b', null, `${r.issues.length === 1 ? '1 sformułowanie' : r.issues.length + ' sformułowania'} do zmiany`),
      r.issues.map((i) => h('div', { class: 'ad-i' }, h('q', null, i.match), h('span', null, i.label), h('small', { class: 'muted' }, i.hint)))) : null;
    panel.replaceChildren(
      h('div', { class: `ad-sum ${r.ready ? 'ok' : 'warn'}` }, icon(r.ready ? 'check' : 'alert', 16), r.ready ? 'Ogłoszenie gotowe do publikacji' : 'Do poprawy przed publikacją'),
      h('ul', { class: 'ad-list' }, rows), iss,
      h('p', { class: 'muted ad-foot' }, 'To szybka kontrola słów kluczowych, nie porada prawna. Ostatnie słowo należy do Ciebie.'));
  }
  for (const f of [lo, hi, cur, text]) f.input.addEventListener('input', paint);

  const form = h('form', { id: 'ad-form', class: 'ad', novalidate: true },
    h('div', { class: 'ad-form' }, errorSlot, h('div', { class: 'ad-row' }, lo, hi, cur), text), panel);
  const submit = button({ label: 'Zapisz ogłoszenie', variant: 'primary', type: 'submit' });
  submit.setAttribute('form', 'ad-form');
  const cancel = button({ label: 'Anuluj', variant: 'secondary' });
  const m = modal({ title: `Ogłoszenie: ${position.title}`, body: form, actions: [cancel, submit], size: 'lg' });
  cancel.addEventListener('click', () => m.close());
  paint();
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); errorSlot.replaceChildren(); submit.setBusy(true);
    try {
      const d = draft();
      const row = await ctx.store.positions.update(position.id, { salary_min: d.salary_min, salary_max: d.salary_max, salary_currency: d.salary_currency, description: d.description });
      m.close();
      if (row && row._workSkipped) toast('Treść zapisana, ale widełki wymagają migracji bazy 2.0.', 'warn');
      else toast('Zapisano ogłoszenie.', 'good');
      if (onSaved) onSaved({ ...position, ...d });
    } catch (err) { errorSlot.replaceChildren(formError(err.message || 'Nie udało się zapisać.')); } finally { submit.setBusy(false); }
  });
  return m;
}
