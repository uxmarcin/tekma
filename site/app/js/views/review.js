/**
 * views/review.js — ocena po rozmowie, pytanie po pytaniu (#/candidates/:id/review, opcjonalnie ?stage=&q=).
 * Układ 1:1 z Figmą 28:3798.
 *
 * Co robi:
 *   - pasek górny (ctx.setHeader): „Twoja ocena — <kandydat>”, postęp (segment na pytanie), „Pytanie n z N”, „Wyślij ocenę”,
 *   - karta pytania: kompetencja, waga, treść, dowód AI (sugestia z cytatem, czasem nagrania i uzasadnieniem — tylko podpowiedź),
 *     skala 1–5 z krótkimi kotwicami (zapis Twojej oceny od razu: store.scorecards.save), notatka (localStorage),
 *   - nawigacja ← / →, rekomendacja po etapie (Zdecydowanie nie / Nie / Tak / Zdecydowanie tak) → decyzja człowieka
 *     w karcie oceny (card.decision: no | yes) + szczegół w localStorage (interview-data.reco),
 *   - „Wyślij ocenę” sprawdza braki (potwierdzenie), zapisuje i wraca do karty oceny kandydata.
 *
 * Zasada AI Act: oceniasz niezależnie; sugestia AI jest obok, ale ocena i rekomendacja są Twoje.
 * export default async function render(ctx) -> HTMLElement
 */

import { interviewDemo, shortAnchor, notes, reco as recoStore } from './interview-data.js';

const RECO_OPTIONS = [
  { value: 'strong_no', label: 'Zdecydowanie nie', decision: 'no' },
  { value: 'no', label: 'Nie', decision: 'no' },
  { value: 'yes', label: 'Tak', decision: 'yes' },
  { value: 'strong_yes', label: 'Zdecydowanie tak', decision: 'yes' },
];

function spark(ui, size = 16) {
  const svg = ui.icon('info', size);
  svg.innerHTML = '<path d="M12 3l1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8z" fill="currentColor" stroke="none"/>';
  svg.classList.remove('ico-info'); svg.classList.add('ico-spark4');
  return svg;
}

export default async function render(ctx) {
  const { ui, store } = ctx;
  const { h } = ui;
  await ui.loadCss(new URL('./review.css', import.meta.url));

  const candidate = await store.candidates.get(ctx.params.id);
  if (!candidate) {
    ctx.setHeader({ title: 'Ocena po rozmowie', crumbs: [{ label: 'Kandydaci', href: '#/candidates' }], width: 'wide' });
    return ui.emptyState({ icon: 'user', title: 'Nie znaleziono kandydata', text: 'Ten kandydat nie istnieje albo został usunięty.', action: { label: 'Wróć do kandydatów', onClick: () => ctx.navigate('#/candidates') } });
  }
  const position = candidate.position_id ? await store.positions.get(candidate.position_id) : null;
  const stages = (position && position.stages && position.stages.length) ? position.stages : [candidate.stage].filter(Boolean);
  const requested = ctx.query && ctx.query.stage;
  const stage = stages.includes(requested) ? requested : (candidate.stage || stages[0] || 'Rozmowa');
  let card = await store.scorecards.get(candidate.id, stage);
  const rubricId = card.rubric_id || (position && position.rubric_id) || null;
  const rubric = rubricId ? await store.rubrics.get(rubricId) : null;
  if (rubric && !card.rubric_id) card.rubric_id = rubric.id;
  const questions = (rubric && Array.isArray(rubric.questions)) ? rubric.questions : [];
  const suggestions = rubric ? ctx.ai.suggest({ candidate, rubric, stage }) : {};
  const demo = interviewDemo({ candidate, position, rubric, stage });
  const me = { id: ctx.user.id, name: ctx.user.name || ctx.user.email || 'Ty' };
  const scorecardHref = `#/candidates/${candidate.id}?stage=${encodeURIComponent(stage)}`;

  const state = {
    qIndex: Math.min(Math.max(0, parseInt((ctx.query && ctx.query.q) || '1', 10) - 1 || 0), Math.max(0, questions.length - 1)),
    reco: recoStore.get(candidate.id, stage) || (card.decision === 'yes' ? 'yes' : card.decision === 'no' ? 'no' : null),
    saving: false,
  };

  const myRating = (qid) => (card.ratings || []).find((r) => r.question_id === qid && r.rater_id === me.id) || null;
  const ratedCount = () => questions.filter((q) => myRating(q.id)).length;

  async function persist(mutate) {
    const before = JSON.parse(JSON.stringify(card));
    mutate(card);
    card.ai = suggestions;
    state.saving = true;
    try { card = await store.scorecards.save(card); return true; } catch (err) { card = before; ui.toast((err && err.message) || 'Nie udało się zapisać oceny.', 'bad'); return false; } finally { state.saving = false; }
  }
  async function rate(q, score) {
    const cur = myRating(q.id);
    if (cur && Number(cur.score) === score) return;
    const ok = await persist((c) => {
      c.ratings = (c.ratings || []).filter((r) => !(r.question_id === q.id && r.rater_id === me.id));
      c.ratings.push({ question_id: q.id, rater_id: me.id, rater_name: me.name, score });
    });
    renderHeader(); renderQuestion();
    if (ok) { const b = qCard.querySelector(`[data-score="${score}"]`); if (b) b.focus({ preventScroll: true }); }
  }
  async function setReco(value) {
    const opt = RECO_OPTIONS.find((o) => o.value === value);
    if (!opt) return;
    state.reco = value;
    recoStore.set(candidate.id, stage, value);
    await persist((c) => { c.decision = opt.decision; });
    renderReco();
    ui.toast(`Rekomendacja: ${opt.label}. Zapisana z Twoim imieniem.`, 'good');
  }

  /* ------------------------------------------------ pasek górny */
  const progressEl = h('span', { class: 'rv-progress', role: 'img' });
  const counterEl = h('span', { class: 'rv-counter' });
  const sendBtn = ui.button({ label: 'Wyślij ocenę', variant: 'primary', size: 'sm', attrs: { class: 'btn btn-primary btn-sm rv-send' }, onClick: submit });
  ctx.setHeader({
    title: `Twoja ocena — ${candidate.full_name}`,
    crumbs: [{ label: 'Kandydaci', href: '#/candidates' }, { label: candidate.full_name, href: scorecardHref }],
    actions: [progressEl, counterEl, sendBtn],
    width: 'wide',
  });
  function renderHeader() {
    const rated = ratedCount();
    progressEl.setAttribute('aria-label', `Ocenione ${rated} z ${questions.length}`);
    progressEl.replaceChildren(questions.map((q, i) => h('i', { class: (myRating(q.id) || i === state.qIndex) ? 'on' : '' })));
    counterEl.textContent = questions.length ? `Pytanie ${state.qIndex + 1} z ${questions.length}` : 'Brak pytań';
  }

  async function submit() {
    if (!questions.length) { ctx.navigate(scorecardHref); return; }
    const missing = questions.length - ratedCount();
    if (!state.reco) {
      ui.toast('Wybierz rekomendację po tym etapie, zanim wyślesz ocenę.', 'warn');
      const first = recoCard.querySelector('button'); if (first) first.focus();
      return;
    }
    if (missing) {
      const ok = await ui.confirm({ title: `Wysłać ocenę bez ${ui.plural(missing, 'odpowiedzi', 'odpowiedzi', 'odpowiedzi')}?`, text: `${ui.plural(missing, 'pytanie nie ma', 'pytania nie mają', 'pytań nie ma')} Twojej oceny. Możesz wysłać teraz i uzupełnić później w karcie oceny.`, confirmLabel: 'Wyślij mimo to' });
      if (!ok) return;
    }
    sendBtn.setBusy(true);
    const ok = await persist(() => {});
    sendBtn.setBusy(false);
    if (!ok) return;
    ui.toast('Ocena wysłana. Teraz widzisz też oceny innych rozmówców.', 'good');
    ctx.navigate(scorecardHref);
  }

  /* ------------------------------------------------ szkielet */
  const root = h('div', { class: 'rv' });
  const col = h('div', { class: 'rv-col' });
  const subEl = h('p', { class: 'rv-sub' }, `${stage} · oceniasz niezależnie, oceny innych zobaczysz po wysłaniu`);
  const qCard = h('section', { class: 'rv-card rv-q', 'aria-label': 'Pytanie' });
  const nav = h('div', { class: 'rv-nav' });
  const recoCard = h('section', { class: 'rv-card rv-reco', 'aria-label': 'Rekomendacja po tym etapie' });
  const mobileSend = h('div', { class: 'rv-msend' }, ui.button({ label: 'Wyślij ocenę', variant: 'primary', onClick: submit }));
  col.append(subEl, qCard, nav, recoCard, mobileSend);
  root.append(col);

  /* ------------------------------------------------ pytanie */
  function renderQuestion() {
    const q = questions[state.qIndex];
    if (!q) {
      qCard.replaceChildren(ui.emptyState({
        icon: 'rubric', title: rubric ? 'Rubryka nie ma pytań' : 'To stanowisko nie ma rubryki',
        text: rubric ? `Rubryka „${rubric.name}” jest pusta. Dodaj pytania z kotwicami, żeby ocenić kandydata.` : 'Bez rubryki rozmowy nie będą porównywalne. Wybierz rubrykę w ustawieniach stanowiska.',
        action: { label: rubric ? 'Edytuj rubrykę' : 'Przejdź do rubryk', onClick: () => ctx.navigate(rubric ? `#/rubrics/${rubric.id}` : '#/rubrics') },
      }));
      nav.replaceChildren(); return;
    }
    const sug = suggestions[q.id] || null;
    const ev = demo.evidence[q.id] || {};
    const mine = myRating(q.id);
    const myScore = mine ? Number(mine.score) : null;

    const scale = h('div', { class: 'rv-scale', role: 'group', 'aria-label': 'Twoja ocena' });
    for (let n = 1; n <= 5; n++) {
      const full = q.anchors && (q.anchors[n] || q.anchors[String(n)]);
      const btn = h('button', { type: 'button', class: 'rv-score', 'data-score': String(n), 'aria-pressed': myScore === n ? 'true' : 'false', title: full ? `${n}: ${full}` : `Ocena ${n}`, 'aria-label': `Ocena ${n} z 5${full ? `: ${full}` : ''}`, disabled: state.saving },
        h('b', null, String(n)), h('span', null, shortAnchor(q, n)));
      btn.addEventListener('click', () => rate(q, n));
      scale.appendChild(btn);
    }
    scale.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      const btns = Array.from(scale.querySelectorAll('button'));
      const idx = btns.indexOf(document.activeElement);
      if (idx < 0) return;
      e.preventDefault();
      const next = e.key === 'ArrowLeft' ? Math.max(0, idx - 1) : e.key === 'ArrowRight' ? Math.min(btns.length - 1, idx + 1) : e.key === 'Home' ? 0 : btns.length - 1;
      btns[next].focus();
    });

    const noteId = `rv-note-${q.id}`;
    const textarea = h('textarea', { id: noteId, class: 'rv-textarea', rows: '3', placeholder: 'Co zapamiętać z tej odpowiedzi?', maxlength: '600' });
    textarea.value = notes.get(candidate.id, stage, q.id);
    textarea.addEventListener('change', () => notes.set(candidate.id, stage, q.id, textarea.value.trim()));

    qCard.replaceChildren(
      h('div', { class: 'rv-q-h' }, q.competency ? h('span', { class: 'rv-badge' }, q.competency) : null, h('span', { class: 'rv-muted' }, `Waga ×${q.weight || 1}`)),
      h('h2', { class: 'rv-q-text' }, q.text),
      sug ? h('div', { class: 'rv-evidence' },
        h('div', { class: 'rv-evidence-h' },
          spark(ui, 16),
          h('span', null, `AI sugeruje ${sug.score} — dopasowanie do kotwicy „${sug.score}”`),
          ev.time ? h('span', { class: 'rv-evidence-time', title: 'Fragment nagrania, z którego pochodzi cytat' }, `${ev.time} ▶`) : null,
        ),
        h('p', { class: 'rv-quote' }, `„${ev.quote || sug.quote}”`),
        h('p', { class: 'rv-muted' }, ev.reason || sug.reason),
      ) : h('p', { class: 'rv-muted' }, 'Brak sugestii AI dla tego pytania.'),
      h('p', { class: 'rv-label' }, 'Twoja ocena'),
      scale,
      h('div', { class: 'rv-notes' }, h('label', { class: 'rv-label', for: noteId }, 'Notatka (opcjonalnie)'), textarea),
    );

    const prev = ui.button({ label: '← Poprzednie pytanie', variant: 'ghost', size: 'sm', disabled: state.qIndex === 0, onClick: () => go(state.qIndex - 1) });
    const next = ui.button({ label: 'Następne pytanie →', variant: 'secondary', size: 'sm', disabled: state.qIndex >= questions.length - 1, onClick: () => go(state.qIndex + 1) });
    nav.replaceChildren(prev, h('span', { class: 'rv-spacer' }), next);
  }
  function go(i) {
    if (i < 0 || i >= questions.length) return;
    state.qIndex = i;
    renderHeader(); renderQuestion();
    qCard.scrollIntoView({ block: 'start', behavior: 'auto' });
    const first = qCard.querySelector('.rv-q-text'); if (first) { first.setAttribute('tabindex', '-1'); first.focus({ preventScroll: true }); }
  }

  /* ------------------------------------------------ rekomendacja */
  function renderReco() {
    recoCard.replaceChildren(
      h('p', { class: 'rv-label' }, 'Rekomendacja po tym etapie'),
      h('div', { class: 'rv-opts', role: 'group', 'aria-label': 'Rekomendacja' }, RECO_OPTIONS.map((o) => {
        const b = h('button', { type: 'button', class: 'rv-opt', 'aria-pressed': state.reco === o.value ? 'true' : 'false', disabled: state.saving }, o.label);
        b.addEventListener('click', () => setReco(o.value));
        return b;
      })),
      h('p', { class: 'rv-muted rv-reco-hint' }, 'To Twoja decyzja — AI jej nie podpowiada. Zapisujemy ją z Twoim imieniem; możesz ją zmienić do końca etapu.'),
    );
  }

  renderHeader(); renderQuestion(); renderReco();
  return root;
}
