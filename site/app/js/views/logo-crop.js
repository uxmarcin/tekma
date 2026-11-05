/* views/logo-crop.js — wybór, kadrowanie i zmniejszanie logo firmy.
 * Obsługa: PNG, JPG, WebP, GIF, AVIF, SVG (rasteryzowane w przeglądarce — skrypty w SVG nigdy się nie wykonują).
 * Wynik: data-URL PNG (albo WebP, gdy PNG byłby za duży) 256×256 px. */

export const LOGO_SIZE = 256;          // px, rozmiar zapisanego logo
export const LOGO_MAX_FILE = 8 * 1024 * 1024;
export const LOGO_MAX_DATA = 280000;   // znaków data-URL (limit w bazie: 300000)
export const LOGO_ACCEPT = '.png,.jpg,.jpeg,.webp,.gif,.avif,.svg,image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml';

const STAGE = 288; // px, widoczne pole kadrowania

/** Wczytuje plik do <img>. Zwraca { img, w, h, url }. */
async function loadFile(file) {
  if (!file) throw new Error('Nie wybrano pliku.');
  if (file.size > LOGO_MAX_FILE) throw new Error('Plik jest za duży (max 8 MB).');
  const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name || '');
  if (!isSvg && !/^image\/(png|jpe?g|webp|gif|avif)$/.test(file.type)) throw new Error('Obsługiwane formaty: PNG, JPG, WebP, GIF, AVIF i SVG.');
  let blob = file;
  if (isSvg) {
    const text = await file.text();
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    const svg = doc.documentElement;
    if (!svg || svg.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) throw new Error('Ten plik SVG jest uszkodzony.');
    // SVG bez width/height nie ma rozmiaru w <img> (Firefox) — ustawiamy z viewBox.
    const vb = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    const hasW = parseFloat(svg.getAttribute('width')) > 0 && !/%$/.test(svg.getAttribute('width') || '');
    const hasH = parseFloat(svg.getAttribute('height')) > 0 && !/%$/.test(svg.getAttribute('height') || '');
    if (!hasW || !hasH) {
      const [, , vw, vh] = vb.length === 4 && vb[2] > 0 && vb[3] > 0 ? vb : [0, 0, 512, 512];
      const k = 1024 / Math.max(vw, vh);
      svg.setAttribute('width', String(Math.round(vw * k))); svg.setAttribute('height', String(Math.round(vh * k)));
    }
    if (!svg.getAttribute('xmlns')) svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
  }
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.decoding = 'async';
  await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('Nie udało się odczytać obrazu.')); img.src = url; });
  const w = img.naturalWidth || 512, h = img.naturalHeight || 512;
  if (w < 2 || h < 2) throw new Error('Obraz jest zbyt mały.');
  return { img, w, h, url, isSvg };
}

/**
 * Otwiera okno kadrowania. Zwraca Promise<string|null> (data-URL albo null, gdy anulowano).
 * ctx.ui — helpery z ui.js.
 */
export async function cropLogo(ctx, file) {
  const { h, button, modal, toast } = ctx.ui;
  let src;
  try { src = await loadFile(file); } catch (e) { toast(e.message, 'bad'); return null; }
  const { img, w, h: ih } = src;

  const contain = Math.min(STAGE / w, STAGE / ih);   // cały obraz widoczny
  const cover = Math.max(STAGE / w, STAGE / ih);     // pole wypełnione
  const maxZoom = Math.max(8, (cover / contain) * 4);
  let zoom = 1, ox = 0, oy = 0, bg = 'transparent';  // ox/oy: przesunięcie środka obrazu względem środka pola (px stage)

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const stage = h('canvas', { class: 'lc-stage', width: STAGE * dpr, height: STAGE * dpr, tabindex: '0', role: 'img', 'aria-label': 'Pole kadrowania logo. Przeciągnij, aby przesunąć, kółkiem lub suwakiem powiększ.' });
  stage.style.width = stage.style.height = STAGE + 'px';
  const sctx = stage.getContext('2d');

  const prevL = h('canvas', { class: 'lc-pv lg', width: 96, height: 96, 'aria-hidden': 'true' });
  const prevS = h('canvas', { class: 'lc-pv sm', width: 56, height: 56, 'aria-hidden': 'true' });
  const prevLc = prevL.getContext('2d'), prevSc = prevS.getContext('2d');

  function draw(c, size, { guides, checker }) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, c.canvas.width, c.canvas.height);
    const k = c.canvas.width / size;            // piksele canvasu na px stage
    c.scale(k, k);
    if (checker) {
      const s = 12;
      for (let y = 0; y < size; y += s) for (let x = 0; x < size; x += s) {
        c.fillStyle = ((x / s + y / s) % 2 === 0) ? '#f1f1f3' : '#fff'; c.fillRect(x, y, s, s);
      }
    }
    if (bg === 'white') { c.fillStyle = '#fff'; c.fillRect(0, 0, size, size); }
    const sc = contain * zoom;
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(img, size / 2 + ox - (w * sc) / 2, size / 2 + oy - (ih * sc) / 2, w * sc, ih * sc);
    if (guides) {
      c.strokeStyle = 'rgba(45,104,255,.9)'; c.lineWidth = 2; c.strokeRect(1, 1, size - 2, size - 2);
      c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1; c.beginPath();
      for (const t of [1 / 3, 2 / 3]) { c.moveTo(size * t, 0); c.lineTo(size * t, size); c.moveTo(0, size * t); c.lineTo(size, size * t); }
      c.stroke();
    }
  }
  function render() {
    draw(sctx, STAGE, { guides: true, checker: bg === 'transparent' });
    // podglądy: ten sam kadr w mniejszej skali
    for (const [c, size] of [[prevLc, 96], [prevSc, 56]]) {
      const k = size / STAGE, sc = contain * zoom * k;
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, size, size);
      if (bg === 'white') { c.fillStyle = '#fff'; c.fillRect(0, 0, size, size); }
      c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
      c.drawImage(img, size / 2 + ox * k - (w * sc) / 2, size / 2 + oy * k - (ih * sc) / 2, w * sc, ih * sc);
    }
  }

  function clamp() {
    const sc = contain * zoom, lim = (n) => Math.max(0, (n * sc) / 2 + STAGE / 2 - 24);
    ox = Math.max(-lim(w), Math.min(lim(w), ox)); oy = Math.max(-lim(ih), Math.min(lim(ih), oy));
  }
  const slider = h('input', { type: 'range', class: 'lc-range', min: '1', max: String(maxZoom), step: '0.01', value: '1', 'aria-label': 'Powiększenie' });
  function setZoom(z, fx = 0, fy = 0) {
    z = Math.max(1, Math.min(maxZoom, z));
    const k = z / zoom;                       // zoom względem punktu (fx, fy) w układzie środka pola
    ox = fx - (fx - ox) * k; oy = fy - (fy - oy) * k;
    zoom = z; slider.value = String(z); clamp(); render();
  }
  slider.addEventListener('input', () => setZoom(parseFloat(slider.value)));

  // przeciąganie
  let drag = null;
  stage.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, ox, oy }; stage.setPointerCapture(e.pointerId); stage.classList.add('is-drag'); });
  stage.addEventListener('pointermove', (e) => { if (!drag) return; ox = drag.ox + (e.clientX - drag.x); oy = drag.oy + (e.clientY - drag.y); clamp(); render(); });
  const end = () => { drag = null; stage.classList.remove('is-drag'); };
  stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = stage.getBoundingClientRect();
    setZoom(zoom * Math.exp(-e.deltaY * 0.0015), e.clientX - r.left - STAGE / 2, e.clientY - r.top - STAGE / 2);
  }, { passive: false });
  stage.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 20 : 6;
    const map = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (map[e.key]) { e.preventDefault(); ox += map[e.key][0]; oy += map[e.key][1]; clamp(); render(); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); setZoom(zoom * 1.1); }
    else if (e.key === '-') { e.preventDefault(); setZoom(zoom / 1.1); }
  });

  const fit = () => { ox = oy = 0; setZoom(1); };
  const fill = () => { ox = oy = 0; setZoom(cover / contain); };
  const bgBtns = [['transparent', 'Przezroczyste'], ['white', 'Białe']].map(([val, label]) => {
    const b = h('button', { type: 'button', 'aria-pressed': String(val === bg) }, label);
    b.addEventListener('click', () => { bg = val; bgBtns.forEach(([, x]) => x.setAttribute('aria-pressed', String(x === b))); render(); });
    return [val, b];
  });

  function exportData() {
    const out = document.createElement('canvas'); out.width = out.height = LOGO_SIZE;
    const c = out.getContext('2d');
    if (bg === 'white') { c.fillStyle = '#fff'; c.fillRect(0, 0, LOGO_SIZE, LOGO_SIZE); }
    const sc = contain * zoom * LOGO_SIZE / STAGE;
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(img, LOGO_SIZE / 2 + ox * LOGO_SIZE / STAGE - (w * sc) / 2, LOGO_SIZE / 2 + oy * LOGO_SIZE / STAGE - (ih * sc) / 2, w * sc, ih * sc);
    let data = out.toDataURL('image/png');
    if (data.length > LOGO_MAX_DATA) data = out.toDataURL('image/webp', 0.88);
    if (data.length > LOGO_MAX_DATA || !data.startsWith('data:image/')) throw new Error('Po zmniejszeniu logo nadal jest zbyt duże. Wybierz prostszy obraz.');
    return data;
  }

  return new Promise((resolve) => {
    let result = null;
    const save = button({ label: 'Zapisz logo', variant: 'primary', onClick: () => {
      try { result = exportData(); m.close(); } catch (e) { toast(e.message, 'bad'); }
    } });
    const body = h('div', { class: 'lc' },
      h('div', { class: 'lc-main' },
        stage,
        h('div', { class: 'lc-side' },
          h('div', { class: 'lc-pvs' }, prevL, prevS, h('small', { class: 'muted' }, 'Tak zobaczą je w aplikacji')),
          h('label', { class: 'lc-l' }, 'Powiększenie', slider),
          h('div', { class: 'lc-row' },
            button({ label: 'Dopasuj całość', size: 'sm', variant: 'secondary', onClick: fit }),
            button({ label: 'Wypełnij pole', size: 'sm', variant: 'secondary', onClick: fill })),
          h('div', { class: 'lc-l' }, 'Tło', h('div', { class: 'segment', role: 'group', 'aria-label': 'Tło logo' }, bgBtns.map(([, b]) => b))))),
      h('p', { class: 'muted lc-tip' }, 'Przeciągnij obraz, aby go ustawić. Powiększysz go kółkiem myszy albo suwakiem (strzałki i +/− działają po kliknięciu w pole).'));
    const m = modal({
      title: 'Kadruj logo firmy', body, size: 'lg',
      onClose: () => { URL.revokeObjectURL(src.url); resolve(result); },
      actions: [button({ label: 'Anuluj', variant: 'secondary', onClick: () => m.close() }), save],
    });
    // domyślnie: cały obraz widoczny; szerokie/wysokie logo nie jest ucinane
    render();
  });
}
