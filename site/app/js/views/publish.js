/**
 * views/publish.js — Publikacje (#/publishing): projekt strony ogłoszenia + post i karta na LinkedIn.
 * Udostępnianie: okno „Udostępnij” LinkedIna z gotową treścią (bez API i bez logowania w imieniu użytkownika).
 * Status „opublikowano” trzyma localStorage (per firma, ta przeglądarka). Publiczny link do ogłoszenia wymaga osobnej migracji.
 */
import { renderAdPage, postText, drawShareCard, workLabel, contractLabel } from '../ad-page.js';
import { salaryLabel } from '../ad-check.js';
import { renderGraphic, TEMPLATES, FORMATS, PALETTES } from '../ad-gfx.js';
import { adCheck } from '../ad-check.js';
import { openAdEditor } from './ad.js';
import { setHeader } from './positions.js';

const PUB_KEY = (org) => `tekma.published.${(org && org.id) || 'x'}`;
const readPub = (org) => { try { return JSON.parse(localStorage.getItem(PUB_KEY(org)) || '{}'); } catch { return {}; } };
const writePub = (org, v) => { try { localStorage.setItem(PUB_KEY(org), JSON.stringify(v)); } catch { /* brak storage */ } };

export default async function render(ctx) {
  const { h, button, tag, emptyState, toast, icon } = ctx.ui;
  await ctx.ui.loadCss(new URL('./publish.css', import.meta.url));
  setHeader(ctx, { title: 'Publikacje', width: 'wide' });
  const [all, rubrics] = await Promise.all([ctx.store.positions.list(), ctx.store.rubrics.list()]);
  const positions = all.filter((p) => p.status !== 'closed');
  if (!positions.length) return emptyState({ title: 'Brak otwartych stanowisk', text: 'Dodaj stanowisko, a przygotujemy jego ogłoszenie i post na LinkedIn.', icon: 'megaphone' });

  let cur = positions.find((p) => p.id === ctx.query?.id) || positions[0];
  let tab = 'page';
  const FREE_TPL = ['mesh', 'swiss', 'pastel']; const isPro = ctx.org && ['pro', 'business'].includes(ctx.org.plan);
  const gfx = { template: 'mesh', format: 'li', palette: 'tekma', seed: 7, headline: '', cta: 'Aplikuj w 60 sekund', showSalary: true, showMeta: true, showCta: true, showOrg: true, showMark: true };
  const pub = readPub(ctx.org);
  const root = h('div', { class: 'pb' });
  const side = h('aside', { class: 'card' });
  const main = h('div', { class: 'pb-main' });
  root.append(side, main);

  const url = () => `${location.origin}${location.pathname.replace(/app\/?(index\.html)?$/, '')}`; // do czasu publicznych linków: strona główna Tekmy

  function paintSide() {
    side.replaceChildren(h('ul', { class: 'pb-list' }, positions.map((p) => h('li', null,
      h('button', { type: 'button', class: 'pb-item', 'aria-current': String(p.id === cur.id), on: { click: () => { cur = p; paint(); } } },
        h('b', null, p.title), h('small', { class: 'muted' }, pub[p.id] ? 'Opublikowano na LinkedIn' : (adCheck(p).ready ? 'Gotowe do publikacji' : 'Do uzupełnienia')))))));
  }

  function editAd() { openAdEditor(ctx, cur, { onSaved: (u) => { Object.assign(cur, u); paint(); } }); }

  function pageTab() {
    const rub = rubrics.find((r) => r.id === cur.rubric_id);
    return h('div', null, renderAdPage({ position: cur, rubric: rub, org: ctx.org, h, onEdit: editAd }));
  }

  function postTab() {
    const area = h('textarea', { 'aria-label': 'Treść posta' }); area.value = postText(cur, ctx.org, url());
    const count = h('span', { class: 'muted pb-note' });
    const upd = () => { count.textContent = `${area.value.length} / 3000 znaków`; };
    area.addEventListener('input', upd); upd();
    const canvas = drawShareCard(cur, ctx.org); canvas.className = 'pb-card';
    const chk = adCheck(cur);
    const share = button({ label: 'Udostępnij na LinkedIn', variant: 'primary', icon: 'link', onClick: async () => {
      try { await navigator.clipboard.writeText(area.value); } catch { /* schowek niedostępny */ }
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url())}`, '_blank', 'noopener');
      toast('Treść posta skopiowana — wklej ją w oknie LinkedIna.', 'good');
    } });
    const copy = button({ label: 'Kopiuj treść', variant: 'secondary', icon: 'copy', onClick: async () => { try { await navigator.clipboard.writeText(area.value); toast('Skopiowano.', 'good'); } catch { toast('Nie udało się skopiować.', 'bad'); } } });
    const dl = button({ label: 'Pobierz kartę (PNG)', variant: 'secondary', onClick: () => canvas.toBlob((b) => {
      const u = URL.createObjectURL(b); const a = h('a', { href: u, download: `${cur.title.replace(/\W+/g, '-').toLowerCase()}-linkedin.png` });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 1000);
    }) });
    const mark = button({ label: pub[cur.id] ? 'Cofnij oznaczenie' : 'Oznacz jako opublikowane', variant: 'ghost', onClick: () => { if (pub[cur.id]) delete pub[cur.id]; else pub[cur.id] = new Date().toISOString(); writePub(ctx.org, pub); paint(); } });
    return h('div', { class: 'pb-post' },
      h('section', { class: 'card st-card' }, h('h2', { class: 'st-h' }, 'Treść posta'), area, h('div', { class: 'pb-row' }, count), h('div', { class: 'pb-row' }, share, copy)),
      h('section', { class: 'card st-card' }, h('h2', { class: 'st-h' }, 'Karta do posta'), canvas,
        h('div', { class: 'pb-row' }, dl, mark),
        chk.ready ? null : h('div', { class: 'pb-note', style: 'margin-top:10px' }, h('p', { style: 'margin:0 0 8px' }, tag('Do poprawy', 'warn'), ' Ogłoszenie nie przechodzi kontroli jawności wynagrodzeń.'), button({ label: 'Uzupełnij ogłoszenie', variant: 'secondary', size: 'sm', icon: 'edit', onClick: editAd })),
        h('p', { class: 'muted pb-note', style: 'margin-top:10px' }, 'Automatyczne publikowanie bez Twojego kliknięcia wymaga połączenia konta LinkedIn (autoryzacja OAuth) — dodamy je razem z publicznymi linkami do ogłoszeń.')));
  }


  function gfxData() {
    const sal = salaryLabel(cur);
    return { title: cur.title, org: ctx.org && ctx.org.name, dept: cur.department, salary: sal ? sal.replace(/\s?[A-Z]{3}$/, '') : '', currency: cur.salary_currency || 'PLN', meta: [workLabel(cur), contractLabel(cur)].filter(Boolean) };
  }
  const gfxOpts = () => ({ headline: gfx.headline, cta: gfx.cta, showSalary: gfx.showSalary, showMeta: gfx.showMeta, showCta: gfx.showCta, showOrg: gfx.showOrg, showMark: isPro ? gfx.showMark : true });
  const fileName = (fmt) => `${cur.title.replace(/\W+/g, '-').toLowerCase()}-${gfx.template}-${fmt}.png`;
  function save(canvas, name) { canvas.toBlob((b) => { const u = URL.createObjectURL(b); const a = h('a', { href: u, download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 1500); }); }

  function gfxTab() {
    let token = 0;
    const big = h('canvas', { class: 'gx-big', 'aria-label': 'Podgląd grafiki' });
    const bigWrap = h('div', { class: 'gx-stage' }, big);
    const gallery = h('div', { class: 'gx-gal', role: 'listbox', 'aria-label': 'Szablony' });
    const locked = (t) => !isPro && !FREE_TPL.includes(t.id);
    const nLocked = TEMPLATES.filter(locked).length;
    const upsell = () => ctx.ui.modal({ title: `Odblokuj ${nLocked} szablonów w Pro`, body: h('div', { class: 'gx-up' },
      h('p', null, `Free ma ${TEMPLATES.length - nLocked} szablony. Pro odblokowuje wszystkie ${TEMPLATES.length} — od Noir i Aurory po Brutal i Blueprint — w każdym formacie: LinkedIn, Instagram, Story, Facebook.`),
      h('ul', null, ...TEMPLATES.filter(locked).map((t) => h('li', null, h('b', null, t.name), ' — ', t.hint)))),
      actions: [{ label: 'Zobacz plan Pro', variant: 'primary', icon: 'crown', onClick: () => { location.hash = '#/settings/plan'; document.querySelector('.modal .close')?.click(); } }] });
    const thumbs = TEMPLATES.map((t) => {
      const lk = locked(t); const c = h('canvas', { class: 'gx-th' });
      const b = h('button', { type: 'button', class: `gx-card${lk ? ' is-locked' : ''}`, role: 'option', 'aria-selected': 'false', 'data-id': t.id, 'aria-label': lk ? `${t.name} — szablon Pro` : t.name, on: { click: () => { if (lk) { upsell(); return; } gfx.template = t.id; draw(); } } },
        h('span', { class: 'gx-thw' }, c, lk ? h('span', { class: 'gx-lk' }, icon('lock'), 'Pro') : null), h('b', null, t.name), h('small', { class: 'muted' }, t.hint));
      b._c = c; gallery.append(b); return b;
    });
    if (nLocked) gallery.append(h('div', { class: 'gx-more' }, h('b', null, `+${nLocked} szablonów w Pro`), h('p', { class: 'muted' }, 'Wszystkie style, nowe co miesiąc. Free zostaje z 3 szablonami na zawsze.'), button({ label: 'Odblokuj Pro', variant: 'primary', size: 'sm', icon: 'crown', onClick: upsell })));

    const seedLbl = h('span', { class: 'gx-seed muted' }, '');
    async function draw() {
      seedLbl.textContent = gfx.seed === 7 ? 'Układ domyślny' : `Układ nr ${gfx.seed}`;
      const my = ++token; const data = gfxData(); const o = gfxOpts();
      thumbs.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.id === gfx.template)));
      await renderGraphic(big, { template: gfx.template, format: gfx.format, palette: gfx.palette, data, opts: o, seed: gfx.seed });
      const f = FORMATS.find((q) => q.id === gfx.format); bigWrap.style.setProperty('--ar', `${f.w} / ${f.h}`); bigWrap.dataset.fmt = gfx.format;
      for (const b of thumbs) { if (my !== token) return; await renderGraphic(b._c, { template: b.dataset.id, format: gfx.format, palette: gfx.palette, data, opts: o, seed: gfx.seed }); }
    }

    const fmts = h('div', { class: 'gx-fmts', role: 'group', 'aria-label': 'Format' }, FORMATS.map((f) => h('button', { type: 'button', class: 'gx-fmt', 'aria-pressed': String(gfx.format === f.id), on: { click: (e) => { gfx.format = f.id; fmts.querySelectorAll('button').forEach((q, i) => q.setAttribute('aria-pressed', String(FORMATS[i].id === f.id))); draw(); } } }, h('b', null, f.label), h('small', { class: 'muted' }, f.note))));
    const sw = h('div', { class: 'gx-sw', role: 'radiogroup', 'aria-label': 'Paleta' }, PALETTES.map((P) => h('button', { type: 'button', class: 'gx-swb', role: 'radio', title: P.name, 'aria-checked': String(gfx.palette === P.id), style: `background:linear-gradient(135deg,${P.a},${P.b} 55%,${P.c})`, on: { click: () => { gfx.palette = P.id; sw.querySelectorAll('button').forEach((q, i) => q.setAttribute('aria-checked', String(PALETTES[i].id === P.id))); draw(); } } })));
    const head = h('input', { class: 'input', type: 'text', maxlength: '80', placeholder: cur.title, 'aria-label': 'Nagłówek na grafice', value: gfx.headline });
    const cta = h('input', { class: 'input', type: 'text', maxlength: '40', 'aria-label': 'Tekst przycisku', value: gfx.cta });
    let tm; const later = () => { clearTimeout(tm); tm = setTimeout(draw, 250); };
    head.addEventListener('input', () => { gfx.headline = head.value; later(); }); cta.addEventListener('input', () => { gfx.cta = cta.value; later(); });
    const tog = (key, label) => { const lockedMark = key === 'showMark' && !isPro; const i = h('input', { type: 'checkbox', checked: gfx[key], disabled: lockedMark }); i.addEventListener('change', () => { gfx[key] = i.checked; draw(); }); return h('label', { class: 'gx-tg', title: lockedMark ? 'Wyłączenie znaku Tekma jest w planie Pro' : null }, i, h('span', null, label), lockedMark ? h('a', { class: 'gx-pro', href: '#/settings/plan' }, icon('lock'), 'Pro') : null); };
    const noSal = !salaryLabel(cur);
    const side = h('div', { class: 'gx-side' },
      h('section', { class: 'card st-card' }, h('h2', { class: 'st-h' }, 'Format'), fmts),
      h('section', { class: 'card st-card' }, h('h2', { class: 'st-h' }, 'Kolory'), sw,
        button({ label: 'Losuj układ tła', variant: 'secondary', size: 'sm', icon: 'spark', onClick: () => { let n; do { n = Math.floor(Math.random() * 1e6) + 1; } while (n === 7 || n === gfx.seed); gfx.seed = n; draw(); } })),
      h('section', { class: 'card st-card' }, h('h2', { class: 'st-h' }, 'Treść'),
        h('label', { class: 'gx-l' }, 'Nagłówek', head), h('label', { class: 'gx-l' }, 'Przycisk', cta),
        tog('showOrg', 'Firma i dział'), tog('showSalary', 'Widełki'), tog('showMeta', 'Tryb pracy i forma umowy'), tog('showCta', 'Przycisk'), tog('showMark', 'Znak Tekma'),
        noSal ? h('div', { class: 'pb-note', style: 'margin-top:8px' }, h('p', { style: 'margin:0 0 8px' }, tag('Brak widełek', 'warn'), ' Design bez widełek nie spełnia zasad jawności wynagrodzeń.'), button({ label: 'Dodaj widełki', variant: 'secondary', size: 'sm', icon: 'edit', onClick: editAd })) : null));
    const dlOne = button({ label: 'Pobierz PNG', variant: 'primary', icon: 'arrow', onClick: () => save(big, fileName(gfx.format)) });
    const dlAll = button({ label: 'Pobierz wszystkie formaty', variant: 'secondary', onClick: async () => {
      const keep = gfx.format; const c = document.createElement('canvas');
      for (const f of FORMATS) { await renderGraphic(c, { template: gfx.template, format: f.id, palette: gfx.palette, data: gfxData(), opts: gfxOpts(), seed: gfx.seed }); await new Promise((res) => c.toBlob((b) => { const u = URL.createObjectURL(b); const a = h('a', { href: u, download: fileName(f.id) }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 1500); res(); })); await new Promise((r) => setTimeout(r, 250)); }
      gfx.format = keep; toast('Pobrano wszystkie formaty.', 'good');
    } });
    const main2 = h('div', { class: 'gx-main' }, h('div', { class: 'gx-bar' }, h('b', null, TEMPLATES.find((t) => t.id === gfx.template).name), seedLbl, h('span', { class: 'gx-act' }, dlOne, dlAll)), bigWrap, h('h2', { class: 'st-h', style: 'margin:18px 0 10px' }, '12 szablonów'), gallery);
    const wrap = h('div', { class: 'gx' }, side, main2);
    draw();
    return wrap;
  }

  function paint() {
    paintSide();
    const edit = button({ label: 'Edytuj ogłoszenie', variant: 'secondary', icon: 'edit', onClick: editAd });
    const seg = h('div', { class: 'segment pb-tabs', role: 'group', 'aria-label': 'Widok' },
      [['page', 'Strona ogłoszenia'], ['gfx', 'Design'], ['post', 'Post na LinkedIn']].map(([k, l]) => h('button', { type: 'button', 'aria-pressed': String(tab === k), on: { click: () => { tab = k; paint(); } } }, l)));
    main.replaceChildren(h('div', { class: 'pb-row', style: 'justify-content:space-between;margin:0' }, seg, edit), tab === 'page' ? pageTab() : (tab === 'gfx' ? gfxTab() : postTab()));
  }
  paint();
  return root;
}
