/**
 * views/privacy.js — Ustawienia → Prywatność i retencja.
 * Okres przechowywania danych odrzuconych kandydatów, anonimizacja po terminie i eksport danych (art. 15 RODO).
 * Decyzję o anonimizacji zawsze podejmuje człowiek — nic nie dzieje się automatycznie.
 */
export default async function render(ctx) {
  const { h, icon, button, tag, emptyState, toast, confirm, plural, formatDate } = ctx.ui;
  const store = ctx.store;
  const write = !!ctx.org && (ctx.org.role === 'owner' || ctx.org.role === 'recruiter');
  const root = h('div', { class: 'st-stack' });

  function download(name, data) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = h('a', { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function paint() {
    const months = store.privacy.retentionMonths();
    let due = [];
    try { due = await store.privacy.due(months); } catch (e) { console.error('[privacy]', e); }

    const sel = h('select', { class: 'input', 'aria-label': 'Okres przechowywania', style: 'max-width:220px', disabled: !write,
      onChange: () => { store.privacy.setRetentionMonths(Number(sel.value)); paint(); } },
      [6, 12, 24].map((m) => h('option', { value: String(m), selected: m === months }, `${m} miesięcy`)));

    const policy = h('section', { class: 'card st-card' },
      h('h2', { class: 'st-h' }, 'Okres przechowywania'),
      h('p', { class: 'muted' }, 'Po tym czasie od zgłoszenia dane odrzuconych kandydatów powinny zostać zanonimizowane (chyba że kandydat zgodził się na bazę talentów). Ustawienie dotyczy tej przeglądarki.'),
      h('div', { class: 'row', style: 'margin-top:12px' }, sel));

    const list = due.length
      ? h('ul', { class: 'st-status' }, due.map((c) => h('li', null,
          h('div', null, h('b', null, c.full_name), h('p', { class: 'muted' }, `${c.position_title || 'Stanowisko'} · zgłoszenie ${formatDate(c.applied_at)}`)),
          button({ label: 'Eksport', size: 'sm', variant: 'secondary', onClick: async () => download(`kandydat-${c.id}.json`, await store.privacy.exportData(c.id)) }))))
      : emptyState({ title: 'Nic do anonimizacji', text: `Nie ma odrzuconych kandydatów starszych niż ${months} mies.`, icon: 'shield' });

    const run = button({ label: due.length ? `Anonimizuj (${due.length})` : 'Anonimizuj', variant: 'danger', icon: 'shield', disabled: !write || !due.length,
      onClick: async () => {
        const ok = await confirm({ title: 'Zanonimizować dane?', danger: true, confirmLabel: 'Anonimizuj',
          text: `${plural(due.length, 'kandydat', 'kandydatów', 'kandydatów')}: imię, nazwisko i e-mail zostaną usunięte bezpowrotnie. Oceny i powód odrzucenia zostaną w statystykach bez danych osobowych. Zalecamy najpierw eksport.` });
        if (!ok) return;
        try { const n = await store.privacy.anonymize(due.map((c) => c.id)); toast(`Zanonimizowano: ${plural(n, 'kandydat', 'kandydatów', 'kandydatów')}.`, 'good'); paint(); }
        catch (e) { toast(e.message || 'Nie udało się zanonimizować danych.', 'bad'); }
      } });

    const exp = button({ label: 'Eksport wszystkich danych', variant: 'secondary', onClick: async () => download('tekma-kandydaci.json', await store.privacy.exportData()) });

    root.replaceChildren(policy,
      h('section', { class: 'card st-card' },
        h('div', { class: 'row', style: 'justify-content:space-between;align-items:center' },
          h('h2', { class: 'st-h' }, 'Po terminie'), tag(due.length ? `${due.length} do działania` : 'Wszystko w porządku', due.length ? 'warn' : 'good')),
        list, h('div', { class: 'actions', style: 'margin-top:14px;gap:8px;display:flex' }, run, exp)),
      h('section', { class: 'card st-card' },
        h('h2', { class: 'st-h' }, 'Prawa kandydata'),
        h('p', { class: 'muted' }, 'Na wniosek kandydata (art. 15–17 RODO) wyeksportuj jego dane przyciskiem „Eksport” albo zanonimizuj je. Odpowiedź należy wysłać w ciągu miesiąca.')));
  }
  await paint();
  return root;
}
