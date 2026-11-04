/**
 * views/position-new.js — kreator „Nowe stanowisko” (Figma 24:2100 krok 1 „Opis”, 24:2341 krok 2 „Etapy”).
 *   #/positions/new?krok=1      opis: nazwa, zespół, lokalizacja, forma, widełki, cel na 6 mies., kryteria + szkic ogłoszenia od AI
 *   #/positions/new?krok=2      etapy i rubryki: lista etapów (rubryka, rozmówcy, menu), zasady przejścia, „Zapisz jako szablon”
 *   #/positions/new?szablon=k   start z szablonu biblioteki (etapy i rubryka z szablonu, przykładowe dane)
 * Kroki 3 „Zespół” i 4 „Publikacja” to ekrany stanowiska: po kroku 2 tworzymy stanowisko (store.positions.create)
 * i przechodzimy do #/positions/:id/team, a publikacja odbywa się w #/positions/:id/ad.
 * Szkic kreatora żyje w localStorage (rekrutacja-data.js: getDraft/setDraft) — odświeżenie strony nic nie gubi.
 * AI tylko szkicuje ogłoszenie; wszystko edytuje człowiek (zasada AI Act).
 * export default async function render(ctx) -> HTMLElement
 */

import { DEFAULT_STAGES } from '../seed.js';
import { bbtn, bicon, badge, toggle, panel, pageHead, wizardSteps, bavatar, menu, moreBtn, loadKitCss } from './b-kit.js';
import { getDraft, setDraft, clearDraft, setPositionMeta, setRubricOrigin, TEMPLATES, TEAM } from './rekrutacja-data.js';
import { setHeader } from './positions.js';

const EXAMPLES = {
  'product-designer': { title: 'Product Designer', department: 'Produkt', location: 'Kraków / hybrydowo', form: 'B2B lub UoP', salary: '16–20 tys. zł', goal: 'Przeprojektować onboarding klienta i zbudować system designu od zera.', criteria: ['Projektowanie interakcji', 'Badania z użytkownikami', 'Systemy designu', 'Komunikacja z inżynierią', 'Samodzielność'] },
  'first-engineer': { title: 'Backend Engineer', department: 'Inżynieria', location: 'Warszawa / zdalnie', form: 'B2B', salary: '18–24 tys. zł', goal: 'Przejąć warstwę danych i przygotować platformę na pięć regionów.', criteria: ['Projektowanie systemów', 'Rozwiązywanie problemów', 'Współpraca', 'Jakość'] },
  'senior-frontend': { title: 'Senior Frontend Engineer', department: 'Inżynieria', location: 'Zdalnie (PL)', form: 'B2B', salary: '20–26 tys. zł', goal: 'Zbudować system komponentów i skrócić czas ładowania panelu o połowę.', criteria: ['Wydajność', 'Architektura UI', 'Dostępność', 'Współpraca'] },
  'product-manager': { title: 'Product Manager', department: 'Produkt', location: 'Warszawa / hybrydowo', form: 'UoP lub B2B', salary: '18–24 tys. zł', goal: 'Poprowadzić discovery i dowieźć pierwszą wersję modułu prognoz dla DACH.', criteria: ['Discovery', 'Priorytetyzacja', 'Metryki', 'Komunikacja'] },
  'first-sales': { title: 'Account Executive', department: 'Sprzedaż', location: 'Warszawa', form: 'B2B', salary: '14–18 tys. zł + prowizja', goal: 'Zbudować pipeline od zera i domknąć pierwszych 10 klientów.', criteria: ['Discovery', 'Pipeline', 'Negocjacje', 'Odporność'] },
  'customer-success': { title: 'Customer Success Manager', department: 'Operacje', location: 'Kraków / zdalnie', form: 'UoP', salary: '10–13 tys. zł', goal: 'Skrócić czas do wartości nowych klientów do 14 dni.', criteria: ['Onboarding', 'Retencja', 'Komunikacja'] },
};
const PEOPLE_BY_STAGE = (stage) => {
  const s = stage.toLowerCase();
  if (s.includes('wstępna') || s.includes('screening')) return s.includes('screening') ? [] : ['ola'];
  if (s.includes('ceo')) return ['piotr'];
  if (s.includes('techn') || s.includes('zadanie') || s.includes('case') || s.includes('symulacja')) return ['anna', 'tomasz'];
  if (s.includes('zespo')) return ['anna', 'ola'];
  return ['anna'];
};
const DEFAULT_RULES = [
  { key: 'min2', title: 'Nikt nie przechodzi po jednej rozmowie', sub: 'Wymagane min. 2 oceny przed decyzją', on: true },
  { key: 'flag', title: 'Flaga przy rozbieżności', sub: 'Gdy oceny różnią się o 2+ pkt', on: true },
  { key: 'ai', title: 'AI nie odrzuca automatycznie', sub: 'Zawsze włączone (AI Act)', on: true, locked: true },
  { key: 'remind', title: 'Przypomnienie po 5 dniach bez ruchu', sub: 'Do właściciela stanowiska', on: false },
];

export default async function render(ctx) {
  const { h } = ctx.ui;
  await Promise.all([loadKitCss(), ctx.ui.loadCss(new URL('./position-new.css', import.meta.url))]);

  // --- szkic: istniejący, z szablonu albo pusty
  let draft = getDraft();
  const tplKey = ctx.query && ctx.query.szablon;
  if (tplKey) {
    const t = TEMPLATES.find((x) => x.key === tplKey);
    if (t) {
      const ex = EXAMPLES[t.key] || { title: t.name, department: t.badge, location: '', form: '', salary: '', goal: '', criteria: [] };
      const stages = t.after ? DEFAULT_STAGES.slice() : t.stages.slice();
      const main = stages.find((s, i) => i >= 2) || stages[1];
      draft = setDraft({ ...ex, step: 1, templateKey: t.key, stages, stageRubrics: main ? { [main]: `tpl:${t.key}` } : {}, stagePeople: {}, rules: DEFAULT_RULES.map((r) => ({ ...r })) });
      try { history.replaceState(null, '', '#/positions/new?krok=1'); } catch { /* nieistotne */ }
    }
  }
  if (!draft) draft = setDraft({ title: '', department: '', location: '', form: '', salary: '', goal: '', criteria: [], step: 1, stages: DEFAULT_STAGES.slice(), stageRubrics: {}, stagePeople: {}, rules: DEFAULT_RULES.map((r) => ({ ...r })) });
  if (!Array.isArray(draft.stages) || !draft.stages.length) draft.stages = DEFAULT_STAGES.slice();
  draft.stageRubrics = draft.stageRubrics || {};
  draft.stagePeople = draft.stagePeople || {};
  draft.rules = Array.isArray(draft.rules) && draft.rules.length ? draft.rules : DEFAULT_RULES.map((r) => ({ ...r }));

  const step = ctx.query && ctx.query.krok === '2' ? 2 : 1;
  if (step === 2 && !String(draft.title || '').trim()) { ctx.navigate('#/positions/new?krok=1'); return h('div'); }

  const rubrics = await ctx.store.rubrics.list().catch(() => []);
  return step === 1 ? renderStep1(ctx, draft, rubrics) : renderStep2(ctx, draft, rubrics);
}

/* ====================================================================== krok 1: opis */
function renderStep1(ctx, draft, rubrics) {
  const { h, toast } = ctx.ui;
  const root = h('div', { class: 'b-page pn' });
  const persist = (patch) => { Object.assign(draft, patch); setDraft({ ...patch, step: 1 }); };

  const cancel = bbtn({ label: 'Anuluj', variant: 'ghost', onClick: async () => {
    const dirty = draft.title || draft.goal || (draft.criteria || []).length;
    if (dirty) {
      const ok = await ctx.ui.confirm({ title: 'Porzucić szkic?', text: 'Dane z kreatora zostaną usunięte. Możesz też wrócić później — szkic czeka na liście stanowisk.', confirmLabel: 'Porzuć szkic', cancelLabel: 'Zostaw szkic' });
      if (ok) clearDraft();
    }
    ctx.navigate('#/positions');
  } });
  const next = bbtn({ label: 'Dalej: etapy', variant: 'primary', onClick: () => {
    if (String(draft.title || '').trim().length < 2) { fTitle.setError('Podaj nazwę stanowiska (co najmniej 2 znaki).'); fTitle.input.focus(); return; }
    persist({ step: 2 });
    ctx.navigate('#/positions/new?krok=2');
  } });
  setHeader(ctx, { title: 'Nowe stanowisko', crumbs: [{ label: 'Stanowiska', href: '#/positions' }], actions: [ctx.ui.button({ label: 'Dalej: etapy', variant: 'primary', onClick: () => next.click() })], width: 'wide' });

  // --- pola
  const fTitle = field({ label: 'Nazwa stanowiska', value: draft.title, placeholder: 'np. Product Designer', autocomplete: 'off', onInput: (v) => { persist({ title: v }); redrawAi(); } });
  const fDept = field({ label: 'Zespół', value: draft.department, placeholder: 'np. Produkt', onInput: (v) => { persist({ department: v }); redrawAi(); } });
  const fLoc = field({ label: 'Lokalizacja', value: draft.location, placeholder: 'np. Kraków / hybrydowo', onInput: (v) => persist({ location: v }) });
  const fForm = field({ label: 'Forma', value: draft.form, placeholder: 'B2B lub UoP', onInput: (v) => persist({ form: v }), cls: 'w132' });
  const fSalary = field({ label: 'Widełki', value: draft.salary, placeholder: '16–20 tys. zł', onInput: (v) => persist({ salary: v }), cls: 'w132' });
  const fGoal = field({ label: 'Czego ta osoba ma dowieźć w 6 miesięcy?', value: draft.goal, placeholder: 'np. Przeprojektować onboarding klienta i zbudować system designu od zera.', textarea: true, onInput: (v) => { persist({ goal: v }); redrawAi(); } });

  // --- kryteria
  const critList = h('div', { class: 'pn-criteria', role: 'list', 'aria-label': 'Kryteria' });
  function drawCriteria() {
    const items = (draft.criteria || []).map((c, i) => h('span', { class: 'pn-crit', role: 'listitem' }, h('span', null, c),
      h('button', { type: 'button', class: 'pn-crit-x', 'aria-label': `Usuń kryterium ${c}`, onClick: () => { draft.criteria.splice(i, 1); persist({ criteria: draft.criteria }); drawCriteria(); redrawAi(); } }, bicon('x', 16))));
    const add = h('button', { type: 'button', class: 'pn-crit-add', onClick: () => startAdd() }, bicon('plus', 16), h('span', null, 'Dodaj'));
    critList.replaceChildren(...items, add);
  }
  function startAdd() {
    const input = h('input', { type: 'text', class: 'pn-crit-input', placeholder: 'Nowe kryterium', 'aria-label': 'Nowe kryterium', maxlength: '48' });
    const commit = () => {
      const v = input.value.trim();
      if (v) {
        if (!(draft.criteria || []).some((c) => c.toLowerCase() === v.toLowerCase())) { draft.criteria = [...(draft.criteria || []), v]; persist({ criteria: draft.criteria }); redrawAi(); }
        else toast('To kryterium już jest na liście.', 'neutral');
      }
      drawCriteria();
      const btn = critList.querySelector('.pn-crit-add'); if (btn && v) btn.focus();
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') { e.preventDefault(); input.value = ''; drawCriteria(); } });
    input.addEventListener('blur', commit);
    critList.querySelector('.pn-crit-add').replaceWith(input);
    input.focus();
  }
  drawCriteria();

  const form = h('form', { class: 'pn-form', novalidate: true, on: { submit: (e) => { e.preventDefault(); next.click(); } } },
    fTitle, fDept,
    h('div', { class: 'b-form-row' }, fLoc, fForm, fSalary),
    fGoal,
    h('div', { class: 'b-label', id: 'pn-crit-l' }, 'Kryteria, które przewidują sukces'),
    critList,
  );
  critList.setAttribute('aria-labelledby', 'pn-crit-l');

  // --- szkic ogłoszenia od AI
  let variant = 0;
  const regen = bbtn({ label: 'Wygeneruj ponownie', variant: 'secondary', onClick: () => { variant = (variant + 1) % 2; redrawAi(); toast('AI przygotowała nowy szkic. Sprawdź go i popraw, co chcesz.', 'neutral'); } });
  const draftBody = h('div', { class: 'pn-ai-draft' });
  const aiPanel = h('section', { class: 'pn-ai', 'aria-label': 'Szkic ogłoszenia od AI' },
    h('div', { class: 'pn-ai-h' }, bicon('sparkle-fill', 16), h('h2', { class: 'pn-ai-t' }, 'Szkic ogłoszenia od AI'), regen),
    draftBody,
    h('p', { class: 'pn-ai-note' }, 'Napisane na podstawie profilu firmy. Edytujesz wszystko — AI tylko szkicuje.'),
  );
  function redrawAi() {
    const d = aiDraft(draft, ctx.org ? ctx.org.name : 'Nordlight Labs', draft.stages.length, variant);
    if (!d) {
      draftBody.replaceChildren(h('p', { class: 'pn-ai-empty' }, 'Wpisz nazwę stanowiska i cel na 6 miesięcy — AI naszkicuje ogłoszenie, które potem poprawisz.'));
      return;
    }
    draftBody.replaceChildren(
      h('h3', { class: 'b-h3' }, d.title),
      h('p', null, d.intro),
      h('p', { class: 'pn-ai-sub' }, 'Co będziesz robić'),
      h('ul', { class: 'pn-ai-ul' }, d.bullets.map((b) => h('li', null, h('span', { 'aria-hidden': 'true' }, '•'), h('span', null, b)))),
      h('p', { class: 'pn-ai-sub' }, 'Jak wygląda proces'),
      h('p', null, d.process),
    );
  }
  redrawAi();

  root.append(
    pageHead({ crumbs: [{ label: 'Stanowiska', href: '#/positions' }, { label: 'Nowe stanowisko' }], title: 'Nowe stanowisko', actions: [cancel, next] }),
    wizardSteps(1),
    h('div', { class: 'b-two pn-cols' }, h('div', { class: 'col-1 pn-card' }, form), h('div', { class: 'col-1' }, aiPanel)),
  );
  requestAnimationFrame(() => { if (window.innerWidth >= 900 && !draft.title) fTitle.input.focus({ preventScroll: true }); });
  return root;
}

function field({ label, value = '', placeholder, autocomplete, onInput, textarea = false, cls = '' }) {
  const { h } = { h: (...a) => document.createElement && window.__tekmaH ? window.__tekmaH(...a) : hh(...a) };
  const id = `pn-${Math.random().toString(36).slice(2, 8)}`;
  const input = textarea
    ? h('textarea', { id, rows: 1, placeholder, spellcheck: 'true' })
    : h('input', { id, type: 'text', placeholder, autocomplete: autocomplete || 'off' });
  input.value = value || '';
  const err = h('div', { class: 'err', role: 'alert' });
  const el = h('div', { class: `b-field${cls ? ' ' + cls : ''}` }, h('label', { htmlFor: id }, label), input, err);
  el.input = input;
  el.setError = (m) => { err.textContent = m || ''; el.classList.toggle('has-error', Boolean(m)); input.setAttribute('aria-invalid', m ? 'true' : 'false'); };
  const grow = () => { if (textarea) { input.style.height = 'auto'; input.style.height = `${Math.max(42, input.scrollHeight + 2)}px`; } };
  input.addEventListener('input', () => { el.setError(''); grow(); if (onInput) onInput(input.value); });
  if (textarea) requestAnimationFrame(grow);
  return el;
}
// lokalny h() (bez dostępu do ctx w pomocniku)
import ui from '../ui.js';
const hh = ui.h;

/** Deterministyczny szkic ogłoszenia: z profilu firmy, nazwy, zespołu, celu i kryteriów. Bez sieci. */
export function aiDraft(d, orgName, stagesCount, variant = 0) {
  const title = String(d.title || '').trim();
  if (!title) return null;
  const goal = String(d.goal || '').trim();
  const crit = (d.criteria || []).slice(0, 3);
  const dept = String(d.department || '').toLowerCase();
  const company = variant === 0
    ? 'Pomagamy operatorom sieci przewidywać zapotrzebowanie na energię.'
    : 'Budujemy platformę prognoz energii dla operatorów sieci w Europie.';
  const goalSentence = goal
    ? `Szukamy osoby, która ${lowerFirst(stripDot(goal))}.`
    : `Szukamy osoby, która wzmocni zespół ${d.department || 'produktowy'} i weźmie odpowiedzialność za cały obszar.`;
  let bullets;
  if (dept.includes('produkt') || dept.includes('design')) {
    bullets = ['Prowadzić badania z dyspozytorami i analitykami sieci', 'Projektować przepływy od pierwszego logowania do pierwszej prognozy', 'Budować i utrzymywać system designu razem z inżynierią'];
  } else if (dept.includes('inży') || dept.includes('eng')) {
    bullets = ['Projektować i rozwijać usługi w Go i PostgreSQL', 'Skalować kolejki zadań i potoki danych', 'Dbać o niezawodność razem z zespołem'];
  } else if (dept.includes('sprzed') || dept.includes('sales')) {
    bullets = ['Budować pipeline w segmencie firm 50–500 osób', 'Prowadzić discovery z CTO i dyrektorami operacyjnymi', 'Przekazywać wnioski z rozmów do produktu'];
  } else {
    bullets = crit.length ? crit.map((c) => `Rozwijać obszar: ${lowerFirst(c)}`) : ['Przejąć odpowiedzialność za kluczowy obszar', 'Pracować blisko z zespołem produktu i inżynierii', 'Mierzyć efekty i dzielić się wnioskami'];
  }
  if (variant === 1) bullets = bullets.slice().reverse();
  return {
    title: `${title} w ${orgName}`,
    intro: `${company} ${goalSentence}`,
    bullets,
    process: `${stagesCount} etapy, te same pytania dla każdego, odpowiedź w ciągu 10 dni. Za Twoją zgodą rozmowy są nagrywane.`,
  };
}
const lowerFirst = (s) => (s ? s[0].toLowerCase() + s.slice(1) : s);
const stripDot = (s) => s.replace(/[.\s]+$/, '');

/* ====================================================================== krok 2: etapy i rubryki */
function renderStep2(ctx, draft, rubrics) {
  const { h, toast } = ctx.ui;
  const root = h('div', { class: 'b-page pn' });
  const persist = (patch) => { Object.assign(draft, patch); setDraft({ ...patch, step: 2 }); };
  const tpl = draft.templateKey ? TEMPLATES.find((t) => t.key === draft.templateKey) : null;

  const back = bbtn({ label: 'Wstecz', variant: 'ghost', onClick: () => ctx.navigate('#/positions/new?krok=1') });
  const next = bbtn({ label: 'Dalej: zespół', variant: 'primary', onClick: () => create() });
  setHeader(ctx, { title: draft.title, crumbs: [{ label: 'Nowe stanowisko', href: '#/positions/new?krok=1' }], actions: [ctx.ui.button({ label: 'Dalej: zespół', variant: 'primary', onClick: () => next.click() })], width: 'wide' });

  const list = h('ol', { class: 'pn-stages', 'aria-label': 'Etapy lejka' });
  const addStage = h('button', { type: 'button', class: 'b-dashed', onClick: () => editStage(null) }, bicon('plus', 16), h('span', null, 'Dodaj etap'));

  function rubricLabel(stage) {
    const ref = draft.stageRubrics[stage];
    if (!ref) return isAiStage(stage) ? 'AI wylicza dopasowanie CV do kryteriów (0–100)' : 'Bez rubryki — przypisz z menu';
    if (String(ref).startsWith('tpl:')) {
      const t = TEMPLATES.find((x) => x.key === ref.slice(4));
      return t ? `Rubryka: ${t.rubricName} (z szablonu) · ${qCount(t.questions)} · ${minutes(t.questions)} min` : 'Bez rubryki';
    }
    const r = rubrics.find((x) => x.id === ref);
    return r ? `Rubryka: ${r.name} · ${qCount(r.questions)} · ${minutes(r.questions)} min` : 'Bez rubryki — przypisz z menu';
  }
  const isAiStage = (s) => /screening|cv/i.test(s);
  const people = (stage) => (draft.stagePeople[stage] || PEOPLE_BY_STAGE(stage)).map((id) => TEAM.find((t) => t.id === id)).filter(Boolean);

  function drawStages() {
    let n = 0;
    list.replaceChildren(...draft.stages.map((s, i) => {
      const ai = isAiStage(s);
      if (!ai) n += 1;
      const more = moreBtn(`Więcej: ${s}`);
      const li = h('li', { class: 'pn-stage' },
        h('span', { class: 'pn-grip', 'aria-hidden': 'true' }, bicon('grip', 16)),
        ai ? h('span', { class: 'pn-n is-ai', 'aria-label': 'Etap AI' }, bicon('sparkle-fill', 16)) : h('span', { class: 'pn-n' }, String(n)),
        h('div', { class: 'pn-stage-t' }, h('b', null, s), h('small', null, rubricLabel(s))),
        ai ? h('div', { class: 'pn-people' }, badge('AI', 'accent')) : h('div', { class: 'pn-people b-avs' }, people(s).map((p) => bavatar(p.name, 26))),
        h('div', { class: 'pn-more' }, more),
      );
      const items = [
        { label: 'Zmień nazwę', icon: 'edit', onClick: () => editStage(i) },
        ...(ai ? [] : [{ label: 'Przypisz rubrykę', icon: 'rubric', onClick: () => assignRubric(i) }, { label: 'Rozmówcy', icon: 'users', onClick: () => assignPeople(i) }]),
        { label: 'Przenieś wyżej', icon: 'chevron', disabled: i === 0, onClick: () => move(i, -1) },
        { label: 'Przenieś niżej', icon: 'chevron', disabled: i === draft.stages.length - 1, onClick: () => move(i, 1) },
        { label: 'Usuń etap', icon: 'trash', danger: true, disabled: draft.stages.length <= 2, onClick: () => removeStage(i) },
      ];
      menu(more, items);
      return li;
    }));
  }
  function renameKeys(from, to) {
    for (const k of ['stageRubrics', 'stagePeople']) { if (draft[k][from] !== undefined) { draft[k][to] = draft[k][from]; delete draft[k][from]; } }
  }
  function move(i, dir) {
    const j = i + dir; if (j < 0 || j >= draft.stages.length) return;
    const [s] = draft.stages.splice(i, 1); draft.stages.splice(j, 0, s);
    persist({ stages: draft.stages }); drawStages();
    const b = list.children[j] && list.children[j].querySelector('.b-more'); if (b) b.focus();
  }
  async function removeStage(i) {
    const s = draft.stages[i];
    const ok = await ctx.ui.confirm({ title: `Usunąć etap „${s}”?`, text: 'Etap zniknie z lejka tego stanowiska. Rubryka zostaje w bibliotece.', confirmLabel: 'Usuń etap', danger: true });
    if (!ok) return;
    draft.stages.splice(i, 1); delete draft.stageRubrics[s]; delete draft.stagePeople[s];
    persist({ stages: draft.stages, stageRubrics: draft.stageRubrics, stagePeople: draft.stagePeople }); drawStages(); addStage.focus();
  }
  function editStage(i) {
    const isNew = i === null;
    const f = ctx.ui.field({ label: 'Nazwa etapu', name: 'stage', value: isNew ? '' : draft.stages[i], required: true, placeholder: 'np. Zadanie projektowe', autocomplete: 'off' });
    const rubSel = isNew ? ctx.ui.field({ label: 'Rubryka (opcjonalnie)', name: 'rubric', type: 'select', options: [{ value: '', label: 'Bez rubryki' }, ...rubrics.map((r) => ({ value: r.id, label: `${r.name} (v${r.version || 1})` }))] }) : null;
    const save = ctx.ui.button({ label: isNew ? 'Dodaj etap' : 'Zapisz', variant: 'primary', onClick: () => {
      const v = f.value.trim().replace(/\s+/g, ' ');
      if (v.length < 2) { f.setError('Podaj nazwę etapu.'); return; }
      if (draft.stages.some((s, k) => s.toLowerCase() === v.toLowerCase() && k !== i)) { f.setError('Taki etap już jest w lejku.'); return; }
      if (isNew) { draft.stages.push(v); if (rubSel && rubSel.value) draft.stageRubrics[v] = rubSel.value; }
      else { const old = draft.stages[i]; draft.stages[i] = v; renameKeys(old, v); }
      persist({ stages: draft.stages, stageRubrics: draft.stageRubrics, stagePeople: draft.stagePeople });
      m.close(); drawStages(); toast(isNew ? `Etap „${v}” dodany.` : 'Nazwa etapu zmieniona.', 'good');
    } });
    const m = ctx.ui.modal({ title: isNew ? 'Nowy etap' : 'Zmień nazwę etapu', body: h('div', null, f, rubSel), actions: [ctx.ui.button({ label: 'Anuluj', onClick: () => m.close() }), save] });
  }
  function assignRubric(i) {
    const s = draft.stages[i];
    const cur = draft.stageRubrics[s] || '';
    const opts = [{ value: '', label: 'Bez rubryki' }, ...(tpl && !tpl.after ? [{ value: `tpl:${tpl.key}`, label: `${tpl.rubricName} (z szablonu „${tpl.name}”)` }] : []), ...rubrics.map((r) => ({ value: r.id, label: `${r.name} (v${r.version || 1})` }))];
    const sel = ctx.ui.field({ label: `Rubryka dla etapu „${s}”`, name: 'rubric', type: 'select', value: cur, options: opts, hint: 'Rubryka sprawia, że oceny rozmówców są porównywalne. Nową utworzysz w Rubrykach albo z szablonu.' });
    const m = ctx.ui.modal({ title: 'Przypisz rubrykę', body: sel, actions: [
      ctx.ui.button({ label: 'Anuluj', onClick: () => m.close() }),
      ctx.ui.button({ label: 'Zapisz', variant: 'primary', onClick: () => { if (sel.value) draft.stageRubrics[s] = sel.value; else delete draft.stageRubrics[s]; persist({ stageRubrics: draft.stageRubrics }); m.close(); drawStages(); toast('Rubryka przypisana.', 'good'); } }),
    ] });
  }
  function assignPeople(i) {
    const s = draft.stages[i];
    const cur = new Set((draft.stagePeople[s] || PEOPLE_BY_STAGE(s)));
    const boxes = TEAM.map((t) => h('label', { class: 'check pn-check' }, h('input', { type: 'checkbox', checked: cur.has(t.id), value: t.id }), bavatar(t.name, 26), h('span', null, t.name, ' ', h('span', { class: 'muted' }, `· ${t.role}`))));
    const m = ctx.ui.modal({ title: `Rozmówcy: ${s}`, body: h('div', { class: 'pn-checks' }, boxes), actions: [
      ctx.ui.button({ label: 'Anuluj', onClick: () => m.close() }),
      ctx.ui.button({ label: 'Zapisz', variant: 'primary', onClick: () => { draft.stagePeople[s] = boxes.map((b) => b.querySelector('input')).filter((x) => x.checked).map((x) => x.value); persist({ stagePeople: draft.stagePeople }); m.close(); drawStages(); } }),
    ] });
  }
  drawStages();

  // --- zasady przejścia
  const rulesBody = h('div', null, draft.rules.map((r, i) => h('div', { class: 'b-row pn-rule' },
    h('div', { class: 'b-row-t grow' }, h('b', null, r.title), h('small', null, r.sub)),
    toggle({ checked: r.on, disabled: Boolean(r.locked), label: r.title, onChange: (v) => { draft.rules[i].on = v; persist({ rules: draft.rules }); } }),
  )));
  const rules = panel({ title: 'Zasady przejścia', body: rulesBody, class: 'pn-rules' });

  const saveTpl = h('button', { type: 'button', class: 'pn-saveplan', onClick: () => {
    setDraft({ savedAsTemplate: true });
    toast(`Szablon „${draft.title}” zapisany. Znajdziesz go w bibliotece po utworzeniu stanowiska.`, 'good');
  } },
    h('b', null, 'Zapisz jako szablon'),
    h('small', null, `Użyjesz go przy kolejnym stanowisku w zespole ${draft.department || 'firmy'}.`),
  );

  async function create() {
    next.setBusy(true); back.disabled = true;
    try {
      // rubryka z szablonu (jeśli etap wskazuje tpl:) — tworzymy ją teraz
      const stageRubrics = { ...draft.stageRubrics };
      for (const [stage, ref] of Object.entries(stageRubrics)) {
        if (String(ref).startsWith('tpl:')) {
          const t = TEMPLATES.find((x) => x.key === ref.slice(4));
          if (!t) { delete stageRubrics[stage]; continue; }
          const existing = rubrics.find((r) => r.name === t.rubricName);
          const r = existing || await ctx.store.rubrics.create({ name: t.rubricName, questions: t.questions });
          if (!existing) setRubricOrigin(r.id, t.name);
          stageRubrics[stage] = r.id;
        }
      }
      const firstRubric = draft.stages.map((s) => stageRubrics[s]).find(Boolean) || null;
      const created = await ctx.store.positions.create({
        title: draft.title, department: draft.department, location: draft.location,
        stages: draft.stages, rubric_id: firstRubric, description: draft.goal,
      });
      setPositionMeta(created.id, {
        form: draft.form, salary: draft.salary, goal: draft.goal, criteria: draft.criteria || [],
        stageRubrics, stagePeople: draft.stagePeople, rules: draft.rules, fromTemplate: draft.templateKey || null,
        team: Array.from(new Set(Object.values(draft.stagePeople).flat().concat(draft.stages.flatMap(PEOPLE_BY_STAGE)))),
      });
      clearDraft();
      toast(`Stanowisko „${created.title}” utworzone. Teraz zespół.`, 'good');
      ctx.navigate(`#/positions/${encodeURIComponent(created.id)}/team`);
    } catch (err) {
      console.error('[position-new] create:', err);
      toast((err && err.message) || 'Nie udało się utworzyć stanowiska. Spróbuj ponownie.', 'bad');
      next.setBusy(false); back.disabled = false;
    }
  }

  root.append(
    pageHead({ crumbs: [{ label: 'Stanowiska', href: '#/positions' }, { label: 'Nowe stanowisko' }], title: draft.title, actions: [back, next] }),
    wizardSteps(2, ['#/positions/new?krok=1']),
    h('div', { class: 'b-two' },
      h('div', { class: 'col-3 pn-stages-col' }, list, addStage),
      h('div', { class: 'col-2 b-stack' }, rules, saveTpl),
    ),
  );
  return root;
}

function qCount(qs) {
  const n = Array.isArray(qs) ? qs.length : 0;
  if (n === 1) return '1 pytanie';
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) return `${n} pytania`;
  return `${n} pytań`;
}
function minutes(qs) { return (Array.isArray(qs) ? qs : []).reduce((s, q) => s + (Number(q.minutes) || 0), 0); }
