/**
 * views/scorecard.js — karta oceny kandydata (#/candidates/:id, opcjonalnie ?stage=). Układ 1:1 z Figmą 10:780
 * (desktop) i 33:5834 (mobile 390).
 *
 * Co robi:
 *   - nagłówek: awatar, imię, meta (stanowisko · aplikacja · źródło · lokalizacja), akcje Napisz / Odrzuć / Przesuń do: <etap>,
 *     (okna decyzji: views/decision-modals.js agenta C1 — openRejectModal / openAdvanceModal, ładowane leniwie),
 *   - pasek etapów (zrobione ✓ / bieżący / przyszłe) — kliknięcie przełącza kartę oceny etapu,
 *   - panel „Karta oceny · <etap>”: pytania z rubryki (kompetencja, waga, rozbieżność, oceny innych rozmówców),
 *     oceny 1–5 (zapis natychmiast), chip „AI sugeruje N” rozwija cytat + uzasadnienie + „Przyjmij jako moją ocenę”,
 *   - wynik etapu (suma ważona) + rekomendacja (podpowiedź) + decyzja człowieka (z ekranu „Ocena po rozmowie”),
 *   - panel „Dopasowanie CV” (sugestia AI, „Dlaczego taki wynik?”), „Nagranie i transkrypcja”, nota AI Act,
 *   - mobile (<900 px): podsumowanie (wynik, kropki per kompetencja, podsumowanie AI, Odrzuć / Przesuń dalej), potem reszta.
 *
 * Zasada produktu (AI Act): AI tylko sugeruje; każdą ocenę i decyzję zatwierdza człowiek.
 * export default async function render(ctx) -> HTMLElement
 */

import { interviewDemo, firstName } from './interview-data.js';

const RECO = {
  yes: { label: 'Tak', tone: 'good', short: 'Zatrudnić' },
  maybe: { label: 'Do omówienia', tone: 'warn', short: 'Do dyskusji' },
  no: { label: 'Nie', tone: 'bad', short: 'Nie' },
};
const DECISION_LABEL = { yes: 'Tak', maybe: 'Może', no: 'Nie' };
const STATUS_LABEL = { rejected: ['Odrzucony', 'bad'], hired: ['Zatrudniony', 'good'] };
const MONTHS = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

const LOCAL_ICONS = {
  shield: '<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.1-7.5 9.5-4.3-1.4-7.5-4.9-7.5-9.5V6z"/>',
  spark4: '<path d="M12 3l1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8z" fill="currentColor" stroke="none"/>',
};
function localIcon(ui, name, size = 16) {
  if (!LOCAL_ICONS[name]) return ui.icon(name, size);
  const svg = ui.icon('info', size);
  svg.innerHTML = LOCAL_ICONS[name];
  svg.classList.remove('ico-info'); svg.classList.add(`ico-${name}`);
  return svg;
}

export default async function render(ctx) {
  const { ui, store } = ctx;
  const { h } = ui;
  await ui.loadCss(new URL('./scorecard.css', import.meta.url));

  const id = ctx.params.id;
  const candidate = await store.candidates.get(id);
  if (!candidate) {
    ctx.setHeader({ title: 'Karta oceny', crumbs: [{ label: 'Kandydaci', href: '#/candidates' }], width: 'wide' });
    return ui.emptyState({
      icon: 'user',
      title: 'Nie znaleziono kandydata',
      text: 'Ten kandydat nie istnieje albo został usunięty. Wróć do bazy kandydatów i wybierz inną osobę.',
      action: { label: 'Wróć do kandydatów', onClick: () => ctx.navigate('#/candidates') },
    });
  }

  const position = candidate.position_id ? await store.positions.get(candidate.position_id) : null;
  const stages = (position && Array.isArray(position.stages) && position.stages.length) ? position.stages : [candidate.stage].filter(Boolean);
  const requested = ctx.query && ctx.query.stage;
  const stage = stages.includes(requested) ? requested : (stages.includes(candidate.stage) ? candidate.stage : stages[0]);

  ctx.setHeader({
    title: candidate.full_name,
    crumbs: [{ label: 'Kandydaci', href: '#/candidates' }, position ? { label: position.title, href: `#/positions/${position.id}` } : null].filter(Boolean),
    width: 'wide',
  });

  if (!stage) {
    return ui.emptyState({ icon: 'alert', title: 'Stanowisko nie ma etapów', text: 'Dodaj etapy lejka w ustawieniach stanowiska, żeby móc oceniać kandydata.', action: position ? { label: 'Otwórz stanowisko', onClick: () => ctx.navigate(`#/positions/${position.id}`) } : null });
  }

  const card = await store.scorecards.get(candidate.id, stage);
  const rubricId = card.rubric_id || (position && position.rubric_id) || null;
  const rubric = rubricId ? await store.rubrics.get(rubricId) : null;
  if (rubric && !card.rubric_id) card.rubric_id = rubric.id;

  const state = {
    candidate, position, stages, stage, card, rubric,
    me: { id: ctx.user.id, name: ctx.user.name || ctx.user.email || 'Ty' },
    suggestions: rubric ? ctx.ai.suggest({ candidate, rubric, stage }) : {},
    demo: interviewDemo({ candidate, position, rubric, stage }),
    saving: false,
    openAi: new Set(),
    cvWhy: false,
  };

  const root = h('div', { class: 'sc' });
  const mobileEl = h('div', { class: 'sc-mobile' });
  const headEl = h('div', { class: 'sc-head' });
  const stagesEl = h('div', { class: 'sc-stages', role: 'group', 'aria-label': 'Etapy lejka' });
  const colsEl = h('div', { class: 'sc-cols' });
  const panelEl = h('section', { class: 'sc-panel sc-main', 'aria-label': 'Karta oceny' });
  const sideEl = h('aside', { class: 'sc-side', 'aria-label': 'Dopasowanie CV i transkrypcja' });
  colsEl.append(panelEl, sideEl);
  root.append(mobileEl, headEl, stagesEl, colsEl);

  /* ------------------------------------------------ pomocnicze */
  const myRating = (qid) => (state.card.ratings || []).find((r) => r.question_id === qid && r.rater_id === state.me.id) || null;
  const questionRatings = (qid) => (state.card.ratings || []).filter((r) => r.question_id === qid);
  const discrepancy = (qid) => {
    const scores = questionRatings(qid).map((r) => Number(r.score));
    if (scores.length < 2) return 0;
    const gap = Math.max(...scores) - Math.min(...scores);
    return gap >= 2 ? gap : 0;
  };
  const questionAvg = (qid) => {
    const s = questionRatings(qid).map((r) => Number(r.score));
    return s.length ? s.reduce((a, b) => a + b, 0) / s.length : null;
  };
  const weightedFor = (filter) => {
    if (!state.rubric) return null;
    let sw = 0, sum = 0;
    for (const q of state.rubric.questions) {
      const scores = questionRatings(q.id).filter(filter).map((r) => Number(r.score));
      if (!scores.length) continue;
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      sw += Number(q.weight) || 1; sum += (Number(q.weight) || 1) * avg;
    }
    return sw ? sum / sw : null;
  };
  const totals = () => {
    const out = { total: null, rated: 0, count: 0, raters: [], flags: 0 };
    if (!state.rubric) return out;
    out.count = state.rubric.questions.length;
    for (const q of state.rubric.questions) {
      if (discrepancy(q.id)) out.flags++;
      if (questionRatings(q.id).length) out.rated++;
    }
    out.total = weightedFor(() => true);
    out.raters = Array.from(new Set((state.card.ratings || []).map((r) => r.rater_id)));
    return out;
  };
  const recommendation = (total) => (total === null ? null : total >= 3.8 ? RECO.yes : total >= 3 ? RECO.maybe : RECO.no);
  const nextStageOf = (s) => { const i = state.stages.indexOf(s); return i >= 0 ? state.stages[i + 1] || null : null; };
  const fmtDate = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : `${d.getDate()} ${MONTHS[d.getMonth()]}`; };

  async function persist(mutate) {
    const before = JSON.parse(JSON.stringify(state.card));
    mutate(state.card);
    state.card.ai = state.suggestions; // zapisujemy, co AI podpowiadało — dla przejrzystości
    state.saving = true;
    try {
      state.card = await store.scorecards.save(state.card);
      return true;
    } catch (err) {
      state.card = before;
      ui.toast((err && err.message) || 'Nie udało się zapisać oceny.', 'bad');
      return false;
    } finally {
      state.saving = false;
      renderPanel(); renderMobile();
    }
  }

  async function rate(qid, score, focusAfter) {
    const current = myRating(qid);
    if (current && Number(current.score) === score) return;
    await persist((c) => {
      c.ratings = (c.ratings || []).filter((r) => !(r.question_id === qid && r.rater_id === state.me.id));
      c.ratings.push({ question_id: qid, rater_id: state.me.id, rater_name: state.me.name, score });
    });
    if (focusAfter) {
      const btn = panelEl.querySelector(`[data-q="${cssEscape(qid)}"] [data-score="${score}"]`);
      if (btn) btn.focus({ preventScroll: true });
    }
  }

  async function acceptAi(q) {
    const sug = state.suggestions[q.id];
    if (!sug) return;
    const mine = myRating(q.id);
    const ok = await ui.confirm({
      title: `Przyjąć sugestię AI (${sug.score}/5) jako swoją ocenę?`,
      text: `${mine ? `Twoja obecna ocena ${mine.score}/5 zostanie zmieniona na ${sug.score}/5.` : `Ocena ${sug.score}/5 zostanie zapisana z Twoim imieniem.`} Możesz ją potem poprawić ręcznie — to Ty odpowiadasz za ocenę.`,
      confirmLabel: 'Przyjmij sugestię',
    });
    if (!ok) return;
    await rate(q.id, sug.score, false);
    ui.toast(`Przyjęto sugestię AI (${sug.score}/5). Ocena jest teraz Twoja.`, 'good');
  }

  /* ------------------------------------------------ okna decyzji (agent C1) */
  async function decisionModals() {
    try { return await import('./decision-modals.js'); } catch (err) { console.warn('[scorecard] decision-modals.js niedostępny', err); return null; }
  }
  async function afterDecision() {
    const fresh = await store.candidates.get(state.candidate.id);
    if (fresh) state.candidate = fresh;
    renderHead(); renderStages(); renderMobile();
  }
  async function reject() {
    const mod = await decisionModals();
    if (!mod || typeof mod.openRejectModal !== 'function') { ui.toast('Okno odrzucenia jeszcze się ładuje — odśwież stronę i spróbuj ponownie.', 'warn'); return; }
    mod.openRejectModal(ctx, state.candidate, { onDone: afterDecision });
  }
  async function advance() {
    const next = nextStageOf(state.candidate.stage);
    const mod = await decisionModals();
    if (!mod || typeof mod.openAdvanceModal !== 'function') { ui.toast('Okno przesunięcia jeszcze się ładuje — odśwież stronę i spróbuj ponownie.', 'warn'); return; }
    mod.openAdvanceModal(ctx, state.candidate, { onDone: afterDecision, nextStage: next, stage: next, scorecard: state.card });
  }

  /* ------------------------------------------------ nagłówek (desktop) */
  function headerActions(size) {
    const c = state.candidate;
    const next = nextStageOf(c.stage);
    const active = c.status === 'active';
    const write = ui.button({ label: 'Napisz', variant: 'ghost', size, title: c.email ? `Napisz do: ${c.email}` : 'Kandydat nie ma adresu e-mail', disabled: !c.email, onClick: () => { if (c.email) location.href = `mailto:${c.email}`; } });
    const compare = ui.button({ label: 'Porównaj', variant: 'ghost', size, title: 'Porównaj z innymi kandydatami na to stanowisko', onClick: () => ctx.navigate(`#/compare?ids=${encodeURIComponent(c.id)}${c.position_id ? `&position=${encodeURIComponent(c.position_id)}` : ''}`) });
    const rejectBtn = ui.button({ label: 'Odrzuć', variant: 'secondary', size, disabled: !active, title: active ? 'Odrzuć kandydata (z podaniem powodu)' : 'Kandydat nie jest już w procesie', onClick: reject });
    const advanceBtn = ui.button({ label: next ? `Przesuń do: ${next}` : 'Ostatni etap', variant: 'primary', size, disabled: !active || !next, title: next ? `Przesuń kandydata do etapu „${next}”` : 'To ostatni etap lejka', onClick: advance });
    return { write, compare, rejectBtn, advanceBtn };
  }

  function renderHead() {
    const { candidate: c, position: p } = state;
    const st = STATUS_LABEL[c.status];
    const meta = [];
    if (p) meta.push(p.title);
    if (c.applied_at) meta.push(`aplikacja ${fmtDate(c.applied_at)}`);
    if (c.source) meta.push(`źródło: ${c.source}`);
    if (p && p.location) meta.push(p.location);
    const { write, compare, rejectBtn, advanceBtn } = headerActions('sm');
    headEl.replaceChildren(
      h('span', { class: 'sc-avatar', 'aria-hidden': 'true' }, ui.initials(c.full_name)),
      h('div', { class: 'sc-title' },
        h('h1', null, c.full_name, st ? ui.tag(st[0], st[1]) : null),
        h('p', { class: 'sc-meta' }, meta.join(' · ')),
        c.status === 'rejected' && c.reject_reason ? h('p', { class: 'sc-reject' }, `Powód odrzucenia: ${c.reject_reason}`) : null,
      ),
      h('div', { class: 'sc-actions' }, write, compare, rejectBtn, advanceBtn),
    );
  }

  /* ------------------------------------------------ pasek etapów */
  function renderStages() {
    const curIdx = state.stages.indexOf(state.candidate.stage);
    const items = [];
    state.stages.forEach((s, i) => {
      const viewing = s === state.stage;
      const done = i < curIdx;
      const cls = `sc-stage${viewing ? ' on' : done ? ' done' : ''}`;
      const btn = h('button', { type: 'button', class: cls, 'aria-pressed': viewing ? 'true' : 'false', title: s === state.candidate.stage ? `${s} — obecny etap kandydata` : done ? `${s} — zaliczony` : `${s} — karta oceny tego etapu` },
        done ? ui.icon('check', 16) : null, s,
        s === state.candidate.stage ? h('em', { class: 'sr-only' }, ' (obecny etap)') : null);
      btn.addEventListener('click', () => { if (!viewing) ctx.navigate(`#/candidates/${state.candidate.id}?stage=${encodeURIComponent(s)}`); });
      if (i) items.push(h('i', { class: 'sc-stage-line', 'aria-hidden': 'true' }));
      items.push(btn);
    });
    stagesEl.replaceChildren(h('div', { class: 'sc-stages-scroll' }, items));
  }

  /* ------------------------------------------------ panel karty oceny */
  function renderPanel() {
    const r = state.rubric;
    const header = h('div', { class: 'sc-ph' },
      h('b', null, `Karta oceny · ${state.stage}`),
      r ? h('span', { class: 'sc-ph-r' },
        `Rubryka v${r.version || 1} · ${ui.plural((r.questions || []).length, 'pytanie', 'pytania', 'pytań')}`,
        h('span', { class: 'sc-ph-sep', 'aria-hidden': 'true' }, '·'),
        h('a', { class: 'sc-ph-link', href: `#/candidates/${state.candidate.id}/review?stage=${encodeURIComponent(state.stage)}` }, 'Oceń samodzielnie'),
      ) : null,
    );
    if (!r) {
      panelEl.replaceChildren(header, h('div', { class: 'sc-empty' }, ui.emptyState({
        icon: 'rubric', title: 'To stanowisko nie ma rubryki',
        text: 'Bez rubryki rozmowy nie będą porównywalne. Wybierz rubrykę w ustawieniach stanowiska albo utwórz nową.',
        action: [
          { label: 'Przejdź do rubryk', variant: 'primary', onClick: () => ctx.navigate('#/rubrics') },
          state.position ? { label: 'Otwórz stanowisko', variant: 'secondary', onClick: () => ctx.navigate(`#/positions/${state.position.id}`) } : null,
        ].filter(Boolean),
      })));
      return;
    }
    if (!Array.isArray(r.questions) || !r.questions.length) {
      panelEl.replaceChildren(header, h('div', { class: 'sc-empty' }, ui.emptyState({
        icon: 'rubric', title: 'Rubryka nie ma pytań',
        text: `Rubryka „${r.name}” jest pusta. Dodaj pytania z kotwicami, żeby ocenić kandydata.`,
        action: { label: 'Edytuj rubrykę', onClick: () => ctx.navigate(`#/rubrics/${r.id}`) },
      })));
      return;
    }
    panelEl.replaceChildren(header, h('ol', { class: 'sc-qs' }, r.questions.map((q, i) => renderQuestion(q, i))), renderResult());
  }

  function renderQuestion(q, i) {
    const mine = myRating(q.id);
    const myScore = mine ? Number(mine.score) : null;
    const sug = state.suggestions[q.id] || null;
    const gap = discrepancy(q.id);
    const others = questionRatings(q.id).filter((x) => x.rater_id !== state.me.id);

    const scale = h('div', { class: 'sc-scale', role: 'group', 'aria-label': `Twoja ocena: ${q.competency || `pytanie ${i + 1}`}` });
    for (let n = 1; n <= 5; n++) {
      const btn = h('button', {
        type: 'button', class: 'sc-score', 'data-score': String(n),
        'aria-pressed': myScore === n ? 'true' : 'false',
        'aria-label': `Ocena ${n} z 5${sug && sug.score === n ? ' (sugestia AI)' : ''}${q.anchors && q.anchors[n] ? `: ${q.anchors[n]}` : ''}`,
        title: q.anchors && q.anchors[n] ? `${n}: ${q.anchors[n]}` : `Ocena ${n}`,
        disabled: state.saving,
      }, String(n));
      btn.addEventListener('click', () => rate(q.id, n, true));
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

    let chip = null, detail = null;
    if (sug) {
      const open = state.openAi.has(q.id);
      chip = h('button', { type: 'button', class: 'sc-ai-chip', 'aria-expanded': open ? 'true' : 'false', 'aria-controls': `ai-${q.id}`, title: 'Pokaż cytat i uzasadnienie sugestii AI' },
        localIcon(ui, 'spark4', 12), `AI sugeruje ${sug.score}`);
      const accept = ui.button({ label: myScore === sug.score ? 'Zgodne z Twoją oceną' : `Przyjmij ${sug.score} jako moją ocenę`, variant: 'secondary', size: 'sm', disabled: myScore === sug.score || state.saving, onClick: () => acceptAi(q) });
      detail = h('div', { id: `ai-${q.id}`, class: 'sc-ai-detail', hidden: !open },
        h('div', { class: 'sc-ai-detail-h' }, localIcon(ui, 'spark4', 16), h('span', null, `AI sugeruje ${sug.score} — dopasowanie do kotwicy „${sug.score}”`), h('span', { class: 'sc-ai-time' }, `${(state.demo.evidence[q.id] || {}).time || '—'} ▶`)),
        h('blockquote', { class: 'sc-ai-quote' }, `„${sug.quote}”`),
        h('p', { class: 'sc-ai-reason' }, sug.reason),
        h('details', { class: 'sc-anchors' },
          h('summary', null, 'Kotwice ocen 1–5'),
          h('ol', null, [1, 2, 3, 4, 5].map((n) => h('li', { class: myScore === n ? 'on' : (sug.score === n ? 'ai' : '') }, h('b', null, String(n)), h('span', null, (q.anchors && (q.anchors[n] || q.anchors[String(n)])) || 'brak opisu')))),
        ),
        h('div', { class: 'sc-ai-actions' }, accept, h('span', { class: 'sc-ai-hint' }, 'To tylko podpowiedź — ocenę zatwierdzasz Ty.')),
      );
      chip.addEventListener('click', () => {
        const now = !state.openAi.has(q.id);
        if (now) state.openAi.add(q.id); else state.openAi.delete(q.id);
        detail.hidden = !now; chip.setAttribute('aria-expanded', now ? 'true' : 'false');
      });
    }

    const othersText = others.length
      ? others.map((o) => `${firstName(o.rater_name) || 'Rozmówca'} ${o.score}`).join(' · ')
      : 'Brak ocen innych rozmówców';

    return h('li', { class: `sc-q${gap ? ' flag' : ''}`, 'data-q': q.id },
      h('p', { class: 'sc-q-text' }, q.text),
      h('div', { class: 'sc-q-meta' },
        q.competency ? h('span', { class: 'sc-badge' }, q.competency) : null,
        h('span', { class: 'sc-q-w' }, `Waga ×${q.weight || 1}`),
        gap ? h('span', { class: 'sc-badge warn', role: 'status' }, `⚑ Rozbieżność ${gap} pkt`) : null,
        h('span', { class: 'sc-spacer' }),
        h('span', { class: 'sc-q-others', title: others.length ? 'Oceny innych rozmówców' : '' }, othersText),
      ),
      h('div', { class: 'sc-q-score' }, scale, h('span', { class: 'sc-spacer' }), chip),
      detail,
    );
  }

  function renderResult() {
    const t = totals();
    const reco = recommendation(t.total);
    const decision = state.card.decision;
    let recoText = 'Brak ocen';
    let recoTone = 'neutral';
    if (reco) {
      const agree = t.raters.filter((rid) => recommendation(weightedFor((r) => r.rater_id === rid)) === reco).length;
      recoText = `${reco.label} (${agree} z ${ui.plural(t.raters.length, 'rozmówcy', 'rozmówców', 'rozmówców')})`;
      recoTone = reco.tone;
      if (t.flags) recoText += ` · ${ui.plural(t.flags, 'rozbieżność', 'rozbieżności', 'rozbieżności')}`;
    }
    const reviewHref = `#/candidates/${state.candidate.id}/review?stage=${encodeURIComponent(state.stage)}`;
    return h('div', { class: 'sc-result' },
      h('div', { class: 'sc-result-l' },
        h('small', null, 'Wynik etapu (ważony)'),
        h('b', null, t.total === null ? '– / 5' : `${ui.fmtScore(t.total)} / 5`),
        h('p', { class: 'sc-result-sub' },
          t.rated ? `${t.rated} z ${ui.plural(t.count, 'pytania', 'pytań', 'pytań')} · ${ui.plural(t.raters.length, 'rozmówca', 'rozmówców', 'rozmówców')}` : 'Oceń pytania powyżej albo ',
          !t.rated ? h('a', { class: 'sc-ph-link', href: reviewHref }, 'oceń samodzielnie') : null,
          decision ? [h('span', { class: 'sc-ph-sep', 'aria-hidden': 'true' }, ' · '), `Twoja decyzja: ${DECISION_LABEL[decision]} `, h('a', { class: 'sc-ph-link', href: reviewHref }, 'Zmień')] : null,
        ),
      ),
      h('div', { class: 'sc-result-r' },
        h('small', null, 'Rekomendacja'),
        h('span', { class: `sc-badge ${recoTone}`, title: 'Podpowiedź z sumy ważonej: od 3,8 „Tak”, od 3 „Do omówienia”, poniżej „Nie”. To nie decyzja — decyzję podejmuje człowiek.' }, recoText),
      ),
    );
  }

  /* ------------------------------------------------ kolumna boczna */
  function renderSide() {
    const { candidate: c, position: p, demo } = state;
    const cv = ctx.ai.cvScore(c, p);
    const whyBtn = h('button', { type: 'button', class: 'sc-ph-link', 'aria-expanded': state.cvWhy ? 'true' : 'false', 'aria-controls': 'sc-cv-why' }, 'Dlaczego taki wynik?');
    const why = h('div', { id: 'sc-cv-why', class: 'sc-cv-why', hidden: !state.cvWhy }, ui.aiBadge('Sugestia AI'), h('p', null, ctx.ai.cvReason(c, p), ' Dopasowanie liczymy z pokrycia wymagań ogłoszenia przez CV — to podpowiedź dla rekrutera, nie ocena osoby.'));
    whyBtn.addEventListener('click', () => { state.cvWhy = !state.cvWhy; why.hidden = !state.cvWhy; whyBtn.setAttribute('aria-expanded', state.cvWhy ? 'true' : 'false'); });

    const cvPanel = h('section', { class: 'sc-panel', 'aria-label': 'Dopasowanie CV' },
      h('div', { class: 'sc-ph' }, h('b', null, 'Dopasowanie CV'), whyBtn),
      h('div', { class: 'sc-cv-body' },
        h('div', { class: 'sc-ring', role: 'img', 'aria-label': `Dopasowanie CV ${cv} na 100 (sugestia AI)` }, svgRing(cv), h('b', null, String(cv))),
        h('ul', { class: 'sc-cv-list' }, demo.cv.map((it) => h('li', { class: it.ok ? 'ok' : 'flag' }, ui.icon(it.ok ? 'check' : 'flag', 16), h('span', null, it.text)))),
      ),
      why,
    );

    const liveHref = `#/candidates/${c.id}/live?stage=${encodeURIComponent(state.stage)}`;
    const trPanel = h('section', { class: 'sc-panel', 'aria-label': 'Nagranie i transkrypcja' },
      h('div', { class: 'sc-ph' }, h('b', null, 'Nagranie i transkrypcja'), h('span', { class: 'sc-ph-r' }, demo.duration, h('span', { class: 'sc-ph-sep', 'aria-hidden': 'true' }, '·'), h('a', { class: 'sc-ph-link', href: liveHref }, 'Na żywo'))),
      h('div', { class: 'sc-lines' }, demo.transcript.map((l) => h('div', { class: 'sc-line' },
        h('span', { class: 'sc-line-t' }, l.t),
        h('div', { class: `sc-line-b${l.mark ? ' mark' : ''}` }, h('b', null, l.who), h('p', null, l.text)),
      ))),
    );

    const note = h('div', { class: 'sc-note' }, localIcon(ui, 'shield', 16), h('p', null, 'Sugestie AI są pomocnicze i zawsze mają uzasadnienie. Decyzję podejmuje człowiek (AI Act, zał. III).'));
    sideEl.replaceChildren(cvPanel, trPanel, note);
  }

  function svgRing(value) {
    const ns = 'http://www.w3.org/2000/svg';
    const r = 38, circ = 2 * Math.PI * r;
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 84 84'); svg.setAttribute('aria-hidden', 'true');
    const bg = document.createElementNS(ns, 'circle');
    bg.setAttribute('cx', '42'); bg.setAttribute('cy', '42'); bg.setAttribute('r', String(r)); bg.setAttribute('class', 'bg');
    const fg = document.createElementNS(ns, 'circle');
    fg.setAttribute('cx', '42'); fg.setAttribute('cy', '42'); fg.setAttribute('r', String(r)); fg.setAttribute('class', 'fg');
    fg.setAttribute('stroke-dasharray', `${(circ * Math.max(0, Math.min(100, value)) / 100).toFixed(2)} ${circ.toFixed(2)}`);
    svg.append(bg, fg);
    return svg;
  }

  /* ------------------------------------------------ mobile (390) */
  function renderMobile() {
    const { candidate: c, position: p, rubric: r, demo } = state;
    const cv = ctx.ai.cvScore(c, p);
    const t = totals();
    const reco = recommendation(t.total);
    const { rejectBtn, advanceBtn } = headerActions('md');
    advanceBtn.querySelector('span').textContent = nextStageOf(c.stage) ? 'Przesuń dalej' : 'Ostatni etap';
    const dots = (avg) => h('span', { class: 'sc-dots', role: 'img', 'aria-label': avg === null ? 'brak ocen' : `${ui.fmtScore(avg)} na 5` },
      [1, 2, 3, 4, 5].map((n) => h('i', { class: avg !== null && n <= Math.round(avg) ? 'on' : '' })));
    mobileEl.replaceChildren(
      h('div', { class: 'sc-m-head' },
        h('span', { class: 'sc-avatar', 'aria-hidden': 'true' }, ui.initials(c.full_name)),
        h('div', { class: 'sc-m-t' }, h('b', null, c.full_name), h('small', null, `${state.stage} · CV ${cv}`)),
      ),
      h('div', { class: 'sc-m-card' },
        h('div', { class: 'sc-m-row' }, h('small', null, 'Wynik etapu'), h('span', { class: `sc-badge ${reco ? reco.tone : 'neutral'}` }, reco ? reco.short : 'Brak ocen')),
        h('b', { class: 'sc-m-total' }, t.total === null ? '– / 5' : `${ui.fmtScore(t.total)} / 5`),
        r && r.questions && r.questions.length
          ? r.questions.map((q) => h('div', { class: 'sc-m-q' }, h('span', null, q.competency || q.text), dots(questionAvg(q.id))))
          : h('p', { class: 'sc-m-muted' }, 'Stanowisko nie ma rubryki — nie ma czego liczyć.'),
      ),
      h('div', { class: 'sc-m-card sc-m-ai' },
        h('span', { class: 'sc-ai-chip static' }, localIcon(ui, 'spark4', 12), 'Podsumowanie AI'),
        h('p', null, demo.summary),
      ),
      c.status === 'active' ? h('div', { class: 'sc-m-actions' }, rejectBtn, advanceBtn)
        : h('p', { class: 'sc-m-muted' }, c.status === 'rejected' ? `Odrzucony${c.reject_reason ? `: ${c.reject_reason}` : '.'}` : 'Zatrudniony.'),
    );
  }

  renderHead(); renderStages(); renderPanel(); renderSide(); renderMobile();
  return root;
}

function cssEscape(s) {
  return (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&');
}
