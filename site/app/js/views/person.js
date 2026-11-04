/**
 * views/person.js — „Osoba — po zatrudnieniu” (#/people/:id?tab=…), Figma 11:1105 + zakładki
 * 29:3934 (1:1), 29:4159 (Check-iny), 30:4101 (Cele), 30:4335 (Szkolenia).
 *
 *   export default async function render(ctx) -> HTMLElement
 *
 * Zakładki: przeglad | 1-1 | check-iny | cele | szkolenia | z-rekrutacji (query ?tab=), przełączane bez
 * przeładowania widoku (history.replaceState). Dane: views/people-data.js (localStorage). Wszystko, co klikalne,
 * zapisuje: plan 90 dni (zaznaczanie kamieni), agenda 1:1 (odhaczanie, dodawanie), notatki menedżera,
 * rytm check-inów, kluczowe rezultaty i aktualizacje celu, przypisywanie kursów. Sugestie AI są tylko sugestiami.
 */

import * as data from './people-data.js';

const TABS = [
  { key: 'przeglad', label: 'Przegląd' },
  { key: '1-1', label: '1:1' },
  { key: 'check-iny', label: 'Check-iny' },
  { key: 'cele', label: 'Cele' },
  { key: 'szkolenia', label: 'Szkolenia' },
  { key: 'z-rekrutacji', label: 'Z rekrutacji' },
];
const MOOD_LABEL = { 1: 'Źle', 2: 'Słabo', 3: 'OK', 4: 'Dobrze', 5: 'Świetnie' };
const WEEKDAY_OPTIONS = [{ value: 1, label: 'w poniedziałek' }, { value: 2, label: 'we wtorek' }, { value: 3, label: 'w środę' }, { value: 4, label: 'w czwartek' }, { value: 5, label: 'w piątek' }];
const WD_FULL = ['nd', 'pn', 'wt', 'śr', 'czw', 'pt', 'sb'];

export default async function render(ctx) {
  const { h, icon, button, avatar, emptyState, toast, field, modal, confirm, plural } = ctx.ui;
  await Promise.all([ctx.ui.loadCss(new URL('./people.css', import.meta.url)), ctx.ui.loadCss(new URL('./person.css', import.meta.url))]);

  let state = data.load();
  const id = ctx.params.id;
  let person = data.getPerson(state, id);
  if (!person) {
    ctx.setHeader({ title: 'Osoba', crumbs: [{ label: 'Ludzie', href: '#/people' }], width: 'wide' });
    return h('div', { class: 'pp' }, emptyState({ icon: 'user', title: 'Nie znaleźliśmy tej osoby', text: 'Może została usunięta albo link jest nieaktualny.', action: { label: 'Wróć do listy', variant: 'secondary', onClick: () => ctx.navigate('#/people') } }));
  }
  let tab = TABS.some((t) => t.key === ctx.query.tab) ? ctx.query.tab : 'przeglad';
  const first = data.firstName(person.name);
  const mgrFirst = data.firstName(person.manager) || 'menedżer';
  const isFem = /a$/.test(first);

  ctx.setHeader({ title: person.name, crumbs: [{ label: 'Ludzie', href: '#/people' }], width: 'wide' });

  /* --- zapis + odświeżenie --- */
  function commit(fn) { state = data.update(fn); person = data.getPerson(state, id); drawBody(); }

  /* --- nagłówek --- */
  const noteBtn = button({ label: 'Dodaj notatkę', variant: 'secondary', onClick: openNote });
  const planBtn = button({ label: 'Zaplanuj 1:1', variant: 'primary', onClick: openSchedule });
  const head = h('div', { class: 'pp-head pp-person-head' },
    avatar(person.name, 'xl'),
    h('div', { class: 't' }, h('h1', null, person.name), h('p', null, data.personSubtitle(person))),
    h('div', { class: 'actions' }, noteBtn, planBtn),
  );

  /* --- zakładki --- */
  const tabsEl = h('div', { class: 'pp-tabs', role: 'tablist', 'aria-label': 'Sekcje profilu' },
    TABS.map((t) => h('a', { href: `#/people/${encodeURIComponent(id)}?tab=${t.key}`, role: 'tab', 'aria-selected': String(t.key === tab), id: `tab-${t.key}`, 'aria-controls': 'pp-tabpanel', tabindex: t.key === tab ? '0' : '-1',
      on: { click: (e) => { e.preventDefault(); setTab(t.key); }, keydown: (e) => onTabKey(e, t.key) } }, t.label)));
  const body = h('div', { class: 'pp-body', id: 'pp-tabpanel', role: 'tabpanel' });
  const root = h('div', { class: 'pp pp-person' }, head, tabsEl, body);

  function setTab(key, focus = false) {
    tab = key;
    for (const a of tabsEl.querySelectorAll('[role="tab"]')) {
      const on = a.id === `tab-${key}`;
      a.setAttribute('aria-selected', String(on)); a.tabIndex = on ? 0 : -1;
      if (on && focus) a.focus();
    }
    body.setAttribute('aria-labelledby', `tab-${key}`);
    try { history.replaceState(null, '', `#/people/${encodeURIComponent(id)}${key === 'przeglad' ? '' : `?tab=${key}`}`); } catch { /* bez znaczenia */ }
    drawBody();
  }
  function onTabKey(e, key) {
    const i = TABS.findIndex((t) => t.key === key);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); setTab(TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length].key, true); }
    if (e.key === 'Home') { e.preventDefault(); setTab(TABS[0].key, true); }
    if (e.key === 'End') { e.preventDefault(); setTab(TABS[TABS.length - 1].key, true); }
  }

  function drawBody() {
    const views = { przeglad: tabOverview, '1-1': tabOneOnOne, 'check-iny': tabCheckins, cele: tabGoals, szkolenia: tabCourses, 'z-rekrutacji': tabRecruitment };
    body.replaceChildren(views[tab]());
  }

  /* ---------------------------------------------------------------- elementy wspólne */
  function panel(title, right, ...children) {
    return h('section', { class: 'pp-panel', 'aria-label': typeof title === 'string' ? title : undefined },
      h('div', { class: 'pp-panel-h' }, h('h2', null, title), right === null || right === undefined ? null : (right instanceof Node ? right : h('span', null, right))),
      children);
  }
  function badge(text, tone = '') { return h('span', { class: `pp-badge ${tone}` }, text); }
  function bar(pct, tone = '', width) { return h('span', { class: `pp-bar ${tone}`, style: width ? `width:${width}` : null, role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('i', { style: `width:${Math.max(0, Math.min(100, pct))}%` })); }
  function checkbox(checked, label, onToggle) {
    const b = h('button', { type: 'button', class: `pp-check${checked ? ' on' : ''}`, role: 'checkbox', 'aria-checked': String(checked), 'aria-label': label, on: { click: onToggle } }, checked ? icon('check', 12) : null);
    return b;
  }
  function moodTone(m) { return m >= 4 ? 'good' : m === 3 ? 'warn' : 'bad'; }
  function moodSquares(m) {
    return h('span', { class: 'pp-mood', 'aria-hidden': 'true' }, [1, 2, 3, 4, 5].map((i) => h('i', { class: i <= m ? moodTone(m) : '' })));
  }
  function moodChart(entries, unit, cls) {
    if (!entries.length) return h('div', { class: `pp-chart ${cls} is-empty` }, h('span', { class: 'pp-cap' }, 'Jeszcze bez check-inów.'));
    return h('div', { class: `pp-chart ${cls}`, role: 'img', 'aria-label': `Nastrój w kolejnych tygodniach: ${entries.map((e) => `${e.mood}/5`).join(', ')}` },
      entries.map((e, i) => h('i', { class: i === entries.length - 1 ? 'last' : e.mood <= 2 ? 'bad' : e.mood === 3 ? 'warn' : '', style: `height:${e.mood * unit}px`, title: `${data.fmtWeekday(e.date)}: ${e.mood}/5` })));
  }
  function nextLabel(next, { short = false } = {}) {
    if (!next || !next.date) return 'Nie zaplanowano';
    const d = new Date(next.date);
    const wd = WD_FULL[d.getDay()];
    const day = `${wd} ${data.fmtDay(next.date)}`;
    const cap = day.charAt(0).toUpperCase() + day.slice(1);
    return short ? `${day}, ${data.fmtTime(next.date)}` : `${cap} · ${data.fmtTime(next.date)} · ${next.minutes || 30} min`;
  }

  /* ---------------------------------------------------------------- Przegląd */
  function tabOverview() {
    const day = data.personDay(person);
    const o = person.oneOnOne || {};
    const next = o.next;
    const series = data.moodSeries(person, 8);
    const last = series[series.length - 1];
    const courses = (person.courses || []).slice(0, 2);
    const cc = data.courseCounts(person);
    const r = person.recruitment;

    const plan = panel('Plan 90 dni', day <= 90 ? `Dzień ${day} z 90` : `Dzień ${day} · plan zamknięty`,
      h('div', { class: 'pp-timeline', role: 'list' }, (person.plan90 || []).map((m, i, arr) => {
        const nextDone = arr[i + 1] ? arr[i + 1].done : false;
        return h('button', { type: 'button', class: `pp-ms${m.done ? ' done' : ''}`, role: 'listitem', 'aria-pressed': String(m.done), title: m.done ? 'Kliknij, aby cofnąć' : 'Kliknij, aby oznaczyć jako zrobione',
          on: { click: () => commit((s) => { const p = data.getPerson(s, id); p.plan90[i].done = !p.plan90[i].done; }) } },
          h('span', { class: 'dotrow', 'aria-hidden': 'true' }, h('i', { class: 'dot' }), i < arr.length - 1 ? h('i', { class: `line${nextDone ? ' on' : ''}` }) : null),
          h('b', null, `Dzień ${m.day}`), h('small', null, m.label));
      })));

    const agendaRows = (o.agenda || []).slice(0, 3).map((a) => h('div', { class: 'pp-agenda-item' },
      checkbox(a.done, `${a.text} — ${a.done ? 'zrobione' : 'do omówienia'}`, () => toggleAgenda(a.id)),
      h('span', { class: `txt${a.done ? ' done' : ''}` }, a.text), h('small', null, a.by)));
    const oneOnOne = panel(`Najbliższe 1:1${next ? ` · ${nextLabel(next, { short: true })}` : ''}`, next ? next.cadence : h('button', { type: 'button', class: 'link', on: { click: openSchedule } }, 'Zaplanuj'),
      h('div', { class: 'pp-agenda' }, agendaRows.length ? agendaRows : h('p', { class: 'pp-cap' }, 'Agenda jest pusta — dodaj punkty w zakładce 1:1.')),
      h('div', { class: 'pp-private' }, data.localIcon('shield'), h('span', null, `Notatki z 1:1 widzą tylko ${first} i ${mgrFirst}.`)));

    const mood = panel('Nastrój w check-inach', `${series.length || 8} tygodni`,
      moodChart(series, 16, 'sm'),
      h('div', { class: 'pp-caption' }, last ? `Ostatni: „${last.summary || last.done || MOOD_LABEL[last.mood]}”` : 'Jeszcze bez check-inów.'));

    const training = panel('Szkolenia', cc.total ? `${plural(cc.active, 'aktywne', 'aktywne', 'aktywnych')}` : 'brak',
      courses.length ? courses.map((c) => h('div', { class: 'pp-course-row' },
        h('b', null, c.title),
        h('div', { class: 'meta' }, h('small', null, `${c.provider} · ${c.progress >= 100 ? 'ukończono' : `do ${data.fmtDay(c.due)}`}`), h('span', { class: 'sp' }),
          c.progress >= 100 && c.reward ? badge(c.reward, c.rewardTone || 'good') : h('span', { class: 'pct' }, `${c.progress}%`)),
        bar(c.progress, c.progress >= 100 ? 'good' : ''),
      )) : h('p', { class: 'pp-cap', style: 'padding:14px 20px' }, 'Nie ma przypisanych kursów.'));

    const recruit = r ? h('a', { class: 'pp-panel pp-recruit', href: `#/people/${encodeURIComponent(id)}?tab=z-rekrutacji`, on: { click: (e) => { e.preventDefault(); setTab('z-rekrutacji'); } } },
      h('div', { class: 't' }, h('b', null, `${isFem ? 'Zatrudniona' : 'Zatrudniony'} z wynikiem ${r.score} / 5`), h('small', null, `Najmocniej: ${r.strongest} · do rozwoju: ${r.growth}`)),
      h('span', { class: 'go' }, 'Zobacz →')) : null;

    return h('div', { class: 'pp-cols' }, h('div', { class: 'pp-col' }, plan, oneOnOne), h('div', { class: 'pp-col' }, mood, training, recruit));
  }

  function toggleAgenda(aid) { commit((s) => { const a = data.getPerson(s, id).oneOnOne.agenda.find((x) => x.id === aid); if (a) a.done = !a.done; }); }

  /* ---------------------------------------------------------------- 1:1 */
  function tabOneOnOne() {
    const o = person.oneOnOne || { agenda: [], history: [] };
    const next = o.next;
    const addRow = h('div', { class: 'pp-add' });
    const showAdd = () => {
      const input = h('input', { type: 'text', class: 'pp-inline-input', placeholder: 'Punkt agendy, np. Plan na grudzień', 'aria-label': 'Nowy punkt agendy', maxlength: '140' });
      const by = h('select', { class: 'pp-inline-select', 'aria-label': 'Kto dodaje' }, [mgrFirst, first].map((n) => h('option', { value: n }, n)));
      const ok = button({ label: 'Dodaj', variant: 'primary', size: 'sm' });
      const cancel = button({ label: 'Anuluj', variant: 'ghost', size: 'sm' });
      const form = h('form', { class: 'pp-add-form', on: { submit: (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (text.length < 3) { input.focus(); toast('Wpisz treść punktu (co najmniej 3 znaki).', 'warn'); return; }
        commit((s) => { data.getPerson(s, id).oneOnOne.agenda.push({ id: data.uid('a'), text, by: by.value, done: false }); });
        toast('Dodaliśmy punkt do wspólnej agendy.', 'good');
      } } }, input, by, ok, cancel);
      cancel.addEventListener('click', () => { addRow.replaceChildren(addBtn); addBtn.focus(); });
      ok.addEventListener('click', () => form.requestSubmit());
      addRow.replaceChildren(form);
      input.focus();
    };
    const addBtn = h('button', { type: 'button', class: 'pp-add-btn', on: { click: showAdd } }, icon('plus'), 'Dodaj punkt');
    addRow.append(addBtn);

    const note = h('textarea', { class: 'pp-note', rows: '3', 'aria-label': 'Notatki menedżera', placeholder: 'Co warto zapamiętać przed kolejnym 1:1?' });
    note.value = o.note || '';
    let noteTimer = null;
    note.addEventListener('input', () => {
      clearTimeout(noteTimer);
      noteTimer = setTimeout(() => { state = data.update((s) => { data.getPerson(s, id).oneOnOne.note = note.value; }); person = data.getPerson(state, id); noteStatus.textContent = 'Zapisano'; }, 500);
      noteStatus.textContent = 'Zapisujemy…';
    });
    const noteStatus = h('span', { class: 'pp-cap', 'aria-live': 'polite' });

    const left = panel(nextLabel(next), next ? [next.cadence, next.tool].filter(Boolean).join(' · ') : h('button', { type: 'button', class: 'link', on: { click: openSchedule } }, 'Zaplanuj'),
      h('div', { class: 'pp-agenda' },
        h('b', { class: 'pp-agenda-t' }, 'Wspólna agenda'),
        (o.agenda || []).length ? o.agenda.map((a) => h('div', { class: 'pp-agenda-item' },
          checkbox(a.done, `${a.text} — ${a.done ? 'zrobione' : 'do omówienia'}`, () => toggleAgenda(a.id)),
          h('span', { class: `txt${a.done ? ' done' : ''}` }, a.text), badge(a.by),
          h('button', { type: 'button', class: 'pp-x', 'aria-label': `Usuń punkt: ${a.text}`, title: 'Usuń', on: { click: () => commit((s) => { const p = data.getPerson(s, id); p.oneOnOne.agenda = p.oneOnOne.agenda.filter((x) => x.id !== a.id); }) } }, icon('x', 14)),
        )) : h('p', { class: 'pp-cap' }, 'Agenda jest pusta. Dodaj pierwszy punkt — zobaczą go oboje.')),
      addRow,
      h('div', { class: 'pp-notes' },
        h('div', { class: 'h' }, data.localIcon('lock'), h('b', null, `Notatki menedżera — widzi je tylko ${mgrFirst}`), noteStatus),
        note),
    );

    const hist = o.history || [];
    const history = panel('Historia 1:1', hist.length ? `${hist.length} z ${hist.length} odbyte` : 'brak',
      hist.length ? hist.map((m) => h('div', { class: 'pp-row pp-meeting' }, h('small', { class: 'd' }, data.fmtDay(m.date)), h('span', { class: 't' }, m.title), h('small', null, plural(m.tasks || 0, 'zadanie', 'zadania', 'zadań'))))
        : h('p', { class: 'pp-cap', style: 'padding:14px 16px' }, 'Pierwsze 1:1 jeszcze się nie odbyło.'));
    const ai = o.ai ? h('div', { class: 'pp-ai' },
      h('div', { class: 'h' }, icon('spark'), h('b', null, 'Sugestia AI na to 1:1')),
      h('p', null, o.ai),
      h('div', { class: 'a' }, button({ label: 'Dodaj do agendy', variant: 'secondary', size: 'sm', onClick: () => { commit((s) => { data.getPerson(s, id).oneOnOne.agenda.push({ id: data.uid('a'), text: o.ai.split(/[.!?]\s/).pop().replace(/\.$/, ''), by: mgrFirst, done: false }); }); toast('Dodaliśmy sugestię do agendy — to Ty decydujesz, czy ją poruszyć.', 'good'); } }),
        h('span', { class: 'pp-cap' }, 'To tylko podpowiedź — decyzja należy do Ciebie.')),
    ) : null;

    return h('div', { class: 'pp-cols' }, h('div', { class: 'pp-col' }, left), h('div', { class: 'pp-col' }, history, ai));
  }

  /* ---------------------------------------------------------------- Check-iny */
  function tabCheckins() {
    const c = person.checkins || { rhythm: { weekday: 5, questions: 5, minutes: 1 }, entries: [], themes: [] };
    const r = c.rhythm || { weekday: 5, questions: 5, minutes: 1 };
    const wd = (WEEKDAY_OPTIONS.find((w) => w.value === Number(r.weekday)) || WEEKDAY_OPTIONS[4]).label;
    const rhythm = h('div', { class: 'pp-rhythm' },
      h('p', null, `Co tydzień ${wd} · ${plural(r.questions || 5, 'pytanie', 'pytania', 'pytań')} · ok. ${r.minutes || 1} min`),
      h('a', { class: 'link pp-cap', href: `#/checkin?person=${encodeURIComponent(id)}`, target: '_blank', rel: 'noopener' }, 'Podgląd formularza'),
      button({ label: 'Zmień rytm', variant: 'secondary', onClick: openRhythm }));

    const entries = (c.entries || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    const list = h('div', { class: 'pp-entries' }, entries.length ? entries.slice(0, 6).map((e) => h('article', { class: 'pp-entry' },
      h('div', { class: 'h' }, h('b', null, data.fmtWeekday(e.date)), moodSquares(e.mood), h('small', null, `Nastrój ${e.mood}/5`)),
      [['Co się udało?', e.done], ['Co Cię blokuje?', e.blocked], ['W czym możemy pomóc?', e.help]].map(([q, a]) => h('div', { class: 'qa' }, h('small', null, q), h('p', null, a || '—'))),
    )) : emptyState({ icon: 'calendar', title: 'Jeszcze bez check-inów', text: `${first} dostanie pierwsze pytania ${wd}. Odpowiedzi widzi tylko ${mgrFirst}.` }));

    const series = data.moodSeries(person, 8);
    const avg = data.moodAvg(series);
    const trend = panel(`Nastrój — ${series.length || 8} tygodni`, `Śr. ${data.fmt1(avg)}`, moodChart(series, 18, 'lg'));
    const themes = panel('Powtarzające się tematy', h('span', { class: 'pp-ai-tag' }, icon('spark', 12), 'AI'),
      h('div', { class: 'pp-themes' }, (c.themes || []).length ? c.themes.map((t) => h('div', { class: 'pp-theme' }, h('span', null, t.text), badge(`${t.count}×`, t.tone === 'neutral' ? '' : t.tone)))
        : h('p', { class: 'pp-cap' }, 'AI wskaże tematy, gdy pojawi się kilka check-inów.')));

    return h('div', { class: 'pp-stack' }, rhythm, h('div', { class: 'pp-cols' }, list, h('div', { class: 'pp-col' }, trend, themes)));
  }

  function openRhythm() {
    const r = (person.checkins && person.checkins.rhythm) || { weekday: 5, questions: 5, minutes: 1 };
    const fDay = field({ label: 'Dzień tygodnia', name: 'weekday', type: 'select', options: WEEKDAY_OPTIONS.map((w) => ({ value: w.value, label: w.label.replace(/^we? /, '').replace(/^./, (x) => x.toUpperCase()) })), value: r.weekday });
    const fQ = field({ label: 'Liczba pytań', name: 'questions', type: 'select', options: [3, 4, 5, 6].map((n) => ({ value: n, label: `${n} (ok. ${n <= 3 ? 1 : n <= 5 ? 1 : 2} min)` })), value: r.questions });
    const save = button({ label: 'Zapisz rytm', variant: 'primary' });
    const m = modal({ title: 'Rytm check-inów', body: h('form', { class: 'pp-form', on: { submit: (e) => { e.preventDefault(); save.click(); } } }, fDay, fQ, h('p', { class: 'pp-cap' }, `${first} dostanie przypomnienie w wybrany dzień rano. Odpowiedzi widzi tylko ${mgrFirst}.`)), actions: [button({ label: 'Anuluj', variant: 'secondary', onClick: () => m.close() }), save] });
    save.addEventListener('click', () => {
      const q = Number(fQ.value);
      commit((s) => { const p = data.getPerson(s, id); p.checkins = p.checkins || { entries: [], themes: [] }; p.checkins.rhythm = { weekday: Number(fDay.value), questions: q, minutes: q <= 5 ? 1 : 2 }; });
      m.close(); toast('Zmieniliśmy rytm check-inów.', 'good');
    });
  }

  /* ---------------------------------------------------------------- Cele */
  function tabGoals() {
    const goals = data.personGoals(state, person);
    if (!goals.length) {
      return emptyState({ icon: 'target', title: `${first} nie ma jeszcze celu`, text: 'Cel osoby łączy się z celem zespołu i firmy — każdy widzi, do czego dokłada się jego praca.', action: { label: 'Dodaj cel', onClick: () => openGoalModal(ctx, { person, onCreated: () => commit(() => {}) }) } });
    }
    return h('div', { class: 'pp-stack' }, goals.map((g) => goalBlock(g)));
  }

  function goalBlock(g) {
    const chain = data.goalChain(state, g);
    const LEVEL = { company: ['Firma', ''], team: ['Zespół', 'info'], person: ['Osoba', 'accent'] };
    const chainEl = panel(`Do czego dokłada się praca ${isFem ? first.replace(/a$/, 'y') : first}`, null,
      h('div', { class: 'pp-levels' }, chain.map((x, i) => h('div', { class: `pp-level lvl-${i}${x.id === g.id ? ' me' : ''}` },
        i === 0 ? icon('target') : h('span', { class: 'conn', 'aria-hidden': 'true' }),
        badge(LEVEL[x.level][0], LEVEL[x.level][1]),
        h('span', { class: 't' }, x.id === g.id && g.short ? g.short : x.title),
        avatar(x.owner, 'sm'),
        bar(x.progress, x.tone || '', '120px'),
        h('span', { class: 'pct' }, `${x.progress}%`)))));

    const krs = g.krs || [];
    const STATUS_TONE = { 'Zrobione': 'good', 'W toku': '', 'Do zrobienia': '', 'Zagrożone': 'warn' };
    const krPanel = panel('Kluczowe rezultaty', h('span', null, `Termin: ${data.fmtDay(g.due)}`),
      krs.length ? krs.map((k) => h('div', { class: 'pp-kr' },
        h('div', { class: 'h' }, h('b', null, k.text), badge(k.status, STATUS_TONE[k.status] || ''),
          h('button', { type: 'button', class: 'pp-kr-edit btn btn-ghost btn-sm', 'aria-label': `Aktualizuj: ${k.text}`, on: { click: () => openKr(g.id, k.id) } }, icon('edit', 14))),
        h('div', { class: 'm' }, bar(k.progress, k.status === 'Zrobione' ? 'good' : ''), h('small', null, k.meta || `${k.progress}%`)),
      )) : h('p', { class: 'pp-cap', style: 'padding:14px 20px' }, 'Dodaj pierwszy kluczowy rezultat.'),
      h('div', { class: 'pp-add' }, h('button', { type: 'button', class: 'pp-add-btn', on: { click: () => openKr(g.id, null) } }, icon('plus'), 'Dodaj rezultat')));

    const ups = (g.updates || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    const updates = panel('Aktualizacje', button({ label: 'Dodaj', variant: 'secondary', size: 'sm', icon: 'plus', onClick: () => openUpdate(g.id) }),
      ups.length ? ups.map((u) => h('div', { class: 'pp-update' }, h('small', null, data.fmtDay(u.date)), h('p', null, u.text)))
        : h('p', { class: 'pp-cap', style: 'padding:14px 16px' }, 'Jeszcze bez aktualizacji.'));

    return h('div', { class: 'pp-stack' }, chainEl, h('div', { class: 'pp-cols' }, krPanel, updates));
  }

  function openKr(goalId, krId) {
    const g = state.goals.find((x) => x.id === goalId);
    const k = krId ? (g.krs || []).find((x) => x.id === krId) : null;
    const fText = field({ label: 'Rezultat', name: 'text', value: k ? k.text : '', required: true, placeholder: 'np. p95 API prognoz < 500 ms' });
    const fStatus = field({ label: 'Status', name: 'status', type: 'select', options: ['Do zrobienia', 'W toku', 'Zagrożone', 'Zrobione'], value: k ? k.status : 'W toku' });
    const fProgress = field({ label: 'Postęp (%)', name: 'progress', type: 'number', min: 0, max: 100, step: 10, value: k ? k.progress : 0 });
    const fMeta = field({ label: 'Miara', name: 'meta', value: k ? k.meta : '', placeholder: 'np. 620 ms → cel 500 ms', hint: 'Krótko: gdzie jesteśmy wobec celu.' });
    const save = button({ label: k ? 'Zapisz zmiany' : 'Dodaj rezultat', variant: 'primary' });
    const m = modal({ title: k ? 'Aktualizuj rezultat' : 'Nowy kluczowy rezultat', body: h('form', { class: 'pp-form', on: { submit: (e) => { e.preventDefault(); save.click(); } } }, fText, h('div', { class: 'form-row' }, fStatus, fProgress), fMeta), actions: [button({ label: 'Anuluj', variant: 'secondary', onClick: () => m.close() }), save] });
    save.addEventListener('click', () => {
      if (fText.value.trim().length < 3) { fText.setError('Opisz rezultat.'); fText.input.focus(); return; }
      let pr = Math.max(0, Math.min(100, Number(fProgress.value) || 0));
      if (fStatus.value === 'Zrobione') pr = 100;
      commit((s) => {
        const gg = s.goals.find((x) => x.id === goalId); gg.krs = gg.krs || [];
        if (k) { const kk = gg.krs.find((x) => x.id === krId); Object.assign(kk, { text: fText.value.trim(), status: fStatus.value, progress: pr, meta: fMeta.value.trim() }); }
        else gg.krs.push({ id: data.uid('k'), text: fText.value.trim(), status: fStatus.value, progress: pr, meta: fMeta.value.trim() });
        gg.progress = Math.round(gg.krs.reduce((a, x) => a + x.progress, 0) / gg.krs.length);
      });
      m.close(); toast(k ? 'Zapisaliśmy rezultat. Postęp celu przeliczony.' : 'Dodaliśmy rezultat.', 'good');
    });
  }

  function openUpdate(goalId) {
    const g = state.goals.find((x) => x.id === goalId);
    const fText = field({ label: 'Co się zmieniło?', name: 'text', type: 'textarea', rows: 3, placeholder: 'np. Staging: p95 0,52 s po migracji.', required: true });
    const fProgress = field({ label: 'Postęp celu (%)', name: 'progress', type: 'number', min: 0, max: 100, step: 5, value: g.progress });
    const save = button({ label: 'Dodaj aktualizację', variant: 'primary' });
    const m = modal({ title: 'Aktualizacja celu', body: h('form', { class: 'pp-form', on: { submit: (e) => { e.preventDefault(); save.click(); } } }, fText, fProgress), actions: [button({ label: 'Anuluj', variant: 'secondary', onClick: () => m.close() }), save] });
    save.addEventListener('click', () => {
      if (fText.value.trim().length < 3) { fText.setError('Napisz, co się zmieniło.'); fText.input.focus(); return; }
      commit((s) => { const gg = s.goals.find((x) => x.id === goalId); gg.updates = gg.updates || []; gg.updates.unshift({ date: data.today(), text: fText.value.trim() }); gg.progress = Math.max(0, Math.min(100, Number(fProgress.value) || 0)); });
      m.close(); toast('Dodaliśmy aktualizację.', 'good');
    });
  }

  /* ---------------------------------------------------------------- Szkolenia */
  function tabCourses() {
    const courses = person.courses || [];
    const barEl = h('div', { class: 'pp-rhythm' },
      h('p', null, 'Kursy to krótkie, codzienne powtórki (2–3 min), a nie wideo, którego nikt nie kończy.'),
      button({ label: 'Przypisz kurs', variant: 'primary', onClick: openCourse }));
    const grid = h('div', { class: 'pp-courses' }, courses.length ? courses.map((c) => {
      const done = c.progress >= 100;
      return h('article', { class: 'pp-course' },
        h('span', { class: `ic${done ? ' good' : ''}`, 'aria-hidden': 'true' }, done ? icon('check') : data.localIcon('book')),
        h('h3', null, c.title),
        h('small', null, [c.provider, c.units].filter(Boolean).join(' · ')),
        bar(c.progress, done ? 'good' : ''),
        h('div', { class: 'm' }, h('small', null, `${c.progress}% · ${done ? `ukończono ${data.fmtDay(c.completed)}` : `do ${data.fmtDay(c.due)}`}`), c.reward ? badge(c.reward, c.rewardTone || '') : null),
        h('div', { class: 'a' },
          done ? null : h('a', { class: 'btn btn-secondary btn-sm', href: `#/course-review?person=${encodeURIComponent(id)}&course=${encodeURIComponent(c.id)}`, target: '_blank', rel: 'noopener' }, 'Otwórz powtórkę'),
          h('button', { type: 'button', class: 'btn btn-ghost btn-sm', on: { click: () => removeCourse(c) } }, 'Usuń')),
      );
    }) : emptyState({ icon: 'rubric', title: 'Nie ma przypisanych kursów', text: 'Przypisz kurs — codzienne powtórki zaczną się następnego dnia rano.' }));
    const st = person.streak || { days: 0, pattern: [] };
    const streak = h('div', { class: 'pp-panel pp-streak' },
      h('div', { class: 't' }, h('b', null, st.days ? `Seria: ${plural(st.days, 'dzień', 'dni', 'dni')} z rzędu` : 'Bez serii — pierwsza powtórka czeka'),
        h('small', null, st.best || st.toReview ? `Najlepiej zapamiętane: ${st.best || '—'} · do powtórki: ${st.toReview || '—'}` : 'Statystyki pojawią się po pierwszych powtórkach.')),
      h('div', { class: 'days', role: 'img', 'aria-label': `Ostatnie 14 dni: ${(st.pattern || []).filter(Boolean).length} z 14 z powtórką` }, (st.pattern || new Array(14).fill(0)).map((x) => h('i', { class: x ? 'on' : '' }))));
    return h('div', { class: 'pp-stack' }, barEl, grid, streak);
  }

  async function removeCourse(c) {
    if (!(await confirm({ title: 'Usunąć kurs?', text: `„${c.title}” zniknie z listy ${first}. Postęp nie wróci.`, confirmLabel: 'Usuń kurs', danger: true }))) return;
    commit((s) => { const p = data.getPerson(s, id); p.courses = p.courses.filter((x) => x.id !== c.id); });
    toast('Usunęliśmy kurs.', 'neutral');
  }

  function openCourse() {
    const CATALOG = ['Projektowanie systemów przetwarzających dane', 'Certyfikacja incident commandera', 'Go: wydajność i profilowanie', 'Research z klientami B2B', 'Rozmowy o odnowieniu umowy', 'Bezpieczeństwo i RODO w praktyce', 'Inny (wpisz niżej)'];
    const fPick = field({ label: 'Kurs z biblioteki', name: 'pick', type: 'select', options: CATALOG, value: CATALOG[0] });
    const fTitle = field({ label: 'Własna nazwa', name: 'title', placeholder: 'np. Onboarding do Kafki' });
    const fProvider = field({ label: 'Źródło', name: 'provider', type: 'select', options: ['Nordlight Academy', 'Kurs wewnętrzny', 'Klub książki'], value: 'Nordlight Academy' });
    const fUnits = field({ label: 'Liczba powtórek', name: 'units', type: 'number', min: 1, max: 60, value: 10 });
    const fDue = field({ label: 'Termin', name: 'due', type: 'date', value: data.daysFrom(45) });
    const fReward = field({ label: 'Nagroda po ukończeniu', name: 'reward', placeholder: 'np. Voucher 30 €', hint: 'Opcjonalnie.' });
    const save = button({ label: 'Przypisz kurs', variant: 'primary' });
    const m = modal({ title: `Przypisz kurs — ${first}`, body: h('form', { class: 'pp-form', on: { submit: (e) => { e.preventDefault(); save.click(); } } }, fPick, fTitle, h('div', { class: 'form-row' }, fProvider, fUnits), h('div', { class: 'form-row' }, fDue, fReward)), actions: [button({ label: 'Anuluj', variant: 'secondary', onClick: () => m.close() }), save] });
    save.addEventListener('click', () => {
      const title = fPick.value.startsWith('Inny') ? fTitle.value.trim() : fPick.value;
      if (title.length < 3) { fTitle.setError('Podaj nazwę kursu.'); fTitle.input.focus(); return; }
      const n = Math.max(1, Number(fUnits.value) || 10);
      commit((s) => { const p = data.getPerson(s, id); p.courses = p.courses || []; p.courses.push({ id: data.uid('c'), title, provider: fProvider.value, units: plural(n, 'powtórka', 'powtórki', 'powtórek'), progress: 0, due: fDue.value || data.daysFrom(45), reward: fReward.value.trim() || '', rewardTone: 'neutral' }); });
      m.close(); toast(`Przypisaliśmy kurs. ${first} dostanie pierwszą powtórkę jutro rano.`, 'good');
    });
  }

  /* ---------------------------------------------------------------- Z rekrutacji */
  function tabRecruitment() {
    const r = person.recruitment;
    if (!r) return emptyState({ icon: 'rubric', title: 'Brak danych z rekrutacji', text: `${first} ${isFem ? 'została dodana' : 'został dodany'} ręcznie, bez karty oceny z lejka.`, action: { label: 'Przejdź do kandydatów', variant: 'secondary', onClick: () => ctx.navigate('#/candidates?status=hired') } });
    return h('div', { class: 'pp-cols' },
      panel(`${isFem ? 'Zatrudniona' : 'Zatrudniony'} z wynikiem ${r.score} / 5`, h('a', { class: 'link', href: '#/candidates?status=hired' }, 'Zobacz kartę oceny →'),
        h('dl', { class: 'pp-dl' },
          h('div', null, h('dt', null, 'Stanowisko'), h('dd', null, r.position)),
          h('div', null, h('dt', null, 'Decyzja o zatrudnieniu'), h('dd', null, data.fmtDay(r.hiredOn))),
          h('div', null, h('dt', null, 'Najmocniej'), h('dd', null, r.strongest)),
          h('div', null, h('dt', null, 'Do rozwoju'), h('dd', null, r.growth)),
          h('div', null, h('dt', null, 'Etapy'), h('dd', null, `${r.stages} rozmów`)),
          h('div', null, h('dt', null, 'Rozmówcy'), h('dd', null, (r.raters || []).join(', '))),
        )),
      h('div', { class: 'pp-ai' }, h('div', { class: 'h' }, icon('spark'), h('b', null, 'Sugestia AI na plan rozwoju')),
        h('p', null, `Obszar „${r.growth}” wrócił w ocenie po rozmowach. Zaproponuj w pierwszym 1:1 po przeglądzie 90 dni jeden projekt, w którym ${first} poprowadzi innych.`),
        h('span', { class: 'pp-cap' }, 'Ocena i decyzje należą do ludzi — AI tylko podpowiada.')),
    );
  }

  /* ---------------------------------------------------------------- okna z nagłówka */
  function openNote() {
    const fText = field({ label: `Notatka (widzi ją tylko ${mgrFirst})`, name: 'note', type: 'textarea', rows: 4, placeholder: 'np. Zaproponować prowadzenie postmortemu.', required: true });
    const save = button({ label: 'Zapisz notatkę', variant: 'primary' });
    const m = modal({ title: `Dodaj notatkę — ${first}`, body: h('form', { class: 'pp-form', on: { submit: (e) => { e.preventDefault(); save.click(); } } }, fText, h('p', { class: 'pp-cap' }, 'Notatka trafi do prywatnych notatek menedżera w zakładce 1:1.')), actions: [button({ label: 'Anuluj', variant: 'secondary', onClick: () => m.close() }), save] });
    save.addEventListener('click', () => {
      const t = fText.value.trim();
      if (t.length < 2) { fText.setError('Wpisz treść notatki.'); fText.input.focus(); return; }
      commit((s) => { const o = data.getPerson(s, id).oneOnOne; o.note = [o.note, `${data.fmtDay(data.today())}: ${t}`].filter(Boolean).join('\n'); });
      m.close(); toast('Zapisaliśmy notatkę.', 'good');
    });
  }

  function openSchedule() {
    const next = (person.oneOnOne && person.oneOnOne.next) || {};
    const base = next.date ? new Date(next.date) : new Date(Date.now() + 2 * 86400000);
    const fDate = field({ label: 'Data', name: 'date', type: 'date', value: data.iso(base), required: true });
    const fTime = field({ label: 'Godzina', name: 'time', type: 'time', value: next.date ? data.fmtTime(next.date) : '10:00', required: true });
    const fMin = field({ label: 'Długość', name: 'minutes', type: 'select', options: [{ value: 30, label: '30 min' }, { value: 45, label: '45 min' }, { value: 60, label: '60 min' }], value: next.minutes || 30 });
    const fCad = field({ label: 'Powtarzanie', name: 'cadence', type: 'select', options: ['Co tydzień', 'Co 2 tygodnie', 'Co miesiąc', 'Jednorazowo'], value: next.cadence || 'Co 2 tygodnie' });
    const fTool = field({ label: 'Gdzie', name: 'tool', type: 'select', options: ['Google Meet', 'Teams', 'Biuro'], value: next.tool || 'Google Meet' });
    const save = button({ label: 'Zaplanuj', variant: 'primary' });
    const m = modal({ title: `Zaplanuj 1:1 z ${first}`, body: h('form', { class: 'pp-form', on: { submit: (e) => { e.preventDefault(); save.click(); } } }, h('div', { class: 'form-row' }, fDate, fTime), h('div', { class: 'form-row' }, fMin, fCad), fTool, h('p', { class: 'pp-cap' }, `Zaproszenie dostaną ${first} i ${mgrFirst}. Agenda jest wspólna, notatki menedżera — prywatne.`)), actions: [button({ label: 'Anuluj', variant: 'secondary', onClick: () => m.close() }), save] });
    save.addEventListener('click', () => {
      if (!fDate.value || !fTime.value) { (fDate.value ? fTime : fDate).setError('Uzupełnij termin.'); return; }
      commit((s) => { const o = data.getPerson(s, id).oneOnOne; o.next = { date: `${fDate.value}T${fTime.value}`, minutes: Number(fMin.value), cadence: fCad.value, tool: fTool.value }; });
      m.close(); toast(`Zaplanowaliśmy 1:1: ${nextLabel(person.oneOnOne.next)}.`, 'good');
    });
  }

  drawBody();
  return root;
}

/* ================================================================== okno „Dodaj cel” (używa go też widok Cele) */
export function openGoalModal(ctx, { person, parentId, onCreated } = {}) {
  const { h, field, button, modal, toast } = ctx.ui;
  const s = data.load();
  const parents = s.goals.filter((g) => g.level !== 'person');
  const fLevel = field({ label: 'Poziom', name: 'level', type: 'select', options: [{ value: 'company', label: 'Firma' }, { value: 'team', label: 'Zespół' }, { value: 'person', label: 'Osoba' }], value: person ? 'person' : 'team' });
  const fParent = field({ label: 'Cel nadrzędny', name: 'parent', type: 'select', options: [{ value: '', label: '— brak —' }, ...parents.map((g) => ({ value: g.id, label: `${g.level === 'company' ? 'Firma' : 'Zespół'} · ${g.title}` }))], value: parentId || (person ? (parents.find((g) => g.level === 'team') || {}).id || '' : '') });
  const fTitle = field({ label: 'Cel', name: 'title', required: true, placeholder: person ? `${data.firstName(person.name)}: np. p95 poniżej 500 ms` : 'np. Sprzedaż: 3 nowych operatorów' });
  const fOwner = field({ label: 'Właściciel', name: 'owner', value: person ? person.name : '', required: true, placeholder: 'Imię i nazwisko' });
  const fDue = field({ label: 'Termin', name: 'due', type: 'date', value: data.daysFrom(60), required: true });
  const save = button({ label: 'Dodaj cel', variant: 'primary' });
  const form = h('form', { class: 'pp-form', on: { submit: (e) => { e.preventDefault(); save.click(); } } }, h('div', { class: 'form-row' }, fLevel, fParent), fTitle, h('div', { class: 'form-row' }, fOwner, fDue),
    h('p', { class: 'pp-cap' }, 'Postęp celu liczymy z kluczowych rezultatów — dodasz je w profilu osoby.'));
  const m = modal({ title: 'Nowy cel', body: form, actions: [button({ label: 'Anuluj', variant: 'secondary', onClick: () => m.close() }), save] });
  const syncParent = () => { fParent.input.disabled = fLevel.value === 'company'; if (fLevel.value === 'company') fParent.value = ''; };
  fLevel.input.addEventListener('change', syncParent); syncParent();
  save.addEventListener('click', () => {
    let bad = null;
    if (fTitle.value.trim().length < 3) { fTitle.setError('Nazwij cel.'); bad ||= fTitle; }
    if (fOwner.value.trim().length < 2) { fOwner.setError('Podaj właściciela.'); bad ||= fOwner; }
    if (!fDue.value) { fDue.setError('Podaj termin.'); bad ||= fDue; }
    if (bad) { bad.input.focus(); return; }
    const goal = { id: data.uid('g'), level: fLevel.value, parent: fParent.value || undefined, title: fTitle.value.trim(), owner: fOwner.value.trim(), progress: 0, due: fDue.value, krs: [], updates: [] };
    if (fLevel.value === 'person') { const p = s.people.find((x) => x.name === goal.owner); if (p) goal.person = p.id; }
    data.update((st) => { st.goals.push(goal); });
    toast('Dodaliśmy cel.', 'good');
    m.close();
    if (onCreated) onCreated(goal);
  });
  return m;
}
