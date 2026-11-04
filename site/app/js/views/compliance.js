/**
 * views/compliance.js — RODO i AI Act (#/compliance), 1:1 z Figmą 08 · RODO i AI Act (12:1352).
 * Lewa kolumna: Kandydaci (zgody, wyjaśnienia, retencja), AI i nadzór człowieka (dwa ustawienia zablokowane
 * — wymóg AI Act: AI tylko sugeruje, rejestr decyzji zawsze włączony), Dane (lokalizacja, podmioty przetwarzające).
 * Prawa: Lista kontrolna (liczona z ustawień) i Wnioski o dane (otwarte można zamknąć).
 * „Eksportuj rejestr decyzji AI” buduje plik JSON z prawdziwych kart ocen (store.scorecards) — każda sugestia AI
 * z decyzją człowieka obok. Dane ustawień: views/settings-data.js (localStorage).
 *
 * export default async function render(ctx) -> HTMLElement
 */

import { settings } from './settings-data.js';
import { kbtn, kicon, badge, toggle, panel, dropdown, loadKitCss } from './admin-kit.js';

const RETENTION = [{ value: 6, label: '6 miesięcy' }, { value: 12, label: '12 miesięcy' }, { value: 24, label: '24 miesiące' }];
const LOCATIONS = ['UE · Frankfurt', 'UE · Dublin', 'UE · Sztokholm'];
const LOCKED_NOTE = 'Tego ustawienia nie da się wyłączyć: AI Act wymaga nadzoru człowieka nad systemem wysokiego ryzyka.';

export default async function render(ctx) {
  const { h, modal, toast, confirm, initials, plural } = ctx.ui;
  await Promise.all([loadKitCss(), ctx.ui.loadCss(new URL('./compliance.css', import.meta.url))]);
  const root = h('div', { class: 'e-root cp' });
  const exportBtn = kbtn({ label: 'Eksportuj rejestr decyzji AI', onClick: exportRegistry });
  ctx.setHeader({ title: 'RODO i AI Act', subtitle: 'AI Act uznaje AI w rekrutacji za system wysokiego ryzyka. Tu ustawiasz, jak Tekma chroni kandydatów i Twoją firmę.', actions: [exportBtn], width: 'wide' });
  const cols = h('div', { class: 'e-cols' });
  root.append(cols);

  function setting({ title, desc, control, id }) {
    return h('div', { class: 'cp-setting' },
      h('div', { class: 't' }, h('b', { id: `${id}-l` }, title), h('span', { id: `${id}-d` }, desc)),
      control);
  }
  const set = (key, v) => settings.update((st) => { st.compliance[key] = v; });

  function draw() {
    const c = settings.get().compliance;

    /* --- Kandydaci --- */
    const candidates = panel({ title: 'Kandydaci', id: 'cp-cand', body: h('div', null,
      setting({ id: 'cp-consent', title: 'Zgoda na nagrywanie rozmów', desc: 'Kandydat akceptuje nagranie przed rozmową. Bez zgody notetaker nie dołącza.',
        control: toggle({ checked: c.recordingConsent, label: 'Zgoda na nagrywanie rozmów', onChange: async (v) => {
          if (!v) {
            const ok = await confirm({ title: 'Wyłączyć zbieranie zgód?', text: 'Bez zgody notetaker nie może nagrywać rozmów — a nagrywanie bez zgody narusza RODO. Zalecamy zostawić włączone.', confirmLabel: 'Wyłącz', cancelLabel: 'Zostaw', danger: true });
            if (!ok) { draw(); return; }
          }
          set('recordingConsent', v); toast(v ? 'Zbieranie zgód włączone.' : 'Zbieranie zgód wyłączone. Notetaker nie dołączy do żadnej rozmowy.', v ? 'good' : 'warn'); draw();
        } }) }),
      setting({ id: 'cp-expl', title: 'Wyjaśnienia dla kandydatów', desc: 'Kandydat może w portalu poprosić o wyjaśnienie, jak AI wpłynęło na ocenę.',
        control: toggle({ checked: c.candidateExplanations, label: 'Wyjaśnienia dla kandydatów', onChange: (v) => { set('candidateExplanations', v); toast(v ? 'Kandydaci mogą prosić o wyjaśnienia w portalu.' : 'Wyjaśnienia w portalu wyłączone. Wnioski przyjmujesz ręcznie.', 'neutral'); draw(); } }) }),
      setting({ id: 'cp-ret', title: 'Okres przechowywania danych', desc: 'Po tym czasie Tekma usuwa dane odrzuconych kandydatów.',
        control: dropdown({ value: c.retentionMonths, options: RETENTION, label: 'Okres przechowywania danych', onChange: (v) => { set('retentionMonths', Number(v)); toast(`Dane odrzuconych kandydatów usuniemy po ${RETENTION.find((r) => String(r.value) === String(v)).label}.`, 'neutral'); } }) }),
    ) });

    /* --- AI i nadzór człowieka --- */
    const ai = panel({ title: 'AI i nadzór człowieka', id: 'cp-ai', body: h('div', null,
      setting({ id: 'cp-only', title: 'AI tylko sugeruje', desc: 'AI nie odrzuca ani nie przesuwa kandydatów. Tego ustawienia nie da się wyłączyć.',
        control: toggle({ checked: true, disabled: true, label: 'AI tylko sugeruje (zablokowane)', lockedNote: LOCKED_NOTE }) }),
      setting({ id: 'cp-log', title: 'Rejestr decyzji AI', desc: 'Każda sugestia AI trafia do rejestru z wersją modelu, danymi wejściowymi i decyzją człowieka.',
        control: toggle({ checked: true, disabled: true, label: 'Rejestr decyzji AI (zablokowane)', lockedNote: LOCKED_NOTE }) }),
      setting({ id: 'cp-bias', title: 'Kontrola stronniczości', desc: 'Comiesięczny raport różnic w ocenach między grupami kandydatów.',
        control: toggle({ checked: c.biasControl, label: 'Kontrola stronniczości', onChange: (v) => { set('biasControl', v); toast(v ? 'Pierwszy raport stronniczości przygotujemy 1 grudnia.' : 'Raporty stronniczości wyłączone.', 'neutral'); draw(); } }) }),
    ) });

    /* --- Dane --- */
    const processorsBtn = h('button', { type: 'button', class: 'e-dd cp-dd-btn', on: { click: openProcessors } }, 'Zobacz listę', kicon('chevron-down'));
    const data = panel({ title: 'Dane', id: 'cp-data', body: h('div', null,
      setting({ id: 'cp-loc', title: 'Lokalizacja danych', desc: 'Dane i nagrania przechowujemy w UE.',
        control: dropdown({ value: c.dataLocation, options: LOCATIONS, label: 'Lokalizacja danych', onChange: (v) => { set('dataLocation', v); toast(`Nowe dane trafią do regionu ${v}. Migrację istniejących zaplanujemy w nocy.`, 'neutral'); draw(); } }) }),
      setting({ id: 'cp-proc', title: 'Podmioty przetwarzające', desc: 'Lista dostawców i umów powierzenia (DPA).', control: processorsBtn }),
    ) });

    /* --- Lista kontrolna --- */
    const checks = [
      { ok: /^UE/.test(c.dataLocation), label: 'Dane w UE' },
      { ok: c.recordingConsent, label: c.recordingConsent ? 'Zbieranie zgód włączone' : 'Zbieranie zgód wyłączone' },
      { ok: true, label: 'Nadzór człowieka włączony' },
      { ok: true, label: 'Rejestr decyzji AI włączony' },
    ];
    const checklist = h('div', { class: 'e-card cp-check' },
      h('div', { class: 'cp-check-h' }, kicon('shield'), h('b', null, 'Lista kontrolna')),
      checks.map((x) => h('div', { class: `cp-check-i${x.ok ? '' : ' is-off'}` }, kicon(x.ok ? 'check-sm' : 'alert'), h('span', null, x.label))));

    /* --- Wnioski o dane --- */
    const open = c.requests.filter((r) => r.status === 'open').length;
    const requests = panel({ title: 'Wnioski o dane', id: 'cp-req', aside: open ? `${open} ${open === 1 ? 'otwarty' : open < 5 ? 'otwarte' : 'otwartych'}` : 'brak otwartych',
      body: h('div', { class: 'e-list' }, c.requests.length ? c.requests.map((r) => h('button', { type: 'button', class: 'e-li clickable cp-req', on: { click: () => openRequest(r) } },
        h('span', { class: 'e-av s32', 'aria-hidden': 'true' }, initials(r.name)),
        h('span', { class: 't' }, h('b', null, r.name), h('small', null, r.status === 'open' ? `${r.type} · zostało ${plural(r.due_days, 'dzień', 'dni', 'dni')}` : `${r.type} · ${r.closed}`)),
        badge(r.status === 'open' ? 'Otwarty' : 'Wykonany', r.status === 'open' ? 'info' : 'good'))) : h('div', { class: 'e-empty' }, 'Brak wniosków.')) });

    cols.replaceChildren(h('div', { class: 'e-col' }, candidates, ai, data), h('div', { class: 'e-col' }, checklist, requests));
  }

  function openProcessors() {
    const c = settings.get().compliance;
    const m = modal({ title: 'Podmioty przetwarzające', body: h('div', null,
      h('p', null, 'Dostawcy, którym powierzamy dane kandydatów. Każdy ma podpisaną umowę powierzenia (DPA).'),
      h('div', { class: 'cp-proc-list' }, c.processors.map((p) => h('div', { class: 'cp-proc' }, h('b', null, p.name), h('small', null, `${p.region} · ${p.dpa}`))))),
      actions: [{ label: 'Zamknij', variant: 'secondary', onClick: () => m.close() }] });
  }

  function openRequest(r) {
    const isOpen = r.status === 'open';
    const body = h('div', null,
      h('p', null, h('b', null, r.name), ` — ${r.type.toLowerCase()}.`),
      h('p', null, isOpen ? `RODO daje 30 dni na odpowiedź. Zostało ${plural(r.due_days, 'dzień', 'dni', 'dni')}.` : `Wniosek ${r.closed}.`),
      isOpen ? h('p', { class: 'e-caption' }, r.type === 'Dostęp do danych' ? 'Wyślemy kandydatowi kopię danych: CV, notatki, karty ocen i sugestie AI z wyjaśnieniem.' : r.type === 'Usunięcie danych' ? 'Usuniemy dane kandydata ze wszystkich stanowisk. Rejestr decyzji AI zostaje w formie zanonimizowanej.' : 'Wyślemy kandydatowi wyjaśnienie, które sugestie AI pojawiły się przy jego ocenie i jaką decyzję podjął człowiek.') : null);
    const m = modal({ title: 'Wniosek o dane', body, actions: isOpen ? [
      { label: 'Zamknij', variant: 'secondary', onClick: () => m.close() },
      { label: 'Oznacz jako wykonany', variant: 'primary', onClick: () => {
        const d = new Date(); const MONTHS = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
        settings.update((st) => { const x = st.compliance.requests.find((y) => y.id === r.id); if (x) { x.status = 'done'; x.closed = `zamknięty ${d.getDate()} ${MONTHS[d.getMonth()]}`; } });
        m.close(); toast(`Wniosek ${r.name}: wykonany.`, 'good'); draw();
      } }] : [{ label: 'Zamknij', variant: 'secondary', onClick: () => m.close() }] });
  }

  async function exportRegistry() {
    exportBtn.setBusy(true);
    try {
      const [cards, candidates] = await Promise.all([ctx.store.scorecards.list ? ctx.store.scorecards.list() : [], ctx.store.candidates.list()]);
      const byId = Object.fromEntries(candidates.map((c) => [c.id, c]));
      const entries = [];
      for (const card of cards || []) {
        const cand = byId[card.candidate_id];
        for (const [qid, s] of Object.entries(card.ai || {})) {
          const human = (card.ratings || []).filter((r) => r.question_id === qid).map((r) => ({ rater: r.rater_name, score: r.score }));
          entries.push({ candidate: cand ? cand.full_name : card.candidate_id, stage: card.stage, question_id: qid, ai_suggestion: { score: s.score, quote: s.quote, reason: s.reason, model: 'tekma-ai-demo-1' }, human_ratings: human, human_decision: card.decision || null, updated_at: card.updated_at });
        }
      }
      const payload = { exported_at: new Date().toISOString(), org: ctx.org ? ctx.org.name : null, note: 'AI tylko sugeruje. Ocenę i decyzję zawsze zatwierdza człowiek.', entries };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const a = h('a', { href: URL.createObjectURL(blob), download: `rejestr-decyzji-ai-${new Date().toISOString().slice(0, 10)}.json` });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast(entries.length ? `Pobieramy rejestr: ${plural(entries.length, 'sugestia AI', 'sugestie AI', 'sugestii AI')} z decyzjami ludzi.` : 'Rejestr jest pusty — nie ma jeszcze sugestii AI przy kartach ocen.', 'neutral');
    } catch (err) {
      toast(err.message || 'Nie udało się przygotować rejestru.', 'bad');
    } finally { exportBtn.setBusy(false); }
  }

  draw();
  return root;
}
