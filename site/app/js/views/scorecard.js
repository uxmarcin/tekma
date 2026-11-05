/**
 * views/scorecard.js — karta oceny kandydata (#/candidates/:id, opcjonalnie ?stage=).
 *
 * Co robi:
 *   - nagłówek kandydata (imię, stanowisko, etap, status, dopasowanie CV jako sugestia AI),
 *   - przełącznik etapu (każdy etap ma własną kartę: store.scorecards.get(candidate_id, stage)),
 *   - pytania z rubryki stanowiska: waga, minuty, kotwice 1–5 (po rozwinięciu), oceny 1–5,
 *   - sugestia AI przy każdym pytaniu (ocena, cytat, powód) — oznaczona ui.aiBadge, nigdy nie zapisuje się sama,
 *   - „Przyjmij sugestie AI” — dopiero po kliknięciu (i potwierdzeniu) sugestie stają się ocenami człowieka,
 *   - oceny innych rozmówców i flaga rozbieżności, gdy oceny ludzi różnią się o ≥ 2 pkt,
 *   - suma ważona, podpowiedź rekomendacji (≥ 3,8 Tak / ≥ 3 Do omówienia / Nie) — tylko PODPOWIEDŹ,
 *   - decyzja Tak / Może / Nie zatwierdzana przez człowieka (z potwierdzeniem),
 *   - po decyzji „Tak” przycisk przeniesienia do następnego etapu (store.candidates.move) — tylko na kliknięcie.
 *
 * Zasada produktu (AI Act): AI tylko sugeruje; każdą ocenę i decyzję zatwierdza człowiek.
 * export default async function render(ctx) -> HTMLElement
 */

const RECO = {
  yes: { label: 'Tak', tone: 'good' },
  maybe: { label: 'Do omówienia', tone: 'warn' },
  no: { label: 'Nie', tone: 'bad' },
};
const DECISION_LABEL = { yes: 'Tak', maybe: 'Może', no: 'Nie' };
const STATUS_LABEL = { rejected: ['Odrzucony', 'bad'], hired: ['Zatrudniony', 'good'] };

export default async function render(ctx) {
  const { h, ui, store } = { h: ctx.ui.h, ui: ctx.ui, store: ctx.store };
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
    crumbs: [{ label: 'Kandydaci', href: '#/candidates' }],
    width: 'wide',
    actions: position ? [ui.button({ label: 'Kanban stanowiska', variant: 'secondary', size: 'sm', icon: 'briefcase', onClick: () => ctx.navigate(`#/positions/${position.id}`) })] : [],
  });

  if (!stage) {
    return ui.emptyState({ icon: 'alert', title: 'Stanowisko nie ma etapów', text: 'Dodaj etapy kanbanu w ustawieniach stanowiska, żeby móc oceniać kandydata.', action: position ? { label: 'Otwórz stanowisko', onClick: () => ctx.navigate(`#/positions/${position.id}`) } : null });
  }

  const card = await store.scorecards.get(candidate.id, stage);
  const rubricId = card.rubric_id || (position && position.rubric_id) || null;
  const rubric = rubricId ? await store.rubrics.get(rubricId) : null;
  if (rubric && !card.rubric_id) card.rubric_id = rubric.id;

  // które etapy mają już oceny (kropka w przełączniku)
  let ratedStages = new Set();
  try {
    const all = await store.scorecards.list();
    ratedStages = new Set(all.filter((c) => c.candidate_id === candidate.id && ((c.ratings || []).length || c.decision)).map((c) => c.stage));
  } catch { /* nieistotne dla widoku */ }

  const state = {
    candidate, position, stages, stage, card, rubric,
    me: { id: ctx.user.id, name: ctx.user.name || ctx.user.email || 'Ty' },
    suggestions: rubric ? ctx.ai.suggest({ candidate, rubric, stage }) : {},
    saving: false, savedAt: null, saveError: null,
    openReasons: new Set(),
  };

  const root = h('div', { class: 'sc' });
  const headEl = h('div', { class: 'sc-head' });
  const stagesEl = h('div', { class: 'sc-stages' });
  const bodyEl = h('div', { class: 'sc-body' });
  const questionsEl = h('div', { class: 'sc-questions' });
  const asideEl = h('aside', { class: 'sc-aside', 'aria-label': 'Podsumowanie oceny' });
  bodyEl.append(questionsEl, asideEl);
  root.append(headEl, stagesEl, bodyEl);

  /* ------------------------------------------------ pomocnicze */
  const myRating = (qid) => (state.card.ratings || []).find((r) => r.question_id === qid && r.rater_id === state.me.id) || null;
  const questionRatings = (qid) => (state.card.ratings || []).filter((r) => r.question_id === qid);
  const discrepancy = (qid) => {
    const scores = questionRatings(qid).map((r) => Number(r.score));
    if (scores.length < 2) return 0;
    const gap = Math.max(...scores) - Math.min(...scores);
    return gap >= 2 ? gap : 0;
  };
  const totals = () => {
    const out = { total: null, rated: 0, count: 0, raters: 0, flags: 0 };
    if (!state.rubric) return out;
    let sw = 0, sum = 0;
    out.count = state.rubric.questions.length;
    for (const q of state.rubric.questions) {
      const scores = questionRatings(q.id).map((r) => Number(r.score));
      if (discrepancy(q.id)) out.flags++;
      if (!scores.length) continue;
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      sw += Number(q.weight) || 1; sum += (Number(q.weight) || 1) * avg; out.rated++;
    }
    out.total = sw ? sum / sw : null;
    out.raters = new Set((state.card.ratings || []).map((r) => r.rater_id)).size;
    return out;
  };
  const recommendation = (total) => (total === null ? null : total >= 3.8 ? RECO.yes : total >= 3 ? RECO.maybe : RECO.no);

  async function persist(mutate, { revertOnError = true } = {}) {
    const before = JSON.parse(JSON.stringify(state.card));
    mutate(state.card);
    state.card.ai = state.suggestions; // zapisujemy, co AI podpowiadało — dla przejrzystości
    state.saving = true; state.saveError = null;
    renderAside();
    try {
      state.card = await store.scorecards.save(state.card);
      state.savedAt = new Date();
      return true;
    } catch (err) {
      if (revertOnError) state.card = before;
      state.saveError = (err && err.message) || 'Nie udało się zapisać oceny.';
      ui.toast(state.saveError, 'bad');
      return false;
    } finally {
      state.saving = false;
      renderQuestions();
      renderAside();
    }
  }

  async function rate(qid, score, focusAfter) {
    const current = myRating(qid);
    if (current && Number(current.score) === score) return; // bez zmian
    await persist((c) => {
      c.ratings = (c.ratings || []).filter((r) => !(r.question_id === qid && r.rater_id === state.me.id));
      c.ratings.push({ question_id: qid, rater_id: state.me.id, rater_name: state.me.name, score });
    });
    if (focusAfter) {
      const btn = questionsEl.querySelector(`[data-q="${cssEscape(qid)}"] [data-score="${score}"]`);
      if (btn) btn.focus({ preventScroll: true });
    }
  }

  async function acceptAi() {
    const qs = (state.rubric && state.rubric.questions) || [];
    const changes = qs.filter((q) => state.suggestions[q.id] && (!myRating(q.id) || Number(myRating(q.id).score) !== state.suggestions[q.id].score));
    if (!changes.length) { ui.toast('Twoje oceny już zgadzają się z sugestiami AI.', 'neutral'); return; }
    const overwrite = changes.filter((q) => myRating(q.id)).length;
    const ok = await ui.confirm({
      title: 'Przyjąć sugestie AI jako swoje oceny?',
      text: `Sugestie AI staną się Twoimi ocenami w ${ui.plural(changes.length, 'pytaniu', 'pytaniach', 'pytaniach')}${overwrite ? ` (w tym ${ui.plural(overwrite, 'zmieniona ocena', 'zmienione oceny', 'zmienionych ocen')})` : ''}. Każdą możesz potem poprawić ręcznie — to Ty odpowiadasz za ocenę.`,
      confirmLabel: 'Przyjmij sugestie',
    });
    if (!ok) return;
    const saved = await persist((c) => {
      for (const q of changes) {
        c.ratings = (c.ratings || []).filter((r) => !(r.question_id === q.id && r.rater_id === state.me.id));
        c.ratings.push({ question_id: q.id, rater_id: state.me.id, rater_name: state.me.name, score: state.suggestions[q.id].score });
      }
    });
    if (saved) ui.toast(`Przyjęto sugestie AI w ${ui.plural(changes.length, 'pytaniu', 'pytaniach', 'pytaniach')}. Oceny są teraz Twoje.`, 'good');
  }

  async function decide(decision) {
    if (state.card.decision === decision) return;
    const t = totals();
    const reco = recommendation(t.total);
    const hint = reco
      ? `Podpowiedź z sumy ważonej: „${reco.label}” (${ui.fmtScore(t.total)} / 5).${reco.label !== DECISION_LABEL[decision] && !(reco === RECO.maybe && decision === 'maybe') ? ' Twoja decyzja jest inna — to w porządku, decyzja należy do Ciebie.' : ''}`
      : 'Brak jeszcze ocen w tej karcie — decyzję możesz podjąć także bez nich.';
    const ok = await ui.confirm({
      title: `Zatwierdzić decyzję „${DECISION_LABEL[decision]}”?`,
      text: `${state.candidate.full_name}, etap „${state.stage}”. ${hint} Decyzję zapisujemy z Twoim imieniem; możesz ją później zmienić.`,
      confirmLabel: `Zatwierdź: ${DECISION_LABEL[decision]}`,
      danger: decision === 'no',
    });
    if (!ok) return;
    const saved = await persist((c) => { c.decision = decision; });
    if (saved) ui.toast(`Decyzja „${DECISION_LABEL[decision]}” zapisana.`, 'good');
  }

  async function moveNext(nextStage, btn) {
    const ok = await ui.confirm({
      title: `Przenieść do etapu „${nextStage}”?`,
      text: `${state.candidate.full_name} przejdzie z etapu „${state.candidate.stage}” do „${nextStage}”. Kandydat nie dostanie żadnej wiadomości.`,
      confirmLabel: 'Przenieś',
    });
    if (!ok) return;
    if (btn) btn.setBusy(true);
    try {
      state.candidate = await store.candidates.move(state.candidate.id, nextStage);
      ui.toast(`${state.candidate.full_name}: etap „${nextStage}”.`, 'good');
      renderHead(); renderStages(); renderAside();
    } catch (err) {
      ui.toast((err && err.message) || 'Nie udało się przenieść kandydata.', 'bad');
      if (btn) btn.setBusy(false);
    }
  }

  /* ------------------------------------------------ nagłówek kandydata */
  function renderHead() {
    const { candidate: c, position: p } = state;
    const st = STATUS_LABEL[c.status];
    const meta = [];
    if (p) meta.push(h('a', { class: 'link', href: `#/positions/${p.id}` }, p.title));
    if (c.source) meta.push(`źródło: ${c.source}`);
    if (c.applied_at) meta.push(`zgłoszenie ${ui.formatDate(c.applied_at)}`);
    const metaEl = h('p', { class: 'sc-meta' });
    meta.forEach((m, i) => { if (i) metaEl.append(h('span', { class: 'sep', 'aria-hidden': 'true' }, '·')); metaEl.append(m); });

    const cv = ctx.ai.cvScore(c, p);
    const circumference = 2 * Math.PI * 17;
    const ring = h('span', { class: 'sc-ring', role: 'img', 'aria-label': `Dopasowanie CV ${cv} na 100` },
      svgRing(circumference, cv), h('b', null, String(cv)));

    headEl.replaceChildren(
      h('div', { class: 'sc-who' },
        ui.avatar(c.full_name, 'lg'),
        h('div', { class: 'sc-who-t' },
          h('h1', null, c.full_name),
          metaEl,
          h('div', { class: 'cluster sc-tags' },
            ui.tag(`Etap: ${c.stage || '—'}`, 'neutral'),
            st ? ui.tag(st[0], st[1]) : null,
            c.email ? h('a', { class: 'small muted sc-mail', href: `mailto:${c.email}` }, c.email) : null,
          ),
          c.status === 'rejected' && c.reject_reason ? h('p', { class: 'small muted sc-reject' }, `Powód odrzucenia: ${c.reject_reason}`) : null,
        ),
      ),
      h('div', { class: 'sc-cv' },
        ring,
        h('div', { class: 'sc-cv-t' },
          h('div', { class: 'cluster' }, h('b', null, 'Dopasowanie CV'), ui.aiBadge('Sugestia AI')),
          h('p', { class: 'small muted' }, ctx.ai.cvReason(c, p)),
        ),
      ),
    );
  }

  function svgRing(circ, value) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 40 40'); svg.setAttribute('aria-hidden', 'true');
    const bg = document.createElementNS(ns, 'circle');
    bg.setAttribute('cx', '20'); bg.setAttribute('cy', '20'); bg.setAttribute('r', '17'); bg.setAttribute('class', 'bg');
    const fg = document.createElementNS(ns, 'circle');
    fg.setAttribute('cx', '20'); fg.setAttribute('cy', '20'); fg.setAttribute('r', '17'); fg.setAttribute('class', 'fg');
    fg.setAttribute('stroke-dasharray', `${(circ * Math.max(0, Math.min(100, value)) / 100).toFixed(2)} ${circ.toFixed(2)}`);
    svg.append(bg, fg);
    return svg;
  }

  /* ------------------------------------------------ przełącznik etapu */
  function renderStages() {
    const group = h('div', { class: 'segment sc-segment', role: 'group', 'aria-label': 'Etap oceny' });
    for (const s of state.stages) {
      const on = s === state.stage;
      const btn = h('button', { type: 'button', 'aria-pressed': on ? 'true' : 'false', title: s === state.candidate.stage ? `${s} — obecny etap kandydata` : s },
        s,
        ratedStages.has(s) || (on && ((state.card.ratings || []).length || state.card.decision)) ? h('i', { class: 'dot', 'aria-label': 'ma oceny', role: 'img' }) : null,
        s === state.candidate.stage ? h('em', { class: 'sr-only' }, ' (obecny etap)') : null,
      );
      btn.addEventListener('click', () => { if (!on) ctx.navigate(`#/candidates/${state.candidate.id}?stage=${encodeURIComponent(s)}`); });
      group.appendChild(btn);
    }
    stagesEl.replaceChildren(
      h('div', { class: 'sc-stages-l' }, h('span', { class: 'small muted' }, 'Karta oceny etapu')),
      h('div', { class: 'sc-stages-scroll' }, group),
    );
  }

  /* ------------------------------------------------ pytania */
  function renderQuestions() {
    const r = state.rubric;
    if (!r) {
      questionsEl.replaceChildren(ui.emptyState({
        icon: 'rubric',
        title: 'To stanowisko nie ma rubryki',
        text: 'Bez rubryki rozmowy nie będą porównywalne. Wybierz rubrykę w ustawieniach stanowiska albo utwórz nową.',
        action: [
          { label: 'Przejdź do rubryk', variant: 'primary', onClick: () => ctx.navigate('#/rubrics') },
          state.position ? { label: 'Otwórz stanowisko', variant: 'secondary', onClick: () => ctx.navigate(`#/positions/${state.position.id}`) } : null,
        ].filter(Boolean),
      }));
      return;
    }
    if (!Array.isArray(r.questions) || !r.questions.length) {
      questionsEl.replaceChildren(ui.emptyState({
        icon: 'rubric', title: 'Rubryka nie ma pytań',
        text: `Rubryka „${r.name}” jest pusta. Dodaj pytania z kotwicami, żeby ocenić kandydata.`,
        action: { label: 'Edytuj rubrykę', onClick: () => ctx.navigate(`#/rubrics/${r.id}`) },
      }));
      return;
    }

    const aiCount = r.questions.filter((q) => state.suggestions[q.id]).length;
    const pending = r.questions.filter((q) => state.suggestions[q.id] && (!myRating(q.id) || Number(myRating(q.id).score) !== state.suggestions[q.id].score)).length;
    const acceptBtn = ui.button({ label: 'Przyjmij sugestie AI', variant: 'secondary', size: 'sm', icon: 'spark', onClick: acceptAi, disabled: !pending || state.saving, title: pending ? `Sugestie AI staną się Twoimi ocenami w ${pending} pyt.` : 'Twoje oceny zgadzają się z sugestiami AI' });
    const toolbar = h('div', { class: 'sc-toolbar' },
      h('div', { class: 'sc-toolbar-t' },
        h('h2', null, 'Pytania z rubryki'),
        h('p', { class: 'small muted' }, h('a', { class: 'link', href: `#/rubrics/${r.id}` }, r.name), ` · wersja ${r.version || 1} · ${ui.plural(r.questions.length, 'pytanie', 'pytania', 'pytań')}`,
          aiCount ? ` · AI podpowiada ${aiCount === r.questions.length ? 'przy każdym' : `przy ${aiCount}`}` : ''),
      ),
      aiCount ? acceptBtn : null,
    );

    const list = h('ol', { class: 'sc-list' }, r.questions.map((q, i) => renderQuestion(q, i)));
    questionsEl.replaceChildren(toolbar, list,
      h('p', { class: 'sc-legal small faint' }, 'Sugestie AI są pomocnicze i zawsze mają uzasadnienie. Ocenę i decyzję zatwierdza człowiek — AI nigdy nie odrzuca ani nie przesuwa kandydata.'));
  }

  function renderQuestion(q, i) {
    const mine = myRating(q.id);
    const myScore = mine ? Number(mine.score) : null;
    const sug = state.suggestions[q.id] || null;
    const gap = discrepancy(q.id);
    const others = questionRatings(q.id).filter((x) => x.rater_id !== state.me.id);

    const scale = h('div', { class: 'sc-scale', role: 'group', 'aria-label': `Twoja ocena: ${q.competency || `pytanie ${i + 1}`}` });
    for (let n = 1; n <= 5; n++) {
      const isAi = sug && sug.score === n;
      const btn = h('button', {
        type: 'button', class: `sc-score${isAi ? ' ai' : ''}`, 'data-score': String(n),
        'aria-pressed': myScore === n ? 'true' : 'false',
        'aria-label': `Ocena ${n} z 5${isAi ? ' (sugestia AI)' : ''}${q.anchors && q.anchors[n] ? `: ${q.anchors[n]}` : ''}`,
        title: q.anchors && q.anchors[n] ? `${n}: ${q.anchors[n]}` : `Ocena ${n}`,
        disabled: state.saving,
      }, String(n), isAi ? h('span', { class: 'sc-ai-mark', 'aria-hidden': 'true' }, ui.icon('spark', 10)) : null);
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

    const raters = h('div', { class: 'sc-raters' },
      h('span', { class: `sc-rater${mine ? '' : ' none'}` }, ui.avatar(state.me.name, 'sm'), h('span', null, 'Ty'), h('b', null, mine ? String(myScore) : '–')),
      others.map((o) => h('span', { class: 'sc-rater' }, ui.avatar(o.rater_name || '?', 'sm'), h('span', null, o.rater_name || 'Rozmówca'), h('b', null, String(o.score)))),
    );

    let aiBlock = null;
    if (sug) {
      const open = state.openReasons.has(q.id);
      const whyBtn = h('button', { type: 'button', class: 'sc-why link', 'aria-expanded': open ? 'true' : 'false', 'aria-controls': `why-${q.id}` }, open ? 'Ukryj uzasadnienie' : 'Dlaczego?');
      const why = h('p', { id: `why-${q.id}`, class: 'sc-why-t small muted', hidden: !open }, sug.reason);
      whyBtn.addEventListener('click', () => {
        const now = !state.openReasons.has(q.id);
        if (now) state.openReasons.add(q.id); else state.openReasons.delete(q.id);
        why.hidden = !now; whyBtn.setAttribute('aria-expanded', now ? 'true' : 'false'); whyBtn.textContent = now ? 'Ukryj uzasadnienie' : 'Dlaczego?';
      });
      aiBlock = h('div', { class: 'sc-ai' },
        h('div', { class: 'sc-ai-h' }, ui.aiBadge(`AI sugeruje ${sug.score}/5`), whyBtn),
        h('blockquote', { class: 'sc-quote' }, `„${sug.quote}”`),
        why,
      );
    }

    const anchors = h('details', { class: 'sc-anchors' },
      h('summary', null, ui.icon('chevron-right', 14), 'Kotwice ocen 1–5'),
      h('ol', { class: 'sc-anchor-list' }, [1, 2, 3, 4, 5].map((n) => h('li', { class: myScore === n ? 'on' : (sug && sug.score === n ? 'ai' : '') },
        h('b', null, String(n)), h('span', null, (q.anchors && (q.anchors[n] || q.anchors[String(n)])) || h('i', { class: 'faint' }, 'brak opisu'))))),
    );

    return h('li', { class: `sc-q${gap ? ' flag' : ''}`, 'data-q': q.id },
      h('div', { class: 'sc-q-h' },
        h('span', { class: 'sc-q-n', 'aria-hidden': 'true' }, String(i + 1)),
        h('div', { class: 'sc-q-t' },
          h('p', { class: 'sc-q-text' }, q.text),
          h('p', { class: 'small muted sc-q-meta' },
            q.competency ? h('span', null, q.competency) : null,
            h('span', null, `waga ×${q.weight || 1}`),
            q.minutes ? h('span', null, `${q.minutes} min`) : null,
          ),
        ),
      ),
      h('div', { class: 'sc-q-rate' }, scale, raters),
      gap ? h('div', { class: 'sc-flag', role: 'status' }, ui.icon('flag', 14), `Rozbieżność ${gap} pkt — omówcie przed decyzją`) : null,
      aiBlock,
      anchors,
    );
  }

  /* ------------------------------------------------ podsumowanie */
  function renderAside() {
    const t = totals();
    const reco = recommendation(t.total);
    const decision = state.card.decision;
    const hasRubric = Boolean(state.rubric && state.rubric.questions && state.rubric.questions.length);

    const scoreBlock = h('div', { class: 'sc-sum' },
      h('small', null, 'Wynik etapu (suma ważona)'),
      h('b', { class: 'sc-total' }, t.total === null ? '–' : ui.fmtScore(t.total), h('span', null, ' / 5')),
      h('p', { class: 'small muted' }, hasRubric
        ? `${t.rated} z ${ui.plural(t.count, 'pytania', 'pytań', 'pytań')} · ${t.raters ? ui.plural(t.raters, 'rozmówca', 'rozmówców', 'rozmówców') : 'brak ocen'}`
        : 'Brak rubryki — nie ma czego liczyć.'),
    );

    const recoBlock = h('div', { class: 'sc-sum' },
      h('div', { class: 'cluster' }, h('small', null, 'Rekomendacja'), h('span', { class: 'tag neutral' }, 'podpowiedź')),
      h('b', { class: `sc-reco ${reco ? reco.tone : ''}` }, reco ? reco.label : 'Brak ocen'),
      h('p', { class: 'small muted' }, reco
        ? 'Liczona z sumy ważonej: od 3,8 „Tak”, od 3 „Do omówienia”, poniżej „Nie”. To nie decyzja — decyzję podejmujesz Ty.'
        : 'Pojawi się po pierwszej ocenie.'),
      t.flags ? h('p', { class: 'sc-flag-sum' }, ui.icon('flag', 14), ui.plural(t.flags, 'rozbieżność do omówienia', 'rozbieżności do omówienia', 'rozbieżności do omówienia')) : null,
    );

    const decisionGroup = h('div', { class: 'sc-decide', role: 'group', 'aria-label': 'Decyzja po etapie' },
      ['yes', 'maybe', 'no'].map((d) => {
        const b = h('button', { type: 'button', class: `choice sc-choice ${d}`, 'aria-pressed': decision === d ? 'true' : 'false', disabled: state.saving },
          d === 'yes' ? ui.icon('check', 15) : d === 'no' ? ui.icon('x', 15) : null, DECISION_LABEL[d]);
        b.addEventListener('click', () => decide(d));
        return b;
      }),
    );

    const idx = state.stages.indexOf(state.stage);
    const nextStage = idx >= 0 ? state.stages[idx + 1] : null;
    let moveBlock = null;
    if (decision === 'yes' && nextStage && state.candidate.status === 'active') {
      if (state.candidate.stage === nextStage) {
        moveBlock = h('p', { class: 'small muted sc-moved' }, ui.icon('check', 14), `Kandydat jest już na etapie „${nextStage}”.`);
      } else if (state.stages.indexOf(state.candidate.stage) > idx + 1) {
        moveBlock = h('p', { class: 'small muted sc-moved' }, `Kandydat jest dalej w kanbanie: „${state.candidate.stage}”.`);
      } else {
        const btn = ui.button({ label: `Przenieś do etapu „${nextStage}”`, variant: 'primary', icon: 'arrow', block: true });
        btn.addEventListener('click', () => moveNext(nextStage, btn));
        moveBlock = h('div', { class: 'sc-move' }, btn, h('p', { class: 'small muted' }, 'Przeniesienie wykonuje się tylko na Twoje kliknięcie.'));
      }
    } else if (decision === 'yes' && !nextStage) {
      moveBlock = h('p', { class: 'small muted sc-moved' }, 'To ostatni etap kanbanu.');
    } else if (decision === 'no' && state.candidate.status === 'active' && state.position) {
      moveBlock = h('p', { class: 'small muted sc-moved' }, 'Odrzucenie z podaniem powodu zrobisz w ', h('a', { class: 'link', href: `#/positions/${state.position.id}` }, 'kanbanie stanowiska'), '.');
    }

    const decisionBlock = h('div', { class: 'sc-sum sc-sum-decision' },
      h('small', null, 'Twoja decyzja po tym etapie'),
      decision ? h('p', { class: 'sc-decision-now' }, 'Zatwierdzono: ', h('b', null, DECISION_LABEL[decision])) : h('p', { class: 'small muted' }, 'Jeszcze nie podjęta.'),
      decisionGroup,
      moveBlock,
    );

    const status = h('p', { class: 'sc-status small faint', role: 'status', 'aria-live': 'polite' },
      state.saving ? 'Zapisywanie…' : state.saveError ? `Nie zapisano: ${state.saveError}` : state.savedAt ? `Zapisano ${ui.formatDate(state.savedAt, { time: true }).split(', ')[1] || ''}` : 'Oceny zapisują się automatycznie.');

    asideEl.replaceChildren(scoreBlock, recoBlock, decisionBlock, status);
  }

  renderHead(); renderStages(); renderQuestions(); renderAside();
  return root;
}

function cssEscape(s) {
  return (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&');
}
