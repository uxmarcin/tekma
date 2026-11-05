(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  /* nawigacja */
  const nav = $('#nav'), burger = $('#burger');
  const onScrollNav = () => nav.classList.toggle('stuck', scrollY > 8);
  onScrollNav(); addEventListener('scroll', onScrollNav, { passive: true });
  burger.addEventListener('click', () => {
    const open = nav.classList.toggle('menu-open');
    document.body.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', open);
  });
  $$('#mmenu a').forEach(a => a.addEventListener('click', () => { nav.classList.remove('menu-open'); document.body.classList.remove('menu-open'); burger.setAttribute('aria-expanded', false); }));

  /* poświata za kursorem w hero */
  const glow = $('#glow'), hero = $('.hero');
  let gx = innerWidth * .7, gy = 160, tx = gx, ty = gy;
  const paintGlow = () => { glow.style.transform = `translate(${gx}px,${gy}px)`; };
  paintGlow();
  if (!reduce && matchMedia('(pointer:fine)').matches) {
    hero.addEventListener('pointermove', e => { const r = hero.getBoundingClientRect(); tx = e.clientX - r.left; ty = e.clientY - r.top; });
    (function loop() { gx += (tx - gx) * .06; gy += (ty - gy) * .06; paintGlow(); requestAnimationFrame(loop); })();
  }


  /* delikatna sieć węzłów w tle hero */
  const net = $('#net');
  if (net) {
    const ctx = net.getContext('2d'); let W = 0, H = 0, dpr = 1, pts = [], mx = -999, my = -999, vis = true, raf = 0;
    const size = () => { dpr = Math.min(devicePixelRatio || 1, 2); W = net.clientWidth; H = net.clientHeight; net.width = W * dpr; net.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(70, W * H / 16000)); pts = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .22, vy: (Math.random() - .5) * .22, r: Math.random() * 1.2 + .6 })); };
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of pts) { if (!reduce) { p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1; } }
      for (let i = 0; i < pts.length; i++) { const a = pts[i];
        for (let j = i + 1; j < pts.length; j++) { const b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y); if (d < 150) { ctx.strokeStyle = `rgba(255,255,255,${(1 - d / 150) * .13})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } }
        const dm = Math.hypot(a.x - mx, a.y - my), g = dm < 160 ? 1 - dm / 160 : 0;
        if (g > 0) { ctx.strokeStyle = `rgba(255,255,255,${g * .22})`; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mx, my); ctx.stroke(); }
        ctx.fillStyle = `rgba(255,255,255,${.28 + g * .5})`; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 6.283); ctx.fill(); }
      if (vis && !reduce) raf = requestAnimationFrame(draw);
    };
    size(); draw();
    addEventListener('resize', () => { size(); if (reduce) draw(); });
    if (!reduce) {
      hero.addEventListener('pointermove', e => { const r = net.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; });
      hero.addEventListener('pointerleave', () => { mx = my = -999; });
      new IntersectionObserver(([e]) => { vis = e.isIntersecting; if (vis) { cancelAnimationFrame(raf); draw(); } }).observe(hero);
    }
  }

  /* okno produktu prostuje się podczas przewijania */
  const tilt = $('#tilt'), stage = $('#stage');
  const paintTilt = () => {
    const r = stage.getBoundingClientRect();
    const p = reduce ? 1 : clamp((innerHeight * .95 - r.top) / (innerHeight * .75));
    tilt.style.setProperty('--rx', (16 * (1 - p)).toFixed(2) + 'deg');
    tilt.style.setProperty('--sc', (.93 + .07 * p).toFixed(3));
    stage.style.setProperty('--p', p.toFixed(3));
  };
  paintTilt();

  /* plan 90 dni — wypełnia się wraz z przewijaniem */
  const person = $('#person'), plan = $('#plan'), dayBar = $('#dayBar'), dayTxt = $('#dayTxt');
  const ms = $$('.ms', plan);
  const paintPlan = () => {
    const r = person.getBoundingClientRect();
    const p = reduce ? 1 : clamp((innerHeight * .8 - r.top) / (r.height * .9));
    const day = Math.max(1, Math.round(p * 90));
    plan.style.setProperty('--fill', (p * 100).toFixed(1) + '%');
    dayBar.style.setProperty('--w', (day / 90 * 100).toFixed(1) + '%');
    dayBar.style.width = (day / 90 * 100) + '%';
    dayTxt.textContent = `Dzień ${day} z 90`;
    ms.forEach(m => m.classList.toggle('on', day >= +m.dataset.d));
  };
  paintPlan();

  let ticking = false;
  const onScroll = () => { if (ticking) return; ticking = true; requestAnimationFrame(() => { paintTilt(); paintPlan(); ticking = false; }); };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);

  /* słupki lejka — rosną, gdy wchodzą w kadr */
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in-view'); io.unobserve(e.target); } }), { threshold: .35 });
  $$('.bars').forEach(b => io.observe(b));

  /* światło pod kursorem na kafelkach i cennikach */
  $$('.tile,.plan-card').forEach(el => el.addEventListener('pointermove', e => {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    el.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }));

  /* karta oceny — interaktywna */
  const Q = [
    { t: 'Opowiedz o swoim największym wyzwaniu ze skalowaniem systemu.', c: 'Projektowanie systemów', w: 3, a: 4, me: 4, ai: 4 },
    { t: 'Jak debugujesz problem, którego nie da się odtworzyć lokalnie?', c: 'Rozwiązywanie problemów', w: 2, a: 5, me: 4, ai: 5 },
    { t: 'Opisz decyzję techniczną, która budziła Twój sprzeciw.', c: 'Współpraca', w: 2, a: 2, me: 5, ai: 3 },
    { t: 'Jak dbasz o jakość kodu w małym zespole?', c: 'Jakość', w: 1, a: 4, me: 4, ai: 4 },
  ];
  const qs = $('#qs');
  const fmt = n => n.toFixed(1).replace('.', ',');
  const renderQ = () => {
    qs.innerHTML = Q.map((q, i) => {
      const diff = Math.abs(q.a - q.me);
      return `<div class="q${diff >= 2 ? ' flag' : ''}" data-i="${i}">
        <div class="q-h"><b>${q.t}<small>${q.c} · waga ×${q.w}</small></b><span class="q-meta">Anna: ${q.a}</span></div>
        <div class="scale" role="group" aria-label="Twoja ocena: ${q.c}">
          ${[1, 2, 3, 4, 5].map(n => `<button type="button" data-v="${n}" aria-pressed="${q.me === n}" class="${q.ai === n ? 'ai' : ''}" aria-label="Ocena ${n}${q.ai === n ? ' (sugestia AI)' : ''}">${n}</button>`).join('')}
          <span class="hint"><svg width="11" height="11"><use href="#spark"/></svg>AI sugeruje ${q.ai}</span>
        </div>
        <div class="q-flag"><svg viewBox="0 0 12 12"><use href="#flag"/></svg>Rozbieżność ${diff} pkt — omówcie przed decyzją</div>
      </div>`;
    }).join('');
    const sw = Q.reduce((s, q) => s + q.w, 0);
    const total = Q.reduce((s, q) => s + q.w * (q.a + q.me) / 2, 0) / sw;
    $('#total').innerHTML = `${fmt(total)} <span>/ 5</span>`;
    const reco = $('#reco');
    reco.textContent = total >= 3.8 ? 'Tak' : total >= 3 ? 'Do omówienia' : 'Nie';
    reco.style.color = total >= 3.8 ? '#34d399' : total >= 3 ? '#fb923c' : '#fb7185';
  };
  qs.addEventListener('click', e => {
    const b = e.target.closest('button[data-v]'); if (!b) return;
    Q[+b.closest('.q').dataset.i].me = +b.dataset.v;
    renderQ();
    const i = b.closest('.q').dataset.i; $(`.q[data-i="${i}"] button[data-v="${b.dataset.v}"]`).focus();
  });
  $('#applyAi').addEventListener('click', () => { Q.forEach(q => q.me = q.ai); renderQ(); });
  renderQ();
})();
