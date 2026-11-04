/**
 * views/decision-modals.js — okna decyzji o kandydacie (współdzielone: lejek, karta oceny, raport).
 *
 *   openRejectModal(ctx, candidate, { onDone })            -> {close}   Figma 27:3550 „Odrzuć kandydata”
 *   openAdvanceModal(ctx, candidate, { onDone, stage })    -> {close}   Figma 27:3756 „Przesuń dalej”
 *
 * ctx = { store, ui, ai, user } (kontekst widoku z routera). candidate = rekord z store.candidates.
 * Odrzucenie: wybór powodu (radio) → szablon wiadomości (edytowalny) → „Zachowaj w bazie” → „Odrzuć i wyślij”
 *   → store.candidates.reject(id, powód) + wpis w decisions-data (wiadomość, zgoda).
 * Przesunięcie: podsumowanie etapu (wynik ważony, liczba ocen, rozbieżność, rekomendacja) → rozmówca, termin,
 *   proponowane sloty z kalendarza, przełącznik zaproszenia → „Przesuń i zaproś” → store.candidates.move(id, etap)
 *   + wpis rozmowy w decisions-data. Ostatni etap (brak następnego) → zatrudnienie (status 'hired').
 * Zasada AI Act: oba okna kończy wyraźne potwierdzenie człowieka; AI niczego tu nie wykonuje i nie podpowiada decyzji.
 */

import { REJECT_REASONS, TEAM, interviewerForStage, slotsFor, rejectMessage, inviteMessage, addInterview, addMessage, addRejection, addMove, isFemale, accusative, genitiveFirst } from './decisions-data.js';

const CSS = new URL('./decision-modals.css', import.meta.url);

const SHIELD = '<path d="M12 3l7 3v5.5c0 4.6-3 8.3-7 9.5-4-1.2-7-4.9-7-9.5V6z"/><path d="M9.5 12l1.8 1.8L14.8 10"/>';
function shieldIcon(size = 16) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', size); svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round'); svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = SHIELD;
  return svg;
}

/** Notka o decyzji człowieka (AI Act, zał. III) — ta sama w obu oknach. */
function humanNote(h, text) {
  return h('div', { class: 'dm-note' }, shieldIcon(16), h('p', null, text));
}

/* ================================================================== Odrzuć kandydata */
export function openRejectModal(ctx, candidate, { onDone } = {}) {
  const { h, button, modal, toast, formError } = ctx.ui;
  ctx.ui.loadCss(CSS);
  const female = isFemale(candidate.full_name);
  const who = female ? 'kandydatka' : 'kandydat';
  const whoGen = female ? 'kandydatki' : 'kandydata';

  const state = { reason: '', position: null };
  const errorSlot = h('div');
  const desc = h('p', { class: 'dm-desc' }, `Powód trafi do raportu stanowiska. ${female ? 'Kandydatka dostanie' : 'Kandydat dostanie'} uprzejmą wiadomość — możesz ją edytować.`);
  const label = h('p', { class: 'dm-label', id: 'dm-reason-label' }, 'Powód');
  const msgArea = h('textarea', { class: 'dm-msg-text', rows: 3, 'aria-label': `Wiadomość do ${whoGen}` });
  const msgBox = h('div', { class: 'dm-msg' }, h('span', { class: 'dm-msg-label' }, `Wiadomość do ${whoGen}`), msgArea);
  const keep = h('input', { type: 'checkbox', checked: true, id: 'dm-keep' });
  const keepRow = h('label', { class: 'dm-check', htmlFor: 'dm-keep' }, keep, h('span', null, 'Zachowaj w bazie kandydatów (12 mies., za zgodą)'));

  const submit = button({ label: 'Odrzuć i wyślij', variant: 'danger', type: 'submit', disabled: true });
  const cancel = button({ label: 'Anuluj', variant: 'ghost' });

  const options = h('div', { class: 'dm-options', role: 'radiogroup', 'aria-labelledby': 'dm-reason-label' },
    REJECT_REASONS.map((r, i) => {
      const input = h('input', { type: 'radio', name: 'dm-reason', value: r, id: `dm-reason-${i}` });
      const row = h('label', { class: 'dm-option', htmlFor: `dm-reason-${i}` }, input, h('span', { class: 'dm-radio', 'aria-hidden': 'true' }), h('span', null, r));
      input.addEventListener('change', () => { if (input.checked) select(r); });
      return row;
    }));
  function select(r) {
    state.reason = r;
    for (const o of options.querySelectorAll('.dm-option')) o.classList.toggle('is-on', o.querySelector('input').value === r);
    msgArea.value = rejectMessage({ candidate, position: state.position, reason: r });
    submit.disabled = false;
  }
  msgArea.value = rejectMessage({ candidate, position: null, reason: '' });

  const form = h('form', { class: 'dm dm-reject', novalidate: true, on: { submit: async (e) => {
    e.preventDefault();
    errorSlot.replaceChildren();
    if (!state.reason) { errorSlot.replaceChildren(formError('Wybierz powód odrzucenia — kandydat ma prawo go poznać.')); options.querySelector('input').focus(); return; }
    submit.setBusy(true);
    try {
      await ctx.store.candidates.reject(candidate.id, state.reason);
      addRejection({ candidate_id: candidate.id, position_id: candidate.position_id, stage: candidate.stage, reason: state.reason, keep: keep.checked, by: ctx.user ? ctx.user.name || ctx.user.email : 'Ty' });
      addMessage({ candidate_id: candidate.id, kind: 'reject', text: msgArea.value.trim() });
      toast(`${candidate.full_name}: odrzucono i wysłano wiadomość.`, 'neutral');
      m.close();
      if (onDone) await onDone({ action: 'reject', reason: state.reason });
    } catch (err) {
      errorSlot.replaceChildren(formError(err.message || 'Nie udało się odrzucić kandydata.'));
      submit.setBusy(false);
    }
  } } },
    errorSlot, desc, label, options, msgBox, keepRow,
    humanNote(h, `Decyzję podejmuje człowiek. AI nie odrzuca ${female ? 'kandydatek' : 'kandydatów'} i nie podpowiada odrzucenia — jedynie oszacowało dopasowanie CV (AI Act, zał. III).`),
  );
  submit.addEventListener('click', () => form.requestSubmit());
  const m = modal({ title: `Odrzucić ${accusative(candidate.full_name)}?`, body: form, actions: [cancel, submit] });
  m.el.classList.add('dm-modal', 'dm-modal-reject');
  cancel.addEventListener('click', () => m.close());
  // stanowisko (do szablonu) — dociągamy w tle, bez blokowania okna
  ctx.store.positions.get(candidate.position_id).then((p) => { state.position = p || null; if (state.reason) msgArea.value = rejectMessage({ candidate, position: p, reason: state.reason }); }).catch(() => {});
  return m;
}

/* ================================================================== Przesuń dalej */
export async function openAdvanceModal(ctx, candidate, { onDone, stage } = {}) {
  const { h, button, modal, toast, formError, avatar, tag, fmtScore } = ctx.ui;
  ctx.ui.loadCss(CSS);
  const female = isFemale(candidate.full_name);

  // dane: stanowisko, karta bieżącego etapu, rubryka (do wagi i wyniku)
  let position = null, card = null, rubric = null;
  try {
    position = await ctx.store.positions.get(candidate.position_id);
    const cards = await ctx.store.scorecards.list();
    card = cards.find((c) => c.candidate_id === candidate.id && c.stage === candidate.stage) || null;
    const rid = (card && card.rubric_id) || (position && position.rubric_id);
    if (rid) rubric = await ctx.store.rubrics.get(rid).catch(() => null);
  } catch (err) { toast(err.message || 'Nie udało się wczytać danych kandydata.', 'bad'); return { close() {} }; }

  const stages = (position && position.stages) || [];
  const idx = stages.indexOf(candidate.stage);
  const target = stage || (idx >= 0 && idx < stages.length - 1 ? stages[idx + 1] : null);
  const hiring = !target; // ostatni etap → zatrudnienie
  const summary = stageSummary(card, rubric, fmtScore);
  const interviewer0 = interviewerForStage(target || candidate.stage);

  const state = { interviewer: interviewer0, slot: null, notify: true };
  const errorSlot = h('div');

  /* podsumowanie */
  const rec = card && card.decision ? { yes: ['Zatrudnić', 'good'], maybe: ['Do namysłu', 'warn'], no: ['Nie zatrudniać', 'bad'] }[card.decision] : null;
  const sumBox = h('div', { class: 'dm-sum' },
    avatar(candidate.full_name),
    h('div', { class: 't' }, h('b', null, candidate.full_name), h('small', null, summary.text)),
    rec ? tag(rec[0], rec[1]) : tag('Bez rekomendacji', 'neutral'),
  );

  /* rozmówca + termin */
  const selInt = h('select', { class: 'dm-field', id: 'dm-int', 'aria-label': 'Rozmówca' },
    TEAM.map((m) => h('option', { value: m.id, selected: m.id === interviewer0.id }, `${m.name}`)));
  const termIn = h('input', { class: 'dm-field', id: 'dm-term', type: 'text', placeholder: 'np. pt 7 lis · 11:00', autocomplete: 'off' });
  const slotsLbl = h('p', { class: 'dm-slots-label' });
  const slotsRow = h('div', { class: 'dm-slots', role: 'group', 'aria-label': 'Proponowane terminy' });
  function drawSlots() {
    const m = state.interviewer;
    slotsLbl.textContent = `Proponowane terminy z kalendarza ${genitiveFirst(m.name)}`;
    const slots = slotsFor(m);
    state.slot = slots[0] || null;
    termIn.value = state.slot ? state.slot.long : '';
    slotsRow.replaceChildren(...slots.map((s) => {
      const b = h('button', { type: 'button', class: `dm-slot${s === state.slot ? ' is-on' : ''}`, 'aria-pressed': String(s === state.slot) }, s.label);
      b.addEventListener('click', () => { state.slot = s; termIn.value = s.long; for (const x of slotsRow.children) { x.classList.toggle('is-on', x === b); x.setAttribute('aria-pressed', String(x === b)); } });
      return b;
    }));
  }
  selInt.addEventListener('change', () => { state.interviewer = TEAM.find((m) => m.id === selInt.value) || TEAM[0]; drawSlots(); });
  termIn.addEventListener('input', () => { state.slot = termIn.value.trim() ? { at: null, label: termIn.value.trim(), long: termIn.value.trim() } : null; for (const x of slotsRow.children) { x.classList.remove('is-on'); x.setAttribute('aria-pressed', 'false'); } });
  drawSlots();

  /* przełącznik zaproszenia */
  const toggle = h('button', { type: 'button', class: 'switch', role: 'switch', 'aria-checked': 'true', 'aria-labelledby': 'dm-notify-lbl' });
  toggle.addEventListener('click', () => { state.notify = !state.notify; toggle.setAttribute('aria-checked', String(state.notify)); submit.querySelector('span').textContent = submitLabel(); });
  const notifyRow = h('div', { class: 'dm-notify' },
    h('span', { id: 'dm-notify-lbl' }, hiring ? `Wyślij ofertę ${female ? 'kandydatce' : 'kandydatowi'} i zaktualizuj portal` : `Wyślij zaproszenie ${female ? 'kandydatce' : 'kandydatowi'} i zaktualizuj portal`),
    toggle);

  const submitLabel = () => (hiring ? (state.notify ? 'Zatrudnij i wyślij ofertę' : 'Zatrudnij') : (state.notify ? 'Przesuń i zaproś' : 'Przesuń'));
  const submit = button({ label: submitLabel(), variant: 'primary', type: 'submit' });
  const cancel = button({ label: 'Anuluj', variant: 'ghost' });

  const form = h('form', { class: 'dm dm-advance', novalidate: true, on: { submit: async (e) => {
    e.preventDefault();
    errorSlot.replaceChildren();
    if (!hiring && state.notify && !termIn.value.trim()) { errorSlot.replaceChildren(formError('Podaj termin rozmowy albo wybierz jeden z proponowanych.')); termIn.focus(); return; }
    submit.setBusy(true);
    try {
      if (hiring) await ctx.store.candidates.update(candidate.id, { status: 'hired' });
      else await ctx.store.candidates.move(candidate.id, target);
      addMove({ candidate_id: candidate.id, position_id: candidate.position_id, from: candidate.stage, stage: hiring ? 'hired' : target, by: ctx.user ? ctx.user.name || ctx.user.email : 'Ty' });
      const interviewer = state.interviewer;
      if (!hiring) addInterview({ candidate_id: candidate.id, position_id: candidate.position_id, stage: target, interviewer_id: interviewer.id, interviewer: interviewer.name, at: state.slot && state.slot.at ? state.slot.at.toISOString() : null, when: termIn.value.trim(), notify: state.notify, by: ctx.user ? ctx.user.name || ctx.user.email : 'Ty' });
      if (state.notify) addMessage({ candidate_id: candidate.id, kind: hiring ? 'offer' : 'invite', text: inviteMessage({ candidate, position, stage: hiring ? 'Oferta' : target, slot: state.slot, interviewer }) });
      toast(hiring ? `${candidate.full_name}: zatrudniono.` : `${candidate.full_name} → ${target}${state.notify ? ' · zaproszenie wysłane' : ''}.`, 'good');
      m.close();
      if (onDone) await onDone({ action: hiring ? 'hire' : 'advance', stage: target });
    } catch (err) {
      errorSlot.replaceChildren(formError(err.message || 'Nie udało się przenieść kandydata.'));
      submit.setBusy(false);
    }
  } } },
    errorSlot,
    sumBox,
    hiring ? null : h('div', { class: 'dm-row' },
      h('div', { class: 'dm-input' }, h('label', { htmlFor: 'dm-int' }, 'Rozmówca'), selInt),
      h('div', { class: 'dm-input' }, h('label', { htmlFor: 'dm-term' }, 'Termin'), termIn),
    ),
    hiring ? null : h('div', { class: 'dm-slots-wrap' }, slotsLbl, slotsRow),
    notifyRow,
    humanNote(h, hiring
      ? 'Zatrudnienie to Twoja decyzja. AI tylko sugerowało oceny — z cytatem i uzasadnieniem (AI Act, zał. III).'
      : 'Etap zmienia człowiek. AI tylko sugerowało oceny — z cytatem i uzasadnieniem; nie przesuwa kandydatów samo (AI Act, zał. III).'),
  );
  submit.addEventListener('click', () => form.requestSubmit());
  const m = modal({ title: hiring ? `Zatrudnić ${accusative(candidate.full_name)}?` : `Przesuń do: ${target}`, body: form, actions: [cancel, submit] });
  m.el.classList.add('dm-modal', 'dm-modal-advance');
  cancel.addEventListener('click', () => m.close());
  return m;
}

/** Wynik etapu (ważony wagami rubryki), liczba ocen, rozbieżność. */
export function stageSummary(card, rubric, fmtScore = (n) => String(n)) {
  const ratings = (card && card.ratings) || [];
  if (!ratings.length) return { score: null, raters: 0, gap: 0, text: 'Brak ocen na tym etapie' };
  const weight = (qid) => { const q = rubric && (rubric.questions || []).find((x) => x.id === qid); return q ? Number(q.weight) || 1 : 1; };
  const byQ = {};
  for (const r of ratings) (byQ[r.question_id] ||= []).push(Number(r.score));
  let num = 0, den = 0, gap = 0;
  for (const [qid, scores] of Object.entries(byQ)) {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    num += avg * weight(qid); den += weight(qid);
    if (scores.length > 1) gap = Math.max(gap, Math.max(...scores) - Math.min(...scores));
  }
  const score = den ? num / den : null;
  const raters = new Set(ratings.map((r) => r.rater_id)).size;
  const ocen = raters === 1 ? '1 ocena' : raters >= 2 && raters <= 4 ? `${raters} oceny` : `${raters} ocen`;
  return { score, raters, gap, text: `Wynik etapu ${fmtScore(score)} / 5 · ${ocen} · ${gap >= 2 ? `rozbieżność ${gap} pkt` : 'bez rozbieżności'}` };
}

export default { openRejectModal, openAdvanceModal, stageSummary };
