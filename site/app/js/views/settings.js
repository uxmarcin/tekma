/**
 * views/settings.js — Ustawienia (#/settings, #/settings/:tab, #/settings/zgodnosc).
 * Zakładki: Firma, Zespół i uprawnienia, Integracje, Plan i płatności, RODO i AI Act.
 *
 * Co jest prawdziwe, a co informacyjne:
 *   - Firma: zmiana nazwy (tylko właściciel, store.org.rename) i motyw (lokalnie, tylko dla Ciebie).
 *   - Zespół: lista członków i zmiana roli (tylko właściciel, store.members). Zaproszenia e-mail — wkrótce.
 *   - Integracje, Plan i płatności, RODO i AI Act: strony informacyjne bez zapisu (brak backendu).
 * export default async function render(ctx) -> HTMLElement
 */
import { getTheme, applyTheme } from '../router.js';
import { cropLogo, LOGO_ACCEPT } from './logo-crop.js';

const TABS = [
  { key: 'firma', label: 'Firma', href: '#/settings' },
  { key: 'zespol', label: 'Zespół i uprawnienia', href: '#/settings/zespol' },
  { key: 'integracje', label: 'Integracje', href: '#/settings/integracje' },
  { key: 'plan', label: 'Plan i płatności', href: '#/settings/plan' },
  { key: 'zgodnosc', label: 'RODO i AI Act', href: '#/settings/zgodnosc' },
];

const ROLES = {
  owner: { label: 'Właściciel', access: 'Wszystko: firma, zespół, stanowiska, rubryki i oceny', tone: 'blue' },
  recruiter: { label: 'Rekruter', access: 'Stanowiska, kandydaci, rubryki i karty oceny', tone: 'neutral' },
  interviewer: { label: 'Rozmówca', access: 'Podgląd danych i własne oceny; bez tworzenia i usuwania', tone: 'neutral' },
};

export default async function render(ctx) {
  await ctx.ui.loadCss(new URL('./settings.css', import.meta.url));
  const { h } = ctx.ui;
  const fromPath = ctx.path === '#/settings/zgodnosc' ? 'zgodnosc' : (ctx.params.tab || 'firma');
  const tab = TABS.some((t) => t.key === fromPath) ? fromPath : 'firma';
  ctx.setHeader({ title: tab === 'zgodnosc' && ctx.path === '#/settings/zgodnosc' ? 'RODO i AI Act' : 'Ustawienia', width: 'wide' });

  const tabs = h('nav', { class: 'st-tabs', 'aria-label': 'Sekcje ustawień' },
    TABS.map((t) => h('a', { class: 'st-tab', href: t.href, 'aria-current': t.key === tab ? 'page' : null }, t.label)));
  const panel = h('div', { class: 'st-panel' });
  const root = h('div', { class: 'st' }, tabs, panel);

  const builders = { firma, zespol, integracje, plan, zgodnosc };
  try {
    panel.append(await builders[tab](ctx));
  } catch (err) {
    console.error('[settings]', err);
    panel.append(ctx.ui.emptyState({ title: 'Nie udało się wczytać ustawień', text: err.message || 'Spróbuj ponownie za chwilę.', icon: 'alert' }));
  }
  return root;
}

/* ------------------------------------------------ Firma */
function firma(ctx) {
  const { h, field, button, formError, toast } = ctx.ui;
  const org = ctx.org;
  const owner = org.role === 'owner';

  const name = field({
    label: 'Nazwa firmy', name: 'org', value: org.name, autocomplete: 'organization',
    disabled: !owner, hint: owner ? 'Widzi ją cały zespół.' : 'Nazwę firmy zmienia właściciel.',
  });
  const submit = button({ label: 'Zapisz zmiany', variant: 'primary', type: 'submit' });
  const errorSlot = h('div');
  const form = h('form', { novalidate: true, class: 'st-form', on: { submit: async (e) => {
    e.preventDefault();
    errorSlot.replaceChildren(); name.setError('');
    const v = name.value.trim();
    if (v.length < 2) { name.setError('Podaj nazwę firmy (co najmniej 2 znaki).'); name.input.focus(); return; }
    if (v === org.name) { toast('Nazwa firmy bez zmian.', 'neutral'); return; }
    submit.setBusy(true);
    try {
      await ctx.store.org.rename(v);
      await ctx.refreshShell();
      toast('Nazwa firmy zapisana.', 'good');
      ctx.navigate('#/settings');
    } catch (err) {
      errorSlot.replaceChildren(formError(err.message || 'Nie udało się zapisać.'));
    } finally { submit.setBusy(false); }
  } } }, errorSlot, name, owner ? h('div', { class: 'st-actions' }, submit) : null);

  const company = h('section', { class: 'card st-card', 'aria-labelledby': 'st-company-h' },
    h('h2', { id: 'st-company-h', class: 'st-h' }, 'Dane firmy'),
    logoBlock(ctx, org, owner),
    form);

  return h('div', { class: 'st-grid' }, company, appearance(ctx));
}

/** Logo firmy: podgląd, wybór pliku (też przeciągnięciem), kadrowanie, usunięcie. */
function logoBlock(ctx, org, owner) {
  const { h, button, toast } = ctx.ui;
  const mark = h('span', { class: 'st-logo-mark' }, ctx.ui.orgAvatar(org, 'xl'));
  const input = h('input', { type: 'file', accept: LOGO_ACCEPT, class: 'st-file', tabindex: '-1', 'aria-hidden': 'true' });
  const apply = async (file) => {
    if (!file) return;
    const data = await cropLogo(ctx, file);
    if (!data) return;
    try { await ctx.store.org.setLogo(data); await ctx.refreshShell(); toast('Logo firmy zapisane.', 'good'); ctx.navigate('#/settings'); }
    catch (err) { toast(err.message || 'Nie udało się zapisać logo.', 'bad'); }
  };
  input.addEventListener('change', () => { const f = input.files && input.files[0]; input.value = ''; apply(f); });
  const change = button({ label: org.logo ? 'Zmień logo' : 'Dodaj logo', size: 'sm', variant: 'secondary', disabled: !owner, onClick: () => input.click() });
  const remove = org.logo ? button({ label: 'Usuń', size: 'sm', variant: 'ghost', disabled: !owner, onClick: async () => {
    if (!(await ctx.ui.confirm({ title: 'Usunąć logo?', text: 'W miejscu logo znów pokażemy pierwszą literę nazwy firmy.', confirmLabel: 'Usuń logo', danger: true }))) return;
    try { await ctx.store.org.setLogo(null); await ctx.refreshShell(); toast('Logo usunięte.', 'good'); ctx.navigate('#/settings'); }
    catch (err) { toast(err.message || 'Nie udało się usunąć logo.', 'bad'); }
  } }) : null;
  const row = h('div', { class: 'st-logo-row' },
    mark,
    h('div', { class: 'st-logo-t' },
      h('b', null, org.name),
      h('small', { class: 'muted' }, `Twoja rola: ${(ROLES[org.role] || {}).label || org.role}`),
      owner ? h('div', { class: 'st-logo-act' }, change, remove, input) : null));
  if (!owner) return row;
  const help = h('p', { class: 'st-logo-help muted' },
    h('b', null, 'Logo: '), 'najlepiej kwadrat ', h('b', null, '512 × 512 px'), ' (min. 256 × 256). Formaty: SVG, PNG, JPG i WebP (do 8 MB).');
  // przeciągnij i upuść
  const wrap = h('div', { class: 'st-logo-wrap' }, row, help);
  for (const ev of ['dragenter', 'dragover']) wrap.addEventListener(ev, (e) => { e.preventDefault(); wrap.classList.add('is-over'); });
  for (const ev of ['dragleave', 'drop']) wrap.addEventListener(ev, (e) => { e.preventDefault(); if (ev === 'dragleave' && wrap.contains(e.relatedTarget)) return; wrap.classList.remove('is-over'); });
  wrap.addEventListener('drop', (e) => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) apply(f); });
  return wrap;
}

function appearance(ctx) {
  const { h } = ctx.ui;
  const cur = getTheme();
  const opts = [['light', 'Jasny'], ['dark', 'Ciemny'], ['system', 'Systemowy']];
  const group = h('div', { class: 'st-themes', role: 'radiogroup', 'aria-label': 'Motyw' });
  for (const [val, label] of opts) {
    const b = h('button', { type: 'button', class: `st-theme ${val}`, role: 'radio', 'aria-checked': String(cur === val) },
      h('span', { class: 'st-prev', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
      h('span', { class: 'st-theme-l' }, h('span', { class: 'st-dot', 'aria-hidden': 'true' }), label));
    b.addEventListener('click', () => {
      applyTheme(val);
      group.querySelectorAll('.st-theme').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    });
    group.append(b);
  }
  return h('section', { class: 'card st-card', 'aria-labelledby': 'st-look-h' },
    h('div', { class: 'st-card-h' }, h('h2', { id: 'st-look-h', class: 'st-h' }, 'Wygląd'), h('small', { class: 'muted' }, 'Tylko dla Ciebie')),
    group);
}

/* ------------------------------------------------ Zespół i uprawnienia */
async function zespol(ctx) {
  const { h, button, avatar, tag, toast, confirm, formatDate, plural } = ctx.ui;
  const owner = ctx.org.role === 'owner';
  const members = await ctx.store.members.list();
  const n = members.length;

  const invite = button({ label: 'Zaproś osobę', variant: 'primary', disabled: true, title: 'Zaproszenia e-mail pojawią się wkrótce' });
  const bar = h('div', { class: 'st-bar' },
    h('p', { class: 'muted' }, `${plural(n, 'osoba', 'osoby', 'osób')} · bez limitu miejsc`),
    h('div', { class: 'st-bar-r' }, h('small', { class: 'muted' }, 'Zaproszenia e-mail: wkrótce'), invite));

  const roleCell = (m) => {
    if (!owner) return tag(ROLES[m.role] ? ROLES[m.role].label : m.role, ROLES[m.role] ? ROLES[m.role].tone : 'neutral');
    const sel = h('select', { class: 'input st-role', 'aria-label': `Rola: ${m.name || 'osoba'}` },
      Object.entries(ROLES).map(([v, r]) => h('option', { value: v, selected: v === m.role }, r.label)));
    sel.addEventListener('change', async () => {
      const next = sel.value;
      const ok = m.is_me
        ? await confirm({ title: 'Zmienić własną rolę?', text: 'Po zmianie możesz stracić dostęp do ustawień zespołu.', confirmLabel: 'Zmień rolę', danger: true })
        : true;
      if (!ok) { sel.value = m.role; return; }
      sel.disabled = true;
      try {
        await ctx.store.members.setRole(m.user_id, next);
        toast('Rola zapisana.', 'good');
        if (m.is_me) await ctx.refreshShell();
        ctx.navigate('#/settings/zespol');
      } catch (err) {
        sel.value = m.role; sel.disabled = false;
        toast(err.message || 'Nie udało się zmienić roli.', 'bad');
      }
    });
    return sel;
  };

  const rows = members.map((m) => h('tr', null,
    h('td', null, h('div', { class: 'st-person' }, avatar(m.name || '?'),
      h('div', null, h('b', null, m.name || 'Bez nazwy'), m.is_me ? h('small', { class: 'muted' }, 'To Ty') : null))),
    h('td', null, roleCell(m)),
    h('td', { class: 'st-access' }, (ROLES[m.role] || {}).access || ''),
    h('td', { class: 'muted st-when' }, formatDate(m.created_at)),
  ));
  const table = h('div', { class: 'card st-table' }, h('div', { class: 'table-wrap' },
    h('table', { class: 'table' },
      h('thead', null, h('tr', null, ['Osoba', 'Rola', 'Dostęp', 'Dołączył(a)'].map((c) => h('th', { scope: 'col' }, c)))),
      h('tbody', null, rows))));

  const roles = h('section', { class: 'card st-card', 'aria-labelledby': 'st-roles-h' },
    h('h2', { id: 'st-roles-h', class: 'st-h' }, 'Co widzi każda rola'),
    h('div', { class: 'st-roles' }, Object.values(ROLES).map((r) => h('div', { class: 'st-role-c' }, h('b', null, r.label), h('p', { class: 'muted' }, r.access)))));

  return h('div', { class: 'st-stack' }, bar, table, roles);
}

/* ------------------------------------------------ Integracje */
/** Kafelek z logiem marki (assets/brands/<logo>.svg); gdy pliku brak, zostaje ikona zastępcza. */
function brandTile(h, icon, it) {
  const tile = h('span', { class: 'st-int-i', 'aria-hidden': 'true' }, icon(it.icon, 18));
  if (it.logo) {
    const img = h('img', { src: new URL(`../../../assets/brands/${it.logo}.svg`, import.meta.url).href, alt: '', width: '22', height: '22' });
    img.addEventListener('load', () => { tile.classList.add('has-logo'); tile.replaceChildren(img); });
  }
  return tile;
}

function integracje(ctx) {
  const { h, icon, tag } = ctx.ui;
  const items = [
    { name: 'Kalendarz Google', text: 'Notetaker sam dołącza do rozmów', icon: 'calendar', logo: 'google-calendar' },
    { name: 'Gmail', text: 'Wiadomości do kandydatów w jednym wątku', icon: 'mail', logo: 'gmail' },
    { name: 'Outlook i Teams', text: 'Dla zespołów na Microsoft 365', icon: 'building', logo: 'microsoft-365' },
  ];
  return h('div', { class: 'st-stack' },
    h('p', { class: 'muted st-lead' }, 'Integracje są w przygotowaniu. Gdy będą dostępne, podłączysz je tutaj, a Ty zatwierdzisz zakres uprawnień.'),
    h('div', { class: 'st-int' }, items.map((it) => h('div', { class: 'card st-int-c' },
      brandTile(h, icon, it),
      h('div', { class: 't' }, h('b', null, it.name), h('p', { class: 'muted' }, it.text)),
      tag('Wkrótce', 'neutral')))));
}

/* ------------------------------------------------ Plan i płatności */
function plan(ctx) {
  const { h, icon, tag } = ctx.ui;
  const owner = ctx.org.role === 'owner';
  // Zakres planów jak w formularzu zamówienia (assets/checkout.js) i na stronie głównej.
  const PLANS = [
    { key: 'free', name: 'Free', price: '0 €', per: 'na zawsze', sub: 'Na pierwsze rekrutacje, bez karty.', feats: ['1 otwarte stanowisko', '5 rozmów z analizą AI / mies.', 'Rubryki, notetaker, karty ocen', 'Strona kariery i portal kandydata'] },
    { key: 'starter', name: 'Starter', price: '49 €', per: '/ mies.', sub: 'Dla zespołu, który zaczyna rosnąć.', feats: ['5 aktywnych stanowisk', '25 rozmów z analizą AI / mies.', 'Notetaker dołącza sam', 'Raporty lejka', 'Strona kariery i portal kandydata'] },
    { key: 'pro', name: 'Pro', price: '129 €', per: '/ mies.', sub: 'Dla zespołów, które rekrutują ciągle.', badge: 'Najczęściej wybierany', feats: ['Bez limitu stanowisk', '60 rozmów z analizą AI / mies., kolejne po 2\u00a0€', 'Coach AI na żywo i kalibracja rozmówców', 'Gmail, Outlook, Slack i kalendarze', 'Eksport rejestru decyzji AI'] },
  ];
  const current = 'free'; // rozliczenia online jeszcze nie działają — każde konto zaczyna na Free
  const cards = PLANS.map((p) => {
    const isCur = p.key === current;
    const cta = isCur
      ? h('button', { type: 'button', class: 'btn btn-secondary btn-block', disabled: true }, 'Twój plan')
      : (owner
        ? h('a', { class: `btn ${p.key === 'pro' ? 'btn-primary' : 'btn-secondary'} btn-block`, href: `../checkout.html?plan=${p.key}` }, `Przejdź na ${p.name}`)
        : h('button', { type: 'button', class: 'btn btn-secondary btn-block', disabled: true, title: 'Plan zmienia właściciel firmy' }, `Przejdź na ${p.name}`));
    return h('section', { class: `card st-card st-pl${isCur ? ' is-cur' : ''}${p.badge ? ' is-hi' : ''}`, 'aria-label': `Plan ${p.name}` },
      h('div', { class: 'st-card-h' }, h('h2', { class: 'st-h' }, p.name), isCur ? tag('Aktywny', 'good') : (p.badge ? tag(p.badge, 'blue') : null)),
      h('div', { class: 'st-price' }, h('b', null, p.price), h('span', null, p.per)),
      h('p', { class: 'muted st-pl-sub' }, p.sub),
      h('ul', { class: 'st-checks' }, p.feats.map((f) => h('li', null, icon('check', 15), f))),
      h('div', { class: 'st-pl-cta' }, cta));
  });
  return h('div', { class: 'st-stack' },
    h('div', { class: 'st-plans' }, cards),
    h('section', { class: 'card st-card' },
      h('h2', { class: 'st-h' }, 'Płatności i faktury'),
      h('p', { class: 'muted' }, owner
        ? 'Rozliczenia online pojawią się wkrótce, do tego czasu nie pobieramy żadnych opłat. Po wybraniu planu wypełnisz formularz zamówienia (dane do faktury), a dostęp i fakturę potwierdzimy mailowo. '
        : 'Plan i dane do faktury zmienia właściciel firmy. ',
        'Potrzebujesz więcej niż Pro (SSO, własna domena, DPA)? ',
        h('a', { class: 'link', href: 'mailto:hello@tekma.app?subject=Tekma%20Scale' }, 'Napisz o planie Scale'), '.')));
}

/* ------------------------------------------------ RODO i AI Act */
function zgodnosc(ctx) {
  const { h, icon, tag } = ctx.ui;
  const principles = [
    ['AI tylko podpowiada', 'Każda sugestia jest oznaczona („AI sugeruje”). Ocenę i decyzję zatwierdza człowiek. AI nigdy nie odrzuca ani nie przesuwa kandydata.'],
    ['Ta sama miara dla każdego', 'Kandydaci są oceniani według tej samej rubryki: te same pytania, wagi i kotwice ocen 1–5. Zmiana pytań tworzy nową wersję rubryki.'],
    ['Dostęp według roli', 'Dane firmy widzą tylko jej członkowie, a zakres zmian zależy od roli (Właściciel, Rekruter, Rozmówca). Egzekwuje to baza danych, nie tylko interfejs.'],
  ];
  const status = [
    ['Sugestie AI w aplikacji', 'Wersja demonstracyjna: podpowiedzi nie analizują jeszcze prawdziwych rozmów', 'warn', 'Demo'],
    ['Rejestr sugestii AI i decyzji człowieka', 'Zapis, kto i kiedy zatwierdził sugestię', 'neutral', 'Wkrótce'],
    ['Eksport i usunięcie danych kandydata (RODO)', 'Wniosek o dane, sprostowanie i usunięcie', 'neutral', 'Wkrótce'],
    ['Umowa powierzenia przetwarzania (DPA)', 'Wzór dla klientów', 'neutral', 'Wkrótce'],
  ];
  return h('div', { class: 'st-stack' },
    h('div', { class: 'st-pr' }, principles.map(([t, p]) => h('section', { class: 'card st-card' },
      h('span', { class: 'st-int-i', 'aria-hidden': 'true' }, icon('shield', 18)), h('h2', { class: 'st-h' }, t), h('p', { class: 'muted' }, p)))),
    h('section', { class: 'card st-card', 'aria-labelledby': 'st-stat-h' },
      h('h2', { id: 'st-stat-h', class: 'st-h' }, 'Stan wdrożenia'),
      h('ul', { class: 'st-status' }, status.map(([t, d, tone, label]) => h('li', null,
        h('div', null, h('b', null, t), h('p', { class: 'muted' }, d)), tag(label, tone))))));
}
