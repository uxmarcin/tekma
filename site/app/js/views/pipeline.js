/**
 * views/pipeline.js — kanban jednego stanowiska: #/positions/:id
 *
 *   export default async function render(ctx) -> HTMLElement
 *   export function openRejectModal(ctx, candidate, { onDone }) -> {close}
 *
 * Kolumny = etapy stanowiska (position.stages). Karta kandydata: imię, źródło, czas zgłoszenia,
 * dopasowanie CV (ai.cvScore — zawsze oznaczone jako sugestia AI), flaga „Rozbieżność” (oceny ≥ 2 pkt różnicy).
 * Przenoszenie: przeciągnięcie (HTML5 DnD) ORAZ menu „Więcej” / skrót Shift+← → (dostępność) → store.candidates.move.
 * Odrzucenie: okno z powodem → store.candidates.reject. Każda zmiana etapu i każde odrzucenie to decyzja
 * człowieka — AI tylko podpowiada dopasowanie, nigdy nie przesuwa ani nie odrzuca.
 * Kliknięcie karty → #/candidates/:id?stage=… (karta oceny, inny widok).
 * Przewijanie poziome tylko wewnątrz tablicy; na mobile (≤ 719 px) kolumny przełączane zakładkami.
 * Tytuł, okruszek „Stanowiska” i akcja „Dodaj kandydata” żyją w pasku górnym routera (ctx.setHeader) — także na mobile.
 */

import { openAddCandidateModal, discrepancyIds, candidateHref } from './candidates.js';

export default async function render(ctx) {
  const { h, icon, button, tag, avatar, emptyState, formatDate, plural } = ctx.ui;
  const { store, ai } = ctx;
  await ctx.ui.loadCss(new URL('./pipeline.css', import.meta.url));

  const position = await store.positions.get(ctx.params.id);
  if (!position) {
    ctx.setHeader({ title: 'Stanowisko', crumbs: [{ label: 'Stanowiska', href: '#/positions' }], width: 'wide' });
    return emptyState({ icon: 'briefcase', title: 'Nie znaleziono stanowiska', text: 'Mogło zostać usunięte albo link jest niepełny.', action: { label: 'Wróć do stanowisk', onClick: () => ctx.navigate('#/positions') } });
  }
  const stages = Array.isArray(position.stages) && position.stages.length ? position.stages : [];

  const state = { candidates: [], flagged: new Set(), rubric: null, active: stages[0] || '', dragId: null, focusId: null };

  const addBtn = button({ label: 'Dodaj kandydata', variant: 'primary', icon: 'plus', onClick: () => openAddCandidateModal(ctx, { positionId: position.id, onCreated: async () => { await load(); draw(); } }) });
  ctx.setHeader({ title: position.title, crumbs: [{ label: 'Stanowiska', href: '#/positions' }], actions: [addBtn], width: 'wide' });

  /* --- szkielet --- */
  const root = h('div', { class: 'pl' });
  const live = h('div', { class: 'sr-only', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const sub = h('div', { class: 'pl-sub' });
  const tabs = h('div', { class: 'pl-tabs', role: 'tablist', 'aria-label': 'Etapy kanbanu' });
  const cols = h('div', { class: 'pl-cols' });
  const board = h('div', { class: 'pl-board', role: 'region', 'aria-label': 'Tablica etapów', tabindex: '0' }, cols);
  const rejectedBox = h('div');
  const hiredBox = h('div');
  const helpId = 'pl-help';
  const help = h('p', { class: 'sr-only', id: helpId }, 'Enter otwiera kartę oceny. Shift ze strzałką w lewo lub w prawo przenosi kandydata między etapami. Przycisk „Więcej” otwiera menu z etapami i odrzuceniem.');
  root.append(sub, help, tabs, board, rejectedBox, hiredBox, live);

  async function load() {
    const [cands, cards, rubric] = await Promise.all([
      store.candidates.list({ position_id: position.id }),
      store.scorecards.list(),
      position.rubric_id ? store.rubrics.get(position.rubric_id).catch(() => null) : Promise.resolve(null),
    ]);
    state.candidates = cands;
    state.rubric = rubric;
    const mine = new Set(cands.map((c) => c.id));
    state.flagged = new Set([...discrepancyIds(cards)].filter((id) => mine.has(id)));
  }

  const activeOf = (stage) => state.candidates.filter((c) => (c.status || 'active') === 'active' && c.stage === stage);
  const rejected = () => state.candidates.filter((c) => c.status === 'rejected');
  const hired = () => state.candidates.filter((c) => c.status === 'hired');

  /* --- podtytuł --- */
  function drawSub() {
    const active = state.candidates.filter((c) => (c.status || 'active') === 'active').length;
    const parts = [];
    if (position.department) parts.push(h('span', null, position.department));
    if (position.location) parts.push(h('span', null, position.location));
    parts.push(state.rubric
      ? h('span', null, 'Rubryka: ', h('a', { href: `#/rubrics/${encodeURIComponent(state.rubric.id)}` }, state.rubric.name))
      : h('span', null, h('a', { href: '#/rubrics' }, 'Brak rubryki'), ' — rozmowy nie będą porównywalne'));
    const children = [];
    parts.forEach((p, i) => { if (i) children.push(h('span', { class: 'dot', 'aria-hidden': 'true' }, '·')); children.push(p); });
    if (position.status === 'closed') children.push(tag('Zamknięte', 'neutral'));
    children.push(h('span', { class: 'pl-counts', style: 'margin-left:auto' },
      h('span', { class: 'tag neutral' }, `Aktywni: ${active}`),
      rejected().length ? h('button', { type: 'button', on: { click: () => { const d = rejectedBox.querySelector('details'); if (d) { d.open = true; d.scrollIntoView({ behavior: scrollBehavior(), block: 'start' }); d.querySelector('summary').focus(); } } } }, 'Odrzuceni: ', h('b', null, rejected().length)) : null,
      hired().length ? h('button', { type: 'button', on: { click: () => { const d = hiredBox.querySelector('details'); if (d) { d.open = true; d.scrollIntoView({ behavior: scrollBehavior(), block: 'start' }); d.querySelector('summary').focus(); } } } }, 'Zatrudnieni: ', h('b', null, hired().length)) : null,
    ));
    sub.replaceChildren(...children);
  }

  /* --- zakładki (mobile) --- */
  function drawTabs() {
    tabs.replaceChildren(...stages.map((s) => {
      const n = activeOf(s).length;
      const b = h('button', { type: 'button', role: 'tab', 'aria-selected': String(s === state.active), 'aria-controls': colId(s), on: { click: () => { state.active = s; drawTabs(); for (const c of cols.children) c.classList.toggle('is-active', c.dataset.stage === s); } } },
        s, h('span', { class: 'n' }, String(n)));
      return b;
    }));
  }
  tabs.addEventListener('keydown', onTabsKey);
  function onTabsKey(e) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const list = Array.from(tabs.querySelectorAll('[role="tab"]'));
    const i = list.indexOf(document.activeElement); if (i < 0) return;
    e.preventDefault();
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length;
    list[j].focus(); list[j].click();
  }
  const colId = (s) => `pl-col-${encodeURIComponent(s).replace(/%/g, '')}`;

  /* --- kolumny --- */
  function drawCols() {
    if (!stages.length) {
      cols.replaceChildren(emptyState({ icon: 'briefcase', title: 'To stanowisko nie ma etapów', text: 'Dodaj etapy kanbanu w ustawieniach stanowiska, a kandydaci pojawią się w kolumnach.' }));
      return;
    }
    cols.replaceChildren(...stages.map((s, idx) => {
      const list = activeOf(s);
      const bodyEl = h('div', { class: 'pl-col-b' },
        list.length ? list.map((c) => cardEl(c, idx)) : h('div', { class: 'pl-empty' }, idx === 0 ? 'Brak kandydatów. Dodaj pierwszego przyciskiem u góry.' : 'Pusto. Przeciągnij tu kandydata albo przenieś go z menu karty.'),
      );
      const col = h('section', { class: `pl-col${s === state.active ? ' is-active' : ''}`, id: colId(s), dataset: { stage: s }, 'aria-label': `${s}: ${plural(list.length, 'kandydat', 'kandydaci', 'kandydatów')}` },
        h('div', { class: 'pl-col-h' }, h('h2', null, s), h('span', { class: 'n', 'aria-hidden': 'true' }, String(list.length))),
        bodyEl,
      );
      // strefa upuszczania
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

  function cardEl(c, stageIdx) {
    const score = ai.cvScore(c, position);
    const flagged = state.flagged.has(c.id);
    const href = candidateHref(c);
    const more = h('button', { type: 'button', class: 'pl-more', 'aria-label': `Więcej: ${c.full_name}`, 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, icon('more'));
    const link = h('a', { class: 'pl-name', href, title: c.full_name, draggable: 'false', 'aria-describedby': helpId }, c.full_name);
    const card = h('article', { class: 'pl-card', draggable: 'true', dataset: { id: c.id }, 'aria-label': `${c.full_name}, etap ${c.stage}` },
      h('div', { class: 'pl-card-h' }, avatar(c.full_name), link, more),
      h('div', { class: 'pl-meta' }, h('span', null, c.source || 'Inne'), h('span', { class: 'dot', 'aria-hidden': 'true' }, '·'), h('time', { datetime: c.applied_at || '' }, formatDate(c.applied_at, { relative: true }))),
      h('div', { class: 'pl-foot' },
        h('span', { class: 'pl-cv', title: `Sugestia AI: ${ai.cvReason(c, position)}` }, icon('spark'), h('span', { class: 'sr-only' }, 'Sugestia AI: '), 'CV ', h('b', null, `${score}%`), h('span', { class: 'bar', 'aria-hidden': 'true' }, h('i', { style: `width:${score}%` }))),
        flagged ? h('span', { class: 'tag warn', title: 'Oceny rozmówców różnią się o 2 pkt lub więcej' }, icon('alert'), 'Rozbieżność') : null,
      ),
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
    const pop = h('div', { class: 'popover pl-menu', role: 'menu', 'aria-label': `Działania: ${c.full_name}` },
      item('Otwórz kartę oceny', 'rubric', { onClick: () => ctx.navigate(candidateHref(c)) }),
      h('hr'),
      h('div', { class: 'lbl' }, 'Przenieś do etapu'),
      stages.map((s, i) => item(s, i < stageIdx ? 'arrow-left' : i > stageIdx ? 'arrow' : 'check', { current: i === stageIdx, disabled: i === stageIdx, onClick: () => moveTo(c.id, s) })),
      h('hr'),
      item('Odrzuć…', 'x', { danger: true, onClick: () => openRejectModal(ctx, c, { onDone: async () => { await load(); draw(); } }) }),
    );
    document.body.appendChild(pop);
    card.classList.add('has-menu');
    trigger.setAttribute('aria-expanded', 'true');
    place();
    function place() {
      const r = trigger.getBoundingClientRect();
      const pw = pop.offsetWidth, ph = pop.offsetHeight;
      let left = Math.min(r.right - pw, window.innerWidth - pw - 8); left = Math.max(8, left);
      let top = r.bottom + 6;
      if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 6);
      pop.style.left = `${left}px`; pop.style.top = `${top}px`;
    }
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
      await load();
      state.focusId = id;
      draw();
      live.textContent = `${c.full_name}: przeniesiono na etap ${stage}.`;
      ctx.ui.toast(`${c.full_name} → ${stage}`, 'good');
    } catch (err) {
      ctx.ui.toast(err.message || 'Nie udało się przenieść kandydata.', 'bad');
    } finally { moving = false; }
  }

  /* --- sekcje pod tablicą --- */
  function asideList(title, list, kind) {
    if (!list.length) return null;
    return h('details', { class: 'pl-aside' },
      h('summary', null, icon('chevron'), `${title} `, h('span', { class: 'n' }, `(${list.length})`)),
      h('div', { class: 'list' }, list.map((c) => h('div', { class: 'row' },
        avatar(c.full_name),
        h('div', { class: 't' },
          h('b', null, h('a', { href: candidateHref(c), class: 'link', style: 'text-decoration:none' }, c.full_name)),
          h('small', null, kind === 'rejected' ? (c.reject_reason ? `Powód: ${c.reject_reason}` : 'Bez podanego powodu.') : `Etap: ${c.stage}`),
        ),
        h('span', { class: 'meta' }, c.stage),
        kind === 'rejected' ? button({ label: 'Przywróć', variant: 'secondary', size: 'sm', onClick: () => restore(c) }) : null,
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
    drawSub(); drawTabs(); drawCols();
    rejectedBox.replaceChildren(asideList('Odrzuceni', rejected(), 'rejected') || '');
    hiredBox.replaceChildren(asideList('Zatrudnieni', hired(), 'hired') || '');
    if (state.focusId) {
      const card = cols.querySelector(`.pl-card[data-id="${CSS.escape(state.focusId)}"]`);
      if (card) {
        card.classList.add('is-moved');
        const link = card.querySelector('.pl-name');
        // na mobile pokaż kolumnę, do której trafił kandydat
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
  root.appendChild(h('p', { class: 'pl-hint' }, icon('info'), 'Przeciągnij kartę między kolumnami albo użyj menu „Więcej”. Z klawiatury: ', h('span', { class: 'kbd' }, 'Shift'), ' + ', h('span', { class: 'kbd' }, '←'), ' / ', h('span', { class: 'kbd' }, '→'), '. AI tylko podpowiada dopasowanie CV. Etap i odrzucenie to zawsze Twoja decyzja.'));
  return root;
}

const scrollBehavior = () => (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

/* ================================================================== okno odrzucenia */
export function openRejectModal(ctx, candidate, { onDone } = {}) {
  const { h, field, button, modal, toast, formError, avatar, icon } = ctx.ui;
  const errorSlot = h('div');
  const reason = field({ label: 'Powód odrzucenia', name: 'reason', type: 'textarea', rows: 4, required: true, placeholder: 'np. Brak doświadczenia z systemami rozproszonymi, które są kluczowe na tym stanowisku.', hint: 'Kandydat ma prawo poznać powód. Napisz konkretnie, bez ocen osoby.' });
  const submit = button({ label: 'Odrzuć kandydata', variant: 'danger', type: 'submit' });
  const cancel = button({ label: 'Anuluj', variant: 'secondary' });
  const form = h('form', { novalidate: true, on: { submit: async (e) => {
    e.preventDefault();
    errorSlot.replaceChildren(); reason.setError('');
    if (reason.value.trim().length < 3) { reason.setError('Podaj powód odrzucenia (co najmniej 3 znaki).'); reason.input.focus(); return; }
    submit.setBusy(true);
    try {
      await ctx.store.candidates.reject(candidate.id, reason.value);
      toast(`${candidate.full_name}: odrzucono.`, 'neutral');
      m.close();
      if (onDone) await onDone();
    } catch (err) {
      errorSlot.replaceChildren(formError(err.message || 'Nie udało się odrzucić kandydata.'));
      submit.setBusy(false);
    }
  } } },
    errorSlot,
    h('div', { class: 'pl-reject-who' }, avatar(candidate.full_name), h('div', { class: 't' }, h('b', null, candidate.full_name), h('small', null, `Etap: ${candidate.stage}`))),
    reason,
    h('div', { class: 'pl-human' }, icon('user'), h('span', null, 'To Twoja decyzja. AI nie odrzuca kandydatów i nie podpowiada odrzucenia — jedynie oszacowało dopasowanie CV. Kandydata można później przywrócić.')),
  );
  submit.addEventListener('click', () => form.requestSubmit());
  const m = modal({ title: 'Odrzuć kandydata', body: form, actions: [cancel, submit] });
  cancel.addEventListener('click', () => m.close());
  return m;
}
