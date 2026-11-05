/**
 * ad-styles.js — generator stylów grafik ogłoszeń: 22 rodziny kompozycji × 4 charaktery (Jasny, Nocny, Żywy, Papier) = 88 stylów.
 * Każdy styl ma własne tło, krój, układ i wygląd przycisków; czytelność gwarantują stałe kolory tekstu dobrane do charakteru
 * oraz akcent liczony przez ensure(). Cała grafika powstaje na canvasie, bez zewnętrznych plików.
 */
export function buildStyles(H) {
  const { mix, rgba, ensure, deepen, blob, SANS, SERIF, MONO } = H;
  const TAU = Math.PI * 2;
  const tri = (x, a, b, c, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.lineTo(c[0], c[1]); x.closePath(); x.fill(); };

  /* ----- 4 charaktery ----- */
  const TONES = {
    light: { label: 'Jasny', colors: (P) => ({ bg: mix(P.a, '#ffffff', 0.92), f1: mix(P.a, '#ffffff', 0.3), f2: mix(P.b, '#ffffff', 0.4), f3: mix(P.c, '#ffffff', 0.45), line: mix(P.a, '#000000', 0.2) }), ink: '#0f0f12', sub: '#55555f', dark: false },
    dark: { label: 'Nocny', colors: (P) => ({ bg: mix(P.a, '#050508', 0.9), f1: P.a, f2: P.b, f3: P.c, line: '#ffffff' }), ink: '#fafafa', sub: '#a8a8b3', dark: true },
    vivid: { label: 'Żywy', colors: (P) => ({ bg: deepen(P.a), f1: P.b, f2: P.c, f3: '#ffffff', line: '#ffffff' }), ink: '#ffffff', sub: 'rgba(255,255,255,.84)', dark: true },
    paper: { label: 'Papier', colors: (P) => ({ bg: '#f5f0e4', f1: P.a, f2: P.b, f3: P.c, line: '#16140f' }), ink: '#16140f', sub: '#6a6454', dark: false },
  };

  /* ----- 6 układów typograficznych (rotowane po rodzinach) ----- */
  const TYPE = [
    (t, c, acc) => ({ font: SANS, titleWeight: 800, salaryWeight: 800, titleTrack: -0.04, align: 'left', cta: 'pill', ctaBg: t.dark ? acc : t.ink }),
    (t, c, acc) => ({ font: SERIF, small: SANS, titleWeight: 700, salaryWeight: 700, titleTrack: -0.02, titleLH: 1.02, align: 'left', cta: 'text', upperSmall: true, topGap: 14 }),
    (t, c, acc) => ({ font: SANS, titleWeight: 700, salaryWeight: 700, titleTrack: -0.035, align: 'center', cta: 'pill', ctaBg: t.dark ? '#ffffff' : t.ink, salary: 'pill' }),
    (t, c, acc) => ({ font: MONO, titleWeight: 700, salaryWeight: 700, titleTrack: -0.02, align: 'left', cta: 'box', labelPrefix: '// ', titleScale: 0.82, salaryScale: 0.85, topGap: 20 }),
    (t, c, acc) => ({ font: SANS, titleWeight: 800, salaryWeight: 800, titleTrack: -0.03, align: 'left', cta: 'box', upperTitle: true, upperSmall: true, salary: 'box', salaryBg: t.dark ? '#ffffff' : '#0f0f12', titleScale: 0.92 }),
    (t, c, acc) => ({ font: SANS, titleWeight: 600, salaryWeight: 600, titleTrack: -0.045, align: 'left', cta: 'pill', ctaBg: t.dark ? '#ffffff' : t.ink, salary: 'outline', titleScale: 1.02 }),
  ];

  /* ----- 22 rodziny kompozycji: c = {bg,f1,f2,f3,line}, r = losowość z ziarna ----- */
  const FAM = [
    { id: 'spot', name: 'Reflektor', hint: 'Stożek światła z rogu', flip: true, paint(x, W, H, c) { const m = Math.max(W, H); const g = x.createRadialGradient(W * 0.88, -H * 0.1, 0, W * 0.88, -H * 0.1, m * 0.95); g.addColorStop(0, rgba(c.f1, 0.85)); g.addColorStop(1, rgba(c.f1, 0)); x.fillStyle = g; x.fillRect(0, 0, W, H); blob(x, W * 0.04, H * 1.05, m * 0.5, c.f2, 0.45); } },
    { id: 'stripe', name: 'Pas startowy', hint: 'Ukośne pasy znikające w tle', paint(x, W, H, c) { x.save(); x.translate(W * 0.64, 0); x.rotate(0.38); const w = Math.max(W, H) * 0.05; for (let i = -6; i < 22; i++) { x.fillStyle = rgba(i % 2 ? c.f1 : c.f2, 0.6); x.fillRect(i * w * 1.2, -H, w * 0.8, H * 3); } x.restore(); const g = x.createLinearGradient(W * 0.4, 0, W * 0.78, 0); g.addColorStop(0, c.bg); g.addColorStop(1, rgba(c.bg, 0)); x.fillStyle = g; x.fillRect(0, 0, W, H); } },
    { id: 'dots', name: 'Półton', hint: 'Raster z rosnących kropek', paint(x, W, H, c) { const cell = Math.max(W, H) * 0.036; for (let gx = Math.floor(W * 0.5 / cell); gx * cell < W + cell; gx++) for (let gy = 0; gy * cell < H + cell; gy++) { const t = (gx * cell - W * 0.5) / (W * 0.5); const k = t * (0.35 + 0.65 * (1 - gy * cell / H)); if (k > 0.04) { x.fillStyle = rgba(c.f1, 0.85); x.beginPath(); x.arc(gx * cell, gy * cell, cell * 0.46 * k, 0, TAU); x.fill(); } } } },
    { id: 'grid', name: 'Milimetrówka', hint: 'Siatka kreślarska z akcentem', paint(x, W, H, c) { const m = Math.min(W, H), g = m * 0.065; x.lineWidth = Math.max(1, m * 0.0015); for (let i = 0; i < W; i += g) { x.strokeStyle = rgba(c.line, i % (g * 4) < 1 ? 0.2 : 0.09); x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); } for (let j = 0; j < H; j += g) { x.strokeStyle = rgba(c.line, j % (g * 4) < 1 ? 0.2 : 0.09); x.beginPath(); x.moveTo(0, j); x.lineTo(W, j); x.stroke(); } x.fillStyle = rgba(c.f1, 0.8); x.fillRect(W - g * 5, g * 2, g * 3, g * 3); x.fillStyle = rgba(c.f2, 0.8); x.fillRect(W - g * 3, g * 5, g * 2, g * 2); } },
    { id: 'wave', name: 'Fale', hint: 'Trzy miękkie fale u dołu', flip: true, paint(x, W, H, c, r) { const ph = r() * 6; [[c.f1, 0.62], [c.f2, 0.7], [c.f3, 0.78]].forEach(([col, t], k) => { x.beginPath(); x.moveTo(0, H); for (let i = 0; i <= 60; i++) { const px = (i / 60) * W; x.lineTo(px, H * t + Math.sin((i / 60) * TAU * (1 + k * 0.4) + ph + k) * H * 0.05); } x.lineTo(W, H); x.closePath(); x.fillStyle = rgba(col, 0.3); x.fill(); }); } },
    { id: 'rings', name: 'Orbity', hint: 'Koncentryczne okręgi z rogu', paint(x, W, H, c) { const m = Math.min(W, H); x.fillStyle = rgba(c.f2, 0.5); x.beginPath(); x.arc(W, H * 0.1, m * 0.12, 0, TAU); x.fill(); x.strokeStyle = rgba(c.f1, 0.85); x.lineWidth = m * 0.012; for (let i = 1; i <= 6; i++) { x.beginPath(); x.arc(W, H * 0.1, m * (0.12 + i * 0.1), 0, TAU); x.stroke(); } } },
    { id: 'blocks', name: 'Bauhaus', hint: 'Płaskie bloki koloru przy krawędzi', paint(x, W, H, c) { const bw = W * 0.11; x.fillStyle = c.f1; x.fillRect(W - bw, 0, bw, H * 0.34); x.fillStyle = c.f2; x.fillRect(W - bw, H * 0.34, bw, H * 0.33); x.fillStyle = c.f3; x.beginPath(); x.arc(W - bw / 2, H * 0.34, bw * 0.4, 0, TAU); x.fill(); } },
    { id: 'split', name: 'Przecięcie', hint: 'Skośny panel koloru', paint(x, W, H, c) { x.fillStyle = rgba(c.f1, 0.88); x.beginPath(); x.moveTo(W * 0.82, 0); x.lineTo(W, 0); x.lineTo(W, H); x.lineTo(W * 0.7, H); x.closePath(); x.fill(); x.fillStyle = rgba(c.f2, 0.9); x.beginPath(); x.moveTo(W * 0.78, 0); x.lineTo(W * 0.8, 0); x.lineTo(W * 0.68, H); x.lineTo(W * 0.66, H); x.closePath(); x.fill(); } },
    { id: 'topo', name: 'Poziomice', hint: 'Warstwice jak na mapie', paint(x, W, H, c, r) { const m = Math.min(W, H), ph = r() * 6; x.lineWidth = Math.max(1.5, m * 0.003); for (let k = 1; k <= 9; k++) { x.beginPath(); for (let i = 0; i <= 120; i++) { const a = (i / 120) * TAU; const R = m * (0.06 + k * 0.055) * (1 + 0.09 * Math.sin(a * 3 + k * 0.7 + ph)); const px = W * 0.9 + Math.cos(a) * R, py = H * 0.22 + Math.sin(a) * R; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath(); x.strokeStyle = rgba(k % 3 ? c.f1 : c.f2, 0.55); x.stroke(); } } },
    { id: 'rays', name: 'Wschód', hint: 'Promienie z dolnego rogu', flip: true, paint(x, W, H, c) { const R = Math.hypot(W, H) * 1.1; for (let i = 0; i < 20; i += 2) { const a0 = Math.PI + (i / 20) * (Math.PI / 2), a1 = Math.PI + ((i + 1) / 20) * (Math.PI / 2); x.fillStyle = rgba(c.f1, 0.2); x.beginPath(); x.moveTo(W, H); x.arc(W, H, R, a0, a1); x.closePath(); x.fill(); } blob(x, W, H, Math.max(W, H) * 0.35, c.f2, 0.5); } },
    { id: 'checker', name: 'Szachownica', hint: 'Plansza w rogu', paint(x, W, H, c) { const t = Math.min(W, H) * 0.06; for (let i = 0; i < 6; i++) for (let j = 0; j < 5; j++) if ((i + j) % 2 === 0) { x.fillStyle = rgba(j % 2 ? c.f2 : c.f1, 0.85); x.fillRect(W - (i + 1) * t, j * t, t, t); } } },
    { id: 'slash', name: 'Cięcie', hint: 'Dwa równoległe pasma', paint(x, W, H, c) { const x0 = W * 0.72; x.fillStyle = rgba(c.f1, 0.88); x.beginPath(); x.moveTo(x0 + W * 0.14, 0); x.lineTo(x0 + W * 0.22, 0); x.lineTo(x0 + W * 0.08, H); x.lineTo(x0 - W * 0.0, H); x.closePath(); x.fill(); x.fillStyle = rgba(c.f2, 0.88); x.beginPath(); x.moveTo(x0 + W * 0.25, 0); x.lineTo(x0 + W * 0.28, 0); x.lineTo(x0 + W * 0.14, H); x.lineTo(x0 + W * 0.11, H); x.closePath(); x.fill(); } },
    { id: 'memphis', name: 'Memphis', hint: 'Rozrzucone figury i zygzaki', paint(x, W, H, c, r) { const m = Math.min(W, H); const cols = [c.f1, c.f2, c.f3]; for (let i = 0; i < 15; i++) { const px = W * (0.64 + r() * 0.34), py = H * (0.04 + r() * 0.72), s = m * (0.025 + r() * 0.04), col = cols[i % 3]; x.save(); x.translate(px, py); x.rotate(r() * TAU); x.fillStyle = col; x.strokeStyle = col; x.lineWidth = s * 0.28; const k = i % 4; if (k === 0) { x.beginPath(); x.arc(0, 0, s * 0.6, 0, TAU); x.fill(); } else if (k === 1) { x.fillRect(-s * 0.6, -s * 0.6, s * 1.2, s * 1.2); } else if (k === 2) { tri(x, [0, -s * 0.7], [s * 0.7, s * 0.6], [-s * 0.7, s * 0.6], col); } else { x.beginPath(); x.moveTo(-s, 0); for (let z = 1; z <= 4; z++) x.lineTo(-s + z * s * 0.5, z % 2 ? -s * 0.4 : s * 0.4); x.stroke(); } x.restore(); } } },
    { id: 'pin', name: 'Prążek', hint: 'Cienkie linie i poświata', flip: true, paint(x, W, H, c) { const g = Math.min(W, H) * 0.014; x.lineWidth = 1; x.strokeStyle = rgba(c.line, 0.11); for (let j = 0; j < H; j += g) { x.beginPath(); x.moveTo(0, j); x.lineTo(W, j); x.stroke(); } blob(x, W * 0.9, H * 0.1, Math.max(W, H) * 0.5, c.f1, 0.6); blob(x, W * 0.05, H * 0.95, Math.max(W, H) * 0.35, c.f2, 0.3); } },
    { id: 'arcs', name: 'Łuki', hint: 'Ćwiartki okręgów jak mozaika', paint(x, W, H, c, r) { const t = Math.min(W, H) * 0.15; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { const X = W - (i + 1) * t, Y = j * t, q = Math.floor(r() * 4); x.fillStyle = rgba((i + j) % 2 ? c.f2 : c.f1, 0.88); x.beginPath(); const cx = X + (q % 2 ? t : 0), cy = Y + (q > 1 ? t : 0); x.moveTo(cx, cy); x.arc(cx, cy, t, (q * Math.PI) / 2 + Math.PI, (q * Math.PI) / 2 + Math.PI * 1.5); x.closePath(); x.fill(); } } },
    { id: 'poly', name: 'Low-poly', hint: 'Fasety trójkątów', paint(x, W, H, c, r) { const cols = [c.f1, c.f2, c.f3]; for (let i = 0; i < 14; i++) { const cx = W * (0.62 + r() * 0.4), cy = H * (r() * 0.6), s = Math.min(W, H) * (0.08 + r() * 0.12), a = r() * TAU; tri(x, [cx + Math.cos(a) * s, cy + Math.sin(a) * s], [cx + Math.cos(a + 2.1) * s, cy + Math.sin(a + 2.1) * s], [cx + Math.cos(a + 4.2) * s, cy + Math.sin(a + 4.2) * s], rgba(cols[i % 3], 0.45 + r() * 0.3)); } } },
    { id: 'confetti', name: 'Konfetti', hint: 'Świętowanie nowego zespołu', paint(x, W, H, c, r) { const cols = [c.f1, c.f2, c.f3]; const m = Math.min(W, H); for (let i = 0; i < 70; i++) { const top = i % 3 === 0; const px = top ? r() * W : W * (0.5 + r() * 0.5), py = top ? H * 0.12 * r() : H * (0.02 + r() * 0.74); const s = m * (0.012 + r() * 0.02); x.save(); x.translate(px, py); x.rotate(r() * TAU); x.fillStyle = rgba(cols[i % 3], 0.9); x.fillRect(-s, -s * 0.4, s * 2, s * 0.8); x.restore(); } } },
    { id: 'orb', name: 'Kula', hint: 'Szklana kula ze światłem', flip: true, paint(x, W, H, c) { const m = Math.min(W, H), cx = W * 0.84, cy = H * 0.3, R = m * 0.3; blob(x, cx, cy, R * 2.2, c.f1, 0.35); const g = x.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.05, cx, cy, R); g.addColorStop(0, c.f3); g.addColorStop(0.45, c.f1); g.addColorStop(1, c.f2); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, R, 0, TAU); x.fill(); } },
    { id: 'conic', name: 'Zorza', hint: 'Rozmyty stożkowy gradient', flip: true, paint(x, W, H, c, r) { const m = Math.max(W, H); x.save(); x.filter = `blur(${Math.round(m * 0.045 * (x._sc || 1))}px)`; if (x.createConicGradient) { const g = x.createConicGradient(r() * 3, W * 0.9, H * 0.85); g.addColorStop(0, c.f1); g.addColorStop(0.33, c.f2); g.addColorStop(0.66, c.f3); g.addColorStop(1, c.f1); x.globalAlpha = 0.7; x.fillStyle = g; } else { x.fillStyle = rgba(c.f1, 0.6); } x.beginPath(); x.arc(W * 0.9, H * 0.85, m * 0.42, 0, TAU); x.fill(); x.restore(); } },
    { id: 'bars', name: 'Kurtyna', hint: 'Zwisające słupki', paint(x, W, H, c, r) { const n = 7, bw = W * 0.036, gap = W * 0.016; for (let i = 0; i < n; i++) { const hh = H * (0.12 + r() * 0.26); x.fillStyle = rgba(i % 2 ? c.f2 : c.f1, 0.9); x.beginPath(); if (x.roundRect) x.roundRect(W * 0.62 + i * (bw + gap), -bw, bw, hh + bw, bw / 2); else x.rect(W * 0.62 + i * (bw + gap), 0, bw, hh); x.fill(); } } },
    { id: 'frame', name: 'Ramka', hint: 'Wąska rama z narożnikami', paint(x, W, H, c) { const m = Math.min(W, H), p = m * 0.035; x.strokeStyle = rgba(c.f1, 0.9); x.lineWidth = Math.max(2, m * 0.004); x.strokeRect(p, p, W - p * 2, H - p * 2); x.fillStyle = c.f1; const s = m * 0.032; [[p, p], [W - p, p], [p, H - p], [W - p, H - p]].forEach(([a, b]) => x.fillRect(a - s / 2, b - s / 2, s, s)); x.strokeStyle = rgba(c.f2, 0.8); x.lineWidth = m * 0.01; x.beginPath(); x.arc(W * 0.9, H * 0.22, m * 0.16, 0, TAU); x.stroke(); } },
    { id: 'mesh5', name: 'Siatka barw', hint: 'Pięć plam koloru', flip: true, paint(x, W, H, c) { const m = Math.max(W, H); blob(x, W * 0.1, H * 0.95, m * 0.5, c.f1, 0.6); blob(x, W * 0.55, H * 0.05, m * 0.45, c.f2, 0.55); blob(x, W * 0.98, H * 0.5, m * 0.4, c.f3, 0.55); blob(x, W * 0.78, H * 1.02, m * 0.4, c.f1, 0.5); blob(x, W * 0.3, H * 0.5, m * 0.25, c.f2, 0.25); } },
  ];

  const out = [];
  FAM.forEach((f, fi) => {
    Object.entries(TONES).forEach(([tk, t]) => {
      const typo = TYPE[(fi + (tk === 'dark' || tk === 'paper' ? 2 : 0)) % TYPE.length];
      const cols = (P) => t.colors(P);
      out.push({
        id: `${f.id}-${tk}`, name: `${f.name} · ${t.label}`, hint: f.hint, tone: tk, gen: true, flip: !!f.flip,
        base: (P) => cols(P).bg,
        st(P) {
          const c = cols(P); const acc = tk === 'vivid' ? '#ffffff' : ensure(P.a, c.bg, 4.5);
          return { mark: t.ink, ink: t.ink, sub: t.sub, acc, ...typo(t, c, acc) };
        },
        bg(x, W, H, P, r) { const c = cols(P); x.fillStyle = c.bg; x.fillRect(0, 0, W, H); f.paint(x, W, H, c, r); },
      });
    });
  });
  return out;
}
