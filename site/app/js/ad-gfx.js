/**
 * ad-gfx.js — silnik grafik do ogłoszeń: 12 oryginalnych stylów × formaty social (LinkedIn, Instagram, Facebook).
 * Wszystko rysowane na <canvas> (bez zewnętrznych zasobów); jeden silnik układu (tytuł, widełki, meta, CTA),
 * style różnią się tłem, typografią, dekoracjami i sposobem pokazania widełek.
 *   FORMATS, PALETTES, TEMPLATES
 *   renderGraphic(canvas, { template, format, palette, data, opts, seed })
 *   data: { title, org, dept, salary, currency, meta[] }   opts: { headline, cta, showSalary, showMeta, showCta, showOrg, showMark }
 */
export const FORMATS = [
  { id: 'li', label: 'LinkedIn post', note: '1200×627', w: 1200, h: 627 },
  { id: 'ig', label: 'Instagram post', note: '1080×1350', w: 1080, h: 1350 },
  { id: 'sq', label: 'Kwadrat', note: '1080×1080', w: 1080, h: 1080 },
  { id: 'st', label: 'Story / Reels', note: '1080×1920', w: 1080, h: 1920 },
  { id: 'fb', label: 'Facebook post', note: '1200×630', w: 1200, h: 630 },
];

export const PALETTES = [
  { id: 'tekma', name: 'Tekma', a: '#2d68ff', b: '#c084fc', c: '#34d399' },
  { id: 'sunset', name: 'Zachód', a: '#ff5a36', b: '#ffb020', c: '#ff4d8d' },
  { id: 'lime', name: 'Limonka', a: '#9be400', b: '#00c2a8', c: '#2d68ff' },
  { id: 'violet', name: 'Fiolet', a: '#7c3aed', b: '#ec4899', c: '#38bdf8' },
  { id: 'ocean', name: 'Ocean', a: '#0ea5e9', b: '#2563eb', c: '#22d3ee' },
  { id: 'rose', name: 'Róż', a: '#f43f5e', b: '#fb923c', c: '#a855f7' },
  { id: 'forest', name: 'Las', a: '#10b981', b: '#84cc16', c: '#0ea5e9' },
  { id: 'mono', name: 'Mono', a: '#18181b', b: '#71717a', c: '#d4d4d8' },
];

/* ---------- pomocnicze ---------- */
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a, b, t) => { const x = hex(a), y = hex(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const rgba = (h, al) => { const [r, g, b] = hex(h); return `rgba(${r},${g},${b},${al})`; };
const lum = (h) => { const [r, g, b] = hex(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
const onColor = (bg) => (lum(bg) > 0.62 ? '#0f0f12' : '#ffffff');
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const rlum = (h) => { const [r, g, b] = hex(h); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
export const contrast = (a, b) => { const x = rlum(a), y = rlum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
/** Gwarantuje czytelność koloru akcentu na danym tle (min. 3:1 — duży tekst): rozjaśnia lub przyciemnia, aż będzie widoczny. */
export function ensure(color, bg, min = 3.2) {
  let c = color; const toward = rlum(bg) < 0.4 ? '#ffffff' : '#000000';
  for (let i = 0; i < 20 && contrast(c, bg) < min; i++) c = mix(c, toward, 0.14);
  return c;
}
const deepen = (c) => { let o = c; for (let i = 0; i < 12 && rlum(o) > 0.2; i++) o = mix(o, '#000000', 0.12); return o; };
function rng(seed) { let s = (seed || 1) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function rr(x, c, X, Y, w, h, r) { x.beginPath(); x.roundRect ? x.roundRect(X, Y, w, h, r) : x.rect(X, Y, w, h); }
function blob(x, cx, cy, r, color, al = 1) { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, rgba(color, al)); g.addColorStop(1, rgba(color, 0)); x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2); }
function grain(x, W, H, r, al = 0.05) { x.save(); for (let i = 0; i < (W * H) / 380; i++) { x.fillStyle = r() > 0.5 ? `rgba(255,255,255,${al})` : `rgba(0,0,0,${al})`; x.fillRect(r() * W, r() * H, 1.4, 1.4); } x.restore(); }
function wrap(x, text, maxW) { const words = String(text).split(/\s+/).filter(Boolean); const lines = []; let line = ''; for (const w of words) { const t = line ? `${line} ${w}` : w; if (x.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; } if (line) lines.push(line); return lines; }

/* ---------- silnik układu ---------- */
function compose(x, W, H, P, d, o, st) {
  const land = W >= H * 1.5;
  const s = Math.min(W / 1080, H / (land ? 650 : 1080));
  const pad = Math.round(land ? 0.062 * W : 0.075 * W) + (st.padExtra || 0) * s;
  const cw = W - pad * 2;
  const center = st.align === 'center';
  const ax = center ? W / 2 : pad;
  const ink = st.ink, sub = st.sub, acc = st.acc;
  const F = (w, size, fam = st.font) => `${w} ${size}px ${fam}`;
  const LS = (v) => { if (x.letterSpacing !== undefined) x.letterSpacing = `${v}px`; };
  x.textAlign = center ? 'center' : 'left'; x.textBaseline = 'alphabetic';

  // 1) stopka: CTA, meta — mierzymy, żeby nic się nie nakładało
  const ctaH = o.showCta ? 76 * s : 0;
  const footY = H - pad;
  const ctaTop = footY - ctaH;
  let metaLines = [];
  if (o.showMeta && d.meta && d.meta.length) {
    x.font = F(500, 28 * s, st.small || st.font); LS(0);
    const txt = d.meta.join('   ·   '); metaLines = wrap(x, st.upperSmall ? txt.toUpperCase() : txt, cw).slice(0, 2);
  }
  const metaH = metaLines.length ? metaLines.length * 40 * s : 0;
  const gap = 30 * s;
  const metaBottom = ctaTop - (o.showCta ? gap : 0);          // linia bazowa ostatniego wiersza meta
  const metaTop = metaBottom - metaH;
  const salaryBottom = metaTop - (metaH ? 18 * s : 0) - (o.showCta && !metaH ? gap * 0 : 0);

  // 2) widełki: rozmiar po szerokości; wysokość bloku do rezerwacji
  const hasSal = !!(o.showSalary && d.salary);
  let sfs = (land ? 80 : 128) * s * (st.salaryScale || 1);
  if (hasSal) { x.font = F(st.salaryWeight, sfs); LS((st.titleTrack || 0) * sfs); while (x.measureText(d.salary).width > cw - (st.salary === 'box' ? 80 * s : 0) - 20 * s && sfs > 36 * s) { sfs -= 3 * s; x.font = F(st.salaryWeight, sfs); } }
  let salH = hasSal ? sfs * 1.35 + 46 * s : 0;               // liczba + etykieta nad nią

  // 3) nagłówek strony: firma
  let y = pad + 24 * s;
  if (o.showOrg && (d.org || d.dept)) {
    const t = [d.org, d.dept].filter(Boolean).join('  ·  ');
    x.font = F(600, 26 * s, st.small || st.font); x.fillStyle = sub; LS((st.track || 0) + 1.5 * s);
    x.fillText(st.upperSmall ? t.toUpperCase() : t, ax, y); LS(0);
  }
  const titleTop = y + (land ? 34 : 70) * s + (st.topGap || 0) * s;

  // 4) tytuł: największy rozmiar, który mieści się między nagłówkiem a widełkami
  const titleText = String(o.headline || d.title);
  const T = st.upperTitle ? titleText.toUpperCase() : titleText;
  const maxLines = land ? 2 : 4;
  const availH = (hasSal ? salaryBottom - salH : metaTop - gap) - titleTop - 16 * s;
  let size = (land ? 84 : 132) * s * (st.titleScale || 1), lines = [], lh = 0;
  for (; size >= 34 * s; size -= 3 * s) {
    x.font = F(st.titleWeight, size); LS((st.titleTrack || 0) * size); lines = wrap(x, T, cw); lh = size * (st.titleLH || 1.04);
    if (lines.length <= maxLines && lines.every((l) => x.measureText(l).width <= cw) && size + (lines.length - 1) * lh <= availH) break;
  }
  x.fillStyle = ink;
  lines.forEach((l, i) => {
    const yy = titleTop + size * 0.92 + i * lh;
    if (st.titleStroke && i === 0) { x.strokeStyle = ink; x.lineWidth = 2.4 * s; x.strokeText(l, ax, yy); } else x.fillText(l, ax, yy);
  });
  LS(0);

  // 5) widełki
  if (hasSal) {
    x.font = F(st.salaryWeight, sfs); LS((st.titleTrack || 0) * sfs);
    const nw = x.measureText(d.salary).width;
    const cur = d.currency || 'PLN';
    const labelText = `${st.labelPrefix || ''}Widełki brutto / mies. · ${cur}`;
    const lab = (yy) => { LS(0); x.font = F(600, 24 * s, st.small || st.font); x.fillStyle = sub; x.fillText(st.upperSmall ? labelText.toUpperCase() : labelText, ax, yy); };
    const base = salaryBottom;
    if (st.salary === 'box' || st.salary === 'pill') {
      const bw = nw + 72 * s, bh = sfs * 1.3; const bx = center ? (W - bw) / 2 : pad; const by = base - bh + 4 * s;
      if (st.salary === 'box') {
        if (st.salaryBorder) { x.fillStyle = '#000'; rr(x, 0, bx + 8 * s, by + 8 * s, bw, bh, 8 * s); x.fill(); }
        x.fillStyle = st.salaryBg; rr(x, 0, bx, by, bw, bh, 8 * s); x.fill(); if (st.salaryBorder) { x.strokeStyle = '#000'; x.lineWidth = 4 * s; x.stroke(); }
        x.fillStyle = onColor(st.salaryBg);
      } else { x.strokeStyle = acc; x.lineWidth = 3 * s; rr(x, 0, bx, by, bw, bh, bh / 2); x.stroke(); x.fillStyle = ink; }
      x.font = F(st.salaryWeight, sfs); LS((st.titleTrack || 0) * sfs); x.textAlign = 'center'; x.fillText(d.salary, bx + bw / 2, by + bh * 0.74); x.textAlign = center ? 'center' : 'left';
      lab(by - 16 * s);
    } else if (st.salary === 'outline') { x.strokeStyle = acc; x.lineWidth = 3 * s; x.strokeText(d.salary, ax, base); lab(base - sfs - 8 * s); }
    else { x.fillStyle = acc; x.fillText(d.salary, ax, base); lab(base - sfs - 8 * s); }
    LS(0);
  }

  // 6) meta
  if (metaLines.length) { x.font = F(500, 28 * s, st.small || st.font); x.fillStyle = sub; LS(0); metaLines.forEach((l, i) => x.fillText(l, ax, metaTop + 28 * s + i * 40 * s)); }

  // 7) CTA + znak
  if (o.showCta) {
    const txt = `${o.cta || 'Aplikuj w 60 sekund'}  →`; const fs = 30 * s; x.font = F(700, fs, st.small || st.font); LS(0);
    const tw = x.measureText(txt).width; const bw = tw + 64 * s, bh = ctaH; const bx = center ? (W - bw) / 2 : pad; const by = ctaTop;
    x.save();
    if (st.cta === 'pill') { x.fillStyle = st.ctaBg; rr(x, 0, bx, by, bw, bh, bh / 2); x.fill(); x.fillStyle = onColor(st.ctaBg); }
    else if (st.cta === 'box') { x.strokeStyle = ink; x.lineWidth = 3 * s; rr(x, 0, bx, by, bw, bh, 6 * s); x.stroke(); x.fillStyle = ink; }
    else if (st.cta === 'brutal') { x.fillStyle = '#000'; rr(x, 0, bx + 8 * s, by + 8 * s, bw, bh, 6 * s); x.fill(); x.fillStyle = st.ctaBg; rr(x, 0, bx, by, bw, bh, 6 * s); x.fill(); x.strokeStyle = '#000'; x.lineWidth = 4 * s; x.stroke(); x.fillStyle = '#000'; }
    else { x.fillStyle = ink; x.fillRect(bx + 32 * s, by + bh - 8 * s, tw, 3 * s); }
    x.textAlign = 'center'; x.fillText(txt, bx + bw / 2, by + bh / 2 + fs * 0.35); x.restore();
    x.textAlign = center ? 'center' : 'left';
  }
  if (o.showMark) {
    // logo Tekmy: znak (dwa kształty z SVG strony) + wordmark; kolor znaku dobrany do tła szablonu
    const fs2 = 36 * s, k = (42 * s) / 32; const yb = footY - (o.showCta ? 22 * s : 0);
    x.font = F(600, fs2, SANS); LS(-0.045 * fs2); const tw = x.measureText('tekma').width; LS(0);
    const xr = W - pad; const wx = xr - tw; const gap = 8 * s; const mw = 26 * k;
    x.save(); x.translate(wx - gap - mw - 3 * k, yb - 28 * k); x.scale(k, k); x.fillStyle = st.mark || '#2d68ff';
    x.fill(new Path2D('M3 6H17.5V22.5L12.5 28V12H3Z')); x.fill(new Path2D('M20 6H29L20 12.5Z')); x.restore();
    x.font = F(600, fs2, SANS); LS(-0.045 * fs2); x.fillStyle = st.ink; x.textAlign = 'left'; x.fillText('tekma', wx, yb); LS(0); x.textAlign = center ? 'center' : 'left';
  }
  return { s, pad };
}

/* ---------- 12 stylów ---------- */
const SANS = 'Inter, "Helvetica Neue", Arial, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

export const TEMPLATES = [
  { id: 'mesh', name: 'Mesh', hint: 'Jasny, miękki gradient — znak firmowy Tekmy',
    st: (P) => ({ font: SANS, titleWeight: 700, salaryWeight: 700, ink: '#0f0f12', sub: '#5f5f6b', acc: '#0f0f12', cta: 'pill', ctaBg: '#0f0f12', titleTrack: -0.035, align: 'left' }),
    bg(x, W, H, P, r) { x.fillStyle = '#fafafa'; x.fillRect(0, 0, W, H); const m = Math.max(W, H); blob(x, W * (0.1 + r() * 0.2), H * 0.12, m * 0.55, P.a, 0.5); blob(x, W * (0.8 + r() * 0.15), H * 0.15, m * 0.5, P.b, 0.5); blob(x, W * (0.4 + r() * 0.2), H * 1.0, m * 0.55, P.c, 0.42); blob(x, W * 0.92, H * 0.85, m * 0.35, '#fb92b4', 0.38); } },
  { id: 'noir', name: 'Noir', hint: 'Czarne tło, neonowa poświata i ziarno',
    st: (P) => ({ font: SANS, titleWeight: 800, salaryWeight: 800, ink: '#fafafa', sub: '#a1a1aa', acc: ensure(P.a, '#09090b'), cta: 'pill', ctaBg: ensure(P.a, '#09090b'), titleTrack: -0.04, align: 'left' }),
    bg(x, W, H, P, r) { x.fillStyle = '#09090b'; x.fillRect(0, 0, W, H); blob(x, W * 0.85, H * 0.95, Math.max(W, H) * 0.7, ensure(P.a, '#09090b', 2), 0.55); blob(x, W * 0.1, H * 0.05, Math.max(W, H) * 0.4, ensure(P.b, '#09090b', 2), 0.22); grain(x, W, H, r, 0.05); },
    deco(x, W, H, P) { x.fillStyle = ensure(P.a, '#09090b'); x.fillRect(0, 0, W, 8); } },
  { id: 'brutal', name: 'Brutal', hint: 'Neo-brutalizm: grube obrysy, przesunięte cienie, naklejka',
    st: (P) => ({ mark: '#000000', font: SANS, titleWeight: 800, salaryWeight: 800, ink: '#000', sub: '#222', acc: '#000', cta: 'brutal', ctaBg: P.b, salary: 'box', salaryBg: P.a, salaryBorder: true, upperTitle: true, titleTrack: -0.03, align: 'left', upperSmall: true }),
    bg(x, W, H, P) { x.fillStyle = '#fff6dc'; x.fillRect(0, 0, W, H); x.strokeStyle = '#000'; x.lineWidth = 6; x.strokeRect(14, 14, W - 28, H - 28); },
    deco(x, W, H, P) { const s = Math.min(W, H) / 1080, r = 112 * s, cx = W - 0.075 * W - r - 4 * s, cy = H - 0.075 * W - 76 * s - r - 270 * s; x.save(); x.translate(cx, cy); x.rotate(0.22); x.fillStyle = '#000'; x.beginPath(); x.arc(8 * s, 8 * s, r, 0, 7); x.fill(); x.fillStyle = P.c; x.beginPath(); x.arc(0, 0, r, 0, 7); x.fill(); x.lineWidth = 5 * s; x.strokeStyle = '#000'; x.stroke(); x.fillStyle = '#000'; x.font = `800 ${28 * s}px ${SANS}`; x.textAlign = 'center'; x.fillText('WIDEŁKI', 0, -4 * s); x.fillText('OD POCZĄTKU', 0, 30 * s); x.restore(); } },
  { id: 'swiss', name: 'Swiss', hint: 'Siatka, gruba linia, wielki okrąg — styl międzynarodowy',
    st: (P) => ({ font: SANS, titleWeight: 700, salaryWeight: 700, ink: '#0f0f12', sub: '#52525b', acc: ensure(P.a, '#f7f6f2'), cta: 'text', titleTrack: -0.045, align: 'left', upperSmall: true }),
    bg(x, W, H, P) { x.fillStyle = '#f7f6f2'; x.fillRect(0, 0, W, H); x.fillStyle = P.a; x.beginPath(); x.arc(W * 1.0, H * 0.5, Math.min(W, H) * 0.3, 0, 7); x.fill(); x.fillStyle = '#0f0f12'; x.fillRect(0, 0, W, 14); } },
  { id: 'aurora', name: 'Aurora', hint: 'Ciemne niebo z rozmytymi wstęgami światła',
    st: (P) => ({ mark: '#ffffff', font: SANS, titleWeight: 700, salaryWeight: 700, ink: '#ffffff', sub: '#b4b4c7', acc: '#ffffff', cta: 'pill', ctaBg: '#ffffff', titleTrack: -0.035, align: 'left' }),
    bg(x, W, H, P, r) { x.fillStyle = '#05060f'; x.fillRect(0, 0, W, H); x.save(); x.filter = `blur(${Math.round(Math.min(W, H) * 0.07)}px)`; [[P.a, 0.35], [P.b, 0.6], [P.c, 0.85]].forEach(([c, t]) => { x.save(); x.translate(W * (0.2 + r() * 0.6), H * t); x.rotate(-0.5 + r() * 0.4); x.fillStyle = rgba(c, 0.6); x.beginPath(); x.ellipse(0, 0, W * 0.65, Math.min(W, H) * 0.12, 0, 0, 7); x.fill(); x.restore(); }); x.restore(); grain(x, W, H, r, 0.035); } },
  { id: 'glass', name: 'Glass', hint: 'Matowe szkło na kolorowych plamach',
    st: (P) => ({ mark: '#ffffff', font: SANS, titleWeight: 700, salaryWeight: 700, ink: '#ffffff', sub: 'rgba(255,255,255,.78)', acc: '#ffffff', cta: 'pill', ctaBg: '#ffffff', titleTrack: -0.03, align: 'left', padExtra: 26 }),
    bg(x, W, H, P, r) { const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, deepen(mix(P.a, '#0b0b1a', 0.35))); g.addColorStop(0.55, deepen(mix(P.b, '#0b0b1a', 0.35))); g.addColorStop(1, deepen(mix(P.c, '#0b0b1a', 0.35))); x.fillStyle = g; x.fillRect(0, 0, W, H); const m = Math.max(W, H); blob(x, W * 0.15, H * 0.2, m * 0.4, P.c, 0.8); blob(x, W * 0.85, H * 0.8, m * 0.45, P.a, 0.8); blob(x, W * 0.7, H * 0.1, m * 0.3, P.b, 0.7); const m2 = Math.min(W, H) * 0.045; x.fillStyle = 'rgba(255,255,255,.14)'; rr(x, 0, m2, m2, W - m2 * 2, H - m2 * 2, 34); x.fill(); x.strokeStyle = 'rgba(255,255,255,.4)'; x.lineWidth = 2; x.stroke(); } },
  { id: 'pastel', name: 'Pastel', hint: 'Ciepłe, obłe kształty i duży, przyjazny krój',
    st: (P) => ({ font: SANS, titleWeight: 800, salaryWeight: 800, ink: '#1c1b3a', sub: '#55557a', acc: mix(P.a, '#1c1b3a', 0.25), cta: 'pill', ctaBg: '#1c1b3a', titleTrack: -0.03, align: 'left' }),
    bg(x, W, H, P, r) { x.fillStyle = mix(P.a, '#ffffff', 0.88); x.fillRect(0, 0, W, H); const m = Math.min(W, H); x.fillStyle = mix(P.b, '#ffffff', 0.55); x.beginPath(); x.arc(W * 0.9, H * 0.12, m * 0.3, 0, 7); x.fill(); x.fillStyle = mix(P.c, '#ffffff', 0.55); x.beginPath(); x.ellipse(W * 0.08, H * 0.98, m * 0.4, m * 0.28, 0.3, 0, 7); x.fill(); x.fillStyle = mix(P.a, '#ffffff', 0.6); x.beginPath(); x.arc(W * 0.78, H * 0.72, m * 0.1, 0, 7); x.fill(); } },
  { id: 'terminal', name: 'Terminal', hint: 'Dla zespołów technicznych: konsola i kod',
    st: (P) => ({ mark: '#4ade80', font: MONO, titleWeight: 700, salaryWeight: 700, ink: '#e6ffe9', sub: '#6fbf84', acc: '#4ade80', cta: 'box', titleTrack: -0.02, align: 'left', labelPrefix: '// ', topGap: 30, titleScale: 0.82, salaryScale: 0.85 }),
    bg(x, W, H, P, r) { x.fillStyle = '#07100a'; x.fillRect(0, 0, W, H); const s = Math.min(W, H) / 1080; x.fillStyle = '#0d1b11'; x.fillRect(0, 0, W, 70 * s); ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => { x.fillStyle = c; x.beginPath(); x.arc((46 + i * 38) * s, 35 * s, 11 * s, 0, 7); x.fill(); }); x.fillStyle = '#6fbf84'; x.font = `500 ${24 * s}px ${MONO}`; x.fillText('~/jobs/apply.sh', 190 * s, 44 * s); x.fillStyle = 'rgba(74,222,128,.05)'; for (let i = 0; i < H; i += 6) x.fillRect(0, i, W, 1); } },
  { id: 'editorial', name: 'Editorial', hint: 'Magazynowy układ z szeryfem i cienkimi liniami',
    st: (P) => ({ mark: '#1a1814', font: SERIF, small: SANS, titleWeight: 700, salaryWeight: 700, ink: '#1a1814', sub: '#6b6558', acc: ensure(P.a, '#f3efe6'), cta: 'text', titleTrack: -0.02, titleLH: 1.02, align: 'left', upperSmall: true, topGap: 14 }),
    bg(x, W, H, P) { x.fillStyle = '#f3efe6'; x.fillRect(0, 0, W, H); const s = Math.min(W, H) / 1080, p = W * 0.05; x.fillStyle = '#1a1814'; x.fillRect(p, p * 0.8, W - p * 2, 3); x.fillRect(p, p * 0.8 + 9, W - p * 2, 1); x.fillRect(p, H - p * 0.8, W - p * 2, 1); x.font = `600 ${20 * s}px ${SANS}`; x.textAlign = 'right'; x.fillStyle = '#6b6558'; x.fillText('LISTOPAD 2026 · REKRUTACJA', W - p, p * 0.8 - 12 * s); x.textAlign = 'left'; } },
  { id: 'gradient', name: 'Gradient Bold', hint: 'Pełne, żywe tło i gigantyczne widełki',
    st: (P) => ({ mark: '#ffffff', font: SANS, titleWeight: 800, salaryWeight: 800, ink: '#ffffff', sub: 'rgba(255,255,255,.85)', acc: '#ffffff', cta: 'pill', ctaBg: '#ffffff', salary: 'box', salaryBg: '#ffffff', titleTrack: -0.04, align: 'left' }),
    bg(x, W, H, P, r) { const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, deepen(P.a)); g.addColorStop(0.6, deepen(P.b)); g.addColorStop(1, deepen(P.c)); x.fillStyle = g; x.fillRect(0, 0, W, H); x.fillStyle = 'rgba(255,255,255,.1)'; x.beginPath(); x.moveTo(W * 0.55, 0); x.lineTo(W, 0); x.lineTo(W, H * 0.6); x.closePath(); x.fill(); x.fillStyle = 'rgba(0,0,0,.08)'; x.beginPath(); x.moveTo(0, H); x.lineTo(W * 0.5, H); x.lineTo(0, H * 0.55); x.closePath(); x.fill(); } },
  { id: 'blueprint', name: 'Blueprint', hint: 'Techniczny rysunek: siatka, znaczniki, linie pomocnicze',
    st: (P) => ({ mark: '#ffffff', font: SANS, titleWeight: 700, salaryWeight: 700, ink: '#ffffff', sub: 'rgba(255,255,255,.7)', acc: '#ffffff', cta: 'box', salary: 'pill', titleTrack: -0.03, align: 'left', upperSmall: true, ctaBg: '#fff' }),
    bg(x, W, H, P) { x.fillStyle = mix(P.a, '#000', 0.62); x.fillRect(0, 0, W, H); const s = Math.min(W, H) / 1080, g = 40 * s; x.lineWidth = 1; for (let i = 0; i < W; i += g) { x.strokeStyle = `rgba(255,255,255,${Math.round(i / g) % 5 ? 0.07 : 0.16})`; x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); } for (let j = 0; j < H; j += g) { x.strokeStyle = `rgba(255,255,255,${Math.round(j / g) % 5 ? 0.07 : 0.16})`; x.beginPath(); x.moveTo(0, j); x.lineTo(W, j); x.stroke(); } x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 2; const m = 26 * s, l = 30 * s; [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([cx, cy, dx, dy]) => { x.beginPath(); x.moveTo(cx, cy + dy * l); x.lineTo(cx, cy); x.lineTo(cx + dx * l, cy); x.stroke(); }); } },
  { id: 'outline', name: 'Outline', hint: 'Kontur zamiast wypełnienia, mocny akcent koloru',
    st: (P) => ({ font: SANS, titleWeight: 800, salaryWeight: 800, ink: '#ffffff', sub: '#9ca3af', acc: ensure(P.a, '#0b0b0b', 4), cta: 'box', salary: 'outline', titleStroke: true, upperTitle: true, titleTrack: -0.03, align: 'left', upperSmall: true, titleScale: 0.95 }),
    bg(x, W, H, P) { x.fillStyle = '#0b0b0b'; x.fillRect(0, 0, W, H); const oa = ensure(P.a, '#0b0b0b', 4); x.fillStyle = oa; x.fillRect(0, 0, Math.max(14, W * 0.014), H); x.save(); x.beginPath(); x.rect(W * 0.78, H * 0.78, W * 0.22, H * 0.22); x.clip(); x.strokeStyle = rgba(oa, 0.55); x.lineWidth = 3; for (let i = -H; i < W; i += 22) { x.beginPath(); x.moveTo(W * 0.78 + i, H); x.lineTo(W * 0.78 + i + H, H * 0.78 - 0); x.stroke(); } x.restore(); } },
];

export async function renderGraphic(canvas, { template, format, palette, data, opts, seed = 7 }) {
  const t = TEMPLATES.find((q) => q.id === template) || TEMPLATES[0];
  const f = FORMATS.find((q) => q.id === format) || FORMATS[0];
  const P = PALETTES.find((q) => q.id === palette) || PALETTES[0];
  try { await Promise.all(['500', '600', '700', '800'].map((w) => document.fonts.load(`${w} 40px Inter`))); } catch { /* czcionka systemowa */ }
  canvas.width = f.w; canvas.height = f.h;
  const x = canvas.getContext('2d'); const r = rng(seed);
  x.clearRect(0, 0, f.w, f.h);
  t.bg(x, f.w, f.h, P, r);
  if (t.deco) t.deco(x, f.w, f.h, P);
  const st = t.st(P);
  const info = compose(x, f.w, f.h, P, data, opts, st);
  return info;
}

/** Kontrola kontrastu: dla każdego szablonu × palety sprawdza kolory tekstu i akcentu względem tła bazowego. Zwraca listę problemów. */
export function auditContrast() {
  const bad = [];
  const BASE = { mesh: '#fafafa', noir: '#09090b', swiss: '#f7f6f2', editorial: '#f3efe6', outline: '#0b0b0b', pastel: null, brutal: '#fff6dc', terminal: '#07100a' };
  for (const t of TEMPLATES) for (const P of PALETTES) {
    const st = t.st(P); const bg = BASE[t.id]; if (!bg) continue;
    for (const k of ['acc', 'ink']) if (st[k].startsWith('#') && contrast(st[k], bg) < 3) bad.push(`${t.id}/${P.id}: ${k} ${st[k]} na ${bg} = ${contrast(st[k], bg).toFixed(2)}`);
    if (st.cta === 'pill' && st.ctaBg && contrast(st.ctaBg, bg) < 3) bad.push(`${t.id}/${P.id}: ctaBg ${st.ctaBg} na ${bg}`);
  }
  return bad;
}
