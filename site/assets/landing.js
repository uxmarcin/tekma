/* Tekma landing — efekty. Bez zależności. */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;

  // Nav: tło i kreska po przewinięciu
  const nav = document.getElementById('nav');
  const onScroll = () => nav.classList.toggle('scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // Menu mobilne
  const burger = document.getElementById('burger'), menu = document.getElementById('mmenu');
  if (burger && menu) {
    burger.addEventListener('click', () => {
      const open = !menu.classList.contains('open');
      menu.classList.toggle('open', open); burger.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
    });
    menu.addEventListener('click', e => { if (e.target.closest('a')) { menu.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); document.body.style.overflow = ''; } });
  }

  // Reveal przy przewijaniu
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px', threshold: .08 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  // Spotlight na kafelkach (kursor)
  if (fine) document.querySelectorAll('.tile,.tcard').forEach(el => {
    el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); el.style.setProperty('--mx', (e.clientX - r.left) + 'px'); el.style.setProperty('--my', (e.clientY - r.top) + 'px'); });
  });

  // Hero: lekkie 3D za kursorem
  const shot = document.querySelector('.hero-shot .browser');
  if (shot && fine && !reduce) {
    let raf = 0, tx = 0, ty = 0, started = false;
    shot.addEventListener('animationend', () => { started = true; shot.style.animation = 'none'; shot.style.opacity = 1; });
    const hero = document.querySelector('.hero');
    hero.addEventListener('pointermove', e => {
      if (!started) return;
      const r = shot.getBoundingClientRect(); tx = ((e.clientX - r.left) / r.width - .5) * 6; ty = ((e.clientY - r.top) / r.height - .5) * -4;
      if (!raf) raf = requestAnimationFrame(() => { shot.style.transform = `rotateX(${ty}deg) rotateY(${tx}deg)`; raf = 0; });
    });
    hero.addEventListener('pointerleave', () => { if (started) shot.style.transform = ''; });
  }

  // Marquee: podwój listę, żeby pętla była ciągła
  const ul = document.querySelector('.marquee ul');
  if (ul) ul.innerHTML += ul.innerHTML;

  // Delikatna paralaksa poświaty w hero
  const glow = document.querySelector('.hero-glow');
  if (glow && !reduce) addEventListener('scroll', () => { glow.style.transform = `translateY(${120 + scrollY * .15}px)`; }, { passive: true });
})();

// Karuzela: automatyczny przesuw w pętli (mobbin-style), pauza na hover/dotyk, przeciąganie myszą
document.querySelectorAll('[data-car]').forEach(t => {
  const strip = t.querySelector('.car-strip'); if (!strip) return;
  strip.innerHTML += strip.innerHTML;                       // dublujemy, żeby pętla była ciągła
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let slow = false, down = false, sx = 0, sl = 0, last = 0, half = 0;
  const measure = () => { half = strip.scrollWidth / 2; };
  measure(); addEventListener('resize', measure);
  const SPEED = 40; // px/s
  const tick = now => {
    if (!last) last = now; const dt = Math.min(50, now - last); last = now;
    if (!down && !reduce && half) { t.scrollLeft += (slow ? SPEED / 3 : SPEED) * dt / 1000; if (t.scrollLeft >= half) t.scrollLeft -= half; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  t.addEventListener('pointerenter', () => slow = true);
  t.addEventListener('pointerleave', () => { slow = false; down = false; t.classList.remove('dragging'); });
  t.addEventListener('touchstart', () => down = true, { passive: true });
  t.addEventListener('touchend', () => setTimeout(() => down = false, 1500), { passive: true });
  t.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; down = true; sx = e.clientX; sl = t.scrollLeft; t.classList.add('dragging'); });
  addEventListener('pointermove', e => { if (!down) return; t.scrollLeft = sl - (e.clientX - sx); });
  addEventListener('pointerup', () => { if (!down) return; down = false; t.classList.remove('dragging'); });
  t.addEventListener('click', e => { if (Math.abs(t.scrollLeft - sl) > 5) e.preventDefault(); }, true);
});
