/* Wybór języka: polski domyślny. Zapamiętuje wybór; wejście na polską stronę po wybraniu EN przekierowuje na odpowiednik. */
(() => {
  const KEY = 'tekma.lang';
  const get = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const set = v => { try { localStorage.setItem(KEY, v); } catch (e) {} };
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[data-lang]');
    if (a) set(a.dataset.lang);
  });
  const isEn = document.documentElement.lang === 'en';
  if (!isEn && get() === 'en' && !/[?&]nolang/.test(location.search)) {
    const go = () => { const en = document.querySelector('.lang a[data-lang="en"][data-exact]'); if (en) location.replace(en.getAttribute('href') + location.hash); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  }
})();
