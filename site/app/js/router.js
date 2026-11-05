/**
 * router.js — router po hashu, strażnik sesji/firmy, szkielet z paskiem bocznym, ładowanie widoków.
 *
 * API:
 *   startRouter({ store, ui, ai })   — uruchamia nasłuch hashchange i pierwszą nawigację
 *   navigate(hash)                   — zmiana trasy (np. '#/positions/abc')
 *   ROUTES                           — tabela tras (pattern → view, layout, title)
 *
 * Widok: views/<view>.js eksportuje `default async function render(ctx) -> HTMLElement`.
 *   ctx = { params, query, store, ui, ai, navigate, user, org, refreshShell, path, route, setHeader }
 *   ctx.setHeader({ title, crumbs:[{label,href}], actions:[HTMLElement], width:'narrow'|'wide' }) — pasek górny
 *   nad treścią (tytuł po lewej, akcja główna po prawej); bez wywołania pokazuje tytuł trasy.
 * Brakujący plik widoku → stan „Ten ekran jest w budowie” (nie błąd). Błąd w widoku → stan błędu
 * z przyciskiem „Spróbuj ponownie”. Po nawigacji: tytuł strony, scroll do góry, fokus na <main>, aria-current.
 */

export const ROUTES = [
  { pattern: '#/login', view: 'auth', layout: 'bare', title: 'Zaloguj się' },
  { pattern: '#/signup', view: 'auth', layout: 'bare', title: 'Załóż konto' },
  { pattern: '#/reset', view: 'auth', layout: 'bare', title: 'Reset hasła' },
  { pattern: '#/onboarding', view: 'onboarding', layout: 'bare', title: 'Twoja firma' },
  { pattern: '#/', view: 'dashboard', layout: 'shell', title: 'Pulpit', nav: 'dashboard' },
  { pattern: '#/positions', view: 'positions', layout: 'shell', title: 'Stanowiska', nav: 'positions' },
  { pattern: '#/positions/:id', view: 'pipeline', layout: 'shell', title: 'Kanban', nav: 'positions' },
  { pattern: '#/candidates', view: 'candidates', layout: 'shell', title: 'Kandydaci', nav: 'candidates' },
  { pattern: '#/candidates/:id', view: 'scorecard', layout: 'shell', title: 'Karta oceny', nav: 'candidates' },
  { pattern: '#/decisions', view: 'decisions', layout: 'shell', title: 'Dziennik decyzji', nav: 'decisions' },
  { pattern: '#/talent', view: 'talent', layout: 'shell', title: 'Baza talentów', nav: 'talent' },
  { pattern: '#/people', view: 'people', layout: 'shell', title: 'Ludzie', nav: 'people' },
  { pattern: '#/people/:id', view: 'people', layout: 'shell', title: 'Ludzie', nav: 'people' },
  { pattern: '#/goals', view: 'goals', layout: 'shell', title: 'Cele', nav: 'goals' },
  { pattern: '#/rubrics', view: 'rubrics', layout: 'shell', title: 'Rubryki', nav: 'rubrics' },
  { pattern: '#/rubrics/:id', view: 'rubrics', layout: 'shell', title: 'Rubryka', nav: 'rubrics' },
  { pattern: '#/feedback', view: 'feedback', layout: 'shell', title: 'Feedback', nav: 'feedback' },
  { pattern: '#/settings', view: 'settings', layout: 'shell', title: 'Ustawienia', nav: 'settings' },
  { pattern: '#/settings/zgodnosc', view: 'settings', layout: 'shell', title: 'RODO i AI Act', nav: 'compliance' },
  { pattern: '#/settings/:tab', view: 'settings', layout: 'shell', title: 'Ustawienia', nav: 'settings' },
];

const NAV = {
  main: [
    { key: 'dashboard', label: 'Pulpit', href: '#/', icon: 'dashboard' },
    { key: 'positions', label: 'Stanowiska', href: '#/positions', icon: 'briefcase' },
    { key: 'rubrics', label: 'Rubryki', href: '#/rubrics', icon: 'rubric' },
    { key: 'candidates', label: 'Kandydaci', href: '#/candidates', icon: 'users' },
    { key: 'talent', label: 'Baza talentów', href: '#/talent', icon: 'user-plus' },
    { key: 'decisions', label: 'Dziennik decyzji', href: '#/decisions', icon: 'scale' },
  ],
  later: [
    { key: 'people', label: 'Ludzie', href: '#/people', icon: 'user' },
    { key: 'goals', label: 'Cele', href: '#/goals', icon: 'target' },
  ],
  admin: [
    { key: 'settings', label: 'Ustawienia', href: '#/settings', icon: 'settings' },
    { key: 'compliance', label: 'RODO i AI Act', href: '#/settings/zgodnosc', icon: 'shield' },
  ],
  support: [
    { key: 'feedback', label: 'Feedback', href: '#/feedback', icon: 'message' },
  ],
};
const ROLE_LABEL = { owner: 'Właściciel', recruiter: 'Rekruter', interviewer: 'Rozmówca' };

const LOGO_PATHS = '<path d="M3 6H17.5V22.5L12.5 28V12H3Z"/><path d="M20 6H29L20 12.5Z"/>';

import { openSearch } from './search.js';
import * as notif from './notifications.js';

let deps = null;          // { store, ui, ai }
let root = null;
let shellEl = null;       // zbudowany szkielet (shell)
let mainEl = null;
let state = { user: null, org: null, route: null, path: '', navSeq: 0 };

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

export function logo(cls = 'logo') {
  const { h } = deps.ui;
  const el = h('a', { class: cls, href: '#/', 'aria-label': 'Tekma — pulpit' });
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
  // własny licznik głębokości historii: przycisk „wstecz” w nagłówku (aplikacja na ekranie początkowym nie ma paska przeglądarki)
  let idx = (history.state && typeof history.state.idx === 'number') ? history.state.idx : 0;
  try { history.replaceState({ ...(history.state || {}), idx }, ''); } catch { /* np. file:// */ }
  state.canBack = idx > 0;
  window.addEventListener('hashchange', () => {
    if (history.state && typeof history.state.idx === 'number') idx = history.state.idx;
    else { idx += 1; try { history.replaceState({ idx }, ''); } catch { /* */ } }
    state.canBack = idx > 0;
  });
  window.addEventListener('hashchange', handleRoute);
  deps.store.auth.onChange((session) => {
    const had = Boolean(state.user), has = Boolean(session);
    if (had !== has) { state.org = null; handleRoute(); }
  });
  return handleRoute();
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
  const isAuthRoute = m.route.view === 'auth';
  if (!state.user) {
    if (!isAuthRoute) { location.replace('#/login'); return; }
  } else if (isAuthRoute) {
    location.replace('#/'); return;
  }

  // strażnik: firma
  if (state.user) {
    if (!state.org) {
      try { state.org = await store.org.current(); } catch (e) { console.error(e); renderFatal(e); return; }
      if (seq !== state.navSeq) return;
    }
    if (!state.org && m.route.view !== 'onboarding') { location.replace('#/onboarding'); return; }
    if (state.org && m.route.view === 'onboarding') { location.replace('#/'); return; }
  }

  state.route = m.route; state.path = m.path;
  document.title = `${m.route.title} · Tekma`;

  const container = m.route.layout === 'shell' ? ensureShell() : ensureBare();
  if (m.route.layout === 'shell') { state.route = m.route; setHeader({ width: 'wide' }); }
  container.setAttribute('aria-busy', 'true');
  container.replaceChildren(ui.skeleton({ lines: 4 }));

  const ctx = {
    params: m.params, query: m.query, store, ui, ai: deps.ai, navigate,
    user: state.user, org: state.org, path: m.path, route: m.route,
    refreshShell: async () => { state.org = await store.org.current(); if (shellEl) updateShell(); return state.org; },
    setHeader: (opts) => setHeader(opts || {}),
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
  if (m.route.layout === 'shell') { updateShell(); syncTitleLevel(); }
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

/* ------------------------------------------------ układ: bare */
function ensureBare() {
  // Logowanie / rejestracja / reset: dwie kolumny (formularz + panel z podglądem produktu), jak w projekcie w Figmie.
  const split = Boolean(state.route && state.route.view === 'auth');
  const cur = root.firstElementChild;
  if (cur && cur.classList.contains('bare') && cur.classList.contains('auth-split') === split) {
    return root.querySelector('.bare-content');
  }
  shellEl = null; mainEl = null;
  const { h } = deps.ui;
  const content = h('div', { class: 'bare-content', style: 'width:100%;display:flex;flex-direction:column;align-items:center' });
  const bare = split
    ? h('div', { class: 'bare auth-split' },
        h('div', { class: 'auth-side' },
          h('div', { class: 'bare-logo' }, logo()),
          content,
          h('p', { class: 'auth-legal' }, '© 2026 Tekma · Dane przechowujemy w UE')),
        authShowcase())
    : h('div', { class: 'bare' }, h('div', { class: 'bare-logo' }, logo()), content);
  root.replaceChildren(bare);
  return content;
}

/** Prawa kolumna ekranów logowania: hasło produktu + kadr z karty oceny (ten sam zrzut co na stronie). */
function authShowcase() {
  const { h } = deps.ui;
  const src = new URL('../../assets/landing/scorecard-1x.webp', import.meta.url).href;
  return h('aside', { class: 'auth-showcase', 'aria-hidden': 'true' },
    h('h2', null, 'Zatrudniaj na podstawie tego, co kandydat naprawdę powiedział.'),
    h('p', null, 'Rubryki, notetaker AI i karty ocen w jednym miejscu. Po ofercie — plan pierwszych 90 dni.'),
    h('div', { class: 'auth-preview' }, h('img', { src, alt: '', decoding: 'async' })),
  );
}


/* ------------------------------------------------ wyszukiwarka i powiadomienia */
function runSearch() { if (deps && state.org) openSearch({ store: deps.store, ui: deps.ui, navigate }); }
function iconButton(name, label, onClick) {
  const b = deps.ui.h('button', { type: 'button', class: 'icon-btn', 'aria-label': label, title: label }, deps.ui.icon(name, 18));
  b.addEventListener('click', onClick);
  return b;
}
function searchButton() {
  const { h, icon } = deps.ui;
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || '');
  const b = h('button', { type: 'button', class: 'side-search', 'aria-label': 'Szukaj (skrót ' + (isMac ? '⌘K' : 'Ctrl K') + ')' }, icon('search', 16), h('span', null, 'Szukaj'), h('kbd', { class: 'kbd' }, isMac ? '⌘K' : 'Ctrl K'));
  b.addEventListener('click', runSearch);
  return b;
}
let notifState = { items: [], seen: new Set(), orgId: null };
function bellButton() {
  const { h, icon } = deps.ui;
  const b = h('button', { type: 'button', class: 'icon-btn bell', 'aria-label': 'Powiadomienia', title: 'Powiadomienia', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' }, icon('bell', 18), h('span', { class: 'bell-badge', hidden: true }));
  b.addEventListener('click', () => toggleNotifs(b));
  return b;
}
function paintBadges() {
  const n = notifState.items.filter((i) => !notifState.seen.has(i.key)).length;
  for (const el of document.querySelectorAll('.bell-badge')) { el.hidden = !n; el.textContent = n > 9 ? '9+' : String(n); }
  for (const b of document.querySelectorAll('.icon-btn.bell')) b.setAttribute('aria-label', n ? `Powiadomienia (${n} nowych)` : 'Powiadomienia');
}
let notifSeq = 0;
async function refreshNotifs() {
  if (!deps || !state.org) return;
  const seq = ++notifSeq, orgId = state.org.id;
  try {
    const items = await notif.collect(deps.store);
    if (seq !== notifSeq) return;
    notifState = { items, seen: notif.readSeen(orgId), orgId };
    paintBadges();
    const pop = document.querySelector('.notif-pop'); if (pop) fillNotifs(pop);
  } catch { /* powiadomienia są dodatkiem */ }
}
function fillNotifs(pop) {
  const { h, icon } = deps.ui;
  const body = pop.querySelector('.notif-body');
  const items = notifState.items;
  body.replaceChildren(...(items.length ? items.map((i) => {
    const a = h('a', { class: `notif-i ${i.tone}${notifState.seen.has(i.key) ? '' : ' is-new'}`, href: i.href }, h('i', { class: 'dot', 'aria-hidden': 'true' }), h('span', null, h('b', null, i.title), i.text ? h('small', null, i.text) : null));
    a.addEventListener('click', () => closeNotifs());
    return a;
  }) : [h('div', { class: 'notif-none' }, icon('check', 18), h('b', null, 'Nic pilnego'), h('small', null, 'Gdy coś będzie wymagało uwagi, zobaczysz to tutaj.'))]));
}
function closeNotifs() {
  const pop = document.querySelector('.notif-pop'); if (!pop) return;
  pop.remove(); document.removeEventListener('keydown', onNotifKey, true); document.removeEventListener('mousedown', onNotifOutside, true);
  for (const b of document.querySelectorAll('.icon-btn.bell')) b.setAttribute('aria-expanded', 'false');
  if (notifState.orgId) { notif.markSeen(notifState.orgId, notifState.items); notifState.seen = notif.readSeen(notifState.orgId); paintBadges(); }
}
const onNotifKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); const b = document.querySelector('.icon-btn.bell[aria-expanded="true"]'); closeNotifs(); if (b) b.focus(); } };
const onNotifOutside = (e) => { if (!e.target.closest('.notif-pop, .icon-btn.bell')) closeNotifs(); };
function toggleNotifs(btn) {
  if (document.querySelector('.notif-pop')) { closeNotifs(); return; }
  const { h } = deps.ui;
  const pop = h('div', { class: 'notif-pop', role: 'dialog', 'aria-label': 'Powiadomienia' }, h('div', { class: 'notif-h' }, h('b', null, 'Powiadomienia')), h('div', { class: 'notif-body' }));
  document.body.appendChild(pop);
  const r = btn.getBoundingClientRect(), w = Math.min(360, window.innerWidth - 24);
  pop.style.width = w + 'px';
  pop.style.left = Math.max(12, Math.min(window.innerWidth - w - 12, r.left)) + 'px';
  pop.style.top = (r.bottom + 8) + 'px';
  btn.setAttribute('aria-expanded', 'true');
  fillNotifs(pop);
  document.addEventListener('keydown', onNotifKey, true); document.addEventListener('mousedown', onNotifOutside, true);
  refreshNotifs();
}
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); runSearch(); }
  });
}

/* ------------------------------------------------ układ: shell */
function ensureShell() {
  if (shellEl && shellEl.isConnected) return mainEl.querySelector('.main-inner');
  const { h, icon } = deps.ui;
  const side = h('aside', { class: 'side', 'aria-label': 'Nawigacja' },
    h('div', { class: 'side-brand' }, logo(), bellButton()),
    searchButton(),
    h('nav', { class: 'side-nav', 'aria-label': 'Główna' },
      h('div', { class: 'grp' }, 'Rekrutacja'),
      NAV.main.map((n) => h('a', { href: n.href, 'data-nav': n.key }, icon(n.icon), n.label)),
      h('div', { class: 'grp' }, 'Po zatrudnieniu'),
      NAV.later.map((n) => h('a', { href: n.href, 'data-nav': n.key }, icon(n.icon), n.label)),
      h('div', { class: 'grp' }, 'Administracja'),
      NAV.admin.map((n) => h('a', { href: n.href, 'data-nav': n.key }, icon(n.icon), n.label)),
      h('div', { class: 'grp' }, 'Pomoc'),
      NAV.support.map((n) => h('a', { href: n.href, 'data-nav': n.key }, icon(n.icon), n.label)),
    ),
    h('div', { class: 'side-foot', 'data-slot': 'user' }),
  );
  const tabbar = h('nav', { class: 'tabbar', 'aria-label': 'Główna (mobile)' },
    NAV.main.map((n) => h('a', { href: n.href, 'data-nav': n.key }, icon(n.icon, 21), h('span', null, n.label))),
  );
  // Pasek górny (wspólny dla desktopu i mobile): okruszek/tytuł, akcje widoku, a na mobile także menu konta.
  const head = h('header', { class: 'main-head' },
    h('div', { class: 'title', 'data-slot': 'title' }),
    h('div', { class: 'actions', 'data-slot': 'actions' }),
    h('div', { class: 'head-user', 'data-slot': 'user-mobile' }),
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
 * Nagłówek nad treścią (pasek górny): tytuł, okruszki i akcja główna po prawej.
 * Widok wywołuje ctx.setHeader({ title, crumbs:[{label, href}], actions:[HTMLElement], width:'narrow'|'wide' }).
 * Bez wywołania pasek pokazuje tytuł trasy.
 */
function setHeader({ title, crumbs, actions, width } = {}) {
  if (!shellEl) return;
  const { h, icon } = deps.ui;
  const t = shellEl.querySelector('[data-slot="title"]');
  const a = shellEl.querySelector('[data-slot="actions"]');
  if (t) {
    const parts = [];
    const hasCrumbLink = (crumbs || []).some((c) => c.href);
    if (state.canBack && !hasCrumbLink && state.path !== '#/') {
      parts.push(h('button', { type: 'button', class: 'crumb back', 'aria-label': 'Wróć', title: 'Wróć', on: { click: () => history.back() } }, icon('arrow-left', 24)));
    }
    // Okruszek: na desktopie „Rodzic / Tytuł”, na mobile sam przycisk „wstecz” (strzałka) z etykietą dla czytników.
    for (const c of crumbs || []) {
      parts.push(c.href
        ? h('a', { class: 'crumb', href: c.href, 'aria-label': `Wróć: ${c.label}` }, icon('arrow-left', 18), h('span', null, c.label))
        : h('span', { class: 'crumb' }, h('span', null, c.label)));
      parts.push(h('span', { class: 'crumb-sep', 'aria-hidden': 'true' }, '/'));
    }
    parts.push(h('span', { class: 't' }, title || (state.route && state.route.title) || ''));
    t.replaceChildren(...parts);
    syncTitleLevel();
  }
  if (a) a.replaceChildren(...(actions || []).filter(Boolean));
  const inner = mainEl && mainEl.querySelector('.main-inner');
  if (inner && width) inner.classList.toggle('narrow', width === 'narrow');
}

/** Tytuł w pasku górnym jest <h1>, gdy widok nie ma własnego h1 w treści (jeden h1 na ekran). */
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
  refreshNotifs();
  const { h, avatar, icon } = deps.ui;
  const org = state.org, user = state.user;
  const userSlot = shellEl.querySelector('[data-slot="user"]');
  if (userSlot) {
    const btn = h('button', { type: 'button', class: 'user-btn', 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-label': 'Menu konta' },
      avatar(user ? user.name : ''),
      h('div', { class: 't' }, h('strong', null, user ? (user.name || user.email) : ''), h('small', null, org ? org.name : '')),
      icon('more'),
    );
    btn.addEventListener('click', () => openUserMenu(btn, userSlot));
    userSlot.replaceChildren(btn);
  }
  const userMobile = shellEl.querySelector('[data-slot="user-mobile"]');
  if (userMobile) {
    // mobile: awatar w pasku górnym (jak w aplikacji ChatGPT) otwiera to samo menu konta
    const btn = h('button', { type: 'button', class: 'head-av', 'aria-label': 'Menu konta', 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, avatar(user ? user.name : ''));
    btn.addEventListener('click', () => openUserMenu(btn, userMobile));
    userMobile.replaceChildren(iconButton('search', 'Szukaj', () => runSearch()), bellButton(), btn);
  }
  const active = state.route && state.route.nav;
  for (const a of shellEl.querySelectorAll('[data-nav]')) {
    const on = a.dataset.nav === active;
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
}

/** Wyskakujące menu konta (jak w ChatGPT): firma i rola, Ustawienia „Wkrótce”, Wyloguj się. */
function openUserMenu(trigger, host) {
  const { h, icon, avatar } = deps.ui;
  if (host.querySelector('.popover')) { closeUserMenu(host, trigger); return; }
  const org = state.org, user = state.user;
  const item = (label, iconName, { onClick, disabled, soon } = {}) => {
    const el = h('button', { type: 'button', role: 'menuitem', 'aria-disabled': disabled ? 'true' : null, tabindex: disabled ? '-1' : '0' },
      icon(iconName), label, soon ? h('em', null, 'Wkrótce') : null);
    if (onClick && !disabled) el.addEventListener('click', onClick);
    return el;
  };
  const pop = h('div', { class: 'popover up', role: 'menu', 'aria-label': 'Konto' },
    h('div', { class: 'pop-head' }, avatar(user ? user.name : ''), h('div', { class: 't' },
      h('strong', null, user ? (user.name || user.email) : ''), h('small', null, user ? user.email : ''))),
    h('hr'),
    h('div', { class: 'pop-head' }, deps.ui.orgAvatar(org, 'sm'),
      h('div', { class: 't' }, h('strong', null, org ? org.name : '—'), h('small', null, org ? (ROLE_LABEL[org.role] || org.role) : ''))),
    h('hr'),
    themeRow(),
    h('hr'),
    ...[['Ludzie', 'user', '#/people'], ['Cele', 'target', '#/goals'], ['Feedback', 'message', '#/feedback']].map(([label, ic, href]) => {
      const el = item(label, ic, { onClick: () => { closeUserMenu(host, trigger); navigate(href); } });
      el.classList.add('only-mobile'); return el;
    }),
    item('Ustawienia', 'settings', { onClick: () => { closeUserMenu(host, trigger); navigate('#/settings'); } }),
    item('Wyloguj się', 'logout', { onClick: () => { closeUserMenu(host, trigger); signOut(); } }),
  );
  host.appendChild(pop);
  trigger.setAttribute('aria-expanded', 'true');
  const items = () => Array.from(pop.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])'));
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeUserMenu(host, trigger); trigger.focus(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const list = items(); const i = list.indexOf(document.activeElement);
      const next = e.key === 'ArrowDown' ? (i + 1) % list.length : (i - 1 + list.length) % list.length;
      list[next].focus();
    }
    if (e.key === 'Tab') closeUserMenu(host, trigger);
  };
  const onDoc = (e) => { if (!host.contains(e.target)) closeUserMenu(host, trigger); };
  pop._cleanup = () => { document.removeEventListener('keydown', onKey, true); document.removeEventListener('mousedown', onDoc, true); };
  document.addEventListener('keydown', onKey, true);
  setTimeout(() => document.addEventListener('mousedown', onDoc, true), 0);
  const first = items()[0]; if (first) first.focus();
}
/* Motyw: 'light' | 'dark' | 'system' — zapisany w localStorage (tekma.theme), ustawiany na <html data-theme>. */
const THEME_KEY = 'tekma.theme';
export function getTheme() { try { return localStorage.getItem(THEME_KEY) || 'system'; } catch { return 'system'; } }
export function applyTheme(t) {
  const el = document.documentElement;
  if (t === 'light' || t === 'dark') el.setAttribute('data-theme', t); else el.removeAttribute('data-theme');
  try { if (t === 'system') localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, t); } catch {}
}
function themeRow() {
  const { h, icon } = deps.ui;
  const cur = getTheme();
  const seg = h('div', { class: 'theme-seg', role: 'radiogroup', 'aria-label': 'Motyw' });
  for (const [val, label, ic] of [['light', 'Jasny', 'sun'], ['dark', 'Ciemny', 'moon'], ['system', 'System', 'monitor']]) {
    const b = h('button', { type: 'button', role: 'radio', 'aria-pressed': String(cur === val), 'aria-checked': String(cur === val), 'aria-label': label, title: label }, icon(ic, 16));
    b.addEventListener('click', () => { applyTheme(val); seg.querySelectorAll('button').forEach(x => { const on = x === b; x.setAttribute('aria-pressed', String(on)); x.setAttribute('aria-checked', String(on)); }); });
    seg.appendChild(b);
  }
  return h('div', { class: 'theme-row' }, h('span', null, 'Motyw'), seg);
}
function closeUserMenu(host, trigger) {
  const pop = host.querySelector('.popover');
  if (!pop) return;
  if (pop._cleanup) pop._cleanup();
  pop.remove();
  trigger.setAttribute('aria-expanded', 'false');
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

export default { startRouter, navigate, matchRoute, ROUTES };
