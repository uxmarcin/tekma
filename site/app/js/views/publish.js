/**
 * views/publish.js — Publikacje (#/publishing): projekt strony ogłoszenia + post i karta na LinkedIn.
 * Udostępnianie: okno „Udostępnij” LinkedIna z gotową treścią (bez API i bez logowania w imieniu użytkownika).
 * Status „opublikowano” trzyma localStorage (per firma, ta przeglądarka). Publiczny link do ogłoszenia wymaga osobnej migracji.
 */
import { renderAdPage, postText, drawShareCard, workLabel, contractLabel } from '../ad-page.js';
import { salaryLabel } from '../ad-check.js';
import { customPalette, renderGraphic, TEMPLATES, FORMATS, PALETTES } from '../ad-gfx.js';
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
  const PV = 'tekma_preview_pro'; let preview = false; try { preview = localStorage.getItem(PV) === '1'; } catch { /* brak storage */ }
  const setPreview = (v) => { preview = v; try { localStorage.setItem(PV, v ? '1' : '0'); } catch { /* brak storage */ } };
  const uploads = [];
  const custom = { mode: 'gradient', c1: '#2d68ff', c2: '#c084fc', c3: '#34d399', use3: false };
  const palArg = () => (gfx.palette === 'custom' ? customPalette({ mode: custom.mode, c1: custom.c1, c2: custom.c2, c3: custom.use3 ? custom.c3 : '' }) : gfx.palette);
  const gfx = { photo: null, template: 'mesh', format: 'li', palette: 'tekma', seed: 7, headline: '', cta: 'Aplikuj w 60 sekund', showSalary: true, showMeta: true, showCta: true, showOrg: true, showMark: true };
  const pub = readPub(ctx.org);
  const root = h('div', { class: 'pb' });
  const side = h('aside', { class: 'pb-rail' });
  const main = h('div', { class: 'pb-main' });
  root.append(side, main);

  const url = () => `${location.origin}${location.pathname.replace(/app\/?(index\.html)?$/, '')}`; // do czasu publicznych linków: strona główna Tekmy

  let sideExtra = null;
  const MODES = [['page', 'eye', 'Podgląd ogłoszenia', 'Tak widzi je kandydat'], ['gfx', 'palette', 'Design', `${TEMPLATES.length} stylów grafik`], ['post', 'megaphone', 'Publikacja', 'Post i udostępnianie na LinkedIn']];
  function paintSide() {
    const pick = h('select', { class: 'pb-pick', 'aria-label': 'Stanowisko' }, positions.map((p) => h('option', { value: p.id, selected: p.id === cur.id }, p.title)));
    pick.addEventListener('change', () => { cur = positions.find((p) => p.id === pick.value) || cur; paint(); });
    const modes = h('div', { class: 'pb-modes', role: 'tablist', 'aria-label': 'Widok' }, MODES.map(([k, ic, t, s]) => h('button', { type: 'button', role: 'tab', class: 'pb-mode', 'aria-selected': String(tab === k), on: { click: () => { tab = k; paint(); } } },
      h('span', { class: 'pb-mi' }, icon(ic)), h('span', { class: 'pb-mt' }, h('b', null, t), h('small', { class: 'muted' }, s)))));
    side.replaceChildren(h('label', { class: 'pb-pl' }, h('span', null, 'Stanowisko'), pick), modes, ...(sideExtra ? [sideExtra] : []));
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
    let rev = 0;
    const nameLbl = h('b', null, '');
    const seedLbl = h('span', { class: 'gx-seed muted' }, '');
    const gallery = h('div', { class: 'gx-gal', role: 'listbox', 'aria-label': 'Szablony' });
    const locked = (t) => !isPro && !preview && !FREE_TPL.includes(t.id);
    const proOnly = (t) => !isPro && !FREE_TPL.includes(t.id);
    const nLocked = TEMPLATES.filter(proOnly).length;
    const upsell = () => ctx.ui.modal({ title: `Odblokuj ${nLocked} stylów w Pro`, body: h('div', { class: 'gx-up' },
      h('p', null, `Free ma ${TEMPLATES.length - nLocked} style. Pro odblokowuje wszystkie ${TEMPLATES.length}: jasne, nocne, żywe i papierowe, w każdym formacie — LinkedIn, Instagram, Story i Facebook — oraz wyłączenie znaku Tekma.`),
      h('p', { class: 'muted' }, 'Nowe style dochodzą co miesiąc.')),
      actions: [{ label: 'Podejrzyj wszystkie style', variant: 'secondary', icon: 'eye', onClick: () => { setPreview(true); document.querySelector('.modal .close')?.click(); paint(); } }, { label: 'Zobacz plan Pro', variant: 'primary', icon: 'crown', onClick: () => { location.hash = '#/settings/plan'; document.querySelector('.modal .close')?.click(); } }] });
    const TONE_LBL = { light: 'Jasne', dark: 'Nocne', vivid: 'Żywe', paper: 'Papier' };
    let filter = 'all';
    const queue = { busy: false, items: [] };
    const pump = async () => { if (queue.busy) return; queue.busy = true; while (queue.items.length) { const b = queue.items.shift(); if (!b.isConnected || b._rev === rev) continue; b._rev = rev; const f = FORMATS.find((q) => q.id === gfx.format); await renderGraphic(b._c, { template: b.dataset.id, format: gfx.format, palette: palArg(), data: gfxData(), opts: gfxOpts(), seed: gfx.seed, photo: gfx.photo, scale: Math.min(1, 360 / f.w) }); } queue.busy = false; };
    const want = (b) => { if (b._rev !== rev && !queue.items.includes(b)) { queue.items.push(b); pump(); } };
    const io = new IntersectionObserver((es) => es.forEach((e) => { e.target._vis = e.isIntersecting; if (e.isIntersecting) want(e.target); }), { rootMargin: '300px' });
    const thumbs = TEMPLATES.map((t) => {
      const lk = locked(t); const c = h('canvas', { class: 'gx-th' });
      const b = h('button', { type: 'button', class: `gx-card${lk ? ' is-locked' : ''}`, role: 'option', 'aria-selected': 'false', 'data-id': t.id, 'aria-label': lk ? `${t.name} — styl Pro` : t.name, title: t.hint, on: { click: () => { if (lk) { upsell(); return; } gfx.template = t.id; draw(); } } },
        h('span', { class: 'gx-thw' }, c, proOnly(t) ? h('span', { class: 'gx-lk' }, icon('crown'), 'Pro') : h('span', { class: 'gx-fr' }, 'Free'), lk ? h('span', { class: 'gx-unl' }, icon('lock'), 'Odblokuj') : null), h('b', null, t.name));
      b._c = c; b._t = t; io.observe(b); return b;
    });
    const chips = [['all', `Wszystkie · ${TEMPLATES.length}`], ['free', `Free · ${TEMPLATES.length - nLocked}`], ['pro', `Pro · ${nLocked}`], ...Object.entries(TONE_LBL)];
    const chipBar = h('div', { class: 'gx-chips', role: 'group', 'aria-label': 'Filtr stylów' }, chips.map(([k, l]) => h('button', { type: 'button', class: 'gx-chip', 'aria-pressed': String(filter === k), 'data-k': k, on: { click: () => { filter = k; chipBar.querySelectorAll('button').forEach((q) => q.setAttribute('aria-pressed', String(q.dataset.k === k))); applyFilter(); } } }, l)));
    function applyFilter() { thumbs.forEach((b) => { const t = b._t; const ok = filter === 'all' || (filter === 'free' && !proOnly(t)) || (filter === 'pro' && proOnly(t)) || t.tone === filter; b.hidden = !ok; }); gallery.dataset.empty = String(thumbs.every((b) => b.hidden)); }
    thumbs.forEach((b) => gallery.append(b));
    function paintThumbs() { rev++; thumbs.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.id === gfx.template))); thumbs.filter((b) => b._vis && !b.hidden).forEach(want); }

    async function draw() {
      seedLbl.textContent = gfx.seed === 7 ? 'Układ domyślny' : `Układ nr ${gfx.seed}`;
      const data = gfxData(); const o = gfxOpts();
      await renderGraphic(big, { template: gfx.template, format: gfx.format, palette: palArg(), data, opts: o, seed: gfx.seed, photo: gfx.photo });
      const f = FORMATS.find((q) => q.id === gfx.format); bigWrap.style.setProperty('--ar', `${f.w} / ${f.h}`); bigWrap.dataset.fmt = gfx.format;
      nameLbl.textContent = TEMPLATES.find((t) => t.id === gfx.template).name;
      paintThumbs();
    }

    /* Tło: zdjęcie własne (zostaje w przeglądarce) lub z biblioteki */
    const MAXPX = 2400;
    const fileIn = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', hidden: true, 'aria-label': 'Wybierz zdjęcie z dysku' });
    const phBox = h('div', { class: 'gx-ph' });
    const useImg = (img, name) => { gfx.photo = { img, name, dim: gfx.photo ? gfx.photo.dim : 0.45, blur: gfx.photo ? gfx.photo.blur : 0 }; paintPhoto(); draw(); };
    async function addFile(file) {
      if (!file) return;
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { toast('Wybierz zdjęcie JPG, PNG lub WebP.', 'error'); return; }
      if (file.size > 15 * 1024 * 1024) { toast('Zdjęcie jest większe niż 15 MB.', 'error'); return; }
      try {
        const bmp = await createImageBitmap(file); const k = Math.min(1, MAXPX / Math.max(bmp.width, bmp.height));
        const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); bmp.close && bmp.close();
        const th = document.createElement('canvas'); th.width = 96; th.height = 64; const tk = Math.max(96 / c.width, 64 / c.height); th.getContext('2d').drawImage(c, (96 - c.width * tk) / 2, (64 - c.height * tk) / 2, c.width * tk, c.height * tk);
        uploads.unshift({ name: file.name, img: c, thumb: th }); useImg(c, file.name);
      } catch { toast('Nie udało się wczytać tego zdjęcia.', 'error'); }
    }
    fileIn.addEventListener('change', () => { addFile(fileIn.files[0]); fileIn.value = ''; });
    let libItems = [];
    const loadLib = (it) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => useImg(im, it.name); im.onerror = () => toast('Nie udało się wczytać zdjęcia z biblioteki.', 'error'); im.src = new URL(`../../assets/bg/${it.file}`, import.meta.url).href; };
    function paintPhoto() {
      const ph = gfx.photo;
      const sl = (label, key, max, unit) => { const out = h('output', null, `${Math.round(ph[key])}${unit}`); const i = h('input', { type: 'range', min: '0', max: String(max), value: String(ph[key]), 'aria-label': label }); i.addEventListener('input', () => { ph[key] = Number(i.value); if (key === 'dim') ph[key] = Number(i.value) / 100; out.textContent = `${Math.round(key === 'dim' ? ph[key] * 100 : ph[key])}${unit}`; later(); }); if (key === 'dim') i.value = String(Math.round(ph.dim * 100)); if (key === 'dim') out.textContent = `${Math.round(ph.dim * 100)}${unit}`; return h('label', { class: 'gx-rg' }, h('span', null, label), i, out); };
      phBox.replaceChildren(...[
        h('div', { class: 'gx-phr' }, button({ label: 'Dodaj własne zdjęcie', variant: 'secondary', size: 'sm', icon: 'plus', onClick: () => fileIn.click() }), ph ? button({ label: 'Usuń tło', variant: 'secondary', size: 'sm', onClick: () => { gfx.photo = null; paintPhoto(); draw(); } }) : null),
        uploads.length ? h('div', { class: 'gx-phl' }, uploads.map((u) => { const b = h('button', { type: 'button', class: 'gx-pht', 'aria-pressed': String(!!ph && ph.img === u.img), title: u.name, on: { click: () => useImg(u.img, u.name) } }, u.thumb); return b; })) : null,
        libItems.length ? h('div', { class: 'gx-phl' }, libItems.map((it) => h('button', { type: 'button', class: 'gx-pht', title: it.name, 'aria-label': it.name, on: { click: () => loadLib(it) } }, h('img', { src: new URL(`../../assets/bg/${it.thumb || it.file}`, import.meta.url).href, alt: '', loading: 'lazy' })))) : null,
        ph ? h('div', { class: 'gx-rgs' }, sl('Przyciemnienie', 'dim', 85, '%'), sl('Rozmycie', 'blur', 14, ' px')) : null,
        h('p', { class: 'gx-phn muted' }, ph ? 'Tekst na zdjęciu jest zawsze biały, a przyciemnienie dba o czytelność.' : 'Zdjęcie zostaje w Twojej przeglądarce i nie jest nigdzie wysyłane. Używaj tylko zdjęć, do których masz prawa.')].filter(Boolean));
    }
    paintPhoto();
    fetch(new URL('../../assets/bg/manifest.json', import.meta.url)).then((r) => (r.ok ? r.json() : [])).then((m) => { if (Array.isArray(m) && m.length) { libItems = m; paintPhoto(); } }).catch(() => {});

    const PLAT = { li: ['linkedin', 'LinkedIn'], ig: ['instagram', 'Instagram'], sq: ['square', 'Instagram · FB'], st: ['smartphone', 'Stories · Reels'], fb: ['facebook', 'Facebook'] };
    const fmts = h('div', { class: 'gx-fmts', role: 'group', 'aria-label': 'Format' }, FORMATS.map((f) => { const [ic, cap] = PLAT[f.id] || ['square', '']; return h('button', { type: 'button', class: 'gx-fmt', 'aria-pressed': String(gfx.format === f.id), 'data-f': f.id, on: { click: () => { gfx.format = f.id; fmts.querySelectorAll('button').forEach((q) => q.setAttribute('aria-pressed', String(q.dataset.f === f.id))); draw(); } } }, h('span', { class: 'gx-fi' }, icon(ic)), h('span', { class: 'gx-ft' }, h('b', null, f.label), h('small', { class: 'muted' }, cap)), h('em', { class: 'gx-fs' }, f.note)); }));
    const customBox = h('div', { class: 'gx-cu' });
    const colorIn = (key, label) => { const c = h('input', { type: 'color', class: 'gx-ci', value: custom[key], 'aria-label': label }); const t = h('input', { type: 'text', class: 'gx-ch', value: custom[key], maxlength: '7', 'aria-label': `${label} (HEX)`, spellcheck: 'false' });
      const set = (v) => { if (!/^#[0-9a-f]{6}$/i.test(v)) return; custom[key] = v.toLowerCase(); c.value = custom[key]; if (document.activeElement !== t) t.value = custom[key]; gfx.palette = 'custom'; syncSw(); later(); };
      c.addEventListener('input', () => { t.value = c.value; set(c.value); }); t.addEventListener('input', () => set(t.value.startsWith('#') ? t.value : `#${t.value}`));
      return h('label', { class: 'gx-cl' }, c, t); };
    function paintCustom() {
      customBox.replaceChildren(...[
        h('div', { class: 'segment gx-cm', role: 'group', 'aria-label': 'Rodzaj koloru' }, [['solid', 'Jednolity'], ['gradient', 'Gradient']].map(([k, l]) => h('button', { type: 'button', 'aria-pressed': String(custom.mode === k), on: { click: () => { custom.mode = k; gfx.palette = 'custom'; paintCustom(); markSw(); draw(); } } }, l))),
        h('div', { class: 'gx-cr' }, colorIn('c1', custom.mode === 'solid' ? 'Kolor' : 'Kolor 1'), ...(custom.mode === 'gradient' ? [colorIn('c2', 'Kolor 2'), ...(custom.use3 ? [colorIn('c3', 'Kolor 3')] : [])] : [])),
        custom.mode === 'gradient' ? button({ label: custom.use3 ? 'Usuń trzeci kolor' : 'Dodaj trzeci kolor', variant: 'secondary', size: 'sm', icon: custom.use3 ? null : 'plus', onClick: () => { custom.use3 = !custom.use3; paintCustom(); draw(); } }) : null].filter(Boolean));
      customBox.hidden = gfx.palette !== 'custom';
    }
    const swPreview = () => { const P = customPalette({ mode: custom.mode, c1: custom.c1, c2: custom.c2, c3: custom.use3 ? custom.c3 : '' }); return `linear-gradient(135deg,${P.a},${P.b} 55%,${P.c})`; };
    const swBtns = [...PALETTES.map((P) => h('button', { type: 'button', class: 'gx-swb', role: 'radio', title: P.name, 'data-p': P.id, 'aria-checked': String(gfx.palette === P.id), style: `background:linear-gradient(135deg,${P.a},${P.b} 55%,${P.c})`, on: { click: () => { gfx.palette = P.id; markSw(); draw(); } } })),
      h('button', { type: 'button', class: 'gx-swb gx-swc', role: 'radio', title: 'Własny kolor lub gradient', 'data-p': 'custom', 'aria-checked': String(gfx.palette === 'custom'), on: { click: () => { gfx.palette = 'custom'; markSw(); draw(); } } }, icon('plus'))];
    const sw = h('div', { class: 'gx-sw', role: 'radiogroup', 'aria-label': 'Paleta' }, swBtns);
    function syncSw() { swBtns.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.p === gfx.palette))); swBtns[swBtns.length - 1].style.background = gfx.palette === 'custom' ? swPreview() : ''; }
    function markSw() { syncSw(); paintCustom(); }
    paintCustom(); markSw();
    const head = h('input', { class: 'input', type: 'text', maxlength: '80', placeholder: cur.title, 'aria-label': 'Nagłówek na grafice', value: gfx.headline });
    const cta = h('input', { class: 'input', type: 'text', maxlength: '40', 'aria-label': 'Tekst przycisku', value: gfx.cta });
    let tm; const later = () => { clearTimeout(tm); tm = setTimeout(draw, 250); };
    head.addEventListener('input', () => { gfx.headline = head.value; later(); }); cta.addEventListener('input', () => { gfx.cta = cta.value; later(); });
    const tog = (key, label) => { const lockedMark = key === 'showMark' && !isPro; const i = h('input', { type: 'checkbox', checked: gfx[key], disabled: lockedMark }); i.addEventListener('change', () => { gfx[key] = i.checked; draw(); }); return h('label', { class: 'gx-tg', title: lockedMark ? 'Wyłączenie znaku Tekma jest w planie Pro' : null }, i, h('span', null, label), lockedMark ? h('a', { class: 'gx-pro', href: '#/settings/plan' }, icon('lock'), 'Pro') : null); };
    const noSal = !salaryLabel(cur);
    const gSide = h('div', { class: 'gx-side' },
      h('section', { class: 'card st-card' }, h('h2', { class: 'st-h' }, 'Format'), fmts),
      h('section', { class: 'card st-card' }, h('h2', { class: 'st-h' }, 'Tło'), phBox, fileIn),
      h('section', { class: 'card st-card' }, h('h2', { class: 'st-h' }, 'Kolory'), sw, customBox,
        button({ label: 'Losuj układ tła', variant: 'secondary', size: 'sm', icon: 'spark', onClick: () => { let n; do { n = Math.floor(Math.random() * 1e6) + 1; } while (n === 7 || n === gfx.seed); gfx.seed = n; draw(); } })),
      h('section', { class: 'card st-card' }, h('h2', { class: 'st-h' }, 'Treść'),
        h('label', { class: 'gx-l' }, 'Nagłówek', head), h('label', { class: 'gx-l' }, 'Przycisk', cta),
        tog('showOrg', 'Firma i dział'), tog('showSalary', 'Widełki'), tog('showMeta', 'Tryb pracy i forma umowy'), tog('showCta', 'Przycisk'), tog('showMark', 'Znak Tekma'),
        noSal ? h('div', { class: 'pb-note', style: 'margin-top:8px' }, h('p', { style: 'margin:0 0 8px' }, tag('Brak widełek', 'warn'), ' Design bez widełek nie spełnia zasad jawności wynagrodzeń.'), button({ label: 'Dodaj widełki', variant: 'secondary', size: 'sm', icon: 'edit', onClick: editAd })) : null));
    const dlOne = button({ label: 'Pobierz PNG', variant: 'primary', icon: 'arrow', onClick: () => { if (proOnly(TEMPLATES.find((t) => t.id === gfx.template))) { upsell(); return; } save(big, fileName(gfx.format)); } });
    const dlAll = button({ label: 'Pobierz wszystkie formaty', variant: 'secondary', onClick: async () => {
      if (proOnly(TEMPLATES.find((t) => t.id === gfx.template))) { upsell(); return; }
      const keep = gfx.format; const c = document.createElement('canvas');
      for (const f of FORMATS) { await renderGraphic(c, { template: gfx.template, format: f.id, palette: palArg(), data: gfxData(), opts: gfxOpts(), seed: gfx.seed, photo: gfx.photo }); await new Promise((res) => c.toBlob((b) => { const u = URL.createObjectURL(b); const a = h('a', { href: u, download: fileName(f.id) }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 1500); res(); })); await new Promise((r) => setTimeout(r, 250)); }
      gfx.format = keep; toast('Pobrano wszystkie formaty.', 'good');
    } });
    const main2 = h('div', { class: 'gx-main' }, h('div', { class: 'gx-bar' }, nameLbl, seedLbl, h('span', { class: 'gx-act' }, dlOne, dlAll)), bigWrap, h('div', { class: 'gx-strip-h' }, h('h2', { class: 'st-h', style: 'margin:0' }, `Style · ${TEMPLATES.length}`), chipBar), gallery);
    const banner = preview && !isPro ? h('div', { class: 'gx-pv' }, icon('crown'), h('span', null, h('b', null, 'Podgląd Pro. '), 'Oglądasz wszystkie style, ale pobranie stylów Pro wymaga planu Pro.'), button({ label: 'Wyłącz podgląd', variant: 'secondary', size: 'sm', onClick: () => { setPreview(false); paint(); } }), button({ label: 'Zobacz plan Pro', variant: 'primary', size: 'sm', onClick: () => { location.hash = '#/settings/plan'; } })) : null;
    main2.prepend(...(banner ? [banner] : []));
    sideExtra = gSide;
    draw();
    return main2;
  }

  function paint() {
    sideExtra = null;
    const edit = button({ label: 'Edytuj ogłoszenie', variant: 'secondary', icon: 'edit', onClick: editAd });
    const content = tab === 'page' ? pageTab() : (tab === 'gfx' ? gfxTab() : postTab());
    paintSide();
    const st = pub[cur.id] ? 'Opublikowano na LinkedIn' : (adCheck(cur).ready ? 'Gotowe do publikacji' : 'Do uzupełnienia');
    main.replaceChildren(h('div', { class: 'pb-top' }, h('div', null, h('h2', { class: 'pb-t' }, cur.title), h('small', { class: 'muted' }, st)), edit), content);
  }
  paint();
  return root;
}
