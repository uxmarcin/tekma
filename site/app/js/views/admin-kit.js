/**
 * views/admin-kit.js — wspólne drobiazgi widoków agenta E (Ustawienia, RODO i AI Act, Rekruterzy, Profil rekrutera).
 * Odwzorowanie komponentów z Figmy (Button Md 36 / Sm 28, Badge, Toggle 34×20, Panel z nagłówkiem 48 px,
 * nagłówek strony 30 px) na vanilla DOM z ui.h. Style: admin-kit.css (klasy `e-*`). Ikony spoza ui.js dopisane lokalnie.
 *
 *   kbtn({label, variant:'primary'|'secondary'|'ghost', size:'md'|'sm', icon, onClick, disabled, title, attrs})
 *   kicon(name, size=16)           — ikony lokalne (globe, plug, link, card, upload, shield, lock, sparkle, bell, check-sm, chevron-down)
 *                                    lub z ui.js (search, mail, calendar, more, chevron, check, x, …)
 *   badge(text, tone:'neutral'|'good'|'info'|'warn'|'bad'|'accent', attrs?)
 *   toggle({checked, disabled, onChange, label, lockedNote})   -> button[role=switch].e-toggle; el.set(bool)
 *   panel({title, aside, body, class})                          -> .e-panel (nagłówek 48 px + treść)
 *   pageHead({title, lead, actions})                            -> .e-head (h1 30 px + lead + akcje po prawej)
 *   dropdown({value, options, onChange, label})                 -> select.e-dd (wygląd „Dropdown” z Figmy)
 *   loadKitCss()                                                -> Promise
 */

import ui from '../ui.js';

const { h, icon } = ui;
const SVG_NS = 'http://www.w3.org/2000/svg';

const LOCAL_ICONS = {
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.6 3.8 5.4 3.8 8.5s-1.2 5.9-3.8 8.5M12 3.5C9.4 6.1 8.2 8.9 8.2 12s1.2 5.9 3.8 8.5"/>',
  plug: '<path d="M9 3v5M15 3v5M6.5 8h11v3.5a5.5 5.5 0 0 1-11 0zM12 17v4"/>',
  link: '<path d="M10 14a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1M14 10a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1"/>',
  card: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h4"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  shield: '<path d="M12 3.5l7.5 3v5.5c0 4.3-3.1 7.4-7.5 8.5-4.4-1.1-7.5-4.2-7.5-8.5V6.5z"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  sparkle: '<path d="M12 3l2.2 6.3L20.5 12l-6.3 2.7L12 21l-2.2-6.3L3.5 12l6.3-2.7z"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"/>',
  'chevron-down': '<path d="M6 9l6 6 6-6"/>',
  'check-sm': '<path d="M5 12.5l4.5 4.5L19 7"/>',
  'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8z"/>',
};

export function kicon(name, size = 16) {
  if (!LOCAL_ICONS[name]) return icon(name, size);
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('ico', `ico-${name}`);
  svg.innerHTML = LOCAL_ICONS[name];
  return svg;
}

export function kbtn({ label, variant = 'secondary', size = 'md', icon: iconName, onClick, disabled = false, type = 'button', title, attrs = {} } = {}) {
  const el = h('button', { class: `e-btn e-btn-${variant}${size === 'sm' ? ' e-btn-sm' : ''}`, type, disabled, title, 'aria-label': !label ? title : null, ...attrs },
    iconName ? kicon(iconName, size === 'sm' ? 14 : 16) : null,
    label ? h('span', null, label) : null);
  if (onClick) el.addEventListener('click', onClick);
  el.setBusy = (busy) => { el.classList.toggle('is-busy', Boolean(busy)); el.disabled = Boolean(busy) || disabled; };
  return el;
}

export function badge(text, tone = 'neutral', attrs = {}) {
  return h('span', { class: `e-badge ${tone}`, ...attrs }, text);
}

export function toggle({ checked = false, disabled = false, onChange, label, lockedNote } = {}) {
  const el = h('button', {
    type: 'button', class: 'e-toggle', role: 'switch',
    'aria-checked': checked ? 'true' : 'false',
    'aria-disabled': disabled ? 'true' : null,
    'aria-label': label || null,
    title: disabled && lockedNote ? lockedNote : null,
  }, h('i', { 'aria-hidden': 'true' }));
  el.set = (v) => el.setAttribute('aria-checked', v ? 'true' : 'false');
  el.addEventListener('click', () => {
    if (disabled) { if (lockedNote) ui.toast(lockedNote, 'neutral'); return; }
    const next = el.getAttribute('aria-checked') !== 'true';
    el.set(next);
    if (onChange) onChange(next);
  });
  return el;
}

export function panel({ title, aside, body, class: cls, id } = {}) {
  const head = title !== undefined ? h('div', { class: 'e-panel-h' },
    h('h2', { class: 'e-panel-t', id: id ? `${id}-t` : null }, title),
    aside ? h('div', { class: 'e-panel-a' }, aside) : null) : null;
  return h('section', { class: `e-panel${cls ? ' ' + cls : ''}`, 'aria-labelledby': id ? `${id}-t` : null }, head, body);
}

export function pageHead({ title, lead, actions = [] } = {}) {
  return h('div', { class: 'e-head' },
    h('div', { class: 'e-head-t' }, h('h1', null, title), lead ? h('p', null, lead) : null),
    actions.length ? h('div', { class: 'e-head-a' }, actions) : null);
}

export function dropdown({ value, options, onChange, label, class: cls } = {}) {
  const sel = h('select', { class: `e-dd${cls ? ' ' + cls : ''}`, 'aria-label': label || null },
    options.map((o) => { const opt = typeof o === 'string' ? { value: o, label: o } : o; return h('option', { value: opt.value, selected: String(opt.value) === String(value) }, opt.label); }));
  if (onChange) sel.addEventListener('change', () => onChange(sel.value));
  const wrap = h('span', { class: 'e-dd-wrap' }, sel, kicon('chevron-down', 16));
  wrap.select = sel;
  return wrap;
}

export function loadKitCss() {
  return ui.loadCss(new URL('./admin-kit.css', import.meta.url));
}

/** „teraz”, „wczoraj”, „2 godz. temu”, „3 dni temu” — jak w Figmie. */
export function ago(iso) {
  if (!iso) return '';
  const d = new Date(iso); const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60000);
  if (min < 2) return 'teraz';
  if (min < 60) return `${min} min temu`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs} godz. temu`;
  const start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((start(new Date()) - start(d)) / 86400000);
  if (days === 0) return 'dziś';
  if (days === 1) return 'wczoraj';
  if (days < 30) return `${days} dni temu`;
  return ui.formatDate(iso);
}

export default { kbtn, kicon, badge, toggle, panel, pageHead, dropdown, loadKitCss, ago };
