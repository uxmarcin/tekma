/* Interaktywne panele w sekcji „Cały proces”: kliknij / naciśnij Enter. */
(() => {
  const root = document.querySelector('.mods'); if (!root) return;
  const act = (el, fn) => { el.tabIndex = 0; el.setAttribute('role', 'button'); el.classList.add('hit');
    el.addEventListener('click', () => fn(el));
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(el); } }); };
  const mods = [...root.querySelectorAll('.mod')];
  const [notes, rub, lej, rap, plan, rodo] = mods;

  // Notetaker: przypnij fragment rozmowy
  notes.querySelectorAll('.line:not(.ai)').forEach(l => act(l, el => el.classList.toggle('pin')));

  // Rubryki: wybierz ocenę, nagłówek pokazuje wybór
  const anch = rub.querySelectorAll('.anch div'), head = rub.querySelector('.mod-h b');
  anch.forEach(d => act(d, el => {
    const on = el.classList.contains('sel'); anch.forEach(x => x.classList.remove('sel'));
    if (!on) el.classList.add('sel');
    head.textContent = on ? 'Kotwice ocen' : 'Wybrano ocenę ' + el.querySelector('b').textContent;
  }));

  // Lejek: kliknięcie przenosi kandydata do kolejnego etapu
  const cols = [...lej.querySelectorAll('.kan > div')];
  const move = el => {
    const i = cols.indexOf(el.parentElement), nx = cols[(i + 1) % cols.length];
    const add = [...nx.children].find(c => c.tagName === 'SPAN'); // przed pierwszą kartą
    nx.insertBefore(el, add || null); el.classList.remove('fl');
    cols.forEach(c => { const n = c.querySelectorAll(':scope > span').length; const e = c.querySelector('h6 span'); if (e) e.textContent = n; });
    el.animate([{ transform: 'translateX(-10px)', opacity: .3 }, { transform: 'none', opacity: 1 }], { duration: 260, easing: 'ease-out' });
  };
  lej.querySelectorAll('.kan > div > span').forEach(c => act(c, move));

  // Raport lejka: najechanie podświetla słupek, kliknięcie przełącza „gorący” etap
  rap.querySelectorAll('.bars i').forEach(b => act(b, el => el.classList.toggle('hot')));

  // Plan 90 dni: oznacz etap jako zrobiony
  plan.querySelectorAll('.ms-l div').forEach(d => act(d, el => {
    const on = el.classList.toggle('on'); el.querySelector('small').textContent = on ? 'gotowe' : 'do zrobienia';
  }));

  // RODO: przełączniki zgodności
  rodo.querySelectorAll('.checks div').forEach(d => act(d, el => el.classList.toggle('off')));
})();
