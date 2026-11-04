/**
 * router.js — router po hashu, strażnik sesji/firmy, szkielet (pasek boczny z Figmy 9:2), ładowanie widoków.
 *
 * API:
 *   startRouter({ store, ui, ai })   — uruchamia nasłuch hashchange i pierwszą nawigację
 *   navigate(hash)                   — zmiana trasy (np. '#/positions/abc')
 *   ROUTES                           — tabela tras (pattern → view, layout, title, nav)
 *   openSearch()                     — wyszukiwarka ⌘K (ramka 32:5867)
 *   getNotifications() / markNotificationsRead(ids) — stan powiadomień (localStorage tekma.demo.notifications)
 *
 * Widok: views/<view>.js eksportuje `default async function render(ctx) -> HTMLElement`.
 *   ctx = { params, query, store, ui, ai, navigate, user, org, refreshShell, path, route, setHeader, openSearch }
 *   ctx.setHeader({ title, subtitle, crumbs:[{label,href}], actions:[HTMLElement], width:'narrow'|'wide', hidden })
 *   — nagłówek strony nad treścią (Figma „Header”: tytuł 30/600 + podtytuł 14 muted po lewej, akcje po prawej;
 *     na mobile: pasek z logo/„wstecz”, dzwonkiem i tytułem 24). Bez wywołania pokazuje tytuł trasy.
 * Układy: 'shell' (pasek boczny + nagłówek), 'bare' (auth, onboarding — bez chrome), 'public' (strony publiczne).
 * Brakujący plik widoku → stan „Ten ekran jest w budowie”. Błąd w widoku → stan błędu z „Spróbuj ponownie”.
 */

import { DASHBOARD_DEMO } from './seed.js';

export const ROUTES = [
  // --- start (agent A)
  { pattern: '#/login', view: 'auth', layout: 'bare', title: 'Zaloguj się' },
  { pattern: '#/signup', view: 'auth', layout: 'bare', title: 'Załóż konto' },
  { pattern: '#/reset', view: 'auth', layout: 'bare', title: 'Reset hasła' },
  { pattern: '#/onboarding', view: 'onboarding', layout: 'bare', title: 'Twoja firma' }, // ?krok=1|2|3
  // --- pulpit i nawigacja (agent A)
  { pattern: '#/', view: 'dashboard', layout: 'shell', title: 'Pulpit', nav: 'dashboard' },
  { pattern: '#/notifications', view: 'notifications', layout: 'shell', title: 'Powiadomienia', nav: 'dashboard' },
  // --- rekrutacja (agent B)
  { pattern: '#/positions', view: 'positions', layout: 'shell', title: 'Stanowiska', nav: 'positions' },
  { pattern: '#/positions/new', view: 'position-new', layout: 'shell', title: 'Nowe stanowisko', nav: 'positions' }, // ?krok=1|2
  { pattern: '#/positions/:id/ad', view: 'position-ad', layout: 'shell', title: 'Stanowisko — ogłoszenie', nav: 'positions' },
  { pattern: '#/positions/:id/team', view: 'position-team', layout: 'shell', title: 'Stanowisko — zespół', nav: 'positions' },
  { pattern: '#/positions/:id/report', view: 'position-report', layout: 'shell', title: 'Stanowisko — raport', nav: 'positions' }, // agent C1
  { pattern: '#/positions/:id', view: 'pipeline', layout: 'shell', title: 'Lejek', nav: 'positions' }, // agent C1
  { pattern: '#/rubrics', view: 'rubrics', layout: 'shell', title: 'Rubryki', nav: 'rubrics' },
  { pattern: '#/rubrics/:id', view: 'rubrics', layout: 'shell', title: 'Rubryka', nav: 'rubrics' },
  { pattern: '#/templates', view: 'templates', layout: 'shell', title: 'Biblioteka szablonów', nav: 'rubrics' },
  { pattern: '#/careers', view: 'careers', layout: 'public', title: 'Strona kariery' },
  { pattern: '#/apply', view: 'portal', layout: 'public', title: 'Portal kandydata' },
  // --- kandydaci, rozmowa, decyzja (agent C1: candidates; agent C2: reszta)
  { pattern: '#/candidates', view: 'candidates', layout: 'shell', title: 'Kandydaci', nav: 'candidates' },
  { pattern: '#/compare', view: 'compare', layout: 'shell', title: 'Porównanie kandydatów', nav: 'candidates' },
  { pattern: '#/candidates/:id/live', view: 'live', layout: 'shell', title: 'Rozmowa na żywo', nav: 'candidates' },
  { pattern: '#/candidates/:id/review', view: 'review', layout: 'shell', title: 'Ocena po rozmowie', nav: 'candidates' },
  { pattern: '#/candidates/:id', view: 'scorecard', layout: 'shell', title: 'Karta oceny', nav: 'candidates' },
  // --- po zatrudnieniu (agent D)
  { pattern: '#/people', view: 'people', layout: 'shell', title: 'Ludzie', nav: 'people' },
  { pattern: '#/people/:id', view: 'person', layout: 'shell', title: 'Osoba', nav: 'people' }, // ?tab=przeglad|1-1|check-iny|cele|szkolenia
  { pattern: '#/goals', view: 'goals', layout: 'shell', title: 'Cele', nav: 'goals' },
  { pattern: '#/checkin', view: 'checkin', layout: 'public', title: 'Check-in' },
  { pattern: '#/course-review', view: 'course-review', layout: 'public', title: 'Powtórka z kursu' },
  // --- ustawienia, zgodność, marketplace (agent E)
  { pattern: '#/settings', view: 'settings', layout: 'shell', title: 'Ustawienia', nav: 'settings' }, // ?tab=firma|zespol|integracje|plan
  { pattern: '#/compliance', view: 'compliance', layout: 'shell', title: 'RODO i AI Act', nav: 'compliance' },
  { pattern: '#/marketplace', view: 'marketplace', layout: 'shell', title: 'Rekruterzy', nav: 'marketplace' },
  { pattern: '#/marketplace/:id', view: 'recruiter', layout: 'shell', title: 'Profil rekrutera', nav: 'marketplace' },
];

/* Nawigacja (Figma 9:2 — Sidebar). count: skąd brać licznik (store | localStorage). */
const NAV = [
  { group: 'Rekrutacja', items: [
    { key: 'dashboard', label: 'Pulpit', href: '#/', icon: 'home' },
    { key: 'positions', label: 'Stanowiska', href: '#/positions', icon: 'briefcase', count: 'positions' },
    { key: 'rubrics', label: 'Rubryki', href: '#/rubrics', icon: 'list', count: 'rubrics' },
    { key: 'candidates', label: 'Kandydaci', href: '#/candidates', icon: 'users', count: 'candidates' },
    { key: 'marketplace', label: 'Rekruterzy', href: '#/marketplace', icon: 'user-badge' },
  ] },
  { group: 'Po zatrudnieniu', items: [
    { key: 'people', label: 'Ludzie', href: '#/people', icon: 'user-check', count: 'people' },
    { key: 'goals', label: 'Cele', href: '#/goals', icon: 'target', count: 'goals' },
  ] },
  { group: 'Administracja', items: [
    { key: 'settings', label: 'Ustawienia', href: '#/settings', icon: 'settings' },
    { key: 'compliance', label: 'RODO i AI Act', href: '#/compliance', icon: 'shield' },
  ] },
  { group: 'Strony publiczne', items: [
    { key: 'careers', label: 'Strona kariery', href: '#/careers', icon: 'globe', external: true },
    { key: 'apply', label: 'Portal kandydata', href: '#/apply', icon: 'log-in', external: true },
  ] },
];
/* Dolny pasek zakładek (Figma 33:5764): Pulpit · Kandydaci · Ludzie · Więcej */
const TABS = [
  { key: 'dashboard', label: 'Pulpit', href: '#/', icon: 'home' },
  { key: 'candidates', label: 'Kandydaci', href: '#/candidates', icon: 'users' },
  { key: 'people', label: 'Ludzie', href: '#/people', icon: 'user-check' },
];
const ROLE_LABEL = { owner: 'Właściciel', recruiter: 'Rekruter', interviewer: 'Rozmówca' };
const NOTIF_KEY = 'tekma.demo.notifications';

const LOGO_PATHS = '<path d="M3 6H17.5V22.5L12.5 28V12H3Z"/><path d="M20 6H29L20 12.5Z"/>';

let deps = null;          // { store, ui, ai }
let root = null;
let shellEl = null;       // zbudowany szkielet (shell)
let mainEl = null;
let state = { user: null, org: null, route: null, path: '', navSeq: 0, counts: {} };

export function navigate(hash) {
  const target = normalizeHash(hash);
  if (location.hash === target) handleRoute();
  else location.hash = target;
}

function normalizeHash(h) {
  if (!h) return '#/';
  if (!h.startsWith('#')) h = '#' + (h.startsWith('/') ? '' : '/') + h;
  return h;
}

/** Logo (Figma Logo/Lockup): znak + „tekma”. cls 'logo mark-only' = sam znak (mobile). */
export function logo(cls = 'logo', href = '#/') {
  const { h } = deps.ui;
  const el = h('a', { class: cls, href, 'aria-label': 'Tekma — pulpit' });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 32 32');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = LOGO_PATHS;
  el.append(svg, h('span', null, 'tekma'));
  return el;
}

/* ------------------------------------------------ dopasowanie trasy */
export function matchRoute(hash) {
  const raw = (hash || '#/').split('?');
  const path = raw[0] || '#/';
  const query = Object.fromEntries(new URLSearchParams(raw[1] || ''));
  const segs = path.replace(/^#\/?/, '').split('/').filter(Boolean);
  for (const r of ROUTES) {
    const pSegs = r.pattern.replace(/^#\/?/, '').split('/').filter(Boolean);
    if (pSegs.length !== segs.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < pSegs.length; i++) {
      if (pSegs[i].startsWith(':')) params[pSegs[i].slice(1)] = decodeURIComponent(segs[i]);
      else if (pSegs[i] !== segs[i]) { ok = false; break; }
    }
    if (ok) return { route: r, params, query, path };
  }
  return null;
}

/* ------------------------------------------------ start */
export function startRouter(d) {
  deps = d;
  root = document.getElementById('root');
  window.addEventListener('hashchange', handleRoute);
  window.addEventListener('keydown', onGlobalKey);
  deps.store.auth.onChange((session) => {
    const had = Boolean(state.user), has = Boolean(session);
    if (had !== has) { state.org = null; handleRoute(); }
  });
  return handleRoute();
}

function onGlobalKey(e) {
  if ((e.metaKey || e.ctrlKey) && !e.altKey && String(e.key).toLowerCase() === 'k') {
    if (!state.user || !shellEl) return;
    e.preventDefault();
    if (document.querySelector('.cmdk-backdrop')) closeSearch(); else openSearch();
  }
}

async function handleRoute() {
  const seq = ++state.navSeq;
  const { store, ui } = deps;
  const m = matchRoute(location.hash);
  if (!m) { location.replace('#/'); return; }

  // strażnik: sesja
  let session = null;
  try { session = await store.auth.session(); } catch (e) { console.error(e); }
  if (seq !== state.navSeq) return;
  state.user = session ? session.user : null;
  const isPublic = m.route.layout === 'public';
  const isAuthRoute = m.route.view === 'auth';
  if (isPublic) { /* strony publiczne i mobilne: bez strażnika */ }
  else if (!state.user) {
    if (!isAuthRoute) { location.replace('#/login'); return; }
  } else if (isAuthRoute) {
    location.replace('#/'); return;
  }

  // strażnik: firma (onboarding z ?krok= jest dostępny także po utworzeniu firmy — kroki 2 i 3)
  if (state.user && !isPublic) {
    if (!state.org) {
      try { state.org = await store.org.current(); } catch (e) { console.error(e); renderFatal(e); return; }
      if (seq !== state.navSeq) return;
    }
    if (!state.org && m.route.view !== 'onboarding') { location.replace('#/onboarding'); return; }
    if (state.org && m.route.view === 'onboarding' && !m.query.krok) { location.replace('#/'); return; }
  }

  closeSearch();
  state.route = m.route; state.path = m.path;
  document.title = `${m.route.title} · Tekma`;

  const container = m.route.layout === 'shell' ? ensureShell() : ensureBare(m.route);
  if (m.route.layout === 'shell') { setHeader({ width: 'wide' }); }
  container.setAttribute('aria-busy', 'true');
  container.replaceChildren(ui.skeleton({ lines: 4 }));

  const ctx = {
    params: m.params, query: m.query, store, ui, ai: deps.ai, navigate,
    user: state.user, org: state.org, path: m.path, route: m.route,
    refreshShell: async () => { state.org = await store.org.current(); if (shellEl) { updateShell(); refreshCounts(); } return state.org; },
    setHeader: (opts) => setHeader(opts || {}),
    openSearch,
  };

  let el;
  try {
    el = await loadView(m.route.view, ctx);
  } catch (err) {
    console.error(`[router] widok ${m.route.view}:`, err);
    el = renderError(err, () => handleRoute());
  }
  if (seq !== state.navSeq) return;
  container.replaceChildren(el);
  container.removeAttribute('aria-busy');
  if (m.route.layout === 'shell') { updateShell(); syncTitleLevel(); refreshCounts(); }
  afterNavigate(container, m.route.layout);
}

async function loadView(name, ctx) {
  const url = new URL(`./views/${name}.js`, import.meta.url);
  let mod;
  try {
    mod = await import(url.href);
  } catch (err) {
    // brak pliku → „w budowie”; inny błąd (np. składnia) → stan błędu
    if (await isMissing(url)) return renderBuilding(ctx.route);
    throw err;
  }
  if (typeof mod.default !== 'function') throw new Error(`Widok „${name}” nie eksportuje funkcji render.`);
  const el = await mod.default(ctx);
  if (!(el instanceof Node)) throw new Error(`Widok „${name}” nie zwrócił elementu.`);
  return el;
}

async function isMissing(url) {
  try {
    const r = await fetch(url.href, { method: 'HEAD', cache: 'no-store' });
    return r.status === 404;
  } catch { return false; }
}

/* ------------------------------------------------ po nawigacji */
function afterNavigate(container, layout) {
  window.scrollTo(0, 0);
  if (layout === 'shell' && mainEl) {
    mainEl.focus({ preventScroll: true });
  } else {
    // układ bare: na desktopie fokus na pierwsze pole z [autofocus], inaczej na nagłówek
    const auto = window.innerWidth >= 900 ? container.querySelector('[autofocus]') : null;
    const first = auto || container.querySelector('h1');
    if (first) { if (!auto) first.setAttribute('tabindex', '-1'); first.focus({ preventScroll: true }); }
  }
}

/* ------------------------------------------------ układ: bare (widok rysuje własny układ — auth/onboarding z Figmy) */
function ensureBare() {
  if (root.firstElementChild && root.firstElementChild.classList.contains('bare-root')) {
    return root.firstElementChild;
  }
  shellEl = null; mainEl = null;
  const { h } = deps.ui;
  const content = h('div', { class: 'bare-root' });
  root.replaceChildren(content);
  return content;
}

/* ------------------------------------------------ układ: shell */
function ensureShell() {
  if (shellEl && shellEl.isConnected) return mainEl.querySelector('.main-inner');
  const { h, icon } = deps.ui;

  // Nagłówek firmy: awatar, nazwa, dzwonek (→ #/notifications), chevron (menu konta)
  const brand = h('div', { class: 'side-brand', 'data-slot': 'workspace' });

  const navEl = h('nav', { class: 'side-nav', 'aria-label': 'Główna' });
  NAV.forEach((g, gi) => {
    if (gi > 0) navEl.appendChild(h('div', { class: 'gap-16', 'aria-hidden': 'true' }));
    navEl.appendChild(h('div', { class: 'grp' }, g.group));
    for (const n of g.items) {
      navEl.appendChild(h('a', { href: n.href, 'data-nav': n.key, target: n.external ? '_blank' : null, rel: n.external ? 'noopener' : null },
        icon(n.icon), h('span', null, n.label), h('em', { 'data-count': n.count || null }, '')));
    }
  });

  const searchBtn = h('button', { type: 'button', class: 'side-search', 'aria-label': 'Szukaj (⌘K)', 'aria-keyshortcuts': 'Meta+K Control+K' },
    icon('search'), h('span', null, 'Szukaj…'), h('kbd', { class: 'kbd', 'aria-hidden': 'true' }, '⌘K'));
  searchBtn.addEventListener('click', () => openSearch());

  const copyBtn = h('button', { type: 'button', class: 'copy' }, 'Kopiuj link');
  copyBtn.addEventListener('click', copyInviteLink);
  const side = h('aside', { class: 'side', 'aria-label': 'Nawigacja' },
    brand,
    h('div', { class: 'gap-10', 'aria-hidden': 'true' }),
    h('hr'),
    h('div', { class: 'gap-12', 'aria-hidden': 'true' }),
    searchBtn,
    h('div', { class: 'gap-12', 'aria-hidden': 'true' }),
    h('hr'),
    h('div', { class: 'gap-16', 'aria-hidden': 'true' }),
    navEl,
    h('div', { class: 'side-spacer', 'aria-hidden': 'true' }),
    h('hr'),
    h('div', { class: 'side-foot' },
      h('div', { class: 'invite' }, icon('mail'), h('span', { class: 't' }, 'Zaproś zespół'), copyBtn),
    ),
  );

  const moreBtn = h('button', { type: 'button', 'data-nav': 'more', 'aria-haspopup': 'dialog' }, icon('more', 20), h('span', null, 'Więcej'));
  moreBtn.addEventListener('click', openMoreSheet);
  const tabbar = h('nav', { class: 'tabbar', 'aria-label': 'Główna (mobile)' },
    TABS.map((n) => h('a', { href: n.href, 'data-nav': n.key }, icon(n.icon, 20), h('span', null, n.label))),
    moreBtn,
  );

  // Nagłówek strony: pasek mobilny (logo/wstecz · tytuł · dzwonek), okruszki, tytuł + podtytuł, akcje.
  const head = h('header', { class: 'main-head' },
    h('div', { class: 'head-bar', 'data-slot': 'bar' }),
    h('div', { class: 'crumbs', 'data-slot': 'crumbs' }),
    h('div', { class: 'head-main' },
      h('div', { class: 'title', 'data-slot': 'title' }),
      h('div', { class: 'actions', 'data-slot': 'actions' }),
    ),
  );
  mainEl = h('main', { class: 'main', id: 'main', tabindex: '-1' },
    head,
    deps.store.mode === 'demo' ? demoBanner() : null,
    h('div', { class: 'main-inner' }),
  );
  shellEl = h('div', { class: 'shell' }, side, h('div', { class: 'main-col' }, mainEl, tabbar));
  root.replaceChildren(shellEl);
  updateShell();
  return mainEl.querySelector('.main-inner');
}

export function demoBanner() {
  const { h, icon } = deps.ui;
  return h('div', { class: 'demo-banner', role: 'note' }, icon('info'),
    h('span', null, h('b', null, 'Tryb demo: '), 'dane zostają tylko w tej przeglądarce. Nic nie wysyłamy na serwer.'));
}

/**
 * Nagłówek strony. Widok wywołuje ctx.setHeader({ title, subtitle, crumbs, actions, width, hidden }).
 * Bez wywołania pokazuje tytuł trasy. Na mobile okruszek zamienia się w „wstecz” w pasku górnym.
 */
function setHeader({ title, subtitle, crumbs, actions, width, hidden } = {}) {
  if (!shellEl) return;
  const { h, icon } = deps.ui;
  const head = shellEl.querySelector('.main-head');
  const t = shellEl.querySelector('[data-slot="title"]');
  const c = shellEl.querySelector('[data-slot="crumbs"]');
  const a = shellEl.querySelector('[data-slot="actions"]');
  const bar = shellEl.querySelector('[data-slot="bar"]');
  const routeTitle = (state.route && state.route.title) || '';
  head.classList.toggle('is-empty', Boolean(hidden));
  if (c) {
    const parts = [];
    for (const cr of crumbs || []) {
      parts.push(cr.href ? h('a', { class: 'crumb', href: cr.href }, cr.label) : h('span', { class: 'crumb' }, cr.label));
      parts.push(h('span', { class: 'crumb-sep', 'aria-hidden': 'true' }, '/'));
    }
    if (parts.length) parts.push(h('span', { class: 'crumb-cur' }, title || routeTitle));
    c.replaceChildren(...parts);
  }
  if (t) {
    t.replaceChildren(h('span', { class: 't' }, title || routeTitle), h('p', { class: 'sub' }, subtitle || ''));
    syncTitleLevel();
  }
  if (bar) {
    const back = (crumbs || []).filter((x) => x.href).pop();
    const bellBtn = h('a', { class: 'icon-btn touch', href: '#/notifications', 'aria-label': 'Powiadomienia' }, icon('bell', 20));
    if (back) {
      bar.replaceChildren(
        h('a', { class: 'icon-btn touch', href: back.href, 'aria-label': `Wróć: ${back.label}` }, icon('arrow-left', 20)),
        h('span', { class: 'bar-title' }, back.label),
        bellBtn,
      );
    } else {
      bar.replaceChildren(logo('logo mark-only'), h('span', { class: 'spacer' }), bellBtn);
    }
  }
  if (a) a.replaceChildren(...(actions || []).filter(Boolean));
  const inner = mainEl && mainEl.querySelector('.main-inner');
  if (inner && width) inner.classList.toggle('narrow', width === 'narrow');
}

/** Tytuł w nagłówku jest <h1>, gdy widok nie ma własnego h1 w treści (jeden h1 na ekran). */
function syncTitleLevel() {
  if (!shellEl || !mainEl) return;
  const cur = shellEl.querySelector('[data-slot="title"] .t');
  if (!cur) return;
  const inner = mainEl.querySelector('.main-inner');
  const wantH1 = !(inner && inner.querySelector('h1'));
  const tag = wantH1 ? 'h1' : 'span';
  if (cur.tagName.toLowerCase() === tag) return;
  const next = deps.ui.h(tag, { class: 't' }, cur.textContent);
  cur.replaceWith(next);
}

function updateShell() {
  if (!shellEl) return;
  const { h, icon, initials } = deps.ui;
  const org = state.org, user = state.user;
  const ws = shellEl.querySelector('[data-slot="workspace"]');
  if (ws) {
    const orgName = org ? org.name : (user ? (user.name || user.email) : 'Tekma');
    const avatarEl = h('span', { class: 'ws-av', 'aria-hidden': 'true' }, initials(orgName).slice(0, 1));
    const logoData = readJson('tekma.demo.company');
    if (logoData && logoData.logo) avatarEl.replaceChildren(h('img', { src: logoData.logo, alt: '' }));
    const btn = h('button', { type: 'button', class: 'ws-btn', 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-label': `Firma: ${orgName} — menu konta` },
      avatarEl, h('span', { class: 'ws-name' }, orgName));
    const chevron = h('button', { type: 'button', class: 'side-ico', 'aria-label': 'Menu konta', 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, icon('chevron-down'));
    const bell = h('a', { class: 'side-ico', href: '#/notifications', 'aria-label': 'Powiadomienia' }, icon('bell'));
    if (unreadCount() > 0) bell.appendChild(h('i', { class: 'dot', 'aria-hidden': 'true' }));
    const toggle = () => openUserMenu(chevron, ws, [btn, chevron]);
    btn.addEventListener('click', toggle);
    chevron.addEventListener('click', toggle);
    ws.replaceChildren(btn, bell, chevron);
  }
  const active = state.route && state.route.nav;
  for (const a of shellEl.querySelectorAll('[data-nav]')) {
    const on = a.dataset.nav === active;
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
}

/** Liczniki w pasku bocznym: stanowiska (otwarte), rubryki, kandydaci (aktywni), ludzie/cele (dane demo modułów). */
async function refreshCounts() {
  if (!shellEl || !state.org) return;
  const { store } = deps;
  const counts = {};
  try {
    const [pos, cands, rubs] = await Promise.all([store.positions.list(), store.candidates.list(), store.rubrics.list()]);
    counts.positions = pos.filter((p) => p.status === 'open').length;
    counts.candidates = cands.filter((c) => c.status === 'active').length;
    counts.rubrics = rubs.length;
    counts.people = demoListLength('tekma.demo.people', pos.length ? 3 : 0);
    counts.goals = demoListLength('tekma.demo.goals', pos.length ? 6 : 0);
  } catch (e) { console.warn('[router] liczniki:', e); }
  state.counts = counts;
  for (const em of shellEl.querySelectorAll('[data-count]')) {
    const v = counts[em.dataset.count];
    em.textContent = v ? String(v) : '';
  }
}
function demoListLength(key, fallback) {
  const v = readJson(key);
  if (Array.isArray(v)) return v.length;
  if (v && typeof v === 'object') { const arr = Object.values(v).find((x) => Array.isArray(x)); if (arr) return arr.length; }
  return fallback;
}
function readJson(key) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

async function copyInviteLink() {
  const { ui } = deps;
  const link = `${location.origin}${location.pathname}#/signup${state.org ? `?org=${encodeURIComponent(state.org.name)}` : ''}`;
  try {
    await navigator.clipboard.writeText(link);
    ui.toast('Link zaproszenia skopiowany. Wyślij go osobom z zespołu.', 'good');
  } catch {
    ui.toast(`Skopiuj link ręcznie: ${link}`, 'neutral', { duration: 8000 });
  }
}

/** Menu konta (pod nagłówkiem firmy): osoba, firma i rola, Ustawienia, Wyloguj się. */
function openUserMenu(trigger, host, triggers = [trigger]) {
  const { h, icon, avatar } = deps.ui;
  if (host.querySelector('.popover')) { closeUserMenu(host, triggers); return; }
  const org = state.org, user = state.user;
  const item = (label, iconName, { onClick, href } = {}) => {
    const el = h(href ? 'a' : 'button', { type: href ? null : 'button', href, role: 'menuitem', tabindex: '0' }, icon(iconName), label);
    if (onClick) el.addEventListener('click', onClick);
    return el;
  };
  const pop = h('div', { class: 'popover down', role: 'menu', 'aria-label': 'Konto' },
    h('div', { class: 'pop-head' }, avatar(user ? user.name : ''), h('div', { class: 't' },
      h('strong', null, user ? (user.name || user.email) : ''), h('small', null, user ? user.email : ''))),
    h('hr'),
    h('div', { class: 'pop-head' }, h('span', { class: 'ws-av', 'aria-hidden': 'true' }, org ? deps.ui.initials(org.name).slice(0, 1) : '?'),
      h('div', { class: 't' }, h('strong', null, org ? org.name : '—'), h('small', null, org ? (ROLE_LABEL[org.role] || org.role) : ''))),
    h('hr'),
    item('Ustawienia', 'settings', { href: '#/settings', onClick: () => closeUserMenu(host, triggers) }),
    item('Powiadomienia', 'bell', { href: '#/notifications', onClick: () => closeUserMenu(host, triggers) }),
    item('Wyloguj się', 'logout', { onClick: () => { closeUserMenu(host, triggers); signOut(); } }),
  );
  host.appendChild(pop);
  triggers.forEach((t) => t.setAttribute('aria-expanded', 'true'));
  const items = () => Array.from(pop.querySelectorAll('[role="menuitem"]'));
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeUserMenu(host, triggers); trigger.focus(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const list = items(); const i = list.indexOf(document.activeElement);
      const next = e.key === 'ArrowDown' ? (i + 1) % list.length : (i - 1 + list.length) % list.length;
      list[next].focus();
    }
    if (e.key === 'Tab') closeUserMenu(host, triggers);
  };
  const onDoc = (e) => { if (!host.contains(e.target)) closeUserMenu(host, triggers); };
  pop._cleanup = () => { document.removeEventListener('keydown', onKey, true); document.removeEventListener('mousedown', onDoc, true); };
  document.addEventListener('keydown', onKey, true);
  setTimeout(() => document.addEventListener('mousedown', onDoc, true), 0);
  const first = items()[0]; if (first) first.focus();
}
function closeUserMenu(host, triggers) {
  const pop = host.querySelector('.popover');
  if (!pop) return;
  if (pop._cleanup) pop._cleanup();
  pop.remove();
  (Array.isArray(triggers) ? triggers : [triggers]).forEach((t) => t && t.setAttribute('aria-expanded', 'false'));
}

/** Arkusz „Więcej” (mobile): pozostałe pozycje nawigacji + konto. */
function openMoreSheet() {
  const { h, icon, modal } = deps.ui;
  const body = h('div', { class: 'more-sheet' });
  const m = modal({ title: 'Więcej', body });
  for (const g of NAV) {
    const items = g.items.filter((n) => !TABS.some((t) => t.key === n.key));
    if (!items.length) continue;
    body.appendChild(h('div', { class: 'grp' }, g.group));
    for (const n of items) {
      const a = h('a', { href: n.href, target: n.external ? '_blank' : null, rel: n.external ? 'noopener' : null }, icon(n.icon), n.label);
      a.addEventListener('click', () => m.close());
      body.appendChild(a);
    }
  }
  body.appendChild(h('div', { class: 'grp' }, 'Konto'));
  const notif = h('a', { href: '#/notifications' }, icon('bell'), 'Powiadomienia');
  notif.addEventListener('click', () => m.close());
  const out = h('button', { type: 'button' }, icon('logout'), 'Wyloguj się');
  out.addEventListener('click', () => { m.close(); signOut(); });
  body.append(notif, out);
}

async function signOut() {
  const { store, ui } = deps;
  try {
    await store.auth.signOut();
    state.user = null; state.org = null;
    ui.toast('Wylogowano.', 'neutral');
    location.hash = '#/login';
    handleRoute();
  } catch (e) {
    ui.toast(e.message || 'Nie udało się wylogować.', 'bad');
  }
}

/* ------------------------------------------------ powiadomienia (stan w localStorage) */
export function getNotifications() {
  const saved = readJson(NOTIF_KEY) || {};
  const read = new Set(saved.read || []);
  return DASHBOARD_DEMO.notifications.map((n) => ({ ...n, unread: n.unread && !read.has(n.id) }));
}
export function markNotificationsRead(ids) {
  const saved = readJson(NOTIF_KEY) || {};
  const read = new Set(saved.read || []);
  for (const id of ids) read.add(id);
  try { localStorage.setItem(NOTIF_KEY, JSON.stringify({ read: Array.from(read) })); } catch { /* prywatne okno */ }
  if (shellEl) updateShell();
}
function unreadCount() {
  if (!state.org) return 0;
  return getNotifications().filter((n) => n.unread).length;
}

/* ------------------------------------------------ wyszukiwarka ⌘K (Figma 32:5867) */
let searchEl = null;
export async function openSearch() {
  if (searchEl || !deps || !state.user) return;
  const { h, icon, avatar, store } = { ...deps.ui, store: deps.store };
  const input = h('input', { type: 'search', placeholder: 'Szukaj kandydatów, stanowisk, rubryk…', 'aria-label': 'Szukaj', autocomplete: 'off', spellcheck: 'false', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'cmdk-list', 'aria-autocomplete': 'list' });
  const list = h('div', { class: 'cmdk-list', id: 'cmdk-list', role: 'listbox', 'aria-label': 'Wyniki' });
  const box = h('div', { class: 'cmdk', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Wyszukiwarka' },
    h('div', { class: 'cmdk-in' }, icon('search'), input, h('span', { class: 'tag neutral', 'aria-hidden': 'true' }, 'Esc')),
    list,
    h('div', { class: 'cmdk-foot', 'aria-hidden': 'true' }, h('span', null, '↑↓ wybierz'), h('span', null, '↵ otwórz'), h('span', null, '⌘K zamknij')),
  );
  searchEl = h('div', { class: 'cmdk-backdrop' }, box);
  const prev = document.activeElement;
  searchEl.addEventListener('mousedown', (e) => { if (e.target === searchEl) closeSearch(); });
  document.body.appendChild(searchEl);
  document.body.classList.add('has-modal');
  input.focus();

  let data = { positions: [], candidates: [], rubrics: [] };
  try {
    const [positions, candidates, rubrics] = await Promise.all([store.positions.list(), store.candidates.list(), store.rubrics.list()]);
    data = { positions, candidates, rubrics };
  } catch (e) { console.warn('[cmdk]', e); }
  const posById = Object.fromEntries(data.positions.map((p) => [p.id, p]));
  const ACTIONS = [
    { label: 'Nowe stanowisko', icon: 'plus', href: '#/positions/new', keys: 'nowe stanowisko dodaj' },
    { label: 'Zaproś osobę do zespołu', icon: 'users', href: '#/settings?tab=zespol', keys: 'zaproś zespół osoba' },
    { label: 'Ustawienia', icon: 'settings', href: '#/settings', keys: 'ustawienia firma plan integracje' },
    { label: 'Powiadomienia', icon: 'bell', href: '#/notifications', keys: 'powiadomienia' },
    { label: 'RODO i AI Act', icon: 'shield', href: '#/compliance', keys: 'rodo ai act zgodność' },
  ];
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  let items = [];
  let sel = 0;

  function build(q) {
    const nq = norm(q.trim());
    const match = (s) => !nq || norm(s).includes(nq);
    const sections = [];
    const cands = data.candidates.filter((c) => match(c.full_name) || match(posById[c.position_id] && posById[c.position_id].title)).slice(0, nq ? 6 : 3)
      .map((c) => ({ kind: 'candidate', label: c.full_name, meta: `${posById[c.position_id] ? posById[c.position_id].title : ''} · ${c.stage}`, href: `#/candidates/${encodeURIComponent(c.id)}`, avatar: c.full_name }));
    if (cands.length) sections.push({ title: 'Kandydaci', items: cands });
    const poss = data.positions.filter((p) => match(p.title) || match(p.department)).slice(0, nq ? 6 : 3)
      .map((p) => ({ kind: 'position', label: p.title, meta: p.status === 'closed' ? 'Zamknięte' : [p.department, p.location].filter(Boolean).join(' · ') || 'Otwarte', href: `#/positions/${encodeURIComponent(p.id)}`, icon: 'briefcase' }));
    if (poss.length) sections.push({ title: 'Stanowiska', items: poss });
    const rubs = data.rubrics.filter((r) => match(r.name)).slice(0, nq ? 6 : 2)
      .map((r) => ({ kind: 'rubric', label: r.name, meta: `v${r.version || 1} · ${(r.questions || []).length} pyt.`, href: `#/rubrics/${encodeURIComponent(r.id)}`, icon: 'list' }));
    if (rubs.length) sections.push({ title: 'Rubryki', items: rubs });
    const acts = ACTIONS.filter((a) => match(a.label) || match(a.keys)).map((a) => ({ kind: 'action', label: a.label, meta: '', href: a.href, icon: a.icon }));
    if (acts.length) sections.push({ title: 'Akcje', items: acts });
    items = [];
    list.replaceChildren();
    for (const s of sections) {
      list.appendChild(h('div', { class: 'cmdk-sec', role: 'presentation' }, s.title));
      for (const it of s.items) {
        const idx = items.length;
        const el = h('div', { class: 'cmdk-item', role: 'option', id: `cmdk-opt-${idx}`, 'aria-selected': 'false' },
          it.avatar ? avatar(it.avatar, 'sm') : icon(it.icon),
          h('b', null, it.label), h('small', null, it.meta), h('span', { class: 'ret', 'aria-hidden': 'true' }, '↵'));
        el.addEventListener('mousemove', () => select(idx));
        el.addEventListener('click', () => go(it));
        items.push({ ...it, el });
        list.appendChild(el);
      }
    }
    if (!items.length) list.appendChild(h('div', { class: 'cmdk-empty' }, `Brak wyników dla „${q.trim()}”.`));
    select(0);
  }
  function select(i) {
    if (!items.length) { input.removeAttribute('aria-activedescendant'); return; }
    sel = Math.max(0, Math.min(items.length - 1, i));
    items.forEach((it, k) => it.el.setAttribute('aria-selected', k === sel ? 'true' : 'false'));
    input.setAttribute('aria-activedescendant', items[sel].el.id);
    items[sel].el.scrollIntoView({ block: 'nearest' });
  }
  function go(it) { closeSearch(); navigate(it.href); }
  input.addEventListener('input', () => build(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); select(sel + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); select(sel - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); if (items[sel]) go(items[sel]); }
    else if (e.key === 'Escape') { e.preventDefault(); closeSearch(); if (prev && prev.focus) prev.focus(); }
  });
  searchEl._prev = prev;
  build(input.value);
}
export function closeSearch() {
  if (!searchEl) return;
  searchEl.remove();
  searchEl = null;
  if (!document.querySelector('.modal-backdrop')) document.body.classList.remove('has-modal');
}

/* ------------------------------------------------ stany */
function renderBuilding(route) {
  const { h, icon, button } = deps.ui;
  return h('div', { class: 'state', role: 'status' },
    h('div', { class: 'glyph' }, icon('clock', 20)),
    h('h2', null, 'Ten ekran jest w budowie'),
    h('p', null, `Widok „${route.title}” pojawi się wkrótce. Reszta aplikacji działa normalnie.`),
    h('div', { class: 'actions' }, button({ label: 'Wróć do pulpitu', variant: 'secondary', onClick: () => navigate('#/') })),
  );
}

function renderError(err, retry) {
  const { h, icon, button } = deps.ui;
  const msg = (err && err.message) || 'Coś poszło nie tak.';
  return h('div', { class: 'state', role: 'alert' },
    h('div', { class: 'glyph' }, icon('alert', 20)),
    h('h2', null, 'Nie udało się wczytać tego ekranu'),
    h('p', null, msg),
    h('div', { class: 'actions' },
      button({ label: 'Spróbuj ponownie', variant: 'primary', onClick: retry }),
      button({ label: 'Wróć do pulpitu', variant: 'secondary', onClick: () => navigate('#/') }),
    ),
    err && err.stack ? h('details', null, h('summary', null, 'Szczegóły techniczne'), h('pre', null, String(err.stack))) : null,
  );
}

function renderFatal(err) {
  const { h, icon, button } = deps.ui;
  root.replaceChildren(h('div', { class: 'bare' },
    h('div', { class: 'bare-logo' }, logo()),
    h('div', { class: 'state', role: 'alert' },
      h('div', { class: 'glyph' }, icon('alert', 20)),
      h('h2', null, 'Nie udało się połączyć z danymi'),
      h('p', null, (err && err.message) || 'Spróbuj ponownie za chwilę.'),
      h('div', { class: 'actions' },
        button({ label: 'Spróbuj ponownie', variant: 'primary', onClick: () => { state.org = null; handleRoute(); } }),
        button({ label: 'Wyloguj się', variant: 'secondary', onClick: signOut }),
      ),
    ),
  ));
}

export default { startRouter, navigate, matchRoute, ROUTES, openSearch, getNotifications, markNotificationsRead };
