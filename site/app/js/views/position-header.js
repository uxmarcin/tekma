/**
 * views/position-header.js — wspólna głowa ekranów stanowiska (lejek, raport): okruszki, tytuł, meta, akcje, zakładki.
 *   positionHeader(ctx, position, { active, actions, candidates }) -> HTMLElement  (Figma 10:435 / 24:2629 — Breadcrumbs+Header+Tabs)
 *   openPositionSettings(ctx, position, { onSaved })               -> {close}     zakładka „Ustawienia” (edycja stanowiska)
 *   plural / shortDate                                               drobne pomocniki współdzielone z lejkiem i raportem
 * Zakładki: Lejek → #/positions/:id, Rubryka → #/rubrics/:id, Raport → #/positions/:id/report, Ogłoszenie → …/ad, Zespół → …/team.
 */

import { DEFAULT_STAGES } from '../seed.js';

const CSS = new URL('./position-header.css', import.meta.url);

export function positionHeader(ctx, position, { active = 'pipeline', actions = [], candidates = [] } = {}) {
  const { h, tag } = ctx.ui;
  ctx.ui.loadCss(CSS);
  const id = encodeURIComponent(position.id);
  const tabs = [
    { key: 'pipeline', label: 'Lejek', href: `#/positions/${id}` },
    { key: 'rubric', label: 'Rubryka', href: position.rubric_id ? `#/rubrics/${encodeURIComponent(position.rubric_id)}` : '#/rubrics' },
    { key: 'report', label: 'Raport', href: `#/positions/${id}/report` },
    { key: 'ad', label: 'Ogłoszenie', href: `#/positions/${id}/ad` },
    { key: 'team', label: 'Zespół', href: `#/positions/${id}/team` },
    { key: 'settings', label: 'Ustawienia' },
  ];
  const all = candidates.filter((c) => c.position_id === position.id);
  const n = all.length;
  const owner = ctx.user && (ctx.user.name || ctx.user.email);
  const metaParts = [position.department, position.location, plural(n, 'kandydat', 'kandydatów', 'kandydatów')].filter(Boolean);
  if (owner && active === 'pipeline') metaParts.push(`${/a$/i.test(owner.split(' ')[0]) ? 'właścicielka' : 'właściciel'}: ${owner}`);

  const el = h('header', { class: 'ph' },
    h('nav', { class: 'ph-crumbs', 'aria-label': 'Okruszki' },
      h('a', { href: '#/positions' }, 'Stanowiska'), h('span', { class: 'sep', 'aria-hidden': 'true' }, '/'), h('span', { class: 'cur', 'aria-current': 'page' }, position.title)),
    h('div', { class: 'ph-head' },
      h('div', { class: 'ph-title' },
        h('h1', null, position.title),
        h('div', { class: 'ph-meta' }, tag(position.status === 'closed' ? 'Zamknięte' : 'Otwarte', 'neutral'), h('span', null, metaParts.join(' · '))),
      ),
      actions.length ? h('div', { class: 'ph-actions' }, actions) : null,
    ),
    h('div', { class: 'ph-tabs', role: 'tablist', 'aria-label': 'Sekcje stanowiska' },
      tabs.map((t) => t.href
        ? h('a', { href: t.href, role: 'tab', 'aria-selected': String(t.key === active), class: t.key === active ? 'is-on' : null }, t.label)
        : h('button', { type: 'button', role: 'tab', 'aria-selected': 'false', on: { click: () => openPositionSettings(ctx, position, { onSaved: () => ctx.navigate(location.hash) }) } }, t.label)),
    ),
  );
  return el;
}

/* ================================================================== Ustawienia stanowiska */
export function openPositionSettings(ctx, position, { onSaved } = {}) {
  const { h, field, button, modal, toast, formError } = ctx.ui;
  const errorSlot = h('div');
  const fTitle = field({ label: 'Nazwa stanowiska', name: 'title', value: position.title, required: true });
  const fDept = field({ label: 'Dział', name: 'department', value: position.department || '' });
  const fLoc = field({ label: 'Lokalizacja', name: 'location', value: position.location || '' });
  const fStatus = field({ label: 'Status', name: 'status', type: 'select', value: position.status || 'open', options: [{ value: 'open', label: 'Otwarte' }, { value: 'closed', label: 'Zamknięte' }] });
  const fStages = field({ label: 'Etapy lejka', name: 'stages', type: 'textarea', rows: 5, value: (position.stages || DEFAULT_STAGES).join('\n'), hint: 'Jeden etap w wierszu. Kandydaci zostają na swoich etapach — zmieniaj nazwy ostrożnie.' });
  const fRubric = field({ label: 'Rubryka', name: 'rubric', type: 'select', value: position.rubric_id || '', options: [{ value: '', label: 'Brak rubryki' }] });
  ctx.store.rubrics.list().then((rs) => { for (const r of rs) fRubric.input.appendChild(h('option', { value: r.id, selected: r.id === position.rubric_id }, `${r.name} (v${r.version || 1})`)); }).catch(() => {});
  const submit = button({ label: 'Zapisz zmiany', variant: 'primary', type: 'submit' });
  const cancel = button({ label: 'Anuluj', variant: 'ghost' });
  const form = h('form', { novalidate: true, on: { submit: async (e) => {
    e.preventDefault(); errorSlot.replaceChildren();
    const stages = fStages.value.split('\n').map((s) => s.trim()).filter(Boolean);
    if (fTitle.value.trim().length < 2) { fTitle.setError('Podaj nazwę stanowiska.'); fTitle.input.focus(); return; }
    if (stages.length < 2) { fStages.setError('Lejek musi mieć co najmniej 2 etapy.'); fStages.input.focus(); return; }
    submit.setBusy(true);
    try {
      await ctx.store.positions.update(position.id, { title: fTitle.value.trim(), department: fDept.value.trim(), location: fLoc.value.trim(), status: fStatus.value, stages, rubric_id: fRubric.value || null });
      toast('Zapisano ustawienia stanowiska.', 'good');
      m.close();
      if (onSaved) await onSaved();
    } catch (err) { errorSlot.replaceChildren(formError(err.message || 'Nie udało się zapisać.')); submit.setBusy(false); }
  } } }, errorSlot, fTitle, h('div', { class: 'form-row' }, fDept, fLoc), h('div', { class: 'form-row' }, fStatus, fRubric), fStages);
  submit.addEventListener('click', () => form.requestSubmit());
  const m = modal({ title: 'Ustawienia stanowiska', body: form, actions: [cancel, submit] });
  m.el.classList.add('dm-modal');
  cancel.addEventListener('click', () => m.close());
  return m;
}

/* ================================================================== pomocniki */
export function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (n === 1) return `${n} ${one}`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}
const MONTHS = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
/** „12 paź” — jak w Figmie. */
export function shortDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
/** „5 dni” / „dziś” — wiek zgłoszenia na karcie. */
export function daysAgoLabel(iso) {
  if (!iso) return '';
  const diff = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 864e5));
  if (diff === 0) return 'dziś';
  if (diff === 1) return '1 dzień';
  return `${diff} dni`;
}
