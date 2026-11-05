/**
 * views/feedback.js — moduł „Opinie”: wysyłanie pomysłów, błędów, pytań i pochwał prosto z aplikacji.
 *   #/feedback   formularz + lista zgłoszeń (swoje; właściciel widzi też opinie całej firmy)
 * Automatycznie dołączamy: stronę, w której jesteś, wersję aplikacji i przeglądarkę.
 * openFeedback(ctx) — to samo w oknie (menu konta i wyszukiwarka).
 * Gdy baza nie ma jeszcze tabeli (migracja 1.6), formularz podpowiada wysyłkę mailem.
 */
import { setHeader } from './positions.js';

export const KINDS = [
  { key: 'idea', label: 'Pomysł', icon: 'spark', ph: 'Czego brakuje albo co byś zmienił? Opisz, co chcesz osiągnąć.' },
  { key: 'bug', label: 'Błąd', icon: 'alert', ph: 'Co się stało, a czego się spodziewałeś? Co kliknąłeś przed błędem?' },
  { key: 'question', label: 'Pytanie', icon: 'info', ph: 'O co chcesz zapytać?' },
  { key: 'praise', label: 'Pochwała', icon: 'star', ph: 'Co działa dobrze i powinno zostać?' },
];
const STATUS = { new: ['Wysłane', 'neutral'], seen: ['Przeczytane', 'blue'], planned: ['W planach', 'warn'], done: ['Zrobione', 'good'] };
const RATING_L = ['', 'Słabo', 'Takie sobie', 'Dobrze', 'Bardzo dobrze', 'Świetnie'];

/** Formularz opinii. onSent(row) po udanej wysyłce. */
export function feedbackForm(ctx, { onSent, compact = false } = {}) {
  const { h, button, icon, formError, toast } = ctx.ui;
  let kind = 'idea', rating = 0;
  const errorSlot = h('div');
  const ta = h('textarea', { name: 'message', rows: compact ? '5' : '7', maxlength: '4000', 'aria-label': 'Treść opinii', placeholder: KINDS[0].ph });
  const count = h('small', { class: 'muted fb-count' }, '0 / 4000');
  const kinds = h('div', { class: 'fb-kinds', role: 'radiogroup', 'aria-label': 'Rodzaj opinii' }, KINDS.map((k) => {
    const b = h('button', { type: 'button', class: 'fb-kind', role: 'radio', 'aria-checked': String(k.key === kind), 'data-k': k.key }, icon(k.icon, 16), k.label);
    b.addEventListener('click', () => { kind = k.key; ta.placeholder = k.ph; kinds.querySelectorAll('.fb-kind').forEach((x) => x.setAttribute('aria-checked', String(x === b))); });
    return b;
  }));
  const ratingLbl = h('small', { class: 'muted fb-rl' }, 'Opcjonalnie');
  const stars = h('div', { class: 'fb-stars', role: 'radiogroup', 'aria-label': 'Ocena Tekmy' }, [1, 2, 3, 4, 5].map((n) => {
    const b = h('button', { type: 'button', class: 'fb-star', role: 'radio', 'aria-checked': 'false', 'aria-label': `${n} z 5: ${RATING_L[n]}`, title: RATING_L[n] }, icon('star', 22));
    b.addEventListener('click', () => { rating = rating === n ? 0 : n; paintStars(); });
    return b;
  }));
  function paintStars() {
    stars.querySelectorAll('.fb-star').forEach((b, i) => { b.classList.toggle('on', i < rating); b.setAttribute('aria-checked', String(i + 1 === rating)); });
    ratingLbl.textContent = rating ? RATING_L[rating] : 'Opcjonalnie';
  }
  ta.addEventListener('input', () => { count.textContent = `${ta.value.length} / 4000`; });
  const submit = button({ label: 'Wyślij opinię', variant: 'primary', icon: 'arrow', type: 'submit' });
  const form = h('form', { class: 'fb-form', novalidate: true },
    errorSlot,
    h('div', { class: 'fb-sec' }, h('label', { class: 'fb-l' }, 'O czym piszesz?'), kinds),
    h('div', { class: 'fb-sec' }, h('label', { class: 'fb-l', for: 'fb-msg' }, 'Twoja opinia'), ta, h('div', { class: 'fb-meta' }, h('small', { class: 'muted' }, 'Dołączymy stronę, na której jesteś, i wersję aplikacji.'), count)),
    h('div', { class: 'fb-sec fb-rate' }, h('label', { class: 'fb-l' }, 'Jak ci się pracuje z Tekmą?'), h('div', { class: 'fb-rate-r' }, stars, ratingLbl)),
    h('div', { class: 'fb-act' }, submit));
  ta.id = 'fb-msg';
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); errorSlot.replaceChildren();
    if (ta.value.trim().length < 3) { errorSlot.replaceChildren(formError('Napisz kilka słów, żebyśmy wiedzieli, o co chodzi.')); ta.focus(); return; }
    submit.setBusy(true);
    try {
      const row = await ctx.store.feedback.create({ kind, rating: rating || null, message: ta.value });
      toast('Dziękujemy! Czytamy każdą opinię.', 'good');
      ta.value = ''; count.textContent = '0 / 4000'; rating = 0; paintStars();
      if (onSent) onSent(row);
    } catch (err) {
      const mail = `mailto:hello@tekma.app?subject=${encodeURIComponent('Opinia o Tekmie: ' + (KINDS.find((k) => k.key === kind) || {}).label)}&body=${encodeURIComponent(ta.value)}`;
      errorSlot.replaceChildren(formError(err.code === 'no_table' ? 'Zapis opinii w aplikacji jest jeszcze nieaktywny. Możesz wysłać ją mailem.' : (err.message || 'Nie udało się wysłać opinii.')));
      if (err.code === 'no_table') errorSlot.append(h('a', { class: 'btn btn-secondary btn-sm fb-mail', href: mail }, icon('mail', 16), 'Wyślij mailem'));
    } finally { submit.setBusy(false); }
  });
  return form;
}

export function openFeedback(ctx) {
  const { h, modal } = ctx.ui;
  ctx.ui.loadCss(new URL('./feedback.css', import.meta.url));
  const m = modal({ title: 'Wyślij opinię', body: h('div', { class: 'fb' }, h('p', { class: 'muted fb-lead' }, 'Twoja opinia bezpośrednio kształtuje Tekmę. Dziękujemy!'), feedbackForm(ctx, { compact: true, onSent: () => m.close() })) });
  return m;
}

export default async function render(ctx) {
  const { h, tag, formatDate, icon, emptyState } = ctx.ui;
  await ctx.ui.loadCss(new URL('./feedback.css', import.meta.url));
  setHeader(ctx, { title: 'Opinie', width: 'wide' });
  const listBox = h('div', { class: 'fb-list' });
  const me = (await ctx.store.auth.session().catch(() => null));
  const myId = me && me.user ? me.user.id : null;

  async function load() {
    try {
      const rows = (await ctx.store.feedback.list()).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      if (!rows.length) { listBox.replaceChildren(emptyState({ icon: 'message', title: 'Nie wysłano jeszcze opinii', text: 'Pierwsza opinia pojawi się tutaj. Zobaczysz też, co z nią zrobiliśmy.' })); return; }
      listBox.replaceChildren(h('ul', { class: 'fb-ul' }, rows.map((r) => {
        const k = KINDS.find((x) => x.key === r.kind) || KINDS[0], st = STATUS[r.status || 'new'] || STATUS.new;
        return h('li', { class: 'fb-item' },
          h('div', { class: 'fb-item-h' }, h('span', { class: 'fb-ik' }, icon(k.icon, 14), k.label), tag(st[0], st[1]),
            h('small', { class: 'muted' }, `${formatDate(r.created_at, { relative: true })}${myId && r.user_id && r.user_id !== myId ? ' · ktoś z zespołu' : ''}`)),
          h('p', { class: 'fb-msg' }, r.message),
          r.rating ? h('small', { class: 'muted' }, `Ocena: ${r.rating}/5`) : null);
      })));
    } catch (err) {
      const noTable = err && err.code === 'no_table';
      listBox.replaceChildren(h('p', { class: 'muted fb-none' }, noTable ? 'Historia opinii pojawi się po jednorazowej migracji bazy (db/migrations/1.6-feedback.sql). Wysyłać możesz już teraz — zgłoszenie pójdzie mailem.' : (err.message || 'Nie udało się wczytać opinii.')));
    }
  }
  const root = h('div', { class: 'fb-page' },
    h('section', { class: 'card fb-card' }, h('h2', { class: 'fb-h' }, 'Wyślij opinię'), h('p', { class: 'muted fb-lead' }, 'Pomysły, błędy, pytania i pochwały — czytamy wszystko i na tej podstawie wybieramy, co robimy dalej.'), feedbackForm(ctx, { onSent: load })),
    h('section', { class: 'card fb-card' }, h('h2', { class: 'fb-h' }, 'Zgłoszenia'), listBox));
  await load();
  return root;
}
