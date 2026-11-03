/**
 * router.js — router po hashu, strażnik sesji/firmy, szkielet z paskiem bocznym, ładowanie widoków.
 *
 * API:
 *   startRouter({ store, ui, ai })   — uruchamia nasłuch hashchange i pierwszą nawigację
 *   navigate(hash)                   — zmiana trasy (np. '#/positions/abc')
 *   ROUTES                           — tabela tras (pattern → view, layout, title)
 *
 * Widok: views/<view>.js eksportuje `default async function render(ctx) -> HTMLElement`.
 *   ctx = { params, query, store, ui, ai, navigate, user, org, refreshShell, path, route }
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
  { pattern: '#/positions/:id', view: 'pipeline', layout: 'shell', title: 'Lejek', nav: 'positions' },
  { pattern: '#/candidates', view: 'candidates', layout: 'shell', title: 'Kandydaci', nav: 'candidates' },
  { pattern: '#/candidates/:id', view: 'scorecard', layout: 'shell', title: 'Karta oceny', nav: 'candidates' },
  { pattern: '#/rubrics', view: 'rubrics', layout: 'shell', title: 'Rubryki', nav: 'rubrics' },
  { pattern: '#/rubrics/:id', view: 'rubrics', layout: 'shell', title: 'Rubryka', nav: 'rubrics' },
];

const NAV = {
  main: [
    { key: 'dashboard', label: 'Pulpit', href: '#/', icon: 'dashboard' },
    { key: 'positions', label: 'Stanowiska', href: '#/positions', icon: 'briefcase' },
    { key: 'rubrics', label: 'Rubryki', href: '#/rubrics', icon: 'rubric' },
    { key: 'candidates', label: 'Kandydaci', href: '#/candidates', icon: 'users' },
  ],
  later: [
    { label: 'Ludzie', icon: 'user' },
    { label: 'Cele', icon: 'target' },
  ],
  admin: [
    { label: 'Ustawienia', icon: 'settings' },
  ],
};
const ROLE_LABEL = { owner: 'Właściciel', recruiter: 'Rekruter', interviewer: 'Rozmówca' };

const LOGO_PATHS = '<path d="M3 6H17.5V22.5L12.5 28V12H3Z"/><path d="M20 6H29L20 12.5Z"/>';

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
  container.setAttribute('aria-busy', 'true');
  container.replaceChildren(ui.skeleton({ lines: 4 }));

  const ctx = {
    params: m.params, query: m.query, store, ui, ai: deps.ai, navigate,
    user: state.user, org: state.org, path: m.path, route: m.route,
    refreshShell: async () => { state.org = await store.org.current(); if (shellEl) updateShell(); return state.org; },
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
  if (m.route.layout === 'shell') updateShell();
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
    const first = container.querySelector('h1');
    if (first) { first.setAttribute('tabindex', '-1'); first.focus({ preventScroll: true }); }
  }
}

/* ------------------------------------------------ układ: bare */
function ensureBare() {
  if (root.firstElementChild && root.firstElementChild.classList.contains('bare')) {
    return root.querySelector('.bare-content');
  }
  shellEl = null; mainEl = null;
  const { h } = deps.ui;
  const content = h('div', { class: 'bare-content', style: 'width:100%;display:flex;flex-direction:column;align-items:center' });
  const bare = h('div', { class: 'bare' }, h('div', { class: 'bare-logo' }, logo()), content);
  root.replaceChildren(bare);
  return content;
}

/* ------------------------------------------------ układ: shell */
function ensureShell() {
  if (shellEl && shellEl.isConnected) return mainEl.querySelector('.main-inner');
  const { h, icon, button } = deps.ui;
  const side = h('aside', { class: 'side', 'aria-label': 'Nawigacja' },
    h('div', { class: 'side-brand' }, logo()),
    h('div', { class: 'side-org', 'data-slot': 'org' }),
    h('nav', { class: 'side-nav', 'aria-label': 'Główna' },
      h('div', { class: 'grp' }, 'Rekrutacja'),
      NAV.main.map((n) => h('a', { href: n.href, 'data-nav': n.key }, icon(n.icon), n.label)),
      h('div', { class: 'grp' }, 'Po zatrudnieniu'),
      NAV.later.map((n) => h('span', { class: 'nav-soon', 'aria-disabled': 'true', title: 'Ten moduł pojawi się wkrótce' }, icon(n.icon), n.label, h('em', null, 'Wkrótce'))),
      h('div', { class: 'grp' }, 'Administracja'),
      NAV.admin.map((n) => h('span', { class: 'nav-soon', 'aria-disabled': 'true', title: 'Ten moduł pojawi się wkrótce' }, icon(n.icon), n.label, h('em', null, 'Wkrótce'))),
    ),
    h('div', { class: 'side-user', 'data-slot': 'user' }),
  );
  const topbar = h('header', { class: 'topbar' },
    logo('logo sm'),
    h('div', { class: 'org', 'data-slot': 'org-mobile' }),
    button({ icon: 'logout', variant: 'ghost', size: 'sm', title: 'Wyloguj się', onClick: signOut }),
  );
  const tabbar = h('nav', { class: 'tabbar', 'aria-label': 'Główna (mobile)' },
    NAV.main.map((n) => h('a', { href: n.href, 'data-nav': n.key }, icon(n.icon, 21), h('span', null, n.label))),
  );
  mainEl = h('main', { class: 'main', id: 'main', tabindex: '-1' },
    deps.store.mode === 'demo' ? demoBanner() : null,
    h('div', { class: 'main-inner' }),
  );
  shellEl = h('div', { class: 'shell' }, side, h('div', { class: 'main-col' }, topbar, mainEl, tabbar));
  root.replaceChildren(shellEl);
  updateShell();
  return mainEl.querySelector('.main-inner');
}

export function demoBanner() {
  const { h, icon } = deps.ui;
  return h('div', { class: 'demo-banner', role: 'note' }, icon('info'),
    h('span', null, h('b', null, 'Tryb demo: '), 'dane zostają tylko w tej przeglądarce. Nic nie wysyłamy na serwer.'));
}

function updateShell() {
  if (!shellEl) return;
  const { h, avatar, button, initials } = deps.ui;
  const org = state.org, user = state.user;
  const orgSlot = shellEl.querySelector('[data-slot="org"]');
  const orgMobile = shellEl.querySelector('[data-slot="org-mobile"]');
  if (orgSlot) orgSlot.replaceChildren(
    h('b', { 'aria-hidden': 'true' }, org ? initials(org.name).slice(0, 1) : '?'),
    h('div', { class: 't' }, h('strong', null, org ? org.name : '—'), h('small', null, org ? (ROLE_LABEL[org.role] || org.role) : '')),
  );
  if (orgMobile) orgMobile.replaceChildren(h('b', { 'aria-hidden': 'true' }, org ? initials(org.name).slice(0, 1) : '?'), h('span', null, org ? org.name : ''));
  const userSlot = shellEl.querySelector('[data-slot="user"]');
  if (userSlot) userSlot.replaceChildren(
    avatar(user ? user.name : ''),
    h('div', { class: 't' }, h('strong', null, user ? (user.name || user.email) : ''), h('small', null, user ? user.email : '')),
    button({ icon: 'logout', variant: 'ghost', size: 'sm', title: 'Wyloguj się', onClick: signOut }),
  );
  const active = state.route && state.route.nav;
  for (const a of shellEl.querySelectorAll('[data-nav]')) {
    const on = a.dataset.nav === active;
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
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
    h('div', { class: 'glyph' }, icon('construction', 20)),
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
