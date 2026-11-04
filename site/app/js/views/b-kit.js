/**
 * views/b-kit.js — wspólne drobiazgi widoków agenta B (Stanowiska, Nowe stanowisko, Rubryki, Biblioteka szablonów,
 * Stanowisko: Zespół / Ogłoszenie, Strona kariery, Portal kandydata).
 * Odwzorowanie komponentów z Figmy na vanilla DOM (ui.h): przycisk Md 36 / Lg 48, Badge, Toggle 34×20, Panel 48 px,
 * nagłówek strony 30 px z okruszkami, zakładki-pigułki, zakładki stanowiska (podkreślenie), karta roli z mini-lejkiem,
 * kroki kreatora, chip AI, awatar 26/28/32/36. Style: b-kit.css (klasy `b-*`). Ikony spoza ui.js dopisane lokalnie.
 *
 *   bicon(name, size=16)                      — ikona lokalna albo z ui.js
 *   bbtn({label, variant:'primary'|'secondary'|'ghost', size:'md'|'lg'|'sm', icon, onClick, disabled, href, title, attrs})
 *   badge(text, tone:'accent'|'neutral'|'good'|'warn'|'bad'|'info')
 *   toggle({checked, disabled, onChange, label}) -> button[role=switch]; el.set(bool), el.checked
 *   panel({title, aside, body, class})        -> .b-panel (nagłówek 48 px + treść); aside = tekst | element
 *   pageHead({crumbs:[{label,href}], title, sub, actions:[el]}) -> fragment: okruszki + nagłówek
 *   pillTabs({items:[{key,label,count}], active, onChange, label})
 *   positionTabs(position, activeKey, {rubricId})   -> zakładki Lejek/Rubryka/Raport/Ogłoszenie/Zespół/Ustawienia
 *   roleCard({title, sub, status, tone, funnel:[0..1], bottleneck, href, onClick, template})
 *   wizardSteps(active)                       -> kroki 1 Opis · 2 Etapy i rubryki · 3 Zespół · 4 Publikacja
 *   aiChip(text, {onClick})                   -> chip „AI” (iskra), zawsze oznaczony
 *   bavatar(name, size=32)                    -> okrągły awatar z inicjałami (12 px, medium)
 *   ago(iso)                                  -> „2 dni temu”, „wczoraj”, „3 tyg. temu”, „miesiąc temu”
 *   menu(trigger, items:[{label, onClick, danger, disabled}]) -> wysuwane menu „więcej”
 *   loadKitCss()                              -> Promise
 */

import ui from '../ui.js';

const { h, icon, initials } = ui;
const SVG_NS = 'http://www.w3.org/2000/svg';

const LOCAL_ICONS = {
  sparkle: '<path d="M12 3l2.2 6.3L20.5 12l-6.3 2.7L12 21l-2.2-6.3L3.5 12l6.3-2.7z"/>',
  'sparkle-fill': '<path fill="currentColor" stroke="none" d="M12 2.5l2.5 7L21.5 12l-7 2.5-2.5 7-2.5-7L2.5 12l7-2.5z"/>',
  grip: '<circle cx="9" cy="6" r="1.2" fill="currentColor"/><circle cx="15" cy="6" r="1.2" fill="currentColor"/><circle cx="9" cy="12" r="1.2" fill="currentColor"/><circle cx="15" cy="12" r="1.2" fill="currentColor"/><circle cx="9" cy="18" r="1.2" fill="currentColor"/><circle cx="15" cy="18" r="1.2" fill="currentColor"/>',
  'chevron-down': '<path d="M6 9l6 6 6-6"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r=".9" fill="currentColor"/><circle cx="4" cy="12" r=".9" fill="currentColor"/><circle cx="4" cy="18" r=".9" fill="currentColor"/>',
  shield: '<path d="M12 3.5l7.5 3v5.5c0 4.3-3.1 7.4-7.5 8.5-4.4-1.1-7.5-4.2-7.5-8.5V6.5z"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.6 3.8 5.4 3.8 8.5s-1.2 5.9-3.8 8.5M12 3.5C9.4 6.1 8.2 8.9 8.2 12s1.2 5.9 3.8 8.5"/>',
  'check-sm': '<path d="M5 12.5l4.5 4.5L19 7"/>',
  'calendar-plus': '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4M12 13v5M9.5 15.5h5"/>',
};

export function bicon(name, size = 16) {
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

/* ---------------------------------------------------------------- przycisk (Figma: Md 36, Lg 48, Sm 28) */
export function bbtn({ label, variant = 'secondary', size = 'md', icon: iconName, onClick, disabled = false, type = 'button', href, title, attrs = {} } = {}) {
  const cls = `b-btn b-btn-${variant}${size !== 'md' ? ' b-btn-' + size : ''}${!label && iconName ? ' b-btn-icon' : ''}`;
  const kids = [iconName ? bicon(iconName, size === 'sm' ? 14 : 16) : null, label ? h('span', null, label) : null];
  const el = href
    ? h('a', { class: cls, href, title, 'aria-label': !label ? title : null, 'aria-disabled': disabled ? 'true' : null, ...attrs }, ...kids)
    : h('button', { class: cls, type, disabled, title, 'aria-label': !label ? title : null, ...attrs }, ...kids);
  if (onClick) el.addEventListener('click', onClick);
  el.setBusy = (busy) => {
    el.classList.toggle('is-busy', Boolean(busy));
    if ('disabled' in el) el.disabled = Boolean(busy) || disabled;
    el.setAttribute('aria-busy', busy ? 'true' : 'false');
  };
  return el;
}

/* ---------------------------------------------------------------- badge (Figma: 12/16 medium, pad 2×8, r 6) */
export function badge(text, tone = 'neutral', attrs = {}) {
  return h('span', { class: `b-badge b-badge-${tone}`, ...attrs }, text);
}

/* ---------------------------------------------------------------- toggle 34×20 */
export function toggle({ checked = false, disabled = false, onChange, label } = {}) {
  const el = h('button', { type: 'button', role: 'switch', class: 'b-toggle', 'aria-checked': checked ? 'true' : 'false', 'aria-label': label || null, disabled, title: disabled ? 'Ustawienie zablokowane' : null }, h('i', { 'aria-hidden': 'true' }));
  el.checked = checked;
  el.set = (v) => { el.checked = Boolean(v); el.setAttribute('aria-checked', el.checked ? 'true' : 'false'); };
  el.addEventListener('click', () => {
    if (disabled) return;
    el.set(!el.checked);
    if (onChange) onChange(el.checked);
  });
  return el;
}

/* ---------------------------------------------------------------- panel z nagłówkiem 48 px */
export function panel({ title, aside, body, class: cls, id, titleTag = 'h2' } = {}) {
  const head = title ? h('div', { class: 'b-panel-h' }, h(titleTag, { class: 'b-panel-t' }, title), aside ? (aside instanceof Node ? aside : h('span', { class: 'b-panel-aside' }, aside)) : null) : null;
  return h('section', { class: `b-panel${cls ? ' ' + cls : ''}`, id, 'aria-label': typeof title === 'string' ? title : null }, head, body);
}

/* ---------------------------------------------------------------- nagłówek strony: okruszki + tytuł + akcje */
export function pageHead({ crumbs = [], title, sub, actions = [], titleTag = 'h1' } = {}) {
  const frag = document.createDocumentFragment();
  if (crumbs.length) {
    const parts = [];
    crumbs.forEach((c, i) => {
      if (i) parts.push(h('span', { class: 'b-crumb-sep', 'aria-hidden': 'true' }, '/'));
      parts.push(c.href ? h('a', { class: 'b-crumb', href: c.href }, c.label) : h('span', { class: 'b-crumb is-current', 'aria-current': 'page' }, c.label));
    });
    frag.appendChild(h('nav', { class: 'b-crumbs', 'aria-label': 'Okruszki' }, parts));
  }
  frag.appendChild(h('header', { class: 'b-head' },
    h('div', { class: 'b-head-t' }, h(titleTag, { class: 'b-h1' }, title), sub ? (sub instanceof Node ? sub : h('p', { class: 'b-sub' }, sub)) : null),
    actions.length ? h('div', { class: 'b-head-actions' }, actions.filter(Boolean)) : null,
  ));
  return frag;
}

/* ---------------------------------------------------------------- zakładki-pigułki (Figma „Tabs”) */
export function pillTabs({ items, active, onChange, label = 'Filtr' } = {}) {
  const el = h('div', { class: 'b-tabs', role: 'tablist', 'aria-label': label });
  const draw = () => {
    el.replaceChildren(...items.map((t) => {
      const on = t.key === active;
      const b = h('button', { type: 'button', role: 'tab', class: `b-tab${on ? ' is-on' : ''}`, 'aria-selected': on ? 'true' : 'false', tabindex: on ? '0' : '-1', dataset: { key: t.key } },
        t.label, t.count !== undefined && t.count !== null ? ` · ${t.count}` : '');
      b.addEventListener('click', () => { if (active !== t.key) { active = t.key; draw(); if (onChange) onChange(t.key); } });
      return b;
    }));
  };
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const i = items.findIndex((t) => t.key === active);
    const j = (i + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
    active = items[j].key; draw(); el.querySelector('.is-on').focus(); if (onChange) onChange(active);
  });
  draw();
  el.setActive = (k) => { active = k; draw(); };
  return el;
}

/* ---------------------------------------------------------------- zakładki stanowiska (podkreślenie) */
export function positionTabs(position, activeKey, { rubricId } = {}) {
  const id = encodeURIComponent(position.id);
  const tabs = [
    { key: 'pipeline', label: 'Lejek', href: `#/positions/${id}` },
    { key: 'rubric', label: 'Rubryka', href: rubricId ? `#/rubrics/${encodeURIComponent(rubricId)}` : '#/rubrics' },
    { key: 'report', label: 'Raport', href: `#/positions/${id}/report` },
    { key: 'ad', label: 'Ogłoszenie', href: `#/positions/${id}/ad` },
    { key: 'team', label: 'Zespół', href: `#/positions/${id}/team` },
    { key: 'settings', label: 'Ustawienia', soon: true },
  ];
  return h('nav', { class: 'b-ptabs', 'aria-label': 'Sekcje stanowiska' },
    tabs.map((t) => (t.soon
      ? h('span', { class: 'b-ptab is-soon', 'aria-disabled': 'true', title: 'Ustawienia stanowiska pojawią się wkrótce' }, t.label)
      : h('a', { class: `b-ptab${t.key === activeKey ? ' is-on' : ''}`, href: t.href, 'aria-current': t.key === activeKey ? 'page' : null }, t.label))));
}

/* ---------------------------------------------------------------- karta roli z mini-lejkiem */
/**
 * funnel: tablica udziałów 0..1 (etap 1 = 1); bottleneck: indeks etapu w kolorze warn; template: szare słupki.
 * Szerokości jak w Figmie: 100 %, 95, 50, 24, 8 px — gdy brak danych (szablon) używamy tych stałych.
 */
const FUNNEL_FIXED = [1, 95 / 193, 50 / 193, 24 / 193, 8 / 193];
const FUNNEL_OPACITY = [0.85, 0.7, 1, 0.4, 0.25];
export function roleCard({ title, sub, status, tone = 'neutral', funnel, bottleneck = -1, href, onClick, template = false, ariaLabel } = {}) {
  const vals = Array.isArray(funnel) && funnel.length ? funnel : FUNNEL_FIXED;
  const bars = vals.slice(0, 5).map((v, i) => {
    const pct = Math.max(8 / 193, Math.min(1, Number(v) || 0)) * 100;
    const cls = `b-fbar${i === bottleneck ? ' is-warn' : ''}${!template && v <= 0 ? ' is-empty' : ''}`;
    return h('i', { class: cls, style: `width:${i === 0 ? 100 : pct}%;opacity:${i === bottleneck ? 1 : FUNNEL_OPACITY[i] ?? 0.4}` });
  });
  const tag = href ? 'a' : 'button';
  const el = h(tag, { class: `b-role${template ? ' is-template' : ''}`, href, type: href ? null : 'button', 'aria-label': ariaLabel || title },
    h('div', { class: 'b-role-prev' },
      badge(status, tone),
      h('div', { class: 'b-funnel', 'aria-hidden': 'true' }, bars),
    ),
    h('div', { class: 'b-role-meta' }, h('b', null, title), h('small', null, sub)),
  );
  if (onClick) el.addEventListener('click', onClick);
  return el;
}

/* ---------------------------------------------------------------- kroki kreatora */
export const WIZARD_STEPS = ['Opis', 'Etapy i rubryki', 'Zespół', 'Publikacja'];
export function wizardSteps(active = 1, hrefs = []) {
  const parts = [];
  WIZARD_STEPS.forEach((label, i) => {
    const n = i + 1;
    if (i) parts.push(h('i', { class: 'b-wz-line', 'aria-hidden': 'true' }));
    const done = n <= active;
    const inner = [h('span', { class: `b-wz-n${done ? ' is-on' : ''}`, 'aria-hidden': 'true' }, String(n)), h('span', { class: `b-wz-l${n === active ? ' is-on' : ''}` }, label)];
    parts.push(hrefs[i]
      ? h('a', { class: 'b-wz-step', href: hrefs[i], 'aria-current': n === active ? 'step' : null, 'aria-label': `Krok ${n}: ${label}` }, inner)
      : h('span', { class: 'b-wz-step', 'aria-current': n === active ? 'step' : null, 'aria-label': `Krok ${n}: ${label}` }, inner));
  });
  return h('ol', { class: 'b-wizard', 'aria-label': 'Kroki kreatora' }, parts.map((p) => (p.tagName === 'I' ? p : h('li', null, p))));
}

/* ---------------------------------------------------------------- chip AI (zawsze oznaczony iskrą) */
export function aiChip(text, { onClick, title } = {}) {
  const el = h(onClick ? 'button' : 'span', { class: 'b-ai', type: onClick ? 'button' : null, title: title || 'Sugestia AI — decyzję podejmuje człowiek' }, bicon('sparkle-fill', 12), h('span', null, text));
  if (onClick) el.addEventListener('click', onClick);
  return el;
}

/* ---------------------------------------------------------------- awatar */
export function bavatar(name, size = 32) {
  return h('span', { class: 'b-av', style: `--sz:${size}px`, title: name || '', 'aria-hidden': 'true' }, initials(name));
}

/* ---------------------------------------------------------------- „x temu” */
export function ago(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const days = Math.floor((Date.now() - d.getTime()) / 864e5);
  if (days <= 0) return 'dziś';
  if (days === 1) return 'wczoraj';
  if (days < 7) return `${days} dni temu`;
  if (days < 28) { const w = Math.round(days / 7); return `${w} tyg. temu`; }
  if (days < 60) return 'miesiąc temu';
  if (days < 365) return `${Math.round(days / 30)} mies. temu`;
  return 'rok temu';
}

/* ---------------------------------------------------------------- menu „więcej” */
export function menu(trigger, items, { align = 'right' } = {}) {
  const host = trigger.parentElement;
  const open = () => {
    if (host.querySelector('.b-menu')) { close(); return; }
    const pop = h('div', { class: `b-menu ${align}`, role: 'menu' },
      items.map((it) => {
        const b = h('button', { type: 'button', role: 'menuitem', class: it.danger ? 'is-danger' : '', disabled: it.disabled }, it.icon ? bicon(it.icon, 15) : null, it.label);
        b.addEventListener('click', () => { close(); if (it.onClick) it.onClick(); });
        return b;
      }));
    host.style.position = host.style.position || 'relative';
    host.appendChild(pop);
    trigger.setAttribute('aria-expanded', 'true');
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); trigger.focus(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const list = Array.from(pop.querySelectorAll('[role=menuitem]:not(:disabled)'));
        const i = list.indexOf(document.activeElement);
        list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length].focus();
      }
    };
    const onDoc = (e) => { if (!host.contains(e.target)) close(); };
    pop._cleanup = () => { document.removeEventListener('keydown', onKey, true); document.removeEventListener('mousedown', onDoc, true); };
    document.addEventListener('keydown', onKey, true);
    setTimeout(() => document.addEventListener('mousedown', onDoc, true), 0);
    const first = pop.querySelector('[role=menuitem]:not(:disabled)'); if (first) first.focus();
  };
  const close = () => {
    const pop = host.querySelector('.b-menu');
    if (!pop) return;
    if (pop._cleanup) pop._cleanup();
    pop.remove();
    trigger.setAttribute('aria-expanded', 'false');
  };
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); open(); });
  return { open, close };
}

/** Przycisk-ikona „więcej” (16 px, bez etykiety) */
export function moreBtn(title = 'Więcej') {
  return h('button', { type: 'button', class: 'b-more', 'aria-label': title, title }, icon('more', 16));
}

export function loadKitCss() {
  return ui.loadCss(new URL('./b-kit.css', import.meta.url));
}

export default { bicon, bbtn, badge, toggle, panel, pageHead, pillTabs, positionTabs, roleCard, wizardSteps, aiChip, bavatar, ago, menu, moreBtn, loadKitCss };
