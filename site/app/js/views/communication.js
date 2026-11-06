/**
 * views/communication.js — Komunikacja (#/communication): automaty i szablony wiadomości do kandydatów.
 * Wg Figma „N2 · Komunikacja”. Stan reguł (włączone, edytowane treści, zatwierdzone szkice) trzymany lokalnie
 * w przeglądarce (klucz tekma_comm_v1:<orgId>) — bez migracji. Wysyłka e-mail wymaga integracji poczty (jeszcze nie ma),
 * więc „Zatwierdź” oznacza szkic jako zatwierdzony przez człowieka, ale niczego nie wysyła.
 */
import { setHeader } from './positions.js';

const RULES = [
  { id: 'confirm', title: 'Potwierdzenie aplikacji', when: 'Nowa aplikacja · natychmiast', icon: 'mail', on: true,
    subject: 'Dziękujemy za aplikację — {stanowisko}',
    body: 'Cześć {imie},\n\ndziękujemy za aplikację na stanowisko {stanowisko}. Każde zgłoszenie ocenia człowiek według tej samej rubryki. Odpowiemy najpóźniej w ciągu 5 dni roboczych.' },
  { id: 'invite', title: 'Zaproszenie na rozmowę', when: 'Zmiana etapu na „Rozmowa” · po zatwierdzeniu terminu', icon: 'mail', on: true,
    subject: 'Zaproszenie na rozmowę — {stanowisko}',
    body: 'Cześć {imie},\n\nchcielibyśmy zaprosić Cię na rozmowę w sprawie stanowiska {stanowisko}. Wybierz dogodny termin z propozycji, a potwierdzimy go w ciągu doby.' },
  { id: 'remind', title: 'Przypomnienie przed rozmową', when: '24 h i 2 h przed terminem', icon: 'mail', on: true,
    subject: 'Przypomnienie: rozmowa — {stanowisko}',
    body: 'Cześć {imie},\n\nprzypominamy o rozmowie na stanowisko {stanowisko}. Jeśli termin przestał pasować, odpisz na tę wiadomość.' },
  { id: 'reject', title: 'Odrzucenie z uzasadnieniem', when: 'Po odrzuceniu · szkic z rubryki, zatwierdza rekruter', icon: 'mail', on: true,
    subject: 'Dziękujemy za rozmowę — {stanowisko}',
    body: 'Cześć {imie},\n\ndziękujemy za czas poświęcony na rozmowę. Zdecydowaliśmy się iść dalej z innym kandydatem. Oceniliśmy każdego według tej samej rubryki.\n\n{oceny}\n\nJeśli zechcesz, zostawimy Twoje dane w bazie talentów na 12 miesięcy. Wystarczy jedno kliknięcie.' },
  { id: 'stale', title: 'Alert: brak ruchu 5 dni', when: 'Kandydat bez odpowiedzi · powiadomienie do rekrutera', icon: 'mail', on: true,
    subject: 'Kandydat czeka na odpowiedź: {kandydat}',
    body: '{kandydat} czeka na Twoją odpowiedź dłużej niż 5 dni ({stanowisko}). Przesuń go dalej albo odrzuć z uzasadnieniem.' },
  { id: 'consent', title: 'Prośba o zgodę na bazę talentów', when: 'Po odrzuceniu · po 24 h', icon: 'mail', on: false,
    subject: 'Czy możemy zostawić Twoje dane?',
    body: 'Cześć {imie},\n\nchętnie zostawimy Twój profil w bazie talentów na 12 miesięcy, żeby odezwać się przy podobnej rekrutacji. Zgodę możesz cofnąć w każdej chwili.' },
];

const DAY = 86400000;

export default async function render(ctx) {
  const { h, icon, button, tag, modal, toast, plural, emptyState } = ctx.ui;
  await ctx.ui.loadCss(new URL('./communication.css', import.meta.url));
  const [cands, poss, cards] = await Promise.all([ctx.store.candidates.list(), ctx.store.positions.list(), ctx.store.scorecards.list().catch(() => [])]);
  const pBy = Object.fromEntries(poss.map((p) => [p.id, p]));

  const KEY = `tekma_comm_v1:${ctx.org ? ctx.org.id : 'x'}`;
  let st = { on: {}, custom: {}, approved: [] };
  try { st = { ...st, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { /* brak zapisu */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* tryb prywatny */ } };
  const isOn = (r) => (r.id in st.on ? st.on[r.id] : r.on);
  const txt = (r) => ({ ...r, ...(st.custom[r.id] || {}) });

  const rejected = cands.filter((c) => c.status === 'rejected');
  const pending = rejected.filter((c) => !st.approved.includes(c.id));
  const stale = cands.filter((c) => c.status === 'active' && c.applied_at && Date.now() - new Date(c.applied_at).getTime() > 5 * DAY);
  const first = (c) => (c && c.full_name ? c.full_name.split(' ')[0] : 'Agnieszko');
  const sample = pending[0] || rejected[0] || cands[0] || null;

  function scoresFor(c) {
    if (!c) return [['Projektowanie systemów', 4], ['Komunikacja z produktem', 2]];
    const k = cards.filter((x) => x.candidate_id === c.id).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))[0];
    const by = {};
    for (const r of (k && k.ratings) || []) if (typeof r.score === 'number') (by[r.question_id] ||= []).push(r.score);
    return Object.entries(by).slice(0, 4).map(([q, s]) => [q, Math.round(s.reduce((a, b) => a + b, 0) / s.length)]);
  }
  const fill = (s, c) => s
    .replaceAll('{imie}', first(c)).replaceAll('{kandydat}', c ? c.full_name : 'Agnieszka Nowak')
    .replaceAll('{stanowisko}', (c && pBy[c.position_id] ? pBy[c.position_id].title : 'Senior Backend Engineer'));

  let active = 'auto', selected = 'reject';
  const tabs = [['auto', 'Automaty'], ['tpl', 'Szablony'], ['survey', 'Ankieta po procesie'], ['status', 'Strona statusu']];
  const seg = h('div', { class: 'cm-tabs', role: 'tablist', 'aria-label': 'Komunikacja' });
  const body = h('div', { class: 'cm-body' });

  function chip(r) {
    if (!isOn(r)) return tag('Wyłączone', 'neutral');
    if (r.id === 'reject') return pending.length ? tag(`${pending.length} do zatwierdzenia`, 'warn') : tag('Aktywne', 'good');
    if (r.id === 'stale') return stale.length ? tag(plural(stale.length, 'kandydat', 'kandydatów', 'kandydatów'), 'bad') : tag('Brak zaległych', 'good');
    return tag('Aktywne', 'good');
  }
  function toggle(r) {
    const b = h('button', { type: 'button', class: 'switch', role: 'switch', 'aria-checked': String(isOn(r)), 'aria-label': `${r.title}: ${isOn(r) ? 'włączone' : 'wyłączone'}` });
    b.addEventListener('click', (e) => { e.stopPropagation(); st.on[r.id] = !isOn(r); save(); drawAuto(); });
    return b;
  }
  function ruleRow(r) {
    const el = h('div', { class: 'cm-rule', role: 'button', tabindex: '0', 'aria-pressed': String(selected === r.id) },
      h('span', { class: 'cm-ico' }, icon(r.icon)),
      h('div', { class: 'cm-t' }, h('strong', null, r.title), h('small', null, r.when)), chip(r), toggle(r));
    const pick = () => { selected = r.id; drawAuto(); };
    el.addEventListener('click', pick);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    return el;
  }
  function previewCard() {
    const r = txt(RULES.find((x) => x.id === selected));
    const c = r.id === 'stale' ? (stale[0] || sample) : sample;
    const parts = fill(r.body, c).split('\n\n');
    const mail = h('div', { class: 'cm-mail' });
    for (const p of parts) {
      if (p === '{oceny}') {
        const sc = scoresFor(c); if (!sc.length) continue;
        mail.append(h('div', { class: 'cm-scores' }, sc.map(([q, s]) => h('div', null, h('span', null, q.length > 28 && /^[0-9a-f-]{8,}/i.test(q) ? 'Kryterium' : q), tag(`${s} / 5`, s >= 4 ? 'good' : s >= 3 ? 'neutral' : 'warn')))));
      } else mail.append(h('p', null, p));
    }
    const needs = r.id === 'reject' && sample && !st.approved.includes(sample.id);
    const approve = button({ label: needs ? 'Zatwierdź szkic' : 'Zatwierdź', variant: 'primary', size: 'sm', onClick: () => {
      if (r.id === 'reject' && sample) { st.approved = [...new Set([...st.approved, sample.id])]; save(); drawAuto(); }
      toast('Zatwierdzone. Wysyłka e-mail ruszy po podłączeniu poczty — na razie nic nie zostało wysłane.', 'good');
    } });
    return h('aside', { class: 'card cm-prev' },
      h('h2', { class: 'cm-h' }, 'Podgląd wiadomości'),
      h('div', { class: 'cm-sub' }, h('small', null, r.title), h('strong', null, `Temat: ${fill(r.subject, c)}`)),
      mail,
      h('div', { class: 'cm-ai' }, icon('spark'), r.id === 'reject' ? 'Szkic wygenerowany z rubryki. Wysyła człowiek.' : 'Szablon z Twoimi danymi. Wysyła człowiek po zatwierdzeniu.'),
      h('div', { class: 'cm-actions' }, button({ label: 'Edytuj', size: 'sm', onClick: () => editRule(r) }), approve));
  }
  function editRule(r) {
    const subject = h('input', { type: 'text', value: r.subject, 'aria-label': 'Temat' });
    const bodyEl = h('textarea', { rows: 10, 'aria-label': 'Treść' }, r.body);
    const m = modal({ title: `Edytuj: ${r.title}`, body: h('div', { class: 'cm-edit' },
      h('label', null, 'Temat', subject), h('label', null, 'Treść', bodyEl),
      h('p', { class: 'muted' }, 'Możesz użyć: {imie}, {kandydat}, {stanowisko}, {oceny}.')),
      actions: [button({ label: 'Przywróć domyślny', onClick: () => { delete st.custom[r.id]; save(); m.close(); drawAuto(); } }),
        button({ label: 'Zapisz', variant: 'primary', onClick: () => { st.custom[r.id] = { subject: subject.value, body: bodyEl.value }; save(); m.close(); drawAuto(); toast('Szablon zapisany.', 'good'); } })] });
  }
  function drawAuto() {
    body.replaceChildren(h('div', { class: 'cm-grid' }, h('div', { class: 'cm-rules' }, RULES.map(ruleRow)), previewCard()));
  }
  function drawTpl() {
    body.replaceChildren(h('div', { class: 'cm-tpls' }, RULES.map((r0) => { const r = txt(r0);
      return h('div', { class: 'card cm-tpl' }, h('div', { class: 'cm-t' }, h('strong', null, r.title), h('small', null, r.subject)),
        h('p', { class: 'muted' }, fill(r.body, sample).split('\n\n')[1] || fill(r.body, sample)),
        button({ label: 'Edytuj', size: 'sm', onClick: () => editRule(r) })); })));
  }
  function drawSoon(title, text, ic) {
    body.replaceChildren(emptyState({ title, text, icon: ic }));
  }
  function draw() {
    seg.replaceChildren(...tabs.map(([k, l]) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(k === active), on: { click: () => { active = k; draw(); } } }, l)));
    if (active === 'auto') drawAuto();
    else if (active === 'tpl') drawTpl();
    else if (active === 'survey') drawSoon('Ankieta po procesie', 'Krótka ankieta dla kandydatów po zakończeniu rekrutacji pojawi się tu wkrótce.', 'rubric');
    else drawSoon('Strona statusu', 'Publiczna strona, na której kandydat widzi etap swojej aplikacji, pojawi się tu wkrótce.', 'users');
  }

  setHeader(ctx, { title: 'Komunikacja', width: 'wide' });
  const root = h('div', { class: 'cm' },
    h('p', { class: 'cm-note muted' }, 'Automaty i szablony wiadomości do kandydatów. Żaden kandydat nie czeka na odpowiedź dłużej niż 5 dni.'), seg, body);
  draw();
  return root;
}
