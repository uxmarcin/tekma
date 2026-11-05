/**
 * views/publish.js — Publikacje (#/publishing): projekt strony ogłoszenia + post i karta na LinkedIn.
 * Udostępnianie: okno „Udostępnij” LinkedIna z gotową treścią (bez API i bez logowania w imieniu użytkownika).
 * Status „opublikowano” trzyma localStorage (per firma, ta przeglądarka). Publiczny link do ogłoszenia wymaga osobnej migracji.
 */
import { renderAdPage, postText, drawShareCard } from '../ad-page.js';
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

  function paint() {
    paintSide();
    const edit = button({ label: 'Edytuj ogłoszenie', variant: 'secondary', icon: 'edit', onClick: editAd });
    const seg = h('div', { class: 'segment pb-tabs', role: 'group', 'aria-label': 'Widok' },
      [['page', 'Strona ogłoszenia'], ['post', 'Post na LinkedIn']].map(([k, l]) => h('button', { type: 'button', 'aria-pressed': String(tab === k), on: { click: () => { tab = k; paint(); } } }, l)));
    main.replaceChildren(h('div', { class: 'pb-row', style: 'justify-content:space-between;margin:0' }, seg, edit), tab === 'page' ? pageTab() : postTab());
  }
  paint();
  return root;
}
