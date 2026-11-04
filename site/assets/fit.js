/* Okno aplikacji w hero zawsze pokazuje cały ekran desktop — na węższych szerokościach skaluje go proporcjonalnie. */
(() => {
  const tilt = document.getElementById('tilt'); if (!tilt) return;
  const win = tilt.querySelector('.win'); if (!win) return;
  const BASE = 1200;
  const fit = () => {
    const w = tilt.parentElement.clientWidth;
    const s = Math.min(1, w / BASE);
    win.style.width = BASE + 'px';
    win.style.transformOrigin = '0 0';
    win.style.transform = s < 1 ? 'scale(' + s.toFixed(4) + ')' : '';
    tilt.style.height = s < 1 ? Math.ceil(win.offsetHeight * s) + 'px' : '';
    tilt.style.width = s < 1 ? '100%' : '';
    tilt.classList.toggle('fitted', s < 1);
  };
  fit();
  if ('ResizeObserver' in window) new ResizeObserver(fit).observe(tilt.parentElement); else addEventListener('resize', fit);
  addEventListener('load', fit);
})();
