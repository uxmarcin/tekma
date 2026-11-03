/**
 * main.js — punkt startowy: łączy store, ui, ai i uruchamia router.
 * Błąd ładowania modułów pokazuje czytelny komunikat zamiast pustej strony.
 */
import ui from './ui.js';

(async () => {
  try {
    const [{ store }, { ai }, { startRouter }] = await Promise.all([
      import('./store.js'),
      import('./ai.js'),
      import('./router.js'),
    ]);
    window.__tekma = { store, ui, ai }; // pomocniczo do debugowania w konsoli
    await startRouter({ store, ui, ai });
  } catch (err) {
    console.error('[main] start aplikacji nie powiódł się:', err);
    const root = document.getElementById('root');
    root.replaceChildren(ui.h('div', { class: 'state', role: 'alert' },
      ui.h('div', { class: 'glyph' }, ui.icon('alert', 20)),
      ui.h('h2', null, 'Nie udało się uruchomić Tekmy'),
      ui.h('p', null, (err && err.message) || 'Odśwież stronę. Jeśli problem wraca, sprawdź js/config.js.'),
      ui.h('div', { class: 'actions' }, ui.button({ label: 'Odśwież stronę', variant: 'primary', onClick: () => location.reload() })),
    ));
  }
})();
