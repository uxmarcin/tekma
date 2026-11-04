/**
 * ui.js — komponenty bazowe Tekmy (bez zależności).
 *
 * API (stabilne, wg kontraktu):
 *   h(tag, attrs, ...children)       -> HTMLElement
 *       attrs: class | className, id, on:{click,…} lub onClick/onInput…, aria-*, data-*, dataset:{},
 *              style (string|obiekt), html (innerHTML — tylko dla zaufanych treści), pozostałe = atrybuty
 *       children: string | Node | Array | null/false (pomijane)
 *   icon(name, size=16)              -> SVGElement (obrys 24×24, stroke 1.6, round)
 *   button({label, variant, size, icon, onClick, disabled, type, block, title, attrs}) -> HTMLButtonElement
 *       + el.setBusy(bool) — stan ładowania
 *   field({label, name, type, value, error, hint, required, autocomplete, placeholder, options, rows, min, max, step})
 *       -> HTMLElement .field; el.input, el.setError(msg), el.value
 *   avatar(name, size?)              -> span.av z inicjałami
 *   tag(text, tone)                  -> span.tag   (tone: neutral|good|warn|bad|info|blue)
 *   toast(message, tone)             -> usuwa się sam po ~4 s
 *   modal({title, body, actions, size, onClose}) -> {close, el}
 *   confirm({title, text, confirmLabel, cancelLabel, danger}) -> Promise<boolean>
 *   emptyState({title, text, action, icon}) -> HTMLElement
 *   loadCss(url)                     -> Promise (idempotentne)
 *   formatDate(iso, {relative})      -> "3 lis 2026" | "dziś", "wczoraj", "3 dni temu"
 *   fmtScore(n, digits=1)            -> "3,5" (przecinek dziesiętny)
 *   skeleton({lines, block})         -> element ładowania
 *   formError(message) / formSuccess(message) -> komunikat nad formularzem
 *   aiBadge(text='AI sugeruje')     -> etykieta sugestii AI (iskra, czerń/szarość — nigdy kolor)
 *   heroState({title, text, action}) -> centralny ekran startowy (nagłówek + jedno główne działanie)
 *   initials(name)                   -> "ML"
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/* ---------------------------------------------------------------- h() */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs && typeof attrs === 'object' && !(attrs instanceof Node) && !Array.isArray(attrs)) {
    for (const [key, val] of Object.entries(attrs)) {
      if (val === null || val === undefined || val === false) continue;
      if (key === 'class' || key === 'className') el.className = val;
      else if (key === 'on' && typeof val === 'object') {
        for (const [evt, fn] of Object.entries(val)) if (fn) el.addEventListener(evt, fn);
      } else if (/^on[A-Z]/.test(key) && typeof val === 'function') el.addEventListener(key.slice(2).toLowerCase(), val);
      else if (key === 'dataset' && typeof val === 'object') Object.assign(el.dataset, val);
      else if (key === 'style') {
        if (typeof val === 'string') el.style.cssText = val; else Object.assign(el.style, val);
      } else if (key === 'html') el.innerHTML = val;
      else if (key === 'value' && 'value' in el) el.value = val;
      else if (key === 'checked' || key === 'disabled' || key === 'selected' || key === 'readOnly' || key === 'autofocus') {
        el[key] = Boolean(val); if (val) el.setAttribute(key.toLowerCase(), '');
      } else if (key === 'htmlFor') el.setAttribute('for', val);
      else el.setAttribute(key, val === true ? '' : String(val));
    }
  } else if (attrs !== undefined && attrs !== null) {
    children.unshift(attrs);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false || c === true) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

/* ---------------------------------------------------------------- icon() */
const ICONS = {
  dashboard: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.8"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.8"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12h18"/>',
  rubric: '<path d="M6 3h12a1.5 1.5 0 0 1 1.5 1.5v15A1.5 1.5 0 0 1 18 21H6a1.5 1.5 0 0 1-1.5-1.5v-15A1.5 1.5 0 0 1 6 3z"/><path d="M8.5 8.5l1.3 1.3 2.4-2.6M8.5 13.5l1.3 1.3 2.4-2.6M14.5 8h2M14.5 13h2"/>',
  users: '<circle cx="9.5" cy="8" r="3.4"/><path d="M3.5 20c.4-3.8 2.8-6 6-6s5.6 2.2 6 6M16 5.3a3.2 3.2 0 0 1 0 5.6M18 14.4c1.7.8 2.8 2.6 3 5.6"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  flag: '<path d="M5 21V4.5M5 4.5h12.5l-2.5 4 2.5 4H5"/>',
  spark: '<path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9zM19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  'arrow-left': '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  logout: '<path d="M10 4H6.5A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20H10M15 8l4 4-4 4M19 12H9.5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3.5 7.5l8.5 6 8.5-6"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12.3a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7M10 11v6M14 11v6"/>',
  edit: '<path d="M4 20h4.5L19 9.5a2.1 2.1 0 0 0-3-3L5.5 17 4 20zM13.5 8l3 3"/>',
  user: '<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5c.6-4.2 3.6-6.5 7.5-6.5s6.9 2.3 7.5 6.5"/>',
  building: '<rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M9 20.5v-4h6v4M8 8h2M14 8h2M8 12h2M14 12h2"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  'chevron-right': '<path d="M9 6l6 6-6 6"/>',
  alert: '<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.5v.3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5v.3"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  eye: '<path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off': '<path d="M4 4l16 16M10 5.8A9.9 9.9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3.2 3.9M6.6 6.6C4 8.5 2.5 12 2.5 12s3.5 6.5 9.5 6.5a9 9 0 0 0 3.3-.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  more: '<circle cx="5.5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="18.5" cy="12" r="1.2" fill="currentColor"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  construction: '<path d="M3 17.5h18M5 17.5V9a7 7 0 0 1 14 0v8.5M12 2v2M9 12h6"/>',
  inbox: '<path d="M3.5 13.5V17a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-3.5M3.5 13.5L6 5.5h12l2.5 8M3.5 13.5h5l1.2 2.2h4.6l1.2-2.2h5"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8z"/>',
  /* ikony z Figmy (pasek boczny, nagłówek, mobile) */
  home: '<path d="M4 10.5L12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z"/><path d="M9.5 20.5v-6h5v6"/>',
  list: '<path d="M8.5 6.5H20M8.5 12H20M8.5 17.5H20"/><path d="M4 6.5h.3M4 12h.3M4 17.5h.3"/>',
  shield: '<path d="M12 3.5l7 2.8v5.7c0 4.4-3 7.5-7 8.5-4-1-7-4.1-7-8.5V6.3z"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.6 3.9 5.4 3.9 8.5s-1.3 5.9-3.9 8.5c-2.6-2.6-3.9-5.4-3.9-8.5S9.4 6.1 12 3.5z"/>',
  'log-in': '<path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14M3.5 12h11M10.5 8l4 4-4 4"/>',
  'user-check': '<circle cx="10" cy="8.5" r="3.6"/><path d="M3.5 20c.5-3.9 3.1-6 6.5-6 1.2 0 2.3.3 3.2.8M15 17.5l2 2 4-4.5"/>',
  'user-badge': '<rect x="4" y="3.5" width="16" height="17" rx="2.5"/><circle cx="12" cy="10" r="2.6"/><path d="M7.5 17.5c.6-2.2 2.3-3.4 4.5-3.4s3.9 1.2 4.5 3.4"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  upload: '<path d="M12 15.5V4.5M7.5 9l4.5-4.5L16.5 9M4.5 15.5v3a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-3"/>',
  plug: '<path d="M9 3.5v4M15 3.5v4M6.5 7.5h11v3a5.5 5.5 0 0 1-11 0zM12 16v4.5"/>',
  'chevron-down': '<path d="M6 9l6 6 6-6"/>',
  'chevron-up': '<path d="M6 15l6-6 6 6"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  sparkle: '<path d="M12 3.5l1.6 4.9 4.9 1.6-4.9 1.6L12 16.5l-1.6-4.9L5.5 10l4.9-1.6z"/><path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
  google: '<path d="M21 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5.1a4.4 4.4 0 0 1-1.9 2.9v2.4h3c1.8-1.7 2.8-4.1 2.8-7z" fill="#4285F4" stroke="none"/><path d="M12 21.5c2.6 0 4.7-.8 6.3-2.3l-3-2.4c-.9.6-1.9.9-3.2.9-2.5 0-4.6-1.7-5.3-3.9H3.6v2.5A9.5 9.5 0 0 0 12 21.5z" fill="#34A853" stroke="none"/><path d="M6.7 13.8a5.7 5.7 0 0 1 0-3.6V7.7H3.6a9.5 9.5 0 0 0 0 8.6z" fill="#FBBC05" stroke="none"/><path d="M12 6.3c1.4 0 2.6.5 3.6 1.4l2.7-2.7A9.5 9.5 0 0 0 3.6 7.7l3.1 2.5c.7-2.2 2.8-3.9 5.3-3.9z" fill="#EA4335" stroke="none"/>',
  play: '<path d="M8 5.5v13l10-6.5z"/>',
};

export function icon(name, size = 16) {
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
  svg.innerHTML = ICONS[name] || ICONS.info;
  return svg;
}
export const iconNames = Object.keys(ICONS);

/* ---------------------------------------------------------------- button() */
export function button({ label, variant = 'secondary', size = 'md', icon: iconName, onClick, disabled = false, type = 'button', block = false, title, attrs = {} } = {}) {
  const classes = ['btn', `btn-${variant}`];
  if (size === 'sm') classes.push('btn-sm');
  if (size === 'lg') classes.push('btn-lg');
  if (block) classes.push('btn-block');
  if (!label && iconName) classes.push('btn-icon');
  const el = h('button', { class: classes.join(' '), type, disabled, title, 'aria-label': !label ? (title || iconName) : null, ...attrs },
    iconName ? icon(iconName) : null,
    label ? h('span', null, label) : null,
  );
  if (onClick) el.addEventListener('click', onClick);
  el.setBusy = (busy) => {
    el.classList.toggle('is-busy', Boolean(busy));
    el.disabled = Boolean(busy) || disabled;
    el.setAttribute('aria-busy', busy ? 'true' : 'false');
  };
  return el;
}

/* ---------------------------------------------------------------- field() */
let fieldSeq = 0;
export function field({ label, name, type = 'text', value = '', error = '', hint = '', required = false, autocomplete, placeholder, options, rows, min, max, step, inputmode, disabled = false, id } = {}) {
  const fid = id || `f-${name || 'x'}-${++fieldSeq}`;
  const hintId = hint ? `${fid}-hint` : null;
  const errId = `${fid}-err`;
  let input;
  if (type === 'select') {
    input = h('select', { id: fid, name, required, disabled },
      (options || []).map((o) => {
        const opt = typeof o === 'string' ? { value: o, label: o } : o;
        return h('option', { value: opt.value, selected: String(opt.value) === String(value) }, opt.label);
      }));
  } else if (type === 'textarea') {
    input = h('textarea', { id: fid, name, required, placeholder, rows: rows || 4, disabled, autocomplete });
    input.value = value;
  } else {
    input = h('input', { id: fid, name, type, required, placeholder, autocomplete, min, max, step, inputmode, disabled });
    input.value = value;
  }
  const describedBy = [hintId, errId].filter(Boolean).join(' ');
  if (describedBy) input.setAttribute('aria-describedby', describedBy);

  let inputWrap = input;
  if (type === 'password') {
    const reveal = h('button', { type: 'button', class: 'reveal', 'aria-label': 'Pokaż hasło', 'aria-pressed': 'false', tabindex: '-1' }, icon('eye'));
    reveal.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      reveal.setAttribute('aria-pressed', show ? 'true' : 'false');
      reveal.setAttribute('aria-label', show ? 'Ukryj hasło' : 'Pokaż hasło');
      reveal.replaceChildren(icon(show ? 'eye-off' : 'eye'));
      input.focus();
    });
    inputWrap = h('div', { class: 'input-wrap' }, input, reveal);
  }

  const errEl = h('div', { class: 'error', id: errId, role: 'alert' });
  const el = h('div', { class: 'field' },
    label ? h('label', { htmlFor: fid }, label, required ? h('span', { class: 'req', 'aria-hidden': 'true' }, '') : null) : null,
    inputWrap,
    hint ? h('div', { class: 'hint', id: hintId }, hint) : null,
    errEl,
  );
  el.input = input;
  el.setError = (msg) => {
    errEl.textContent = msg || '';
    el.classList.toggle('has-error', Boolean(msg));
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  };
  Object.defineProperty(el, 'value', { get: () => input.value, set: (v) => { input.value = v; } });
  if (error) el.setError(error);
  input.addEventListener('input', () => { if (el.classList.contains('has-error')) el.setError(''); });
  return el;
}

/* ---------------------------------------------------------------- avatar / tag */
export function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
export function avatar(name, size) {
  const el = h('span', { class: `av${size ? ' ' + size : ''}`, title: name || '', 'aria-hidden': 'true' }, initials(name));
  return el;
}
export function tag(text, tone = 'neutral') {
  return h('span', { class: `tag ${tone}` }, text);
}

/* ---------------------------------------------------------------- toast() */
let toastHost = null;
const TOAST_ICON = { good: 'check', warn: 'alert', bad: 'x', info: 'info', neutral: 'info' };
export function toast(message, tone = 'neutral', { duration = 4000 } = {}) {
  if (!toastHost) {
    toastHost = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'false' });
    document.body.appendChild(toastHost);
  }
  const el = h('div', { class: `toast ${tone}` }, icon(TOAST_ICON[tone] || 'info'), h('span', null, message));
  toastHost.appendChild(el);
  const remove = () => { el.classList.add('leaving'); setTimeout(() => el.remove(), 200); };
  const t = setTimeout(remove, duration);
  el.addEventListener('click', () => { clearTimeout(t); remove(); });
  return { close: remove };
}

/* ---------------------------------------------------------------- modal() */
export function modal({ title, body, actions = [], size, onClose, closeOnBackdrop = true } = {}) {
  const previouslyFocused = document.activeElement;
  const titleId = `m-title-${++fieldSeq}`;
  const closeBtn = h('button', { type: 'button', class: 'close', 'aria-label': 'Zamknij' }, icon('x'));
  const actionEls = actions.map((a) => (a instanceof Node ? a : button(a)));
  const box = h('div', { class: `modal${size ? ' ' + size : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
    h('div', { class: 'modal-h' }, h('h2', { id: titleId }, title || ''), closeBtn),
    h('div', { class: 'modal-b' }, body),
    actionEls.length ? h('div', { class: 'modal-f' }, actionEls) : null,
  );
  const backdrop = h('div', { class: 'modal-backdrop' }, box);
  let closed = false;
  const close = (result) => {
    if (closed) return; closed = true;
    document.removeEventListener('keydown', onKey, true);
    backdrop.remove();
    if (!document.querySelector('.modal-backdrop')) document.body.classList.remove('has-modal');
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus();
    if (onClose) onClose(result);
  };
  const focusables = () => Array.from(box.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'));
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') {
      const list = focusables(); if (!list.length) return;
      const first = list[0], last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  closeBtn.addEventListener('click', () => close());
  if (closeOnBackdrop) backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', onKey, true);
  document.body.classList.add('has-modal');
  document.body.appendChild(backdrop);
  requestAnimationFrame(() => {
    const list = focusables().filter((n) => n !== closeBtn);
    const first = box.querySelector('input,select,textarea') || list[0] || closeBtn;
    first.focus();
  });
  return { close, el: box };
}

export function confirm({ title = 'Na pewno?', text = '', confirmLabel = 'Potwierdź', cancelLabel = 'Anuluj', danger = false } = {}) {
  return new Promise((resolve) => {
    let result = false;
    const m = modal({
      title,
      body: text ? h('p', null, text) : null,
      onClose: () => resolve(result),
      actions: [
        button({ label: cancelLabel, variant: 'secondary', onClick: () => m.close() }),
        button({ label: confirmLabel, variant: danger ? 'danger' : 'primary', onClick: () => { result = true; m.close(); } }),
      ],
    });
  });
}

/* ---------------------------------------------------------------- stany */
export function emptyState({ title, text, action, icon: iconName = 'inbox' } = {}) {
  const actions = action ? (Array.isArray(action) ? action : [action]).map((a) => (a instanceof Node ? a : button({ variant: 'primary', ...a }))) : [];
  return h('div', { class: 'empty' },
    h('span', { class: 'glyph', 'aria-hidden': 'true' }, icon(iconName, 16)),
    title ? h('h3', null, title) : null,
    text ? h('p', null, text) : null,
    actions.length ? h('div', { class: 'actions' }, actions) : null,
  );
}
export function aiBadge(text = 'AI sugeruje') {
  return h('span', { class: 'ai-note' }, icon('spark', 12), text);
}
export function heroState({ title, text, action, secondary } = {}) {
  const actions = [action, secondary].filter(Boolean).map((a, i) => (a instanceof Node ? a : button({ variant: i === 0 ? 'primary' : 'secondary', ...a })));
  return h('div', { class: 'hero-state' },
    title ? h('h1', null, title) : null,
    text ? h('p', null, text) : null,
    actions.length ? h('div', { class: 'actions' }, actions) : null,
  );
}
export function formError(message) {
  return h('div', { class: 'form-error', role: 'alert' }, icon('alert'), h('span', null, message));
}
export function formSuccess(message) {
  return h('div', { class: 'form-success', role: 'status' }, icon('check'), h('span', null, message));
}
export function skeleton({ lines = 3, block = false } = {}) {
  const el = h('div', { class: 'skeleton', 'aria-busy': 'true', 'aria-label': 'Ładowanie' });
  if (block) { el.appendChild(h('i', { class: 'block' })); return el; }
  el.appendChild(h('i', { class: 'h' }));
  const widths = ['w80', 'w60', 'w40', 'w80', 'w60'];
  for (let i = 0; i < lines; i++) el.appendChild(h('i', { class: widths[i % widths.length] }));
  return el;
}

/* ---------------------------------------------------------------- loadCss() */
const loadedCss = new Map();
export function loadCss(url) {
  const href = String(url);
  if (loadedCss.has(href)) return loadedCss.get(href);
  const p = new Promise((resolve) => {
    const link = h('link', { rel: 'stylesheet', href });
    link.addEventListener('load', () => resolve(true));
    link.addEventListener('error', () => resolve(false));
    document.head.appendChild(link);
  });
  loadedCss.set(href, p);
  return p;
}

/* ---------------------------------------------------------------- formatowanie */
const MONTHS = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
export function formatDate(iso, { relative = false, time = false } = {}) {
  if (!iso) return '';
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  if (relative) {
    const now = new Date();
    const day = 24 * 3600 * 1000;
    const start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((start(now) - start(d)) / day);
    if (diff === 0) return 'dziś';
    if (diff === 1) return 'wczoraj';
    if (diff === -1) return 'jutro';
    if (diff > 1 && diff < 7) return `${diff} dni temu`;
    if (diff < -1 && diff > -7) return `za ${-diff} dni`;
  }
  let s = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  if (time) s += `, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return s;
}
export function fmtScore(n, digits = 1) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '–';
  return Number(n).toFixed(digits).replace('.', ',');
}
export function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (n === 1) return `${n} ${one}`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

export default { h, icon, iconNames, button, field, avatar, initials, tag, toast, modal, confirm, emptyState, heroState, aiBadge, formError, formSuccess, skeleton, loadCss, formatDate, fmtScore, plural };
