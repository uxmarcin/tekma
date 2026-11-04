(() => {
  const root = document.getElementById('shots'); if (!root) return;
  let data = []; try { data = JSON.parse(root.dataset.shots); } catch (e) { return; }
  const tabs = [...root.querySelectorAll('[role=tab]')], img = document.getElementById('shotImg'), cap = document.getElementById('shotCap'), panel = document.getElementById('shot');
  const show = (i, focus) => {
    tabs.forEach((t, j) => { t.setAttribute('aria-selected', j === i); t.tabIndex = j === i ? 0 : -1; });
    panel.setAttribute('aria-labelledby', tabs[i].id);
    img.classList.add('swap');
    const next = new Image(); next.onload = next.onerror = () => { img.src = data[i].src; if (data[i].w) { img.width = data[i].w; img.height = data[i].h; } img.alt = data[i].t + ' — ekran aplikacji Tekma'; cap.innerHTML = ''; const b = document.createElement('b'); b.textContent = data[i].t; cap.append(b, data[i].d); img.classList.remove('swap'); };
    next.src = data[i].src;
    if (focus) tabs[i].focus();
  };
  tabs.forEach((t, i) => t.addEventListener('click', () => show(i)));
  root.querySelector('[role=tablist]').addEventListener('keydown', e => {
    const cur = tabs.findIndex(t => t.getAttribute('aria-selected') === 'true');
    const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (k) { e.preventDefault(); show((cur + k + tabs.length) % tabs.length, true); }
    if (e.key === 'Home') { e.preventDefault(); show(0, true); }
    if (e.key === 'End') { e.preventDefault(); show(tabs.length - 1, true); }
  });
})();
