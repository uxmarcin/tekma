/**
 * views/pipeline.js — lejek (kanban) jednego stanowiska: #/positions/:id   (Figma 10:435 „Stanowisko — Pipeline”)
 *
 *   export default async function render(ctx) -> HTMLElement
 *   export { openRejectModal, openAdvanceModal } from './decision-modals.js'   (zgodność wsteczna)
 *
 * Głowa (okruszki, tytuł, meta, „Udostępnij ogłoszenie”, „Dodaj kandydata”, zakładki) = position-header.js.
 * Kolumny = etapy stanowiska (position.stages), 252 px, tło surface-2. Karta: awatar, imię, „źródło · N dni”,
 * chip AI („AI: pasuje/częściowo/luki” na screeningu, „AI sugeruje 4,1” na rozmowach, „Wynik 4,6” na ofercie — zawsze
 * oznaczony iskrą jako sugestia) i po prawej „CV 86” albo „⚑ 3 pkt” (rozbieżność ocen ≥ 2) albo „Oferta”.
 * Przenoszenie: przeciągnięcie (HTML5 DnD), menu „Więcej” (etapy, „Przesuń dalej…” = okno z zaproszeniem, „Odrzuć…”),
 * skrót Shift+← → → store.candidates.move. Odrzucenie i przesunięcie dalej: decision-modals.js (decyzja człowieka).
 * „Dodaj” pod kolumną → okno „Dodaj kandydata” z ustawionym etapem. Kliknięcie karty → #/candidates/:id?stage=….
 * Mobile (≤ 719 px): kolumny przełączane zakładkami, bez poziomego scrolla strony.
 */

import { openAddCandidateModal, discrepancyGaps, candidateHref } from './candidates.js';
import { openRejectModal, openAdvanceModal, stageSummary } from './decision-modals.js';
import { positionHeader, daysAgoLabel } from './position-header.js';
import { addMove } from './decisions-data.js';

export { openRejectModal, openAdvanceModal };

export default async function render(ctx) {
  const { h, icon, button, tag, avatar, emptyState, aiBadge, fmtScore, plural } = ctx.ui;
  const { store, ai } = ctx;
  await ctx.ui.loadCss(new URL('./pipeline.css', import.meta.url));

  const position = await store.positions.get(ctx.params.id);
  if (!position) {
    ctx.setHeader({ title: 'Stanowisko', crumbs: [{ label: 'Stanowiska', href: '#/positions' }], width: 'wide' });
    return emptyState({ icon: 'briefcase', title: 'Nie znaleziono stanowiska', text: 'Mogło zostać usunięte albo link jest niepełny.', action: { label: 'Wróć do stanowisk', onClick: () => ctx.navigate('#/positions') } });
  }
  const stages = Array.isArray(position.stages) && position.stages.length ? position.stages : [];
  ctx.setHeader({ title: position.title, crumbs: [{ label: 'Stanowiska', href: '#/positions' }], width: 'wide' });

  const state = { candidates: [], cards: [], gaps: new Map(), rubric: null, active: stages[0] || '', dragId: null, focusId: null };

  /* --- szkielet --- */
  const root = h('div', { class: 'pl ph-page' });
  const headSlot = h('div');
  const live = h('div', { class: 'sr-only', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const tabs = h('div', { class: 'pl-tabs', role: 'tablist', 'aria-label': 'Etapy lejka' });
  const cols = h('div', { class: 'pl-cols' });
  const board = h('div', { class: 'pl-board', role: 'region', 'aria-label': 'Tablica etapów', tabindex: '0' }, cols);
  const rejectedBox = h('div');
  const hiredBox = h('div');
  const helpId = 'pl-help';
  const help = h('p', { class: 'sr-only', id: helpId }, 'Enter otwiera kartę oceny. Shift ze strzałką w lewo lub w prawo przenosi kandydata między etapami. Przycisk „Więcej” otwiera menu z etapami, przesunięciem dalej i odrzuceniem.');
  root.append(headSlot, help, tabs, board, rejectedBox, hiredBox, live);

  async function load() {
    const [cands, cards, rubric] = await Promise.all([
      store.candidates.list({ position_id: position.id }),
      store.scorecards.list(),
      position.rubric_id ? store.rubrics.get(position.rubric_id).catch(() => null) : Promise.resolve(null),
    ]);
    state.candidates = cands;
    state.cards = cards.filter((c) => cands.some((x) => x.id === c.candidate_id));
    state.rubric = rubric;
    state.gaps = discrepancyGaps(state.cards);
  }

  const activeOf = (stage) => state.candidates.filter((c) => (c.status || 'active') === 'active' && c.stage === stage);
  const rejected = () => state.candidates.filter((c) => c.status === 'rejected');
  const hired = () => state.candidates.filter((c) => c.status === 'hired');

  /* --- głowa --- */
  function drawHead() {
    const share = button({ label: 'Udostępnij ogłoszenie', variant: 'secondary', onClick: shareAd });
    const add = button({ label: 'Dodaj kandydata', variant: 'primary', onClick: () => openAdd(stages[0]) });
    headSlot.replaceChildren(positionHeader(ctx, position, { active: 'pipeline', actions: [share, add], candidates: state.candidates }));
  }
  async function shareAd() {
    const url = `${location.origin}${location.pathname}#/careers?position=${encodeURIComponent(position.id)}`;
    try { await navigator.clipboard.writeText(url); ctx.ui.toast('Skopiowano link do ogłoszenia.', 'good'); }
    catch { ctx.ui.toast(`Link do ogłoszenia: ${url}`, 'neutral', { duration: 8000 }); }
  }
  function openAdd(stage) {
    openAddCandidateModal(ctx, { positionId: position.id, stage, onCreated: async () => { await load(); draw(); } });
  }

  /* --- zakładki (mobile) --- */
  function drawTabs() {
    tabs.replaceChildren(...stages.map((s) => {
      const n = activeOf(s).length;
      return h('button', { type: 'button', role: 'tab', 'aria-selected': String(s === state.active), 'aria-controls': colId(s), on: { click: () => { state.active = s; drawTabs(); for (const c of cols.children) c.classList.toggle('is-active', c.dataset.stage === s); } } },
        s, h('span', { class: 'n' }, String(n)));
    }));
  }
  tabs.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const list = Array.from(tabs.querySelectorAll('[role="tab"]'));
    const i = list.indexOf(document.activeElement); if (i < 0) return;
    e.preventDefault();
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length;
    list[j].focus(); list[j].click();
  });
  const colId = (s) => `pl-col-${encodeURIComponent(s).replace(/%/g, '')}`;

  /* --- kolumny --- */
  function drawCols() {
    if (!stages.length) {
      cols.replaceChildren(emptyState({ icon: 'briefcase', title: 'To stanowisko nie ma etapów', text: 'Dodaj etapy lejka w ustawieniach stanowiska, a kandydaci pojawią się w kolumnach.' }));
      return;
    }
    cols.replaceChildren(...stages.map((s, idx) => {
      const list = activeOf(s);
      const addBtn = h('button', { type: 'button', class: 'pl-add', on: { click: () => openAdd(s) } }, icon('plus'), 'Dodaj');
      const col = h('section', { class: `pl-col${s === state.active ? ' is-active' : ''}`, id: colId(s), dataset: { stage: s }, 'aria-label': `${s}: ${plural(list.length, 'kandydat', 'kandydaci', 'kandydatów')}` },
        h('div', { class: 'pl-col-h' }, idx === 0 ? icon('spark') : null, h('h2', null, s), h('span', { class: 'n', 'aria-hidden': 'true' }, String(list.length))),
        list.length ? list.map((c) => cardEl(c, idx)) : h('div', { class: 'pl-empty' }, idx === 0 ? 'Brak kandydatów. Dodaj pierwszego.' : 'Pusto. Przeciągnij tu kandydata albo przenieś go z menu karty.'),
        addBtn,
      );
      col.addEventListener('dragover', (e) => { if (!state.dragId) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; col.classList.add('is-over'); });
      col.addEventListener('dragenter', (e) => { if (!state.dragId) return; e.preventDefault(); col.classList.add('is-over'); });
      col.addEventListener('dragleave', (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove('is-over'); });
      col.addEventListener('drop', (e) => {
        e.preventDefault(); col.classList.remove('is-over');
        const id = state.dragId || e.dataTransfer.getData('text/plain');
        state.dragId = null;
        if (id) moveTo(id, s);
      });
      return col;
    }));
  }

  /** Chip AI / wynik na karcie — zależnie od etapu. Zawsze oznaczony iskrą (sugestia), poza „Wynik” (oceny ludzi). */
  function chipFor(c, stageIdx) {
    const cv = ai.cvScore(c, position);
    const last = stageIdx === stages.length - 1;
    const myCards = state.cards.filter((x) => x.candidate_id === c.id && (x.ratings || []).length);
    if (last && myCards.length) {
      const scores = myCards.map((x) => stageSummary(x, state.rubric).score).filter((n) => typeof n === 'number');
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      return { el: h('span', { class: 'ai-note pl-chip', title: 'Średni wynik etapów z ocen rozmówców' }, icon('check', 12), `Wynik ${fmtScore(avg)}`), human: true };
    }
    if (stageIdx > 0 && state.rubric) {
      const sug = ai.suggest({ candidate: c, rubric: state.rubric, stage: c.stage });
      const qs = state.rubric.questions || [];
      let num = 0, den = 0;
      for (const q of qs) { if (sug[q.id]) { const w = Number(q.weight) || 1; num += sug[q.id].score * w; den += w; } }
      if (den) return { el: h('span', { class: 'ai-note pl-chip', title: 'Sugestia AI z transkrypcji — ocenę zatwierdza człowiek' }, icon('spark', 12), h('span', { class: 'sr-only' }, 'Sugestia AI: '), `AI sugeruje ${fmtScore(num / den)}`) };
    }
    const label = cv >= 80 ? 'AI: pasuje' : cv >= 65 ? 'AI: częściowo' : 'AI: luki';
    return { el: h('span', { class: 'ai-note pl-chip', title: `Sugestia AI: ${ai.cvReason(c, position)}` }, icon('spark', 12), h('span', { class: 'sr-only' }, 'Sugestia AI: '), label) };
  }

  function cardEl(c, stageIdx) {
    const cv = ai.cvScore(c, position);
    const gap = state.gaps.get(c.id) || 0;
    const last = stageIdx === stages.length - 1;
    const href = candidateHref(c);
    const more = h('button', { type: 'button', class: 'pl-more', 'aria-label': `Więcej: ${c.full_name}`, 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, icon('more'));
    const link = h('a', { class: 'pl-name', href, title: c.full_name, draggable: 'false', 'aria-describedby': helpId }, c.full_name);
    const right = gap >= 2
      ? h('span', { class: 'pl-right warn', title: `Oceny rozmówców różnią się o ${gap} pkt` }, '⚑ ', h('span', { class: 'sr-only' }, 'Rozbieżność: '), `${gap} pkt`)
      : last ? h('span', { class: 'pl-right' }, 'Oferta')
        : h('span', { class: 'pl-right', title: `Dopasowanie CV (sugestia AI): ${cv}%` }, h('span', { class: 'sr-only' }, 'Dopasowanie CV: '), `CV ${cv}`);
    const card = h('article', { class: 'pl-card', draggable: 'true', dataset: { id: c.id }, 'aria-label': `${c.full_name}, etap ${c.stage}` },
      h('div', { class: 'pl-card-h' },
        avatar(c.full_name),
        h('div', { class: 'pl-who' }, link, h('span', { class: 'pl-meta' }, `${c.source || 'Inne'} · ${daysAgoLabel(c.applied_at)}`)),
        more),
      h('div', { class: 'pl-foot' }, chipFor(c, stageIdx).el, right),
    );
    more.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openMenu(more, card, c, stageIdx); });
    card.addEventListener('dragstart', (e) => {
      state.dragId = c.id;
      try { e.dataTransfer.setData('text/plain', c.id); e.dataTransfer.effectAllowed = 'move'; } catch { /* starsze przeglądarki */ }
      card.classList.add('is-dragging');
    });
    card.addEventListener('dragend', () => { card.classList.remove('is-dragging'); state.dragId = null; for (const col of cols.querySelectorAll('.is-over')) col.classList.remove('is-over'); });
    card.addEventListener('keydown', (e) => {
      if (e.target === more) return;
      if (e.shiftKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        const next = stages[stageIdx + (e.key === 'ArrowRight' ? 1 : -1)];
        if (!next) { live.textContent = e.key === 'ArrowRight' ? 'To ostatni etap.' : 'To pierwszy etap.'; return; }
        moveTo(c.id, next);
      }
    });
    return card;
  }

  /* --- menu karty --- */
  let openPop = null;
  function closeMenu() {
    if (!openPop) return;
    const { pop, trigger, card, cleanup } = openPop;
    cleanup(); pop.remove(); card.classList.remove('has-menu');
    trigger.setAttribute('aria-expanded', 'false');
    openPop = null;
  }
  function openMenu(trigger, card, c, stageIdx) {
    if (openPop && openPop.trigger === trigger) { closeMenu(); trigger.focus(); return; }
    closeMenu();
    const item = (label, iconName, { onClick, disabled, danger, current } = {}) => {
      const el = h('button', { type: 'button', role: 'menuitem', class: danger ? 'danger' : null, 'aria-disabled': disabled ? 'true' : null, tabindex: disabled ? '-1' : '0' },
        icon(iconName), h('span', null, label), current ? icon('check') : null);
      if (current) el.lastChild.classList.add('chk');
      if (onClick && !disabled) el.addEventListener('click', (e) => { e.stopPropagation(); closeMenu(); onClick(); });
      return el;
    };
    const next = stages[stageIdx + 1];
    const refresh = async () => { await load(); draw(); };
    const pop = h('div', { class: 'popover pl-menu', role: 'menu', 'aria-label': `Działania: ${c.full_name}` },
      item('Otwórz kartę oceny', 'rubric', { onClick: () => ctx.navigate(candidateHref(c)) }),
      item(next ? `Przesuń dalej: ${next}…` : 'Zatrudnij…', 'arrow', { onClick: () => openAdvanceModal(ctx, c, { onDone: refresh }) }),
      h('hr'),
      h('div', { class: 'lbl' }, 'Przenieś do etapu'),
      stages.map((s, i) => item(s, i < stageIdx ? 'arrow-left' : i > stageIdx ? 'arrow' : 'check', { current: i === stageIdx, disabled: i === stageIdx, onClick: () => moveTo(c.id, s) })),
      h('hr'),
      item('Odrzuć…', 'x', { danger: true, onClick: () => openRejectModal(ctx, c, { onDone: refresh }) }),
    );
    document.body.appendChild(pop);
    card.classList.add('has-menu');
    trigger.setAttribute('aria-expanded', 'true');
    (function place() {
      const r = trigger.getBoundingClientRect();
      const pw = pop.offsetWidth, ph = pop.offsetHeight;
      let left = Math.min(r.right - pw, window.innerWidth - pw - 8); left = Math.max(8, left);
      let top = r.bottom + 6;
      if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 6);
      pop.style.left = `${left}px`; pop.style.top = `${top}px`;
    })();
    const items = () => Array.from(pop.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])'));
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(); trigger.focus(); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const list = items(); const i = list.indexOf(document.activeElement);
        list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length].focus();
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault(); const list = items(); list[e.key === 'Home' ? 0 : list.length - 1].focus();
      } else if (e.key === 'Tab') { closeMenu(); }
    };
    const onDoc = (e) => { if (!pop.contains(e.target) && e.target !== trigger) closeMenu(); };
    const onScroll = () => closeMenu();
    document.addEventListener('keydown', onKey, true);
    setTimeout(() => { document.addEventListener('mousedown', onDoc, true); board.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('scroll', onScroll, { passive: true, capture: true }); window.addEventListener('resize', onScroll); }, 0);
    openPop = { pop, trigger, card, cleanup: () => { document.removeEventListener('keydown', onKey, true); document.removeEventListener('mousedown', onDoc, true); board.removeEventListener('scroll', onScroll); window.removeEventListener('scroll', onScroll, { capture: true }); window.removeEventListener('resize', onScroll); } };
    const first = items()[0]; if (first) first.focus();
  }

  /* --- przeniesienie (decyzja człowieka) --- */
  let moving = false;
  async function moveTo(id, stage) {
    if (moving) return;
    const c = state.candidates.find((x) => x.id === id);
    if (!c || c.stage === stage) return;
    moving = true;
    try {
      await store.candidates.move(id, stage);
      addMove({ candidate_id: id, position_id: position.id, from: c.stage, stage, by: ctx.user ? ctx.user.name || ctx.user.email : 'Ty' });
      await load();
      state.focusId = id;
      draw();
      live.textContent = `${c.full_name}: przeniesiono na etap ${stage}.`;
      ctx.ui.toast(`${c.full_name} → ${stage}`, 'good');
    } catch (err) {
      ctx.ui.toast(err.message || 'Nie udało się przenieść kandydata.', 'bad');
    } finally { moving = false; }
  }

  /* --- panele pod tablicą: odrzuceni, zatrudnieni --- */
  function asideList(title, list, kind) {
    if (!list.length) return null;
    return h('details', { class: 'pl-aside' },
      h('summary', null, h('span', { class: 'ttl' }, title), h('span', { class: 'n' }, String(list.length)), icon('chevron')),
      h('div', { class: 'pl-aside-list' }, list.map((c) => h('div', { class: 'pl-aside-row' },
        avatar(c.full_name),
        h('div', { class: 't' },
          h('a', { href: candidateHref(c) }, c.full_name),
          h('small', null, kind === 'rejected' ? (c.reject_reason ? `Powód: ${c.reject_reason}` : 'Bez podanego powodu.') : `Etap: ${c.stage}`),
        ),
        tag(c.stage, 'neutral'),
        kind === 'rejected' ? button({ label: 'Przywróć', variant: 'secondary', onClick: () => restore(c) }) : tag('Zatrudniony', 'good'),
      ))),
    );
  }
  async function restore(c) {
    const ok = await ctx.ui.confirm({ title: 'Przywrócić kandydata?', text: `${c.full_name} wróci na etap „${c.stage}” jako aktywny kandydat. Powód odrzucenia zostanie usunięty.`, confirmLabel: 'Przywróć' });
    if (!ok) return;
    try {
      await store.candidates.update(c.id, { status: 'active', reject_reason: null });
      await load(); draw();
      ctx.ui.toast(`${c.full_name}: przywrócono.`, 'good');
    } catch (err) { ctx.ui.toast(err.message || 'Nie udało się przywrócić kandydata.', 'bad'); }
  }

  function draw() {
    closeMenu();
    drawHead(); drawTabs(); drawCols();
    rejectedBox.replaceChildren(asideList('Odrzuceni', rejected(), 'rejected') || '');
    hiredBox.replaceChildren(asideList('Zatrudnieni', hired(), 'hired') || '');
    if (state.focusId) {
      const card = cols.querySelector(`.pl-card[data-id="${CSS.escape(state.focusId)}"]`);
      if (card) {
        card.classList.add('is-moved');
        const link = card.querySelector('.pl-name');
        if (window.matchMedia('(max-width:719px)').matches) {
          const col = card.closest('.pl-col'); state.active = col.dataset.stage; drawTabs();
          for (const x of cols.children) x.classList.toggle('is-active', x === col);
        }
        link.focus({ preventScroll: false });
        card.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
      state.focusId = null;
    }
  }

  await load();
  draw();
  root.appendChild(h('p', { class: 'pl-hint' }, aiBadge('AI sugeruje'), ' Chip na karcie to sugestia AI (dopasowanie CV, ocena z transkrypcji). Etap i odrzucenie to zawsze Twoja decyzja — przeciągnij kartę, użyj menu „Więcej” albo ', h('span', { class: 'kbd' }, 'Shift'), ' + ', h('span', { class: 'kbd' }, '←'), ' / ', h('span', { class: 'kbd' }, '→'), '.'));
  return root;
}
