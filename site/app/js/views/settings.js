/**
 * views/settings.js — Ustawienia (#/settings?tab=firma|zespol|integracje|plan), 1:1 z Figmą:
 * 36 · Firma (31:4384), 37 · Zespół i uprawnienia (31:4585), 38 · Integracje (31:4872), 39 · Plan i płatności (31:5113).
 * Piąta zakładka „RODO i AI Act” prowadzi do #/compliance (osobny widok).
 *
 * Dane: views/settings-data.js (localStorage `tekma.demo.settings`). Nazwę firmy zapisujemy dodatkowo przez
 * store.org.update({name}), jeśli adapter to udostępnia (w kontrakcie v1 go nie ma — wtedy tylko dane demo).
 * Role: model z kontraktu (owner/recruiter/interviewer) z etykietami z Figmy (Admin/Rekrutacja/Rozmówca);
 * Menedżer i Rekruter zewn. to wiersze demo spoza modelu bazy — nie da się ich nadać w zaproszeniu.
 *
 * export default async function render(ctx) -> HTMLElement
 */

import { settings, ROLES, ROLE_INFO, ROLE_LABEL, uid } from './settings-data.js';
import { kbtn, kicon, badge, toggle, panel, dropdown, loadKitCss, ago } from './admin-kit.js';

const TABS = [
  { key: 'firma', label: 'Firma' },
  { key: 'zespol', label: 'Zespół i uprawnienia' },
  { key: 'integracje', label: 'Integracje' },
  { key: 'plan', label: 'Plan i płatności' },
];
const LOGO_COLORS = ['info', 'good', 'warn', 'bad', 'ink'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default async function render(ctx) {
  const { h, modal, toast, confirm, field, plural, initials } = ctx.ui;
  await Promise.all([loadKitCss(), ctx.ui.loadCss(new URL('./settings.css', import.meta.url))]);
  ctx.setHeader({ title: 'Ustawienia', width: 'wide' });

  let tab = TABS.some((t) => t.key === ctx.query.tab) ? ctx.query.tab : 'firma';
  const root = h('div', { class: 'e-root st' });
  const tabsEl = h('div', { class: 'e-tabs', role: 'tablist', 'aria-label': 'Ustawienia' });
  const body = h('div', { class: 'st-body' });
  root.append(tabsEl, body);

  function renderTabs() {
    tabsEl.replaceChildren(
      ...TABS.map((t) => h('button', {
        type: 'button', class: 'e-tab', role: 'tab', id: `st-tab-${t.key}`,
        'aria-selected': t.key === tab ? 'true' : 'false', 'aria-controls': 'st-panel', tabindex: t.key === tab ? '0' : '-1',
        on: { click: () => setTab(t.key), keydown: onTabKey },
      }, t.label)),
      h('a', { class: 'e-tab', href: '#/compliance', role: 'tab', 'aria-selected': 'false', tabindex: '-1', on: { keydown: onTabKey } }, 'RODO i AI Act'),
    );
  }
  function onTabKey(e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const list = Array.from(tabsEl.querySelectorAll('[role="tab"]'));
    const i = list.indexOf(document.activeElement);
    const next = list[(i + (e.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length];
    e.preventDefault(); next.focus();
  }
  function setTab(key) {
    tab = key;
    try { history.replaceState(null, '', `#/settings${key === 'firma' ? '' : '?tab=' + key}`); } catch { /* bez znaczenia */ }
    renderTabs(); renderBody();
  }
  function renderBody() {
    body.setAttribute('role', 'tabpanel'); body.id = 'st-panel'; body.setAttribute('aria-labelledby', `st-tab-${tab}`);
    body.replaceChildren(({ firma: renderCompany, zespol: renderTeam, integracje: renderIntegrations, plan: renderPlan })[tab]());
  }

  /* ================================================================ Firma */
  function renderCompany() {
    const s = settings.get();
    const c = s.company;

    const logo = h('div', { class: `st-logo tone-${c.logoColor}`, 'aria-hidden': 'true' });
    const logoBtn = kbtn({ label: 'Zmień logo', onClick: () => {
      const next = LOGO_COLORS[(LOGO_COLORS.indexOf(c.logoColor) + 1) % LOGO_COLORS.length];
      c.logoColor = next; logo.className = `st-logo tone-${next}`;
      settings.update((st) => { st.company.logoColor = next; });
      toast('Kolor logo zmieniony. W demo nie wysyłamy plików.', 'neutral');
    } });

    const fName = inputField({ label: 'Nazwa firmy', value: c.name, name: 'name', required: true });
    const fWww = inputField({ label: 'Strona www', value: c.website, name: 'website', placeholder: 'np. firma.pl' });
    const fDesc = inputField({ label: 'Opis (AI używa go do szkiców)', value: c.description, name: 'description', hint: 'AI używa opisu w szkicach ogłoszeń i wiadomości. Nigdy nie ocenia nim kandydatów.' });
    const fLang = inputField({ label: 'Język interfejsu', value: c.language, name: 'language', type: 'select', options: ['Polski', 'English', 'Deutsch'] });
    const fTz = inputField({ label: 'Strefa czasowa', value: c.timezone, name: 'timezone', type: 'select', options: ['Europa/Warszawa', 'Europa/Berlin', 'Europa/Londyn', 'Europa/Lizbona', 'UTC'] });

    const saveBtn = kbtn({ label: 'Zapisz zmiany', variant: 'primary', type: 'submit' });
    const form = h('form', { class: 'st-profile e-panel', novalidate: true, on: { submit: async (e) => {
      e.preventDefault();
      const name = fName.input.value.trim();
      if (name.length < 2) { fName.setError('Podaj nazwę firmy (co najmniej 2 znaki).'); fName.input.focus(); return; }
      fName.setError('');
      saveBtn.setBusy(true);
      try {
        settings.update((st) => { Object.assign(st.company, { name, website: fWww.input.value.trim(), description: fDesc.input.value.trim(), language: fLang.input.value, timezone: fTz.input.value }); });
        if (ctx.store.org && typeof ctx.store.org.update === 'function' && ctx.org && ctx.org.name !== name) {
          await ctx.store.org.update({ name });
          if (ctx.refreshShell) await ctx.refreshShell();
        }
        toast('Zapisaliśmy zmiany.', 'good');
      } catch (err) {
        toast(err.message || 'Nie udało się zapisać zmian.', 'bad');
      } finally { saveBtn.setBusy(false); }
    } } },
      h('div', { class: 'st-logo-row' }, logo, logoBtn),
      fName, fWww, fDesc,
      h('div', { class: 'e-row' }, fLang, fTz),
      h('div', { class: 'e-actions' }, saveBtn),
    );

    /* --- Strona kariery --- */
    const url = h('button', { type: 'button', class: 'st-url', title: 'Kopiuj adres', on: { click: async () => {
      try { await navigator.clipboard.writeText('https://' + c.careers.url); toast('Skopiowaliśmy adres strony kariery.', 'good'); }
      catch { toast('Nie udało się skopiować. Zaznacz adres i skopiuj ręcznie.', 'warn'); }
    } } }, kicon('globe'), h('span', null, c.careers.url));
    const opt = (label, key) => h('div', { class: 'st-opt' }, h('span', { id: `st-opt-${key}` }, label),
      toggle({ checked: Boolean(c.careers[key]), label, onChange: (v) => {
        settings.update((st) => { st.company.careers[key] = v; });
        const msg = { useCustomDomain: v ? `Własna domena włączona: ${c.careers.customDomain}. Dodaj rekord CNAME u operatora domeny.` : 'Strona kariery działa pod adresem Tekmy.', showSalary: v ? 'Widełki płacowe widoczne w ogłoszeniach.' : 'Widełki płacowe ukryte.', english: v ? 'Wersja angielska włączona.' : 'Wersja angielska wyłączona.' }[key];
        toast(msg, 'neutral');
      } }));
    const careers = panel({ title: 'Strona kariery', id: 'st-careers', body: h('div', { class: 'st-careers' },
      url,
      opt(`Własna domena (${c.careers.customDomain})`, 'useCustomDomain'),
      opt('Pokaż widełki płacowe', 'showSalary'),
      opt('Wersja angielska', 'english'),
    ) });

    /* --- Wartości firmy --- */
    const valuesList = h('div', { class: 'st-values' });
    const drawValues = () => valuesList.replaceChildren(...(c.values.length ? c.values.map((v) => h('p', null, `• ${v}`)) : [h('p', { class: 'e-muted' }, 'Brak wartości. Dodaj je, żeby AI używało ich w ogłoszeniach.')]));
    drawValues();
    const editBtn = h('button', { type: 'button', class: 'link', on: { click: () => {
      const ta = field({ label: 'Wartości (jedna w wierszu)', name: 'values', type: 'textarea', value: c.values.join('\n'), rows: 5 });
      const m = modal({ title: 'Wartości firmy', body: h('div', null, h('p', null, 'Pokazujemy je na stronie kariery. AI używa ich w szkicach ogłoszeń.'), ta),
        actions: [
          { label: 'Anuluj', variant: 'secondary', onClick: () => m.close() },
          { label: 'Zapisz zmiany', variant: 'primary', onClick: () => {
            c.values = ta.value.split('\n').map((x) => x.trim().replace(/^[•\-–]\s*/, '')).filter(Boolean);
            settings.update((st) => { st.company.values = c.values; });
            drawValues(); m.close(); toast('Zapisaliśmy wartości firmy.', 'good');
          } },
        ] });
    } } }, 'Edytuj');
    const values = panel({ title: 'Wartości firmy', id: 'st-values', aside: editBtn, body: valuesList });

    return h('div', { class: 'e-cols' }, form, h('div', { class: 'e-col' }, careers, values));
  }

  /** Pole w stylu Figmy (biały, linia 1 px). el.input, el.setError(msg). */
  function inputField({ label, value, name, type = 'text', options, placeholder, required, hint }) {
    const id = `st-f-${name}`;
    const input = type === 'select'
      ? h('select', { id, name }, options.map((o) => h('option', { value: o, selected: o === value }, o)))
      : h('input', { id, name, type, value, placeholder, required, autocomplete: 'off' });
    const err = h('div', { class: 'st-err', role: 'alert' });
    const el = h('div', { class: 'e-field' }, h('label', { htmlFor: id }, label), input, hint ? h('div', { class: 'e-caption' }, hint) : null, err);
    el.input = input;
    el.setError = (msg) => { err.textContent = msg || ''; el.classList.toggle('has-error', Boolean(msg)); input.setAttribute('aria-invalid', msg ? 'true' : 'false'); };
    return el;
  }

  /* ================================================================ Zespół i uprawnienia */
  function renderTeam() {
    const wrap = h('div', { class: 'st-team' });
    const draw = () => {
      const s = settings.get();
      const members = s.members, invites = s.invites;
      const me = ctx.user && ctx.user.email ? String(ctx.user.email).toLowerCase() : '';
      const owners = members.filter((m) => m.role === 'owner').length;

      const bar = h('div', { class: 'st-bar' },
        h('p', { class: 'e-muted' }, `${plural(members.length, 'osoba', 'osoby', 'osób')} · bez limitu miejsc${invites.length ? ` · ${plural(invites.length, 'zaproszenie', 'zaproszenia', 'zaproszeń')} czeka` : ''}`),
        kbtn({ label: 'Zaproś osobę', variant: 'primary', onClick: () => openInvite(draw) }),
      );

      const head = h('div', { class: 'st-trow head', role: 'row' },
        h('span', { role: 'columnheader' }, 'Osoba'), h('span', { role: 'columnheader' }, 'Rola'), h('span', { role: 'columnheader' }, 'Dostęp'), h('span', { role: 'columnheader' }, 'Ostatnio'), h('span', { role: 'columnheader' }, h('span', { class: 'sr-only' }, 'Akcje')));

      const rowEl = (m) => {
        const isMe = me && m.email.toLowerCase() === me;
        const menuHost = h('div', { class: 'st-menu-host' });
        const more = h('button', { type: 'button', class: 'e-more', 'aria-label': `Więcej: ${m.name}`, 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, kicon('more'));
        more.addEventListener('click', () => openMenu(more, menuHost, memberMenu(m, { owners, isMe })));
        menuHost.append(more);
        return h('div', { class: 'st-trow', role: 'row' },
          h('div', { class: 'st-who', role: 'cell' }, h('span', { class: 'e-av s32', 'aria-hidden': 'true' }, initials(m.name)),
            h('div', { class: 't' }, h('b', null, m.name, isMe ? h('em', null, ' (Ty)') : null), h('small', null, m.email))),
          h('div', { role: 'cell' }, h('span', { class: 'st-role' }, ROLE_LABEL[m.role] || m.role)),
          h('div', { class: 'st-access', role: 'cell' }, m.access),
          h('div', { class: 'st-last', role: 'cell' }, ago(m.last_seen)),
          h('div', { class: 'st-more', role: 'cell' }, menuHost),
        );
      };
      const inviteEl = (inv) => {
        const menuHost = h('div', { class: 'st-menu-host' });
        const more = h('button', { type: 'button', class: 'e-more', 'aria-label': `Więcej: ${inv.email}`, 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, kicon('more'));
        more.addEventListener('click', () => openMenu(more, menuHost, inviteMenu(inv)));
        menuHost.append(more);
        return h('div', { class: 'st-trow is-invite', role: 'row' },
          h('div', { class: 'st-who', role: 'cell' }, h('span', { class: 'e-av s32', 'aria-hidden': 'true' }, kicon('mail', 14)),
            h('div', { class: 't' }, h('b', null, inv.email), h('small', null, `Zaproszenie wysłane ${ago(inv.sent_at)}`))),
          h('div', { role: 'cell' }, h('span', { class: 'st-role' }, ROLE_LABEL[inv.role])),
          h('div', { class: 'st-access', role: 'cell' }, badge('Oczekuje', 'neutral')),
          h('div', { class: 'st-last', role: 'cell' }, '—'),
          h('div', { class: 'st-more', role: 'cell' }, menuHost),
        );
      };
      const table = h('div', { class: 'e-panel st-table', role: 'table', 'aria-label': 'Członkowie zespołu' }, head, members.map(rowEl), invites.map(inviteEl));

      const roles = panel({ title: 'Co widzi każda rola', id: 'st-roles', body: h('div', { class: 'st-roles' },
        ROLE_INFO.map((r) => h('div', { class: 'st-role-tile' }, h('b', null, r.label), h('small', null, r.desc)))) });

      wrap.replaceChildren(bar, table, roles);

      function memberMenu(m, { owners, isMe }) {
        const items = [];
        for (const r of ROLES) {
          if (r.key === m.role) continue;
          items.push({ label: `Zmień rolę: ${r.label}`, icon: 'user', onClick: () => {
            if (m.role === 'owner' && owners <= 1) { toast('Firma musi mieć co najmniej jednego Admina.', 'warn'); return; }
            settings.update((st) => { const x = st.members.find((y) => y.id === m.id); if (x) { x.role = r.key; x.access = r.access; } });
            toast(`${m.name}: rola ${r.label}.`, 'good'); draw();
          } });
        }
        items.push({ hr: true });
        items.push({ label: isMe ? 'Opuść firmę' : 'Usuń z firmy', icon: 'trash', danger: true, onClick: async () => {
          if (m.role === 'owner' && owners <= 1) { toast('Nie możesz usunąć ostatniego Admina. Najpierw nadaj tę rolę komuś innemu.', 'warn'); return; }
          const ok = await confirm({ title: `Usunąć ${m.name} z firmy?`, text: 'Osoba straci dostęp do stanowisk, kandydatów i kart ocen. Jej oceny zostają w historii.', confirmLabel: 'Usuń', danger: true });
          if (!ok) return;
          settings.update((st) => { st.members = st.members.filter((y) => y.id !== m.id); });
          toast(`${m.name} nie ma już dostępu.`, 'neutral'); draw();
        } });
        return items;
      }
      function inviteMenu(inv) {
        return [
          { label: 'Wyślij ponownie', icon: 'mail', onClick: () => { settings.update((st) => { const x = st.invites.find((y) => y.id === inv.id); if (x) x.sent_at = new Date().toISOString(); }); toast(`Wysłaliśmy zaproszenie ponownie: ${inv.email}.`, 'good'); draw(); } },
          { hr: true },
          { label: 'Anuluj zaproszenie', icon: 'x', danger: true, onClick: () => { settings.update((st) => { st.invites = st.invites.filter((y) => y.id !== inv.id); }); toast('Zaproszenie anulowane.', 'neutral'); draw(); } },
        ];
      }
    };
    draw();
    return wrap;
  }

  function openMenu(trigger, host, items) {
    const existing = host.querySelector('.e-menu');
    if (existing) { closeMenu(host, trigger); return; }
    const menu = h('div', { class: 'e-menu', role: 'menu' }, items.map((it) => it.hr ? h('hr') : h('button', { type: 'button', role: 'menuitem', class: it.danger ? 'danger' : null, on: { click: () => { closeMenu(host, trigger); it.onClick(); } } }, kicon(it.icon), it.label)));
    host.append(menu); trigger.setAttribute('aria-expanded', 'true');
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closeMenu(host, trigger); trigger.focus(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); const list = Array.from(menu.querySelectorAll('[role="menuitem"]')); const i = list.indexOf(document.activeElement);
        list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length].focus();
      }
      if (e.key === 'Tab') closeMenu(host, trigger);
    };
    const onDoc = (e) => { if (!host.contains(e.target)) closeMenu(host, trigger); };
    menu._cleanup = () => { document.removeEventListener('keydown', onKey, true); document.removeEventListener('mousedown', onDoc, true); };
    document.addEventListener('keydown', onKey, true);
    setTimeout(() => document.addEventListener('mousedown', onDoc, true), 0);
    const first = menu.querySelector('[role="menuitem"]'); if (first) first.focus();
  }
  function closeMenu(host, trigger) {
    const menu = host.querySelector('.e-menu'); if (!menu) return;
    if (menu._cleanup) menu._cleanup(); menu.remove(); trigger.setAttribute('aria-expanded', 'false');
  }

  function openInvite(onDone) {
    const fEmail = field({ label: 'Adres e-mail', name: 'email', type: 'email', placeholder: 'np. marta@nordlight.io', required: true, autocomplete: 'off' });
    const fRole = field({ label: 'Rola', name: 'role', type: 'select', value: 'recruiter', options: ROLES.map((r) => ({ value: r.key, label: `${r.label} — ${r.desc}` })) });
    const fNote = field({ label: 'Wiadomość (opcjonalnie)', name: 'note', type: 'textarea', rows: 3, placeholder: 'Cześć! Dołącz do Tekmy, żeby oceniać kandydatów razem z nami.' });
    const submit = ctx.ui.button({ label: 'Wyślij zaproszenie', variant: 'primary' });
    const form = h('form', { novalidate: true, on: { submit: (e) => {
      e.preventDefault();
      const email = fEmail.value.trim().toLowerCase();
      if (!EMAIL_RE.test(email)) { fEmail.setError('Ten adres e-mail wygląda na niepoprawny. Sprawdź znak @ i domenę.'); fEmail.input.focus(); return; }
      const s = settings.get();
      if (s.members.some((m) => m.email.toLowerCase() === email)) { fEmail.setError('Ta osoba jest już w zespole.'); return; }
      if (s.invites.some((i) => i.email === email)) { fEmail.setError('Zaproszenie do tej osoby już czeka. Możesz je wysłać ponownie z listy.'); return; }
      settings.update((st) => { st.invites.push({ id: uid(), email, role: fRole.value, note: fNote.value.trim(), sent_at: new Date().toISOString() }); });
      m.close(); toast(`Wysłaliśmy zaproszenie: ${email} (${ROLE_LABEL[fRole.value]}). W demo nie wysyłamy e-maili.`, 'good');
      onDone();
    } } }, fEmail, fRole, fNote, h('p', { class: 'e-caption' }, 'Zaproszenie jest ważne 7 dni. Rolę możesz zmienić później z listy zespołu.'));
    submit.addEventListener('click', () => form.requestSubmit());
    const m = modal({ title: 'Zaproś osobę', body: form, actions: [ctx.ui.button({ label: 'Anuluj', variant: 'secondary', onClick: () => m.close() }), submit] });
  }

  /* ================================================================ Integracje */
  function renderIntegrations() {
    const grid = h('div', { class: 'st-grid' });
    const draw = () => {
      const s = settings.get();
      grid.replaceChildren(...s.integrations.map((it) => {
        const connectedLabel = it.connectedLabel || 'Połączono';
        const right = it.connected
          ? h('button', { type: 'button', class: 'e-badge good', title: `Rozłącz: ${it.name}`, 'aria-label': `${connectedLabel}: ${it.name}. Rozłącz`, on: { click: () => disconnect(it) } }, connectedLabel)
          : kbtn({ label: it.action, size: 'sm', onClick: () => connect(it), attrs: { 'aria-label': `${it.action}: ${it.name}` } });
        return h('div', { class: 'e-card st-int' },
          h('div', { class: 'st-int-top' }, h('span', { class: 'st-int-ico', 'aria-hidden': 'true' }, kicon(it.icon)), h('span', { class: 'spacer' }), right),
          h('b', null, it.name), h('small', null, it.desc));
      }));
    };
    const connect = async (it) => {
      if (it.key === 'ats') {
        const fSrc = field({ label: 'Źródło', name: 'src', type: 'select', value: 'Greenhouse', options: ['Greenhouse', 'Lever', 'Ashby', 'Plik CSV'] });
        const m = modal({ title: 'Import z ATS', body: h('div', null, h('p', null, 'Przeniesiemy stanowiska i kandydatów z Twojego ATS. Dopasowanie CV policzymy od nowa — jako sugestię AI, nie ocenę.'), fSrc),
          actions: [{ label: 'Anuluj', variant: 'secondary', onClick: () => m.close() }, { label: 'Rozpocznij import', variant: 'primary', onClick: () => { m.close(); mark(it, true); toast(`Import z ${fSrc.value} w kolejce. W demo dane się nie zmienią.`, 'good'); } }] });
        return;
      }
      const text = {
        outlook: 'Poprosimy Microsoft o dostęp do kalendarza, poczty i nagrań spotkań Teams. Notetaker dołączy tylko do rozmów, na które kandydat wyraził zgodę.',
        slack: 'Tekma wyśle do wybranego kanału powiadomienia o nowych ocenach, rozbieżnościach i zaległych 1:1.',
        linkedin: 'Wtyczka dodaje przycisk „Dodaj do Tekmy” na profilach LinkedIn. Nie pobiera danych bez Twojego kliknięcia.',
        zoom: 'Poprosimy Zoom o dostęp do nagrań. Notetaker dołączy tylko do rozmów z zaznaczoną zgodą kandydata.',
        stripe: 'Połączenie konta Stripe pozwala rozliczać rekruterów z marketplace automatycznie.',
        gcal: 'Poprosimy Google o dostęp do kalendarza, żeby notetaker dołączał do rozmów.',
        gmail: 'Poprosimy Google o dostęp do poczty, żeby wiadomości do kandydatów trafiały do jednego wątku.',
        claude: 'Udostępnimy Claude serwer MCP z odczytem kandydatów i lejków. Bez zapisu i bez decyzji.',
      }[it.key] || '';
      const ok = await confirm({ title: `${it.action}: ${it.name}`, text, confirmLabel: it.action });
      if (ok) { mark(it, true); toast(`${it.name}: ${(it.connectedLabel || 'połączono').toLowerCase()}.`, 'good'); }
    };
    const disconnect = async (it) => {
      const ok = await confirm({ title: `Rozłączyć ${it.name}?`, text: 'Możesz połączyć ponownie w każdej chwili. Dane już zaimportowane zostają.', confirmLabel: 'Rozłącz', danger: true });
      if (ok) { mark(it, false); toast(`${it.name}: rozłączono.`, 'neutral'); }
    };
    const mark = (it, v) => { settings.update((st) => { const x = st.integrations.find((y) => y.key === it.key); if (x) x.connected = v; }); draw(); };
    draw();
    return grid;
  }

  /* ================================================================ Plan i płatności */
  function renderPlan() {
    const wrap = h('div', { class: 'e-cols' });
    const draw = () => {
      const s = settings.get(); const p = s.plan; const u = p.usage;
      const pct = u.aiInterviews.limit ? Math.round(u.aiInterviews.used / u.aiInterviews.limit * 100) : 0;
      const usage = (label, used, limit) => h('div', { class: 'st-usage' },
        h('div', { class: 'h' }, h('span', null, label), h('b', null, `${used} / ${limit === null ? 'bez limitu' : limit}`)),
        h('div', { class: 'e-progress', role: 'progressbar', 'aria-label': label, 'aria-valuenow': used, 'aria-valuemin': '0', 'aria-valuemax': limit === null ? Math.max(used * 10, 10) : limit },
          h('i', { class: limit && used / limit >= .9 ? 'warn' : null, style: `width:${limit === null ? Math.min(10, used * 2.5) : Math.min(100, used / limit * 100)}%` })));

      const planCard = h('div', { class: 'e-panel st-plan' },
        h('div', { class: 'st-plan-h' },
          h('h2', null, p.name),
          p.status === 'cancelled' ? badge('Anulowany · aktywny do 1 grudnia', 'warn') : badge('Aktualny plan', 'accent'),
          h('span', { class: 'spacer' }),
          h('b', { class: 'st-price' }, p.price)),
        h('p', { class: 'e-muted' }, `${p.status === 'cancelled' ? 'Nie odnowi się' : p.renews} · ${p.invoiceTo}`),
        usage('Rozmowy z analizą AI', u.aiInterviews.used, u.aiInterviews.limit),
        usage('Aktywne stanowiska', u.positions.used, u.positions.limit),
        usage('Miejsca w zespole', u.seats.used, u.seats.limit),
        h('div', { class: 'st-plan-a' },
          kbtn({ label: 'Zmień plan', onClick: () => changePlan(draw) }),
          p.status === 'cancelled'
            ? kbtn({ label: 'Wznów subskrypcję', variant: 'ghost', onClick: () => { settings.update((st) => { st.plan.status = 'active'; }); toast('Subskrypcja wznowiona. Odnowi się 1 grudnia.', 'good'); draw(); } })
            : kbtn({ label: 'Anuluj subskrypcję', variant: 'ghost', onClick: async () => {
              const ok = await confirm({ title: 'Anulować subskrypcję?', text: 'Plan Pro działa do 1 grudnia. Potem konto przechodzi na Starter: 1 stanowisko, 3 miejsca, bez analizy AI rozmów. Dane zostają.', confirmLabel: 'Anuluj subskrypcję', cancelLabel: 'Zostaw', danger: true });
              if (ok) { settings.update((st) => { st.plan.status = 'cancelled'; }); toast('Subskrypcja anulowana. Plan działa do 1 grudnia.', 'neutral'); draw(); }
            } }),
        ),
      );

      const invoices = panel({ title: 'Faktury', id: 'st-invoices', aside: h('button', { type: 'button', class: 'link', on: { click: () => downloadInvoices(s.invoices) } }, 'Pobierz wszystkie'),
        body: h('div', { class: 'e-list' }, s.invoices.map((inv) => h('div', { class: 'st-inv' },
          h('b', null, inv.label), h('span', null, inv.desc), badge(inv.status === 'paid' ? 'Opłacona' : 'Do zapłaty', inv.status === 'paid' ? 'good' : 'warn'),
          h('button', { type: 'button', class: 'st-pdf', 'aria-label': `Pobierz fakturę ${inv.label}`, on: { click: () => downloadInvoices([inv]) } }, 'PDF')))) });

      const payment = h('div', { class: 'e-card st-pay' },
        h('b', null, 'Metoda płatności'),
        h('div', { class: 'st-pay-card' }, kicon('card'), h('span', null, `${p.payment.brand} •••• ${p.payment.last4} · wygasa ${p.payment.expires}`)),
        kbtn({ label: 'Zmień', onClick: () => changePayment(draw) }));

      const upsell = h('div', { class: 'e-card soft st-upsell' },
        h('b', null, `Wykorzystano ${pct}% rozmów z analizą AI`),
        h('small', null, pct >= 50 ? 'Przy obecnym tempie limit skończy się ok. 22 listopada. Kolejne rozmowy kosztują po 2 € — nic nie zablokujemy.' : 'Limit wystarczy do końca okresu rozliczeniowego. Kolejne rozmowy kosztowałyby po 2 € — nic nie zablokujemy.'));

      wrap.replaceChildren(h('div', { class: 'e-col' }, planCard, invoices), h('div', { class: 'e-col' }, payment, upsell));
    };
    draw();
    return wrap;
  }

  function changePlan(onDone) {
    const s = settings.get();
    let picked = s.plan.key;
    const list = h('div', { class: 'st-plans', role: 'radiogroup', 'aria-label': 'Plan' }, s.plans.map((pl) => {
      const b = h('button', { type: 'button', role: 'radio', 'aria-checked': pl.key === picked ? 'true' : 'false', class: 'st-plan-opt', on: { click: () => { picked = pl.key; for (const x of list.querySelectorAll('[role="radio"]')) x.setAttribute('aria-checked', x === b ? 'true' : 'false'); } } },
        h('div', { class: 't' }, h('b', null, pl.name, pl.key === s.plan.key ? badge('Aktualny', 'accent') : null), h('small', null, pl.note)), h('span', { class: 'p' }, pl.price));
      return b;
    }));
    const m = modal({ title: 'Zmień plan', body: h('div', null, list, h('p', { class: 'e-caption' }, 'Zmiana działa od razu, różnicę rozliczamy proporcjonalnie na następnej fakturze.')),
      actions: [{ label: 'Anuluj', variant: 'secondary', onClick: () => m.close() }, { label: 'Zapisz zmiany', variant: 'primary', onClick: () => {
        const pl = s.plans.find((x) => x.key === picked);
        if (pl.key !== s.plan.key) {
          settings.update((st) => { Object.assign(st.plan, { key: pl.key, name: pl.name, price: pl.price, status: 'active' }); st.plan.usage.aiInterviews.limit = pl.aiLimit; st.plan.usage.positions.limit = pl.key === 'starter' ? 1 : null; st.plan.usage.seats.limit = pl.key === 'starter' ? 3 : null; });
          toast(`Plan zmieniony na ${pl.name}.`, 'good');
        }
        m.close(); onDone();
      } }] });
  }

  function changePayment(onDone) {
    const fBrand = field({ label: 'Karta', name: 'brand', type: 'select', value: 'Visa', options: ['Visa', 'Mastercard', 'American Express'] });
    const fNum = field({ label: 'Numer karty', name: 'num', type: 'text', placeholder: '4242 4242 4242 4242', inputmode: 'numeric', autocomplete: 'off' });
    const fExp = field({ label: 'Ważna do', name: 'exp', type: 'text', placeholder: 'MM/RR', inputmode: 'numeric', autocomplete: 'off' });
    const fCvc = field({ label: 'CVC', name: 'cvc', type: 'text', placeholder: '123', inputmode: 'numeric', autocomplete: 'off' });
    const submit = ctx.ui.button({ label: 'Zapisz kartę', variant: 'primary' });
    const form = h('form', { novalidate: true, on: { submit: (e) => {
      e.preventDefault();
      const digits = fNum.value.replace(/\D/g, '');
      if (digits.length < 12) { fNum.setError('Podaj pełny numer karty (co najmniej 12 cyfr).'); fNum.input.focus(); return; }
      if (!/^\d{2}\/\d{2}$/.test(fExp.value.trim())) { fExp.setError('Podaj datę w formacie MM/RR.'); fExp.input.focus(); return; }
      settings.update((st) => { st.plan.payment = { brand: fBrand.value, last4: digits.slice(-4), expires: fExp.value.trim() }; });
      m.close(); toast('Zapisaliśmy nową kartę. W demo nie obciążamy kart.', 'good'); onDone();
    } } }, fBrand, fNum, h('div', { class: 'form-row' }, fExp, fCvc), h('p', { class: 'e-caption' }, 'Dane karty trafiają do Stripe. Tekma nie przechowuje pełnego numeru.'));
    submit.addEventListener('click', () => form.requestSubmit());
    const m = modal({ title: 'Zmień metodę płatności', body: form, actions: [ctx.ui.button({ label: 'Anuluj', variant: 'secondary', onClick: () => m.close() }), submit] });
  }

  function downloadInvoices(list) {
    const s = settings.get();
    const text = list.map((inv) => `Faktura ${inv.label}\nNabywca: ${s.plan.invoiceTo}\nPozycje: ${inv.desc}\nStatus: ${inv.status === 'paid' ? 'Opłacona' : 'Do zapłaty'}\n`).join('\n---\n');
    try {
      const blob = new Blob([`Tekma — faktury (demo)\n\n${text}`], { type: 'text/plain;charset=utf-8' });
      const a = h('a', { href: URL.createObjectURL(blob), download: list.length === 1 ? `faktura-${list[0].date}.txt` : 'faktury-tekma.txt' });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast(list.length === 1 ? 'Pobieramy fakturę. W demo to plik tekstowy zamiast PDF.' : `Pobieramy ${plural(list.length, 'fakturę', 'faktury', 'faktur')}. W demo to plik tekstowy zamiast PDF.`, 'neutral');
    } catch { toast('Nie udało się pobrać pliku.', 'bad'); }
  }

  renderTabs(); renderBody();
  return root;
}
