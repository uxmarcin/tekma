/**
 * views/intake.js — Intake z hiring managerem (#/positions/:id/intake). Wg Figma „N6”.
 * Pięć sekcji do uzgodnienia (cel roli, kryteria, widełki, panel), komentarze HM i rekrutera.
 * Dane trzymane lokalnie (klucz tekma_intake_v1:<positionId>); „Zakończ intake” dopisuje streszczenie do opisu stanowiska.
 */
import { setHeader } from './positions.js';

const SECTIONS = [
  ['goal', 'Cel roli'], ['must', 'Kryteria obowiązkowe'], ['nice', 'Kryteria mile widziane'], ['pay', 'Widełki i forma'], ['panel', 'Panel rozmówców'],
];

export default async function render(ctx) {
  const { h, icon, button, field, avatar, formatDate, toast } = ctx.ui;
  await ctx.ui.loadCss(new URL('./intake.css', import.meta.url));
  const pos = await ctx.store.positions.get(ctx.params.id);
  if (!pos) throw new Error('Nie znaleziono stanowiska.');
  const members = await ctx.store.members.list().catch(() => []);

  const KEY = `tekma_intake_v1:${pos.id}`;
  let d = { goal: '', must: '', nice: '', from: '', to: '', mode: 'Zdalnie', why: '', panel: [], comments: [], approved: false };
  try { d = { ...d, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { /* brak zapisu */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* tryb prywatny */ } };
  const done = {
    goal: () => d.goal.trim().length > 3, must: () => d.must.trim().length > 1, nice: () => d.nice.trim().length > 1,
    pay: () => Boolean(d.from && d.to && d.approved), panel: () => d.panel.length > 0,
  };
  let active = SECTIONS.find(([k]) => !done[k]())?.[0] || 'goal';

  const nav = h('nav', { class: 'in-nav', 'aria-label': 'Sekcje intake' });
  const bar = h('div', { class: 'in-bar' }, h('span'));
  const barTxt = h('span', { class: 'muted' });
  const main = h('div', { class: 'in-main' });

  function drawNav() {
    const n = SECTIONS.filter(([k]) => done[k]()).length;
    bar.firstChild.style.width = `${(n / SECTIONS.length) * 100}%`;
    barTxt.textContent = `${n} z ${SECTIONS.length} sekcji uzgodnione`;
    nav.replaceChildren(...SECTIONS.map(([k, l]) => h('button', { type: 'button', class: 'in-step', 'aria-current': String(k === active), on: { click: () => { active = k; draw(); } } },
      h('span', { class: `in-dot${done[k]() ? ' ok' : ''}` }, done[k]() ? icon('check') : null), l)));
  }
  const textSection = (key, title, hint, ph) => {
    const ta = h('textarea', { rows: 8, placeholder: ph, 'aria-label': title }, d[key]);
    ta.addEventListener('input', () => { d[key] = ta.value; save(); drawNav(); });
    return h('section', { class: 'card in-card' }, h('h2', null, title), h('p', { class: 'muted' }, hint), ta);
  };
  function paySection() {
    const num = (key, label) => { const f = field({ label, name: key, type: 'text', value: d[key], placeholder: 'np. 22 000' }); f.input.addEventListener('input', () => { d[key] = f.input.value; d.approved = false; save(); drawNav(); sync(); }); return f; };
    const mode = field({ label: 'Tryb pracy', name: 'mode', options: ['Zdalnie', 'Hybrydowo', 'Stacjonarnie'], value: d.mode });
    mode.input.addEventListener('change', () => { d.mode = mode.input.value; save(); });
    const why = field({ label: 'Uzasadnienie widełek (do wiadomości zespołu)', name: 'why', type: 'text', value: d.why });
    why.input.addEventListener('input', () => { d.why = why.input.value; save(); });
    const list = h('div', { class: 'in-comments' });
    const paint = () => list.replaceChildren(...d.comments.map((c) => h('div', { class: 'in-c' }, avatar(c.who), h('div', null,
      h('strong', null, c.who, ' ', h('small', { class: 'muted' }, `(${c.role}) · ${formatDate(c.at, { relative: true })}`)), h('p', null, c.text)))));
    const box = h('input', { type: 'text', placeholder: 'Dodaj komentarz…', 'aria-label': 'Komentarz' });
    const post = button({ label: 'Dodaj', size: 'sm', onClick: () => {
      if (!box.value.trim()) return;
      d.comments.push({ who: ctx.user && ctx.user.name ? ctx.user.name : 'Ty', role: 'rekruter', text: box.value.trim(), at: new Date().toISOString() });
      box.value = ''; save(); paint(); } });
    paint();
    const approve = button({ label: 'Zatwierdź widełki', variant: 'primary', size: 'sm', onClick: () => { d.approved = true; save(); draw(); } });
    function sync() {
      const label = approve.querySelector('span');
      if (label) label.textContent = d.approved ? 'Uzgodnione' : (d.from && d.to ? `Zatwierdź ${d.from}–${d.to}` : 'Zatwierdź widełki');
      approve.disabled = d.approved || !(d.from && d.to);
    }
    const ok = d.approved;
    sync();
    return [
      h('section', { class: 'card in-card' }, h('h2', null, 'Widełki i forma współpracy'),
        h('div', { class: 'in-row' }, num('from', 'Od (PLN)'), num('to', 'Do (PLN)'), mode), why),
      h('section', { class: 'card in-card' }, h('h2', null, 'Komentarze hiring managera'), list, h('div', { class: 'in-post' }, box, post),
        h('div', { class: `in-wait${ok ? ' ok' : ''}` }, icon(ok ? 'check' : 'clock'), h('span', null, ok ? 'Widełki uzgodnione z hiring managerem.' : 'Czeka na decyzję hiring managera.'), approve)),
    ];
  }
  function panelSection() {
    const rows = (members.length ? members : [{ user_id: 'me', name: ctx.user && ctx.user.name || 'Ty' }]).map((m) => {
      const cb = h('input', { type: 'checkbox', checked: d.panel.includes(m.user_id) });
      cb.addEventListener('change', () => { d.panel = cb.checked ? [...new Set([...d.panel, m.user_id])] : d.panel.filter((x) => x !== m.user_id); save(); drawNav(); });
      return h('label', { class: 'in-pick' }, cb, avatar(m.name || '?'), h('span', null, m.name || 'Członek zespołu'));
    });
    return h('section', { class: 'card in-card' }, h('h2', null, 'Panel rozmówców'), h('p', { class: 'muted' }, 'Wybierz osoby, które poprowadzą rozmowy. Każda odpowiada za inne kryteria rubryki.'), ...rows);
  }
  function draw() {
    drawNav();
    const s = {
      goal: () => [textSection('goal', 'Cel roli', 'Jedno zdanie: co ma się zmienić dzięki tej osobie w ciągu 12 miesięcy?', 'np. Przejąć rozwój modułu płatności i skrócić czas wdrożeń.')],
      must: () => [textSection('must', 'Kryteria obowiązkowe', 'Co kandydat musi umieć, żeby przejść dalej? Jedno kryterium w linii.', 'np. 5+ lat doświadczenia z systemami rozproszonymi')],
      nice: () => [textSection('nice', 'Kryteria mile widziane', 'Co jest atutem, ale nie warunkiem? Jedno w linii.', 'np. Doświadczenie z Kafką')],
      pay: paySection, panel: () => [panelSection()],
    }[active];
    main.replaceChildren(...s());
  }
  function finish() {
    const missing = SECTIONS.filter(([k]) => !done[k]()).map(([, l]) => l);
    if (missing.length) { toast(`Do uzgodnienia: ${missing.join(', ')}.`, 'warn'); return; }
    const summary = `Cel roli: ${d.goal.trim()}\nObowiązkowe:\n${d.must.trim()}\nMile widziane:\n${d.nice.trim()}\nWidełki: ${d.from}–${d.to} PLN · ${d.mode}`;
    const desc = pos.description ? pos.description : summary;
    ctx.store.positions.update(pos.id, { description: desc }).then(() => { toast('Intake zakończony. Streszczenie zapisane w opisie stanowiska.', 'good'); ctx.navigate(`#/positions/${pos.id}`); }).catch((e) => toast(e.message || 'Nie udało się zapisać.', 'bad'));
  }
  async function remind() {
    const txt = `Cześć! Prosimy o uzgodnienie intake dla stanowiska ${pos.title}: ${location.origin}${location.pathname}#/positions/${pos.id}/intake`;
    try { await navigator.clipboard.writeText(txt); toast('Treść przypomnienia skopiowana do schowka. Wyślij ją hiring managerowi.', 'good'); }
    catch { toast(txt, 'neutral'); }
  }
  setHeader(ctx, { title: `Intake: ${pos.title}`, width: 'wide', actions: [
    button({ label: 'Wyślij przypomnienie', icon: 'bell', onClick: remind }), button({ label: 'Zakończ intake', variant: 'primary', icon: 'check', onClick: finish })] });
  draw();
  return h('div', { class: 'in' },
    h('p', { class: 'muted in-sub' }, 'Uzgodnij z hiring managerem kryteria, widełki i panel, zanim otworzysz rekrutację.'),
    h('div', { class: 'in-prog' }, bar, barTxt),
    h('div', { class: 'in-grid' }, nav, main));
}
