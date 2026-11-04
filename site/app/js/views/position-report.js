/**
 * views/position-report.js — raport stanowiska: #/positions/:id/report   (Figma 24:2629 „Stanowisko — Raport”)
 *
 *   export default async function render(ctx) -> HTMLElement
 *
 * Wszystko liczone z danych store (kandydaci, karty ocen, rubryka) + pamięci decyzji (decisions-data: ruchy, rozmowy):
 *   KPI: Kandydaci (+N w tym tygodniu), Czas do oferty (mediana dni od zgłoszenia do oferty), Konwersja do oferty (n z N),
 *        Zgodność ocen (udział pytań, w których rozmówcy różnią się ≤ 1 pkt).
 *   Lejek: ile osób dotarło do etapu (etap bieżący lub dalszy; odrzuceni liczeni do etapu odrzucenia), spadek między etapami,
 *        największy spadek wyróżniony (warn). Powody odrzuceń: z reject_reason. Źródła: liczba i najdalszy etap.
 *   „Czekają za długo”: aktywni bez zaplanowanej rozmowy, > 5 dni od ostatniego ruchu → „Zaplanuj” = okno „Przesuń dalej”.
 * „Eksportuj PDF” = druk strony (window.print). Głowa i zakładki: position-header.js.
 */

import { positionHeader, plural } from './position-header.js';
import { openAdvanceModal } from './decision-modals.js';
import { interviewsFor, lastMoveAt } from './decisions-data.js';

export default async function render(ctx) {
  const { h, button, tag, avatar, emptyState } = ctx.ui;
  const { store } = ctx;
  await Promise.all([ctx.ui.loadCss(new URL('./position-header.css', import.meta.url)), ctx.ui.loadCss(new URL('./position-report.css', import.meta.url))]);

  const position = await store.positions.get(ctx.params.id);
  if (!position) {
    ctx.setHeader({ title: 'Raport', crumbs: [{ label: 'Stanowiska', href: '#/positions' }], width: 'wide' });
    return emptyState({ icon: 'briefcase', title: 'Nie znaleziono stanowiska', text: 'Mogło zostać usunięte albo link jest niepełny.', action: { label: 'Wróć do stanowisk', onClick: () => ctx.navigate('#/positions') } });
  }
  ctx.setHeader({ title: `${position.title} — raport`, crumbs: [{ label: 'Stanowiska', href: '#/positions' }], width: 'wide' });
  const stages = position.stages || [];
  const root = h('div', { class: 'pr ph-page' });

  async function load() {
    const [cands, cards] = await Promise.all([store.candidates.list({ position_id: position.id }), store.scorecards.list()]);
    return { cands, cards: cards.filter((c) => cands.some((x) => x.id === c.candidate_id)) };
  }

  function draw({ cands, cards }) {
    const idx = (s) => stages.indexOf(s);
    const total = cands.length;
    const lastStage = stages[stages.length - 1];
    const reached = (i) => cands.filter((c) => (c.status === 'hired') || idx(c.stage) >= i).length;
    const offers = cands.filter((c) => c.status === 'hired' || c.stage === lastStage).length;
    const weekAgo = Date.now() - 7 * 864e5;
    const newThisWeek = cands.filter((c) => new Date(c.applied_at).getTime() >= weekAgo).length;

    // mediana dni do oferty
    const offerDays = cands.filter((c) => c.status === 'hired' || c.stage === lastStage)
      .map((c) => Math.max(1, Math.round(((lastMoveAt(c.id) ? new Date(lastMoveAt(c.id)) : Date.now()) - new Date(c.applied_at)) / 864e5))).sort((a, b) => a - b);
    const median = offerDays.length ? (offerDays.length % 2 ? offerDays[(offerDays.length - 1) / 2] : Math.round((offerDays[offerDays.length / 2 - 1] + offerDays[offerDays.length / 2]) / 2)) : null;

    // zgodność ocen
    let pairs = 0, agree = 0;
    for (const card of cards) {
      const byQ = {};
      for (const r of card.ratings || []) (byQ[r.question_id] ||= []).push(Number(r.score));
      for (const scores of Object.values(byQ)) { if (scores.length >= 2) { pairs++; if (Math.max(...scores) - Math.min(...scores) <= 1) agree++; } }
    }
    const agreement = pairs ? Math.round((agree / pairs) * 100) : null;

    /* --- KPI --- */
    const kpi = (label, value, sub) => h('div', { class: 'pr-kpi' }, h('small', null, label), h('b', null, value), h('span', null, sub));
    const kpis = h('div', { class: 'pr-kpis' },
      kpi('Kandydaci', String(total), newThisWeek ? `+${newThisWeek} w tym tygodniu` : 'bez nowych w tym tygodniu'),
      kpi('Czas do oferty', median === null ? '—' : `${median} dni`, median === null ? 'brak ofert' : 'mediana'),
      kpi('Konwersja do oferty', total ? `${Math.round((offers / total) * 100)}%` : '—', `${offers} z ${total}`),
      kpi('Zgodność ocen', agreement === null ? '—' : `${agreement}%`, agreement === null ? 'brak podwójnych ocen' : 'kalibracja rozmówców'),
    );

    /* --- lejek --- */
    const rows = [{ label: 'Aplikacje', n: total }, ...stages.map((s, i) => ({ label: s, n: reached(i) }))];
    let worst = -1, worstDrop = 0;
    rows.forEach((r, i) => { if (i === 0) return; const prev = rows[i - 1].n; const drop = prev ? 1 - r.n / prev : 0; r.drop = prev ? Math.round(drop * 100) : null; if (drop > worstDrop) { worstDrop = drop; worst = i; } });
    const max = Math.max(1, total);
    const funnel = panel('Lejek', worst > 0 ? `Największy spadek: ${rows[worst - 1].label} → ${rows[worst].label.toLowerCase()}` : 'Brak spadków',
      h('div', { class: 'pr-bars' }, rows.map((r, i) => h('div', { class: `pr-bar${i === worst ? ' is-worst' : ''}` },
        h('span', { class: 'lbl' }, r.label),
        h('span', { class: 'track', 'aria-hidden': 'true' }, h('i', { style: `width:${Math.round((r.n / max) * 100)}%` })),
        h('b', null, String(r.n)),
        h('span', { class: 'drop' }, r.drop === null ? '' : `−${r.drop}%`),
      ))));

    /* --- powody odrzuceń --- */
    const rejectedList = cands.filter((c) => c.status === 'rejected');
    const byReason = new Map();
    for (const c of rejectedList) { const k = (c.reject_reason || 'Bez podanego powodu').trim(); byReason.set(k, (byReason.get(k) || 0) + 1); }
    const reasons = [...byReason.entries()].sort((a, b) => b[1] - a[1]);
    const maxR = Math.max(1, ...reasons.map((r) => r[1]));
    const rejections = panel('Powody odrzuceń', String(rejectedList.length),
      reasons.length
        ? h('div', { class: 'pr-reasons' }, reasons.map(([label, n]) => h('div', { class: 'pr-reason' },
          h('div', { class: 't' }, h('span', null, label), h('b', null, String(n))),
          h('span', { class: 'bar', 'aria-hidden': 'true' }, h('i', { style: `width:${Math.round((n / maxR) * 100)}%` })))))
        : h('p', { class: 'pr-empty' }, 'Nikogo jeszcze nie odrzucono. Powód odrzucenia zapisuje się tu z okna „Odrzuć”.'));

    /* --- źródła --- */
    const bySource = new Map();
    for (const c of cands) {
      const k = c.source || 'Inne';
      const e = bySource.get(k) || { n: 0, far: -1, farN: 0 };
      e.n++;
      const i = c.status === 'hired' ? stages.length : idx(c.stage);
      if (i > e.far) { e.far = i; e.farN = 1; } else if (i === e.far) e.farN++;
      bySource.set(k, e);
    }
    const sources = [...bySource.entries()].sort((a, b) => b[1].far - a[1].far || b[1].n - a[1].n);
    const farLabel = (e) => e.far >= stages.length ? `${e.farN} zatrudn.` : e.far === stages.length - 1 ? `${e.farN} do oferty` : e.far < 0 ? '' : `${e.farN} do: ${stages[e.far]}`;
    const sourcesPanel = h('section', { class: 'pr-panel', 'aria-label': 'Źródła' },
      h('div', { class: 'pr-panel-h' }, h('h2', null, 'Źródła — kto doprowadził najdalej')),
      sources.length ? sources.map(([label, e]) => h('div', { class: 'pr-source' }, h('span', { class: 'lbl' }, label), h('b', null, String(e.n)), h('span', { class: 'sub' }, farLabel(e))))
        : h('p', { class: 'pr-empty' }, 'Brak kandydatów.'));

    /* --- czekają za długo --- */
    const waiting = cands.filter((c) => (c.status || 'active') === 'active').map((c) => {
      const since = lastMoveAt(c.id) || c.applied_at;
      const days = Math.round((Date.now() - new Date(since).getTime()) / 864e5);
      return { c, days, planned: interviewsFor(c.id).some((i) => i.stage === c.stage || idx(i.stage) > idx(c.stage)) };
    }).filter((x) => !x.planned && x.days > 5).sort((a, b) => b.days - a.days);
    const waitingPanel = h('section', { class: 'pr-panel', 'aria-label': 'Czekają za długo' },
      h('div', { class: 'pr-panel-h' }, h('h2', null, 'Czekają za długo — brak kolejnego kroku'), h('span', null, waiting.length ? plural(waiting.length, 'osoba', 'osoby', 'osób') : 'nikt')),
      waiting.length ? waiting.map(({ c, days }) => h('div', { class: 'pr-wait' },
        avatar(c.full_name),
        h('a', { class: 'name', href: `#/candidates/${encodeURIComponent(c.id)}?stage=${encodeURIComponent(c.stage)}` }, c.full_name),
        tag(c.stage, 'neutral'),
        tag(`${days} dni bez ruchu`, 'warn'),
        button({ label: 'Zaplanuj', variant: 'secondary', onClick: () => openAdvanceModal(ctx, c, { onDone: refresh }) }),
      )) : h('p', { class: 'pr-empty' }, 'Każdy aktywny kandydat ma zaplanowany następny krok albo ruszył w ciągu 5 dni.'));

    const exportBtn = button({ label: 'Eksportuj PDF', variant: 'secondary', onClick: () => window.print() });
    root.replaceChildren(
      positionHeader(ctx, position, { active: 'report', actions: [exportBtn], candidates: cands }),
      kpis,
      h('div', { class: 'pr-cols' }, funnel, h('div', { class: 'pr-side' }, rejections, sourcesPanel)),
      waitingPanel,
    );
  }

  function panel(title, right, body) {
    return h('section', { class: 'pr-panel', 'aria-label': title }, h('div', { class: 'pr-panel-h' }, h('h2', null, title), right ? h('span', null, right) : null), body);
  }
  async function refresh() { draw(await load()); }

  draw(await load());
  return root;
}
