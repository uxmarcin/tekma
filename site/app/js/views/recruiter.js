/**
 * views/recruiter.js — Profil rekrutera (#/marketplace/:id), 1:1 z Figmą 41 · Profil rekrutera (32:5281).
 * Okruszki, nagłówek (awatar 72, imię 30 px + badge, meta, „Napisz”, „Zaproponuj współpracę”), kolumny 3:2:
 * O mnie + Opinie klientów | Statystyki + Model współpracy + notka o zakresie dostępu.
 * „Zaproponuj współpracę” tworzy zlecenie na wybrane stanowisko (store.positions.list) w marketplace-data;
 * „Napisz” zapisuje wiadomość. Dane: views/marketplace-data.js (localStorage).
 *
 * export default async function render(ctx) -> HTMLElement
 */

import { marketplace, uid } from './marketplace-data.js';
import { kbtn, kicon, badge, panel, loadKitCss } from './admin-kit.js';

const fmtRating = (n) => `★ ${Number(n).toFixed(1).replace('.', ',')}`;
const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

export default async function render(ctx) {
  const { h, modal, toast, field, plural, emptyState } = ctx.ui;
  await Promise.all([loadKitCss(), ctx.ui.loadCss(new URL('./recruiter.css', import.meta.url))]);

  const data = marketplace.get();
  const r = data.recruiters.find((x) => x.id === ctx.params.id);
  if (!r) {
    ctx.setHeader({ title: 'Profil rekrutera', crumbs: [{ label: 'Rekruterzy', href: '#/marketplace' }], width: 'wide' });
    return h('div', { class: 'e-root' }, emptyState({ icon: 'users', title: 'Nie ma takiego rekrutera', text: 'Profil mógł zostać usunięty z marketplace. Wróć do listy i wybierz kogoś innego.', action: { label: 'Wróć do rekruterów', variant: 'secondary', onClick: () => ctx.navigate('#/marketplace') } }));
  }
  // Nagłówek z Figmy (awatar 72 + imię + badge + meta + akcje) rysujemy w treści; nagłówek routera chowamy.
  ctx.setHeader({ title: r.name, crumbs: [{ label: 'Rekruterzy', href: '#/marketplace' }], width: 'wide', hidden: true });

  const isAgency = r.kind === 'agency';
  const feminine = isAgency || /a$/i.test(r.name.split(' ')[0]);
  const verifiedLabel = feminine ? 'Zweryfikowana' : 'Zweryfikowany';
  const p = r.profile;

  const root = h('div', { class: 'e-root rc' });

  const crumbs = h('nav', { class: 'rc-crumbs', 'aria-label': 'Okruszki' },
    h('a', { href: '#/marketplace', 'aria-label': 'Wróć: Rekruterzy' }, kicon('arrow-left', 20), h('span', null, 'Rekruterzy')), h('span', { 'aria-hidden': 'true' }, '/'), h('span', { class: 'cur' }, r.name));

  const proposeBtn = kbtn({ label: 'Zaproponuj współpracę', variant: 'primary', onClick: propose });
  const writeBtn = kbtn({ label: 'Napisz', onClick: write });
  const head = h('div', { class: 'rc-head' },
    h('span', { class: 'e-av s72', 'aria-hidden': 'true' }, r.initials),
    h('div', { class: 't' },
      h('div', { class: 'n' }, h('h1', null, r.name), r.verified ? badge(verifiedLabel, 'accent') : null),
      h('p', null, p.meta)),
    h('div', { class: 'rc-actions' }, writeBtn, proposeBtn));
  syncPropose();

  const about = h('div', { class: 'e-card rc-about' },
    h('h2', null, 'O mnie'),
    h('p', null, p.about),
    h('div', { class: 'e-tags' }, p.tags.map((t) => badge(t))));

  const reviews = panel({ title: 'Opinie klientów', id: 'rc-rev', aside: `${fmtRating(r.stats.rating)} · ${plural(r.stats.reviews, 'opinia', 'opinie', 'opinii')}`,
    body: h('div', { class: 'e-list' }, p.reviews.map((rv) => h('div', { class: 'rc-review' },
      h('small', null, h('span', { 'aria-label': `${rv.stars} z 5 gwiazdek` }, stars(rv.stars)), ` · ${rv.who}`),
      h('p', null, rv.text)))) });

  const statsCard = h('div', { class: 'e-card rc-stats' },
    h('div', { class: 's' }, h('b', null, String(r.stats.candidates)), h('small', null, 'kandydatów')),
    h('div', { class: 's' }, h('b', null, String(r.stats.hires)), h('small', null, 'zatrudnień / 12 mies.')),
    h('div', { class: 's' }, h('b', null, `${r.stats.shortlistDays} dni`), h('small', null, 'do shortlisty')));

  const pricing = panel({ title: 'Model współpracy', id: 'rc-terms', body: h('div', null, p.terms.map((t) => h('div', { class: 'e-kv' }, h('span', null, t.k), h('b', null, t.v)))) });

  const note = h('div', { class: 'e-note' }, kicon('lock'), h('span', null, p.scopeNote));

  root.append(crumbs, head, h('div', { class: 'e-cols' }, h('div', { class: 'e-col' }, about, reviews), h('div', { class: 'e-col' }, statsCard, pricing, note)));

  function currentOrder() { return marketplace.get().orders.find((o) => o.recruiter_id === r.id && o.status !== 'closed'); }
  function syncPropose() {
    const o = currentOrder();
    const span = proposeBtn.querySelector('span');
    if (o) {
      span.textContent = o.status === 'proposed' ? 'Propozycja wysłana' : 'Współpraca trwa';
      proposeBtn.className = 'e-btn e-btn-secondary';
      proposeBtn.title = `${o.position_title} · ${o.status === 'proposed' ? 'czeka na odpowiedź' : 'aktywne zlecenie'}`;
    } else {
      span.textContent = 'Zaproponuj współpracę'; proposeBtn.className = 'e-btn e-btn-primary'; proposeBtn.removeAttribute('title');
    }
  }

  async function propose() {
    const existing = currentOrder();
    if (existing) {
      const m = modal({ title: existing.status === 'proposed' ? 'Propozycja wysłana' : 'Współpraca trwa', body: h('div', null,
        h('p', null, h('b', null, r.name), ` · ${existing.position_title}.`),
        h('p', null, existing.status === 'proposed' ? `${feminine ? 'Rekruterka' : 'Rekruter'} ma 48 godzin na odpowiedź. Po akceptacji dostanie dostęp tylko do tego stanowiska.` : `Zlecenie aktywne od ${ctx.ui.formatDate(existing.started)}.${existing.note ? ' ' + existing.note : ''}`),
      ), actions: [
        { label: 'Wycofaj', variant: 'danger', onClick: () => { marketplace.update((st) => { st.orders = st.orders.filter((o) => o.id !== existing.id); }); m.close(); syncPropose(); toast('Propozycja wycofana.', 'neutral'); } },
        { label: 'Zamknij', variant: 'secondary', onClick: () => m.close() },
      ] });
      return;
    }
    let positions = [];
    try { positions = (await ctx.store.positions.list()).filter((x) => x.status !== 'closed'); } catch { positions = []; }
    if (!positions.length) {
      const m = modal({ title: 'Zaproponuj współpracę', body: h('div', null, h('p', null, 'Rekruter pracuje na konkretnym stanowisku. Najpierw dodaj otwarte stanowisko, potem wróć tutaj.')),
        actions: [{ label: 'Przejdź do stanowisk', variant: 'primary', onClick: () => { m.close(); ctx.navigate('#/positions'); } }] });
      return;
    }
    const fPos = field({ label: 'Stanowisko', name: 'position', type: 'select', options: positions.map((x) => ({ value: x.id, label: x.title })), value: positions[0].id });
    const fNote = field({ label: 'Wiadomość (opcjonalnie)', name: 'note', type: 'textarea', rows: 3, placeholder: 'Np. zależy nam na shortliście do końca miesiąca.' });
    const terms = h('div', { class: 'rc-terms-box' }, p.terms.map((t) => h('div', null, h('span', null, t.k), h('b', null, t.v))));
    const submit = ctx.ui.button({ label: 'Wyślij propozycję', variant: 'primary' });
    const form = h('form', { novalidate: true, on: { submit: (e) => {
      e.preventDefault();
      const pos = positions.find((x) => x.id === fPos.value);
      marketplace.update((st) => { st.orders.push({ id: uid(), recruiter_id: r.id, position_id: pos.id, position_title: pos.title, status: 'proposed', started: new Date().toISOString().slice(0, 10), note: fNote.value.trim() }); });
      m.close(); syncPropose();
      toast(`Wysłaliśmy propozycję do ${r.name}: ${pos.title}. Zobaczy tylko to stanowisko.`, 'good');
    } } }, fPos, h('p', { class: 'e-caption rc-terms-l' }, 'Warunki z profilu'), terms, fNote,
      h('p', { class: 'e-caption' }, `${isAgency ? 'Agencja' : feminine ? 'Rekruterka' : 'Rekruter'} dodaje kandydatów do lejka tego stanowiska. Ocenę i decyzję o dalszych etapach zawsze podejmuje Twój zespół.`));
    submit.addEventListener('click', () => form.requestSubmit());
    const m = modal({ title: `Zaproponuj współpracę: ${r.name}`, body: form, actions: [ctx.ui.button({ label: 'Anuluj', variant: 'secondary', onClick: () => m.close() }), submit] });
  }

  function write() {
    const fMsg = field({ label: 'Wiadomość', name: 'msg', type: 'textarea', rows: 5, placeholder: `Cześć ${r.name.split(' ')[0]}, szukamy…`, required: true });
    const submit = ctx.ui.button({ label: 'Wyślij', variant: 'primary' });
    const form = h('form', { novalidate: true, on: { submit: (e) => {
      e.preventDefault();
      const text = fMsg.value.trim();
      if (text.length < 5) { fMsg.setError('Napisz co najmniej kilka słów.'); fMsg.input.focus(); return; }
      marketplace.update((st) => { st.messages.push({ id: uid(), recruiter_id: r.id, text, sent_at: new Date().toISOString() }); });
      m.close(); toast(`Wiadomość do ${r.name} wysłana. Odpowiedź przyjdzie na e-mail. W demo nic nie wysyłamy.`, 'good');
    } } }, fMsg, h('p', { class: 'e-caption' }, 'Rozmowa toczy się w Tekmie i na e-mailu. Nie podawaj danych kandydatów przed zleceniem.'));
    submit.addEventListener('click', () => form.requestSubmit());
    const m = modal({ title: `Napisz do: ${r.name}`, body: form, actions: [ctx.ui.button({ label: 'Anuluj', variant: 'secondary', onClick: () => m.close() }), submit] });
  }

  return root;
}
