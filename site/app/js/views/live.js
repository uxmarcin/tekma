/**
 * views/live.js — rozmowa na żywo z coachem AI (#/candidates/:id/live, opcjonalnie ?stage=). Układ 1:1 z Figmą 28:3679.
 *
 * Co robi:
 *   - pasek górny (ctx.setHeader): tytuł „<kandydat> — <etap>”, znacznik „Nagrywanie · mm:ss” (timer), „Wycisz coacha”, „Zakończ i oceń”,
 *   - bieżące pytanie z rubryki: numer, kompetencja, waga, czas „x / N min” z paskiem postępu, pokrycie rubryki (chipy),
 *   - transkrypcja na żywo (dane demo z interview-data.js) + wskaźnik „<imię> mówi…” + notatka do pytania (localStorage),
 *   - coach AI (oznaczony iskrą i „Na żywo”): czego brakuje + 3 pytania do dopytania — kliknięcie „zadaje” pytanie
 *     (trafia do transkrypcji z Twoim imieniem), „Następne pytania” przełączają bieżące pytanie,
 *   - sesja (start, bieżące pytanie, wyciszenie, zadane pytania) zapisuje się w localStorage (interview-data.session).
 *
 * Zasada AI Act: coach tylko podpowiada; pytania zadaje i oceny wystawia człowiek. Kandydat nie widzi podpowiedzi.
 * export default async function render(ctx) -> HTMLElement
 */

import { interviewDemo, notes, session, speakerName, firstName, RATER_NAMES } from './interview-data.js';

const DEMO_ELAPSED = 18 * 60 + 42;   // Figma: „Nagrywanie · 18:42”
const DEMO_Q_ELAPSED = 6 * 60;       // Figma: „6 / 10 min”

const mmss = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

function spark(ui, size = 16) {
  const svg = ui.icon('info', size);
  svg.innerHTML = '<path d="M12 3l1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8z" fill="currentColor" stroke="none"/>';
  svg.classList.remove('ico-info'); svg.classList.add('ico-spark4');
  return svg;
}

export default async function render(ctx) {
  const { ui, store } = ctx;
  const { h } = ui;
  await ui.loadCss(new URL('./live.css', import.meta.url));

  const candidate = await store.candidates.get(ctx.params.id);
  if (!candidate) {
    ctx.setHeader({ title: 'Rozmowa na żywo', crumbs: [{ label: 'Kandydaci', href: '#/candidates' }], width: 'wide' });
    return ui.emptyState({ icon: 'user', title: 'Nie znaleziono kandydata', text: 'Ten kandydat nie istnieje albo został usunięty.', action: { label: 'Wróć do kandydatów', onClick: () => ctx.navigate('#/candidates') } });
  }
  const position = candidate.position_id ? await store.positions.get(candidate.position_id) : null;
  const stages = (position && position.stages && position.stages.length) ? position.stages : [candidate.stage].filter(Boolean);
  const requested = ctx.query && ctx.query.stage;
  const stage = stages.includes(requested) ? requested : (candidate.stage || stages[0] || 'Rozmowa');
  const card = await store.scorecards.get(candidate.id, stage);
  const rubricId = card.rubric_id || (position && position.rubric_id) || null;
  const rubric = rubricId ? await store.rubrics.get(rubricId) : null;
  const questions = (rubric && Array.isArray(rubric.questions)) ? rubric.questions : [];
  const demo = interviewDemo({ candidate, position, rubric, stage });
  const who = speakerName(candidate);
  const me = firstName(ctx.user.name) || 'Ty';
  const femaleCandidate = /a$/i.test(who) && !/^(Kuba|Jarema)$/i.test(who);

  /* ------------------------------------------------ sesja */
  const now = () => Date.now();
  let s = session.get(candidate.id, stage);
  if (!s || typeof s.startedAt !== 'number') {
    s = { startedAt: now() - DEMO_ELAPSED * 1000, qIndex: 0, qStartedAt: now() - DEMO_Q_ELAPSED * 1000, muted: false, asked: [] };
    session.set(candidate.id, stage, s);
  }
  if (s.qIndex >= questions.length) s.qIndex = Math.max(0, questions.length - 1);
  const saveSession = () => session.set(candidate.id, stage, s);
  const elapsed = () => Math.max(0, Math.floor((now() - s.startedAt) / 1000));
  const qElapsed = () => Math.max(0, Math.floor((now() - s.qStartedAt) / 1000));
  const currentQ = () => questions[s.qIndex] || null;

  /* ------------------------------------------------ pasek górny */
  const liveBadge = h('span', { class: 'lv-live', role: 'status', 'aria-live': 'off', title: 'Nagrywanie trwa — kandydat wyraził zgodę' }, h('i', { 'aria-hidden': 'true' }), h('span', null, `Nagrywanie · ${mmss(elapsed())}`));
  const muteBtn = ui.button({ label: s.muted ? 'Włącz coacha' : 'Wycisz coacha', variant: 'secondary', size: 'sm', attrs: { class: 'btn btn-secondary btn-sm lv-desk', 'aria-pressed': s.muted ? 'true' : 'false' }, onClick: toggleMute });
  const endBtn = ui.button({ label: 'Zakończ i oceń', variant: 'primary', size: 'sm', attrs: { class: 'btn btn-primary btn-sm lv-desk' }, onClick: finish });
  ctx.setHeader({
    title: `${candidate.full_name} — ${stage}`,
    crumbs: [{ label: 'Kandydaci', href: '#/candidates' }, { label: candidate.full_name, href: `#/candidates/${candidate.id}` }],
    actions: [liveBadge, muteBtn, endBtn],
    width: 'wide',
  });

  function toggleMute() {
    s.muted = !s.muted; saveSession();
    for (const b of [muteBtn, muteBtnM]) { b.querySelector('span').textContent = s.muted ? 'Włącz coacha' : 'Wycisz coacha'; b.setAttribute('aria-pressed', s.muted ? 'true' : 'false'); }
    renderCoach();
    ui.toast(s.muted ? 'Coach wyciszony — podpowiedzi nie będą się pojawiać.' : 'Coach włączony.', 'neutral');
  }
  async function finish() {
    const ok = await ui.confirm({ title: 'Zakończyć rozmowę i przejść do oceny?', text: `Nagranie zatrzyma się na ${mmss(elapsed())}. Ocenisz każde pytanie samodzielnie — sugestie AI zobaczysz obok, ale decyzja należy do Ciebie.`, confirmLabel: 'Zakończ i oceń' });
    if (!ok) return;
    s.endedAt = now(); saveSession();
    ctx.navigate(`#/candidates/${candidate.id}/review?stage=${encodeURIComponent(stage)}`);
  }

  /* ------------------------------------------------ szkielet */
  const root = h('div', { class: 'lv' });
  const convEl = h('div', { class: 'lv-conv' });
  const coachEl = h('aside', { class: 'lv-coach', 'aria-label': 'Coach AI' });
  const muteBtnM = ui.button({ label: s.muted ? 'Włącz coacha' : 'Wycisz coacha', variant: 'secondary', size: 'sm', attrs: { class: 'btn btn-secondary btn-sm', 'aria-pressed': s.muted ? 'true' : 'false' }, onClick: toggleMute });
  const endBtnM = ui.button({ label: 'Zakończ i oceń', variant: 'primary', size: 'sm', onClick: finish });
  const mobileBar = h('div', { class: 'lv-mbar' }, muteBtnM, endBtnM);
  root.append(convEl, coachEl, mobileBar);

  const subEl = h('p', { class: 'lv-sub' }, [position && position.title, 'Google Meet', RATER_NAMES.join(', ')].filter(Boolean).join(' · '));

  /* ------------------------------------------------ bieżące pytanie */
  const qCard = h('section', { class: 'lv-q', 'aria-label': 'Bieżące pytanie' });
  const timeEl = h('span', { class: 'lv-q-time' });
  const fillEl = h('i', { class: 'lv-fill' });
  function renderQuestion() {
    const q = currentQ();
    if (!q) {
      qCard.replaceChildren(h('div', { class: 'lv-q-h' }, h('span', { class: 'lv-badge' }, 'Brak pytań')),
        h('p', { class: 'lv-q-text' }, rubric ? 'Rubryka nie ma pytań.' : 'To stanowisko nie ma rubryki — coach nie ma czego pilnować.'),
        h('p', { class: 'lv-muted' }, h('a', { class: 'lv-link', href: rubric ? `#/rubrics/${rubric.id}` : '#/rubrics' }, rubric ? 'Dodaj pytania do rubryki' : 'Przejdź do rubryk')));
      return;
    }
    const cov = demo.coverage[q.id] || [];
    qCard.replaceChildren(
      h('div', { class: 'lv-q-h' },
        h('span', { class: 'lv-badge' }, `Pytanie ${s.qIndex + 1} z ${questions.length}${q.competency ? ` · ${q.competency}` : ''} · waga ×${q.weight || 1}`),
        h('span', { class: 'lv-spacer' }),
        ui.icon('clock', 16), timeEl,
      ),
      h('div', { class: 'lv-progress', role: 'progressbar', 'aria-label': 'Czas na pytanie', 'aria-valuemin': '0', 'aria-valuemax': '100' }, fillEl),
      h('p', { class: 'lv-q-text' }, q.text),
      h('div', { class: 'lv-cov' },
        h('span', { class: 'lv-muted' }, 'Pokrycie rubryki:'),
        cov.map((c) => h('span', { class: `lv-cov-chip${c.ok ? ' ok' : ''}`, title: c.ok ? 'Kandydat już o tym powiedział' : 'Jeszcze nie padło — coach podpowiada, jak dopytać' }, c.ok ? ui.icon('check', 12) : null, c.label)),
      ),
    );
    tick();
  }

  /* ------------------------------------------------ transkrypcja */
  const linesEl = h('div', { class: 'lv-lines', 'aria-live': 'polite' });
  const noteInput = h('input', { class: 'lv-note', type: 'text', 'aria-label': 'Notatka do bieżącego pytania', placeholder: 'Notatka do tego pytania (widzą tylko rozmówcy)…', maxlength: '300' });
  noteInput.addEventListener('change', () => { const q = currentQ(); if (q) notes.set(candidate.id, stage, q.id, noteInput.value.trim()); });
  noteInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); noteInput.blur(); ui.toast('Notatka zapisana. Zobaczysz ją przy ocenie.', 'good'); } });
  const trPanel = h('section', { class: 'lv-panel lv-tr', 'aria-label': 'Transkrypcja na żywo' },
    h('div', { class: 'lv-ph' }, h('b', null, 'Transkrypcja na żywo'), h('span', null, 'PL · auto')),
    linesEl,
    h('div', { class: 'lv-listen' }, ui.icon('mic', 16), h('span', null, `${who} mówi…`), h('i', { class: 'lv-pulse', 'aria-hidden': 'true' })),
    h('div', { class: 'lv-note-row' }, noteInput),
  );
  function renderLines() {
    const q = currentQ();
    const base = s.qIndex === 0 ? demo.live.lines : [{ t: mmss(Math.max(0, elapsed() - qElapsed())), who: RATER_NAMES[1], text: q ? q.text : '' }];
    const asked = (s.asked || []).filter((a) => a.qIndex === s.qIndex).map((a) => ({ t: a.t, who: a.who, text: a.text }));
    const all = base.concat(asked);
    linesEl.replaceChildren(all.map((l) => h('div', { class: 'lv-line' },
      h('span', { class: 'lv-line-t' }, l.t),
      h('div', { class: `lv-line-b${l.mark ? ' mark' : ''}` }, h('b', null, l.who), h('p', null, l.text)),
    )));
    noteInput.value = q ? notes.get(candidate.id, stage, q.id) : '';
  }

  /* ------------------------------------------------ coach */
  function renderCoach() {
    const q = currentQ();
    const coach = q ? (demo.coach[q.id] || { missing: '', questions: [] }) : { missing: '', questions: [] };
    const askedTexts = new Set((s.asked || []).filter((a) => a.qIndex === s.qIndex).map((a) => a.text));
    const head = h('div', { class: 'lv-coach-h' }, spark(ui, 16), h('b', null, 'Coach AI · dopytaj teraz'), h('span', { class: `lv-badge soft${s.muted ? ' off' : ''}` }, s.muted ? 'Wyciszony' : 'Na żywo'));
    const items = [];
    if (s.muted) {
      items.push(h('p', { class: 'lv-muted' }, 'Coach jest wyciszony. Podpowiedzi wrócą po włączeniu — nic nie znika z transkrypcji.'));
    } else if (!q) {
      items.push(h('p', { class: 'lv-muted' }, 'Bez pytań z rubryki coach nie ma czego pilnować.'));
    } else {
      items.push(h('p', { class: 'lv-coach-lead' }, coach.missing));
      let firstOpen = true;
      coach.questions.forEach((text, i) => {
        const done = askedTexts.has(text);
        const primary = !done && firstOpen; if (primary) firstOpen = false;
        const btn = h('button', { type: 'button', class: `lv-sug${primary ? ' first' : ''}${done ? ' done' : ''}`, 'aria-pressed': done ? 'true' : 'false', title: done ? 'Zadane — jest w transkrypcji' : 'Zadaj to pytanie (trafi do transkrypcji z Twoim imieniem)' },
          h('span', { class: 'lv-sug-n' }, done ? ui.icon('check', 12) : String(i + 1)),
          h('span', { class: 'lv-sug-t' }, text),
        );
        btn.addEventListener('click', () => ask(text));
        items.push(btn);
      });
    }
    const next = questions.map((qq, i) => ({ qq, i })).filter(({ i }) => i !== s.qIndex);
    const nextList = next.length ? next.map(({ qq, i }) => {
      const b = h('button', { type: 'button', class: 'lv-next', title: `Przejdź do pytania ${i + 1}` },
        h('span', null, qq.competency ? `${qq.competency}: ${qq.text}` : qq.text), h('small', null, `${qq.minutes || 10} min`));
      b.addEventListener('click', () => switchQuestion(i));
      return b;
    }) : h('p', { class: 'lv-muted' }, 'To ostatnie pytanie z rubryki.');
    coachEl.replaceChildren(
      head, ...items,
      h('hr'),
      h('b', { class: 'lv-coach-sub' }, 'Następne pytania'),
      nextList,
      h('div', { class: 'lv-privacy' }, `Podpowiedzi coacha widzą tylko rozmówcy. ${femaleCandidate ? 'Kandydatka zgodziła się' : 'Kandydat zgodził się'} na nagrywanie.`),
    );
  }

  function ask(text) {
    const already = (s.asked || []).some((a) => a.qIndex === s.qIndex && a.text === text);
    if (already) return;
    s.asked = (s.asked || []).concat([{ qIndex: s.qIndex, text, who: me, t: mmss(elapsed()) }]);
    saveSession();
    renderLines(); renderCoach();
    ui.toast('Pytanie trafiło do transkrypcji. Zadaj je na głos.', 'neutral');
  }
  function switchQuestion(i) {
    if (i === s.qIndex || !questions[i]) return;
    s.qIndex = i; s.qStartedAt = now(); saveSession();
    renderQuestion(); renderLines(); renderCoach();
    ui.toast(`Pytanie ${i + 1} z ${questions.length}.`, 'neutral');
  }

  /* ------------------------------------------------ timer */
  function tick() {
    liveBadge.querySelector('span').textContent = `Nagrywanie · ${mmss(elapsed())}`;
    const q = currentQ();
    if (!q) return;
    const limit = Number(q.minutes) || 10;
    const mins = Math.floor(qElapsed() / 60);
    timeEl.textContent = `${mins} / ${limit} min`;
    const pct = Math.min(100, Math.round((qElapsed() / (limit * 60)) * 100));
    fillEl.style.width = `${pct}%`;
    fillEl.parentElement.setAttribute('aria-valuenow', String(pct));
    fillEl.classList.toggle('over', qElapsed() > limit * 60);
    timeEl.classList.toggle('over', qElapsed() > limit * 60);
  }
  const timer = setInterval(() => { if (!root.isConnected) { clearInterval(timer); return; } tick(); }, 1000);

  convEl.append(subEl, qCard, trPanel);
  renderQuestion(); renderLines(); renderCoach();
  return root;
}
