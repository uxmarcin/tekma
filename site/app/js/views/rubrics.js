/**
 * views/rubrics.js — rubryki ocen.
 *   #/rubrics        lista: nazwa, wersja, liczba pytań, gdzie używana, ostatnia aktualizacja; „Nowa rubryka”
 *   #/rubrics/new    edytor nowej rubryki  → store.rubrics.create({name, questions})
 *   #/rubrics/:id    edytor istniejącej    → store.rubrics.update(id, {name, questions})
 *
 * Edytor: nazwa; pytania (treść, kompetencja, waga 1–3, minuty, kotwice 1–5); dodawanie, usuwanie,
 * zmiana kolejności; walidacja po polsku; wersja rośnie, gdy zmieniły się pytania (pokazujemy to przed zapisem);
 * ostrzeżenie o niezapisanych zmianach (linki w aplikacji + zamknięcie karty).
 * export default async function render(ctx) -> HTMLElement
 */

const ANCHOR_KEYS = ['1', '2', '3', '4', '5'];
const ANCHOR_HINT = { 1: 'Poziom najniższy', 2: 'Poniżej oczekiwań', 3: 'Spełnia oczekiwania', 4: 'Powyżej oczekiwań', 5: 'Wybitnie' };

export default async function render(ctx) {
  await ctx.ui.loadCss(new URL('./rubrics.css', import.meta.url));
  if (ctx.params && ctx.params.id) return renderEditor(ctx, ctx.params.id);
  return renderList(ctx);
}

/* ============================================================ lista */
async function renderList(ctx) {
  const { h, button, icon, emptyState, formatDate, plural } = ctx.ui;
  const [rubrics, positions] = await Promise.all([ctx.store.rubrics.list(), ctx.store.positions.list().catch(() => [])]);
  // tytuł i akcja główna żyją w pasku górnym routera (desktop i mobile)
  ctx.setHeader({ title: 'Rubryki', width: 'wide', actions: [button({ label: 'Nowa rubryka', variant: 'primary', icon: 'plus', onClick: () => ctx.navigate('#/rubrics/new') })] });

  const usedIn = (r) => positions.filter((p) => p.rubric_id === r.id);
  const root = h('div', { class: 'rb' });
  root.append(h('p', { class: 'page-lead' }, 'Ta sama miara dla każdego kandydata: pytania, wagi i kotwice ocen 1–5. Każda zmiana pytań tworzy nową wersję.'));

  if (!rubrics.length) {
    root.append(emptyState({
      icon: 'rubric', title: 'Nie masz jeszcze rubryk',
      text: 'Rubryka to lista pytań z wagami i opisami ocen 1–5. Dzięki niej każdy rozmówca ocenia tak samo.',
      action: { label: 'Utwórz pierwszą rubrykę', icon: 'plus', onClick: () => ctx.navigate('#/rubrics/new') },
    }));
    return root;
  }

  const list = h('div', { class: 'list rb-list', role: 'list' });
  for (const r of rubrics) {
    const qs = Array.isArray(r.questions) ? r.questions : [];
    const used = usedIn(r);
    const minutes = qs.reduce((s, q) => s + (Number(q.minutes) || 0), 0);
    list.append(h('a', { class: 'row rb-row', href: `#/rubrics/${r.id}`, role: 'listitem', 'aria-label': `${r.name}, wersja ${r.version || 1}` },
      h('span', { class: 'rb-glyph', 'aria-hidden': 'true' }, icon('rubric', 18)),
      h('div', { class: 't' },
        h('b', null, r.name),
        h('small', null,
          `${plural(qs.length, 'pytanie', 'pytania', 'pytań')}`,
          minutes ? ` · ok. ${minutes} min` : '',
          used.length ? ` · ${used.map((p) => p.title).join(', ')}` : ' · nieprzypisana do stanowiska'),
      ),
      h('span', { class: 'tag neutral rb-ver' }, `v${r.version || 1}`),
      h('time', { datetime: r.updated_at || '' }, r.updated_at ? `aktualizacja ${formatDate(r.updated_at, { relative: true })}` : ''),
      icon('chevron-right', 16),
    ));
  }
  root.append(h('div', { class: 'card rb-card' }, list));
  return root;
}

/* ============================================================ edytor */
async function renderEditor(ctx, id) {
  const { h, button, field, icon, confirm, toast, formError, formatDate, plural } = ctx.ui;
  const isNew = id === 'new';
  let rubric = null;
  if (!isNew) {
    rubric = await ctx.store.rubrics.get(id);
    if (!rubric) {
      ctx.setHeader({ title: 'Rubryka', crumbs: [{ label: 'Rubryki', href: '#/rubrics' }], width: 'narrow' });
      return ctx.ui.emptyState({
        icon: 'rubric', title: 'Nie znaleziono rubryki',
        text: 'Ta rubryka nie istnieje albo została usunięta. Wróć do listy i wybierz inną.',
        action: { label: 'Wróć do rubryk', onClick: () => ctx.navigate('#/rubrics') },
      });
    }
  }
  const positions = await ctx.store.positions.list().catch(() => []);
  const usedIn = rubric ? positions.filter((p) => p.rubric_id === rubric.id) : [];

  /* ---------- stan formularza ---------- */
  let keySeq = 0;
  const newQuestion = (q = {}) => ({
    _key: `k${++keySeq}`, id: q.id || null,
    text: q.text || '', competency: q.competency || '',
    weight: [1, 2, 3].includes(Number(q.weight)) ? Number(q.weight) : 2,
    minutes: Number(q.minutes) || 10,
    anchors: Object.fromEntries(ANCHOR_KEYS.map((k) => [k, (q.anchors && (q.anchors[k] ?? q.anchors[Number(k)])) || ''])),
    _open: !q.id, // nowe pytanie: kotwice od razu rozwinięte
  });
  const form = {
    name: rubric ? rubric.name : '',
    questions: rubric && Array.isArray(rubric.questions) && rubric.questions.length ? rubric.questions.map(newQuestion) : [newQuestion()],
  };
  const normalizeQ = (q) => ({ id: q.id, text: q.text.trim(), competency: q.competency.trim(), weight: q.weight, minutes: Number(q.minutes) || 10, anchors: Object.fromEntries(ANCHOR_KEYS.map((k) => [k, (q.anchors[k] || '').trim()])) });
  const snapshot = () => JSON.stringify({ name: form.name.trim(), questions: form.questions.map(normalizeQ) });
  const questionsSnapshot = () => JSON.stringify(form.questions.map(normalizeQ));
  let savedSnapshot = isNew ? null : snapshot();
  let savedQuestions = isNew ? null : questionsSnapshot();
  const isDirty = () => (isNew ? form.name.trim() !== '' || form.questions.some((q) => q.text.trim() || q.competency.trim() || ANCHOR_KEYS.some((k) => q.anchors[k].trim())) : snapshot() !== savedSnapshot);
  const questionsChanged = () => !isNew && questionsSnapshot() !== savedQuestions;

  /* ---------- elementy ---------- */
  const root = h('div', { class: 'rb rb-editor' });
  const errorSlot = h('div', { class: 'rb-errors' });
  const nameField = field({ label: 'Nazwa rubryki', name: 'name', value: form.name, required: true, placeholder: 'np. Backend — rozmowa techniczna', hint: 'Nazwa pomaga odróżnić rubryki dla różnych stanowisk i etapów.', autocomplete: 'off' });
  nameField.input.addEventListener('input', () => { form.name = nameField.value; refreshMeta(); });
  const metaEl = h('div', { class: 'rb-meta' });
  const listEl = h('ol', { class: 'rb-qlist', 'aria-label': 'Pytania rubryki' });
  const addBtn = button({ label: 'Dodaj pytanie', variant: 'secondary', icon: 'plus', onClick: () => { form.questions.push(newQuestion()); renderQuestions(); focusQuestion(form.questions.length - 1); refreshMeta(); } });
  const saveBtnTop = button({ label: isNew ? 'Utwórz rubrykę' : 'Zapisz zmiany', variant: 'primary', onClick: () => save() });
  const saveBtnBottom = button({ label: isNew ? 'Utwórz rubrykę' : 'Zapisz zmiany', variant: 'primary', onClick: () => save() });
  const backBtn = button({ label: isNew ? 'Anuluj' : 'Wróć do listy', variant: 'secondary', onClick: () => leave('#/rubrics') });
  const dirtyNote = h('span', { class: 'rb-dirty small muted', role: 'status', 'aria-live': 'polite' });

  ctx.setHeader({ title: isNew ? 'Nowa rubryka' : rubric.name, crumbs: [{ label: 'Rubryki', href: '#/rubrics' }], width: 'narrow', actions: [saveBtnTop] });

  root.append(
    h('div', { class: 'page-h' },
      h('div', { class: 't' },
        h('h1', null, isNew ? 'Nowa rubryka' : 'Edytuj rubrykę'),
        h('p', null, isNew
          ? 'Dodaj pytania, nadaj im wagi i opisz, co znaczy każda ocena od 1 do 5. Rubrykę przypiszesz do stanowiska w jego ustawieniach.'
          : 'Zmiana pytań, wag lub kotwic tworzy nową wersję rubryki. Starsze karty oceny zachowują swoją wersję.'),
      ),
    ),
    h('div', { class: 'card rb-card' }, nameField, metaEl),
    h('div', { class: 'rb-qhead' }, h('h2', null, 'Pytania'), h('span', { class: 'small muted', 'data-slot': 'count' })),
    listEl,
    h('div', { class: 'rb-add' }, addBtn),
    errorSlot,
    h('div', { class: 'rb-actions' }, saveBtnBottom, backBtn, dirtyNote),
  );

  /* ---------- meta: wersja, użycie, zapowiedź nowej wersji ---------- */
  function refreshMeta() {
    const parts = [];
    if (rubric) {
      parts.push(h('div', { class: 'rb-meta-row' }, icon('rubric', 15), h('span', null, h('b', null, `Wersja ${rubric.version || 1}`), rubric.updated_at ? ` · ostatnia zmiana ${formatDate(rubric.updated_at)}` : '')));
      parts.push(h('div', { class: 'rb-meta-row' }, icon('briefcase', 15), h('span', null, usedIn.length
        ? ['Używana w: ', usedIn.map((p, i) => [i ? ', ' : '', h('a', { class: 'link', href: `#/positions/${p.id}` }, p.title)])]
        : 'Nieprzypisana do żadnego stanowiska — przypiszesz ją w ustawieniach stanowiska.')));
      if (questionsChanged()) {
        parts.push(h('div', { class: 'rb-meta-row rb-version-up', role: 'status' }, icon('info', 15), h('span', null, h('b', null, `Po zapisaniu wersja wzrośnie do ${(Number(rubric.version) || 1) + 1}`), ' — zmieniły się pytania, wagi lub kotwice.')));
      } else if (isDirty()) {
        parts.push(h('div', { class: 'rb-meta-row', role: 'status' }, icon('info', 15), h('span', null, 'Zmiana samej nazwy nie podnosi wersji.')));
      }
    } else {
      parts.push(h('div', { class: 'rb-meta-row' }, icon('rubric', 15), h('span', null, h('b', null, 'Wersja 1'), ' — numer rośnie przy każdej zmianie pytań.')));
    }
    metaEl.replaceChildren(...parts);
    const count = root.querySelector('[data-slot="count"]');
    if (count) {
      const minutes = form.questions.reduce((s, q) => s + (Number(q.minutes) || 0), 0);
      count.textContent = `${plural(form.questions.length, 'pytanie', 'pytania', 'pytań')}${minutes ? ` · ok. ${minutes} min rozmowy` : ''}`;
    }
    dirtyNote.textContent = isDirty() ? 'Masz niezapisane zmiany.' : '';
    const label = isNew ? 'Utwórz rubrykę' : 'Zapisz zmiany';
    for (const b of [saveBtnTop, saveBtnBottom]) { b.querySelector('span').textContent = label; }
  }

  /* ---------- pytania ---------- */
  function renderQuestions() {
    listEl.replaceChildren(...form.questions.map((q, i) => renderQuestion(q, i)));
  }

  function renderQuestion(q, i) {
    const n = form.questions.length;
    const textF = field({ label: 'Treść pytania', name: `q-${q._key}-text`, type: 'textarea', rows: 2, value: q.text, required: true, placeholder: 'np. Opowiedz o systemie, który projektowałeś lub projektowałaś pod rosnące obciążenie.' });
    textF.input.addEventListener('input', () => { q.text = textF.value; refreshMeta(); });
    const compF = field({ label: 'Kompetencja', name: `q-${q._key}-comp`, value: q.competency, placeholder: 'np. Projektowanie systemów', autocomplete: 'off' });
    compF.input.addEventListener('input', () => { q.competency = compF.value; refreshMeta(); });
    const minF = field({ label: 'Czas (min)', name: `q-${q._key}-min`, type: 'number', value: String(q.minutes), min: 1, max: 120, step: 1, inputmode: 'numeric' });
    minF.input.addEventListener('input', () => { q.minutes = Number(minF.value); refreshMeta(); });

    const weightGroup = h('div', { class: 'segment rb-weight', role: 'group', 'aria-label': `Waga pytania ${i + 1}` });
    const weightBtns = [1, 2, 3].map((w) => {
      const b = h('button', { type: 'button', 'aria-pressed': q.weight === w ? 'true' : 'false', title: w === 1 ? 'Waga 1 — uzupełniające' : w === 2 ? 'Waga 2 — ważne' : 'Waga 3 — kluczowe' }, `×${w}`);
      b.addEventListener('click', () => {
        q.weight = w;
        weightBtns.forEach((x, idx) => x.setAttribute('aria-pressed', idx + 1 === w ? 'true' : 'false'));
        refreshMeta();
      });
      return b;
    });
    weightGroup.append(...weightBtns);
    const weightField = h('div', { class: 'field rb-weight-field' }, h('label', { id: `w-${q._key}` }, 'Waga'), weightGroup, h('div', { class: 'hint' }, '×1 uzupełniające · ×3 kluczowe'));
    weightGroup.setAttribute('aria-labelledby', `w-${q._key}`);

    const anchorFields = ANCHOR_KEYS.map((k) => {
      const f = field({ label: `${k} — ${ANCHOR_HINT[k]}`, name: `q-${q._key}-a${k}`, value: q.anchors[k], placeholder: 'Co konkretnie słyszysz w odpowiedzi na tym poziomie?', autocomplete: 'off' });
      f.input.addEventListener('input', () => { q.anchors[k] = f.value; refreshMeta(); updateAnchorCount(); });
      return f;
    });
    const anchorsSummaryCount = h('span', { class: 'muted' });
    const updateAnchorCount = () => { const filled = ANCHOR_KEYS.filter((k) => q.anchors[k].trim()).length; anchorsSummaryCount.textContent = `${filled} z 5 uzupełnionych`; };
    updateAnchorCount();
    const anchors = h('details', { class: 'rb-anchors', open: q._open || undefined },
      h('summary', null, icon('chevron-right', 14), h('span', null, 'Kotwice ocen 1–5'), anchorsSummaryCount),
      h('div', { class: 'rb-anchors-b' },
        h('p', { class: 'small muted' }, 'Kotwica opisuje, co znaczy dana ocena. Dzięki temu dwie osoby oceniają tę samą odpowiedź tak samo.'),
        anchorFields,
      ),
    );
    anchors.addEventListener('toggle', () => { q._open = anchors.open; });

    const upBtn = button({ icon: 'chevron', variant: 'ghost', size: 'sm', title: 'Przenieś wyżej', disabled: i === 0, onClick: () => move(i, -1) });
    upBtn.classList.add('rb-up');
    const downBtn = button({ icon: 'chevron', variant: 'ghost', size: 'sm', title: 'Przenieś niżej', disabled: i === n - 1, onClick: () => move(i, 1) });
    downBtn.classList.add('rb-down');
    const delBtn = button({ icon: 'trash', variant: 'ghost', size: 'sm', title: 'Usuń pytanie', onClick: () => remove(i) });

    const el = h('li', { class: 'rb-q card', 'data-key': q._key },
      h('div', { class: 'rb-q-h' },
        h('span', { class: 'rb-q-n' }, h('span', { class: 'sr-only' }, 'Pytanie '), String(i + 1)),
        h('span', { class: 'rb-q-title small muted' }, q.competency ? q.competency : 'Pytanie'),
        h('div', { class: 'rb-q-tools' }, upBtn, downBtn, delBtn),
      ),
      textF,
      h('div', { class: 'rb-q-grid' }, compF, weightField, minF),
      anchors,
    );
    el._fields = { textF, compF, minF };
    compF.input.addEventListener('input', () => { el.querySelector('.rb-q-title').textContent = q.competency.trim() || 'Pytanie'; });
    return el;
  }

  function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= form.questions.length) return;
    const [q] = form.questions.splice(i, 1);
    form.questions.splice(j, 0, q);
    renderQuestions(); refreshMeta();
    const el = listEl.children[j];
    const btn = el && el.querySelector(dir < 0 ? '.rb-up' : '.rb-down');
    const target = btn && !btn.disabled ? btn : el && el.querySelector('.rb-q-tools .btn:not(:disabled)');
    if (target) target.focus();
    toast(`Pytanie przeniesione na pozycję ${j + 1}.`, 'neutral', { duration: 1800 });
  }

  async function remove(i) {
    const q = form.questions[i];
    const hasContent = q.text.trim() || q.competency.trim() || ANCHOR_KEYS.some((k) => q.anchors[k].trim());
    if (hasContent) {
      const ok = await confirm({ title: 'Usunąć to pytanie?', text: `Pytanie ${i + 1}${q.competency ? ` („${q.competency}”)` : ''} zniknie z rubryki po zapisaniu. Wcześniejsze karty oceny zachowają swoje oceny.`, confirmLabel: 'Usuń pytanie', danger: true });
      if (!ok) return;
    }
    form.questions.splice(i, 1);
    renderQuestions(); refreshMeta();
    const next = listEl.children[Math.min(i, listEl.children.length - 1)];
    if (next) { const b = next.querySelector('.rb-q-tools .btn:not(:disabled)'); if (b) b.focus(); } else addBtn.focus();
  }

  function focusQuestion(i) {
    const el = listEl.children[i];
    if (el && el._fields) el._fields.textF.input.focus();
  }

  /* ---------- walidacja i zapis ---------- */
  function validate() {
    const problems = [];
    let first = null;
    nameField.setError('');
    if (form.name.trim().length < 2) { nameField.setError('Podaj nazwę rubryki (co najmniej 2 znaki).'); problems.push('nazwa'); first = first || nameField.input; }
    if (!form.questions.length) { problems.push('brak pytań'); }
    form.questions.forEach((q, i) => {
      const el = listEl.children[i];
      if (!el || !el._fields) return;
      const { textF, minF } = el._fields;
      textF.setError(''); minF.setError('');
      if (!q.text.trim()) { textF.setError(`Wpisz treść pytania ${i + 1}.`); problems.push(`pytanie ${i + 1}`); first = first || textF.input; }
      const m = Number(q.minutes);
      if (!(m >= 1 && m <= 120)) { minF.setError('Podaj czas od 1 do 120 minut.'); problems.push(`czas pytania ${i + 1}`); first = first || minF.input; }
    });
    return { ok: !problems.length, problems, first };
  }

  async function save() {
    errorSlot.replaceChildren();
    const v = validate();
    if (!v.ok) {
      const msg = !form.questions.length
        ? 'Dodaj co najmniej jedno pytanie — rubryka bez pytań nie ma czego mierzyć.'
        : `Popraw ${plural(v.problems.length, 'pole', 'pola', 'pól')}: ${v.problems.join(', ')}.`;
      errorSlot.replaceChildren(formError(msg));
      toast(msg, 'bad');
      if (v.first) v.first.focus(); else addBtn.focus();
      return;
    }
    const payload = { name: form.name.trim(), questions: form.questions.map((q) => ({ id: q.id || undefined, text: q.text, competency: q.competency, weight: q.weight, minutes: q.minutes, anchors: q.anchors })) };
    const busy = (on) => { saveBtnTop.setBusy(on); saveBtnBottom.setBusy(on); backBtn.disabled = on; };
    busy(true);
    try {
      if (isNew) {
        const created = await ctx.store.rubrics.create(payload);
        savedSnapshot = snapshot(); savedQuestions = questionsSnapshot();
        toast(`Rubryka „${created.name}” utworzona (wersja ${created.version || 1}).`, 'good');
        detach();
        ctx.navigate(`#/rubrics/${created.id}`);
        return;
      }
      const prevVersion = Number(rubric.version) || 1;
      const willBump = questionsChanged();
      const updated = await ctx.store.rubrics.update(rubric.id, payload);
      rubric = updated;
      // odśwież id pytań nadane przez store (nowe pytania) i stan „zapisane”
      form.questions.forEach((q, i) => { const u = updated.questions && updated.questions[i]; if (u && !q.id) q.id = u.id; });
      savedSnapshot = snapshot(); savedQuestions = questionsSnapshot();
      ctx.setHeader({ title: rubric.name, crumbs: [{ label: 'Rubryki', href: '#/rubrics' }], width: 'narrow', actions: [saveBtnTop] });
      refreshMeta();
      const newVersion = Number(updated.version) || prevVersion;
      toast(newVersion > prevVersion ? `Zapisano. Wersja rubryki wzrosła z ${prevVersion} do ${newVersion}.` : (willBump ? 'Zapisano.' : 'Zapisano. Wersja bez zmian.'), 'good');
    } catch (err) {
      errorSlot.replaceChildren(formError((err && err.message) || 'Nie udało się zapisać rubryki. Spróbuj ponownie.'));
      errorSlot.scrollIntoView({ block: 'nearest' });
    } finally {
      busy(false);
    }
  }

  /* ---------- ostrzeżenie o niezapisanych zmianach ---------- */
  async function leave(hash) {
    if (isDirty()) {
      const ok = await confirm({ title: 'Porzucić niezapisane zmiany?', text: 'Zmiany w tej rubryce nie zostały zapisane. Jeśli wyjdziesz, przepadną.', confirmLabel: 'Wyjdź bez zapisu', cancelLabel: 'Zostań', danger: true });
      if (!ok) return;
    }
    detach();
    ctx.navigate(hash);
  }
  const onBeforeUnload = (e) => {
    if (!root.isConnected) { detach(); return; }
    if (isDirty()) { e.preventDefault(); e.returnValue = ''; }
  };
  const onDocClick = (e) => {
    if (!root.isConnected) { detach(); return; }
    if (!isDirty()) return;
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const target = a.getAttribute('href');
    if (!target || target === location.hash) return;
    e.preventDefault(); e.stopPropagation();
    leave(target);
  };
  function detach() {
    window.removeEventListener('beforeunload', onBeforeUnload);
    document.removeEventListener('click', onDocClick, true);
  }
  window.addEventListener('beforeunload', onBeforeUnload);
  document.addEventListener('click', onDocClick, true);

  renderQuestions(); refreshMeta();
  if (isNew) requestAnimationFrame(() => { if (window.innerWidth >= 900) nameField.input.focus({ preventScroll: true }); });
  return root;
}
