/**
 * views/compare.js — porównanie kandydatów (#/compare?ids=a,b,c&position=&stage=). Układ 1:1 z Figmą 27:3249.
 *
 * Co robi:
 *   - nagłówek „Porównanie · <stanowisko>” + „N kandydatów po etapie … · ta sama rubryka, te same pytania”,
 *     akcje: „Dodaj kandydata” (okno z listą kandydatów tego stanowiska), „Zapisz decyzję” (okno: Tak / Może / Nie per kandydat
 *     → store.scorecards.save; decyzja człowieka),
 *   - tabela: kandydat (link do karty), wiersz na pytanie rubryki (średnia rozmówców jako kropki + liczba; rozbieżność ≥ 2 pkt
 *     jako „⚑ 2 vs 5”), dopasowanie CV (sugestia AI), wynik ważony, podsumowanie AI (iskra), rekomendacja (podpowiedź),
 *   - nota pod tabelą: pierwsza rozbieżność do omówienia (z czasem nagrania) albo brak rozbieżności,
 *   - usuwanie kandydata z porównania (×) i stan pusty z wyborem kandydatów.
 *
 * Zasada AI Act: dopasowanie CV, podsumowanie i rekomendacja to podpowiedzi; decyzję zapisuje człowiek.
 * export default async function render(ctx) -> HTMLElement
 */

import { interviewDemo } from './interview-data.js';

const RECO = {
  yes: { label: 'Zatrudnić', tone: 'good' },
  maybe: { label: 'Do dyskusji', tone: 'warn' },
  no: { label: 'Nie', tone: 'bad' },
};
const DECISION_LABEL = { yes: 'Tak', maybe: 'Może', no: 'Nie' };

function spark(ui, size = 16) {
  const svg = ui.icon('info', size);
  svg.innerHTML = '<path d="M12 3l1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8z" fill="currentColor" stroke="none"/>';
  svg.classList.remove('ico-info'); svg.classList.add('ico-spark4');
  return svg;
}

export default async function render(ctx) {
  const { ui, store } = ctx;
  const { h } = ui;
  await ui.loadCss(new URL('./compare.css', import.meta.url));

  const q = ctx.query || {};
  const ids = String(q.ids || '').split(',').map((s) => s.trim()).filter(Boolean);
  const [allCandidates, positions, allCards] = await Promise.all([store.candidates.list(), store.positions.list(), store.scorecards.list().catch(() => [])]);
  const byId = Object.fromEntries(allCandidates.map((c) => [c.id, c]));
  const selected = ids.map((id) => byId[id]).filter(Boolean);
  const positionId = q.position || (selected[0] && selected[0].position_id) || null;
  const position = positionId ? positions.find((p) => p.id === positionId) || null : null;
  const rubric = position && position.rubric_id ? await store.rubrics.get(position.rubric_id) : null;
  const questions = (rubric && Array.isArray(rubric.questions)) ? rubric.questions : [];

  // etap porównania: z URL, inaczej etap, na którym najwięcej wybranych ma oceny, inaczej etap pierwszego kandydata
  const stageCounts = {};
  for (const c of selected) for (const card of allCards.filter((x) => x.candidate_id === c.id && (x.ratings || []).length)) stageCounts[card.stage] = (stageCounts[card.stage] || 0) + 1;
  const stage = q.stage || Object.keys(stageCounts).sort((a, b) => stageCounts[b] - stageCounts[a])[0] || (selected[0] && selected[0].stage) || (position && position.stages && position.stages[0]) || '';

  const navigateWith = (newIds, extra = {}) => {
    const params = new URLSearchParams();
    if (newIds.length) params.set('ids', newIds.join(','));
    const pos = extra.position || positionId; if (pos) params.set('position', pos);
    const st = extra.stage || q.stage; if (st) params.set('stage', st);
    ctx.navigate(`#/compare${params.toString() ? `?${params}` : ''}`);
  };

  const addBtn = ui.button({ label: 'Dodaj kandydata', variant: 'secondary', size: 'sm', onClick: () => openAddModal() });
  const saveBtn = ui.button({ label: 'Zapisz decyzję', variant: 'primary', size: 'sm', disabled: !selected.length, onClick: () => openDecisionModal() });
  ctx.setHeader({ title: 'Porównanie kandydatów', crumbs: [{ label: 'Kandydaci', href: '#/candidates' }], width: 'wide' });

  const root = h('div', { class: 'cp' });
  root.append(
    h('div', { class: 'cp-head' },
      h('div', { class: 'cp-title' },
        h('h1', null, `Porównanie${position ? ` · ${position.title}` : ''}`),
        h('p', null, selected.length
          ? `${ui.plural(selected.length, 'kandydat', 'kandydatów', 'kandydatów')}${stage ? ` po etapie „${stage}”` : ''} · ${rubric ? 'ta sama rubryka, te same pytania' : 'stanowisko bez rubryki — brak wspólnych pytań'}`
          : 'Wybierz co najmniej dwóch kandydatów z jednego stanowiska, żeby zestawić oceny z tej samej rubryki.'),
      ),
      h('div', { class: 'cp-actions' }, addBtn, saveBtn),
    ),
  );

  if (!selected.length) {
    root.append(ui.emptyState({ icon: 'users', title: 'Nikogo jeszcze nie porównujesz', text: 'Dodaj kandydatów z jednego stanowiska. Zobaczysz ich oceny pytanie po pytaniu, dopasowanie CV i rekomendację — na jednym ekranie.', action: { label: 'Dodaj kandydata', onClick: () => openAddModal() } }));
    return root;
  }

  /* ------------------------------------------------ liczenie */
  const cardFor = (c) => allCards.find((x) => x.candidate_id === c.id && x.stage === stage) || { ratings: [], decision: null };
  const qScores = (c, qid) => (cardFor(c).ratings || []).filter((r) => r.question_id === qid).map((r) => Number(r.score));
  const qAvg = (c, qid) => { const s = qScores(c, qid); return s.length ? s.reduce((a, b) => a + b, 0) / s.length : null; };
  const qGap = (c, qid) => { const s = qScores(c, qid); if (s.length < 2) return null; const gap = Math.max(...s) - Math.min(...s); return gap >= 2 ? { min: Math.min(...s), max: Math.max(...s), gap } : null; };
  const total = (c) => {
    let sw = 0, sum = 0;
    for (const qq of questions) { const a = qAvg(c, qq.id); if (a === null) continue; sw += Number(qq.weight) || 1; sum += (Number(qq.weight) || 1) * a; }
    return sw ? sum / sw : null;
  };
  const flagsOf = (c) => questions.filter((qq) => qGap(c, qq.id)).length;
  const recoOf = (c) => { const t = total(c); if (t === null) return null; if (flagsOf(c)) return RECO.maybe; return t >= 3.8 ? RECO.yes : t >= 3 ? RECO.maybe : RECO.no; };
  const demos = Object.fromEntries(selected.map((c) => [c.id, interviewDemo({ candidate: c, position: positions.find((p) => p.id === c.position_id) || position, rubric, stage })]));

  /* ------------------------------------------------ tabela */
  const dots = (avg) => h('span', { class: 'cp-dots', 'aria-hidden': 'true' }, [1, 2, 3, 4, 5].map((n) => h('i', { class: avg !== null && n <= Math.round(avg) ? 'on' : '' })));
  const cell = (...kids) => h('div', { class: 'cp-cell', role: 'cell' }, kids);
  const label = (...kids) => h('div', { class: 'cp-label', role: 'rowheader' }, kids);
  const row = (cls, ...kids) => h('div', { class: `cp-row${cls ? ' ' + cls : ''}`, role: 'row' }, kids);

  const table = h('div', { class: 'cp-table', role: 'table', 'aria-label': 'Porównanie kandydatów', style: `--cols:${selected.length}` });
  table.append(row('head',
    label(h('small', null, 'Kandydat')),
    selected.map((c) => {
      const rm = h('button', { type: 'button', class: 'cp-rm', 'aria-label': `Usuń ${c.full_name} z porównania`, title: 'Usuń z porównania' }, ui.icon('x', 14));
      rm.addEventListener('click', () => navigateWith(selected.filter((x) => x.id !== c.id).map((x) => x.id)));
      return cell(h('a', { class: 'cp-cand', href: `#/candidates/${c.id}?stage=${encodeURIComponent(stage)}`, title: 'Otwórz kartę oceny' }, h('span', { class: 'cp-av', 'aria-hidden': 'true' }, ui.initials(c.full_name)), h('b', null, c.full_name)), rm);
    }),
  ));
  for (const qq of questions) {
    table.append(row('',
      label(h('span', null, `${qq.competency || qq.text} ×${qq.weight || 1}`)),
      selected.map((c) => {
        const gap = qGap(c, qq.id);
        const avg = qAvg(c, qq.id);
        if (gap) return cell(h('span', { class: 'cp-badge warn', title: `Rozmówcy ocenili ${gap.min} i ${gap.max} — rozbieżność ${gap.gap} pkt` }, `⚑ ${gap.min} vs ${gap.max}`));
        if (avg === null) return cell(h('span', { class: 'cp-none' }, 'brak ocen'));
        const shown = Number.isInteger(avg) ? String(avg) : ui.fmtScore(avg);
        return cell(dots(avg), h('span', { class: 'cp-num', 'aria-label': `${shown} na 5` }, shown));
      }),
    ));
  }
  if (!questions.length) table.append(row('', label(h('span', null, 'Pytania z rubryki')), selected.map(() => cell(h('span', { class: 'cp-none' }, 'brak rubryki')))));
  table.append(row('',
    label(h('span', null, 'Dopasowanie CV')),
    selected.map((c) => cell(h('b', { class: 'cp-cv', title: 'Sugestia AI — dopasowanie CV do ogłoszenia' }, `CV ${ctx.ai.cvScore(c, positions.find((p) => p.id === c.position_id) || position)}`))),
  ));
  table.append(row('',
    label(h('span', null, 'Wynik ważony')),
    selected.map((c) => { const t = total(c); return cell(h('b', { class: 'cp-total' }, t === null ? '– / 5' : `${ui.fmtScore(t)} / 5`)); }),
  ));
  table.append(row('',
    label(h('span', { class: 'cp-ai' }, spark(ui, 16), 'Podsumowanie AI')),
    selected.map((c) => cell(h('p', { class: 'cp-sum' }, demos[c.id].compareSummary))),
  ));
  table.append(row('',
    label(h('span', null, 'Rekomendacja')),
    selected.map((c) => {
      const r = recoOf(c); const d = cardFor(c).decision;
      return cell(
        h('span', { class: `cp-badge ${r ? r.tone : 'neutral'}`, title: 'Podpowiedź z sumy ważonej i rozbieżności — nie decyzja' }, r ? r.label : 'Brak ocen'),
        d ? h('span', { class: 'cp-decision', title: 'Decyzja zapisana przez człowieka' }, `Decyzja: ${DECISION_LABEL[d]}`) : null,
      );
    }),
  ));
  root.append(h('div', { class: 'cp-scroll' }, table));

  /* ------------------------------------------------ nota */
  let note = null;
  for (const c of selected) {
    for (const qq of questions) {
      const gap = qGap(c, qq.id);
      if (gap) { note = { c, qq, gap }; break; }
    }
    if (note) break;
  }
  const line = (demos[note ? note.c.id : selected[0].id].live.lines.find((l) => l.who !== 'Tomasz') || {}).t || '18:40';
  root.append(h('div', { class: `cp-note${note ? ' warn' : ''}` }, ui.icon(note ? 'flag' : 'check', 16),
    h('p', null, note
      ? `Przy ${firstNameLoc(note.c.full_name)} rozmówcy ocenili ${(note.qq.competency || 'to pytanie').toLowerCase()} na ${note.gap.min} i ${note.gap.max}. Zanim zdecydujecie, porozmawiajcie o tym pytaniu — nagranie: ${line}.`
      : 'Brak rozbieżności między rozmówcami. Oceny są porównywalne: ta sama rubryka i te same pytania. Decyzję podejmujecie Wy — AI tylko podpowiada.')));

  /* ------------------------------------------------ okna */
  function openAddModal() {
    const { field, button, modal, toast } = ui;
    const posSel = field({ label: 'Stanowisko', name: 'position', type: 'select', value: positionId || (positions[0] && positions[0].id) || '', options: positions.map((p) => ({ value: p.id, label: p.title })) });
    const listEl = h('div', { class: 'cp-pick' });
    const chosen = new Set();
    const renderList = () => {
      const pid = posSel.value;
      const pool = allCandidates.filter((c) => c.position_id === pid && !selected.some((s) => s.id === c.id) && c.status !== 'rejected');
      chosen.clear();
      listEl.replaceChildren(pool.length ? pool.map((c) => {
        const cb = h('input', { type: 'checkbox', value: c.id });
        cb.addEventListener('change', () => { if (cb.checked) chosen.add(c.id); else chosen.delete(c.id); });
        return h('label', { class: 'cp-pick-item' }, cb, h('span', { class: 'cp-av sm', 'aria-hidden': 'true' }, ui.initials(c.full_name)), h('span', { class: 't' }, h('b', null, c.full_name), h('small', null, `${c.stage}${typeof c.cv_score === 'number' ? ` · CV ${c.cv_score}` : ''}`)));
      }) : h('p', { class: 'cp-none' }, 'Brak kolejnych aktywnych kandydatów na tym stanowisku.'));
    };
    posSel.input.addEventListener('change', renderList);
    if (positionId) posSel.input.disabled = true;
    renderList();
    const ok = button({ label: 'Dodaj do porównania', variant: 'primary', onClick: () => {
      if (!chosen.size) { toast('Zaznacz co najmniej jednego kandydata.', 'warn'); return; }
      const pid = posSel.value;
      m.close();
      navigateWith(selected.map((c) => c.id).concat(Array.from(chosen)), { position: pid });
    } });
    const cancel = button({ label: 'Anuluj', variant: 'secondary' });
    const m = modal({ title: 'Dodaj kandydata do porównania', body: h('div', null, posSel, h('p', { class: 'cp-hint' }, 'Porównujemy tylko w obrębie jednego stanowiska — ta sama rubryka i te same pytania.'), listEl), actions: [cancel, ok] });
    cancel.addEventListener('click', () => m.close());
  }

  function openDecisionModal() {
    const { button, modal, toast } = ui;
    const picks = {};
    const rows = selected.map((c) => {
      const cur = cardFor(c).decision || null;
      picks[c.id] = cur;
      const group = h('div', { class: 'cp-dec-opts', role: 'group', 'aria-label': `Decyzja: ${c.full_name}` }, ['yes', 'maybe', 'no'].map((d) => {
        const b = h('button', { type: 'button', class: 'cp-dec-opt', 'aria-pressed': cur === d ? 'true' : 'false' }, DECISION_LABEL[d]);
        b.addEventListener('click', () => { picks[c.id] = d; for (const x of group.children) x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        return b;
      }));
      const r = recoOf(c);
      return h('div', { class: 'cp-dec-row' },
        h('div', { class: 'cp-dec-who' }, h('span', { class: 'cp-av sm', 'aria-hidden': 'true' }, ui.initials(c.full_name)), h('span', { class: 't' }, h('b', null, c.full_name), h('small', null, r ? `Podpowiedź: ${r.label}` : 'Brak ocen'))),
        group);
    });
    const save = button({ label: 'Zapisz decyzje', variant: 'primary', onClick: async () => {
      const todo = selected.filter((c) => picks[c.id] && picks[c.id] !== (cardFor(c).decision || null));
      if (!todo.length) { toast('Nic się nie zmieniło.', 'neutral'); m.close(); return; }
      save.setBusy(true);
      try {
        for (const c of todo) {
          const card = await store.scorecards.get(c.id, stage);
          card.decision = picks[c.id];
          await store.scorecards.save(card);
        }
        toast(`Zapisano ${ui.plural(todo.length, 'decyzję', 'decyzje', 'decyzji')}. Kandydatów przesuniesz lub odrzucisz w lejku stanowiska.`, 'good');
        m.close();
        navigateWith(selected.map((c) => c.id));
      } catch (err) {
        toast((err && err.message) || 'Nie udało się zapisać decyzji.', 'bad');
        save.setBusy(false);
      }
    } });
    const cancel = button({ label: 'Anuluj', variant: 'secondary' });
    const m = modal({ title: `Decyzja po etapie „${stage}”`, body: h('div', null, h('p', { class: 'cp-hint' }, 'Decyzję podejmuje człowiek — rekomendacja AI to tylko podpowiedź. Zapisujemy ją z Twoim imieniem w karcie oceny każdego kandydata.'), rows), actions: [cancel, save] });
    cancel.addEventListener('click', () => m.close());
  }

  return root;
}

function firstNameLoc(full = '') {
  // Miejscownik imienia (demo): Jakub → Jakubie, Marta → Marcie, inaczej „przy <imię>”.
  const n = String(full).trim().split(/\s+/)[0] || '';
  const map = { Jakub: 'Jakubie', Marta: 'Marcie', Claire: 'Claire', Daniel: 'Danielu', Igor: 'Igorze', Tomasz: 'Tomaszu', Sofia: 'Sofii', Aleksandra: 'Aleksandrze', Lena: 'Lenie', Piotr: 'Piotrze', Anna: 'Annie', Leo: 'Leo', Ewa: 'Ewie' };
  return map[n] || n;
}
