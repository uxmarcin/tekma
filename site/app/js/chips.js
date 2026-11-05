/**
 * chips.js — edytor listy jako „chipy” (np. etapy kanbanu).
 *   const f = chipsField({ label, items, defaults?, min?, max?, hint?, placeholder?, name? })
 *   f.items()        -> string[] (w kolejności)
 *   f.value          -> items().join('\n')
 *   f.setError(msg)  f.input -> pole dodawania (do focusu)
 * Obsługa: Enter / przecinek dodaje, klik w chip edytuje nazwę (Enter zapisuje, Esc anuluje),
 * × usuwa, przeciągnięcie zmienia kolejność, a z klawiatury Alt+←/→ przesuwa wybrany chip.
 */
import { h, icon } from './ui.js';

let seq = 0;
const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ');

export function chipsField({ label, items = [], defaults = null, min = 0, max = 99, hint = '', placeholder = 'Dodaj i naciśnij Enter', name = 'chips', maxLen = 60 } = {}) {
  const id = `chips-${name}-${++seq}`;
  let list = items.map(norm).filter(Boolean);
  let editing = -1, dragFrom = -1;

  const errEl = h('div', { class: 'error', id: `${id}-err`, role: 'alert' });
  const live = h('div', { class: 'sr-only', 'aria-live': 'polite' });
  const add = h('input', { type: 'text', id, class: 'chip-add', placeholder, maxlength: String(maxLen), autocomplete: 'off', spellcheck: 'false', 'aria-describedby': hint ? `${id}-hint` : null });
  const box = h('div', { class: 'chips-box', role: 'list' });
  const el = h('div', { class: 'field chips-field' },
    label ? h('label', { for: id }, label) : null, box,
    hint ? h('div', { class: 'hint', id: `${id}-hint` }, hint) : null, errEl, live);

  const dup = (v, except = -1) => list.some((x, i) => i !== except && x.toLowerCase() === v.toLowerCase());
  function say(msg) { live.textContent = ''; setTimeout(() => { live.textContent = msg; }, 20); }
  function err(msg) { el.setError(msg); }

  function commit(v) {
    v = norm(v);
    if (!v) return false;
    if (list.length >= max) { err(`Maksymalnie ${max} pozycji.`); return false; }
    if (dup(v)) { err(`„${v}” już jest na liście.`); return false; }
    list.push(v); el.setError(''); paint(); say(`Dodano: ${v}`); return true;
  }
  function move(i, to) {
    if (to < 0 || to >= list.length || i === to) return;
    const [x] = list.splice(i, 1); list.splice(to, 0, x); paint(i === dragFrom ? -1 : to); say(`${x}: pozycja ${to + 1} z ${list.length}`);
  }
  function remove(i) { const [x] = list.splice(i, 1); el.setError(''); paint(); add.focus(); say(`Usunięto: ${x}`); }

  function chip(text, i) {
    if (editing === i) {
      const inp = h('input', { type: 'text', class: 'chip-edit', value: text, maxlength: String(maxLen), 'aria-label': `Edytuj pozycję ${i + 1}` });
      const done = (save) => {
        if (editing !== i) return; editing = -1;
        const v = norm(inp.value);
        if (save && v && v !== text) { if (dup(v, i)) err(`„${v}” już jest na liście.`); else { list[i] = v; el.setError(''); } }
        paint(i);
      };
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); done(true); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); } });
      inp.addEventListener('blur', () => done(true));
      setTimeout(() => { inp.focus(); inp.select(); }, 0);
      return h('span', { class: 'chip is-editing', role: 'listitem' }, h('i', { class: 'chip-n', 'aria-hidden': 'true' }, String(i + 1)), inp);
    }
    const lab = h('button', { type: 'button', class: 'chip-l', title: 'Kliknij, aby zmienić nazwę. Alt + strzałki zmieniają kolejność.', 'data-i': String(i),
      'aria-label': `${text}, pozycja ${i + 1} z ${list.length}. Enter zmienia nazwę, Alt i strzałki zmieniają kolejność, Delete usuwa.` }, text);
    lab.addEventListener('click', () => { editing = i; paint(); });
    lab.addEventListener('keydown', (e) => {
      if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowUp')) { e.preventDefault(); move(i, i - 1); }
      else if (e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowDown')) { e.preventDefault(); move(i, i + 1); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(i); }
    });
    const x = h('button', { type: 'button', class: 'chip-x', 'aria-label': `Usuń: ${text}`, title: 'Usuń', on: { click: () => remove(i) } }, icon('x', 12));
    const c = h('span', { class: 'chip', role: 'listitem', draggable: 'true' }, h('i', { class: 'chip-n', 'aria-hidden': 'true' }, String(i + 1)), lab, x);
    c.addEventListener('dragstart', (e) => { dragFrom = i; c.classList.add('is-drag'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', text); } catch { /* */ } });
    c.addEventListener('dragend', () => { dragFrom = -1; paint(); });
    c.addEventListener('dragover', (e) => { if (dragFrom < 0) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; c.classList.toggle('is-over', i !== dragFrom); });
    c.addEventListener('dragleave', () => c.classList.remove('is-over'));
    c.addEventListener('drop', (e) => { e.preventDefault(); const from = dragFrom; dragFrom = -1; if (from >= 0) move(from, i); else paint(); });
    return c;
  }

  function paint(focusIdx = -2) {
    box.replaceChildren(...list.map(chip), add);
    if (focusIdx >= 0 && editing < 0) { const b = box.querySelector(`.chip-l[data-i="${focusIdx}"]`); if (b) b.focus(); }
  }

  add.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); if (commit(add.value)) { add.value = ''; add.focus(); } }
    else if (e.key === 'Backspace' && !add.value && list.length) { e.preventDefault(); const last = list.length - 1; editing = last; paint(); }
  });
  add.addEventListener('paste', (e) => {
    const t = (e.clipboardData && e.clipboardData.getData('text')) || '';
    if (!/[\n,;]/.test(t)) return;
    e.preventDefault(); t.split(/[\n,;]+/).forEach((p) => commit(p)); add.value = ''; add.focus();
  });
  add.addEventListener('blur', () => { if (add.value.trim() && commit(add.value)) add.value = ''; });
  box.addEventListener('click', (e) => { if (e.target === box) add.focus(); });

  if (defaults) {
    const reset = h('button', { type: 'button', class: 'chips-reset', on: { click: () => { list = defaults.map(norm); editing = -1; el.setError(''); paint(); say('Przywrócono domyślne'); } } }, 'Przywróć domyślne');
    const lab = el.querySelector('label');
    const head = h('div', { class: 'chips-lab' });
    lab.replaceWith(head); head.append(lab, reset);
  }

  el.setError = (msg) => { errEl.textContent = msg || ''; el.classList.toggle('has-error', Boolean(msg)); };
  el.items = () => [...list];
  el.setItems = (arr) => { list = arr.map(norm).filter(Boolean); editing = -1; el.setError(''); paint(); };
  el.input = add;
  Object.defineProperty(el, 'value', { get: () => list.join('\n') });
  el.min = min;
  paint();
  return el;
}
