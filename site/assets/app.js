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


  /* kosmos w tle hero: gwiazdy z głębią (paralaksa), migotanie, rzadkie spadające gwiazdy */
  const net = $('#net');
  if (net) {
    const ctx = net.getContext('2d'); let W = 0, H = 0, dpr = 1, stars = [], shoot = null, mx = 0, my = 0, sx = 0, sy = 0, vis = true, raf = 0, t0 = performance.now(), nextShoot = t0 + 4000;
    const size = () => { dpr = Math.min(devicePixelRatio || 1, 2); W = net.clientWidth; H = net.clientHeight; net.width = Math.round(W * dpr); net.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(160, W * H / 9000));
      stars = Array.from({ length: n }, () => { const z = Math.random() ** 2; return { x: Math.random() * W, y: Math.random() * H, z, r: .5 + z * 1.5, a: .25 + z * .6, f: Math.random() * 6.283, s: .4 + Math.random() * 1.2, v: .01 + z * .05 }; }); };
    const draw = (now) => {
      const t = (now - t0) / 1000; ctx.clearRect(0, 0, W, H);
      sx += (mx - sx) * .04; sy += (my - sy) * .04;
      for (const p of stars) {
        if (!reduce) { p.y -= p.v; if (p.y < -4) { p.y = H + 4; p.x = Math.random() * W; } }
        const x = p.x + sx * p.z * 28, y = p.y + sy * p.z * 18, tw = reduce ? 1 : .65 + .35 * Math.sin(t * p.s + p.f), al = p.a * tw;
        if (p.r > 1.2) { const g = ctx.createRadialGradient(x, y, 0, x, y, p.r * 5); g.addColorStop(0, `rgba(255,255,255,${al * .5})`); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, p.r * 5, 0, 6.283); ctx.fill(); }
        ctx.fillStyle = `rgba(255,255,255,${al})`; ctx.beginPath(); ctx.arc(x, y, p.r, 0, 6.283); ctx.fill();
      }
      if (!reduce) {
        if (!shoot && now > nextShoot) { const a = .5 + Math.random() * .3; shoot = { x: Math.random() * W * .8, y: Math.random() * H * .35, vx: Math.cos(a) * 9, vy: Math.sin(a) * 9, life: 0 }; nextShoot = now + 6000 + Math.random() * 7000; }
        if (shoot) { const s = shoot; s.x += s.vx; s.y += s.vy; s.life++; const al = Math.max(0, 1 - s.life / 50) * .7;
          const g = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 9, s.y - s.vy * 9); g.addColorStop(0, `rgba(255,255,255,${al})`); g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.strokeStyle = g; ctx.lineWidth = 1.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 9, s.y - s.vy * 9); ctx.stroke();
          if (s.life > 50) shoot = null; }
        if (vis) raf = requestAnimationFrame(draw);
      }
    };
    size(); draw(performance.now());
    addEventListener('resize', () => { size(); if (reduce) draw(performance.now()); });
    if (!reduce) {
      hero.addEventListener('pointermove', e => { const r = hero.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width - .5; my = (e.clientY - r.top) / r.height - .5; });
      new IntersectionObserver(([e]) => { vis = e.isIntersecting; if (vis) { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); } }).observe(hero);
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
