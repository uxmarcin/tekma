/**
 * views/notes.js — Notetaker: notatki z rozmowy (#/candidates/:id/notes). Wg Figma „N8”.
 * Nie nagrywa rozmów. Wklejasz transkrypt (np. z Google Meet / Zoom) w formacie „[mm:ss] Imię: tekst”,
 * przypisujesz cytaty do kryteriów rubryki i wpisujesz ocenę. Cytaty i oceny wybiera człowiek; „Zapisz oceny”
 * zapisuje je w karcie oceny kandydata. Transkrypt zostaje lokalnie w tej przeglądarce (tekma_notes_v1:<kandydat>).
 */
import { setHeader } from './positions.js';

const LINE = /^\s*\[?(\d{1,2}:\d{2})\]?\s*([^:]{1,40}):\s*(.+)$/;

export default async function render(ctx) {
  const { h, icon, button, toast, emptyState } = ctx.ui;
  await ctx.ui.loadCss(new URL('./notes.css', import.meta.url));
  const cand = await ctx.store.candidates.get(ctx.params.id);
  if (!cand) throw new Error('Nie znaleziono kandydata.');
  const pos = await ctx.store.positions.get(cand.position_id);
  const rubric = pos && pos.rubric_id ? await ctx.store.rubrics.get(pos.rubric_id).catch(() => null) : null;
  const qs = (rubric && rubric.questions) || [];
  const stage = cand.stage || ((pos && pos.stages) || [])[0] || '';

  const KEY = `tekma_notes_v1:${cand.id}`;
  let d = { raw: '', consent: false, tags: {}, scores: {} };
  try { d = { ...d, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { /* brak zapisu */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* tryb prywatny */ } };
  const parse = () => d.raw.split('\n').map((l) => LINE.exec(l)).filter(Boolean).map((m, i) => ({ i, t: m[1], who: m[2].trim(), text: m[3].trim() }));

  const area = h('div', { class: 'nt-main' });
  const side = h('div', { class: 'nt-side' });
  let picking = null; // indeks linii, której przypisujemy kryterium

  function drawSide() {
    const lines = parse();
    side.replaceChildren(h('section', { class: 'card nt-card' }, h('h2', null, 'Dowody wg rubryki'),
      h('div', { class: 'nt-ai' }, icon('spark'), 'Cytaty przypisujesz Ty. Ocenę wpisujesz Ty.'),
      qs.length ? qs.map((q) => {
        const n = lines.filter((l) => d.tags[l.i] === q.id).length;
        const sel = h('select', { 'aria-label': `Ocena: ${q.competency || q.text}` }, h('option', { value: '' }, '—'), [1, 2, 3, 4, 5].map((v) => h('option', { value: String(v), selected: d.scores[q.id] === v }, String(v))));
        sel.addEventListener('change', () => { if (sel.value) d.scores[q.id] = Number(sel.value); else delete d.scores[q.id]; save(); });
        return h('div', { class: 'nt-q' }, h('div', null, h('strong', null, q.competency || 'Kryterium'), h('small', { class: 'muted' }, n ? `${n} ${n === 1 ? 'cytat' : 'cytaty'}` : 'brak dowodów w rozmowie')), sel);
      }) : h('p', { class: 'muted' }, 'To stanowisko nie ma jeszcze rubryki.')));
  }
  function drawMain() {
    const lines = parse();
    if (!lines.length) {
      const ta = h('textarea', { rows: 12, placeholder: '[02:14] Ola: Opowiedz o systemie, który skalowałeś.\n[02:31] Jakub: W poprzedniej firmie przeszliśmy z monolitu na trzy usługi…', 'aria-label': 'Transkrypt' }, d.raw);
      area.replaceChildren(h('section', { class: 'card nt-card' }, h('h2', null, 'Transkrypt'),
        h('p', { class: 'muted' }, 'Wklej transkrypt rozmowy w formacie „[mm:ss] Imię: tekst”, po jednej wypowiedzi w linii. Tekma niczego nie nagrywa.'), ta,
        button({ label: 'Pokaż transkrypt', variant: 'primary', onClick: () => { d.raw = ta.value; save(); draw(); } })));
      return;
    }
    area.replaceChildren(h('section', { class: 'card nt-card' }, h('h2', null, 'Transkrypt'),
      lines.map((l) => {
        const q = qs.find((x) => x.id === d.tags[l.i]);
        const row = h('div', { class: `nt-line${q ? ' tagged' : ''}` },
          h('span', { class: 'nt-t muted' }, l.t),
          h('div', { class: 'nt-x' }, h('strong', null, l.who, q ? h('span', { class: 'nt-chip' }, icon('flag'), q.competency || 'Kryterium') : null), h('p', null, l.text),
            picking === l.i ? h('div', { class: 'nt-pick' }, qs.map((x) => button({ label: x.competency || 'Kryterium', size: 'sm', onClick: () => { d.tags[l.i] = x.id; picking = null; save(); draw(); } })),
              d.tags[l.i] ? button({ label: 'Usuń przypisanie', size: 'sm', onClick: () => { delete d.tags[l.i]; picking = null; save(); draw(); } }) : null) : null),
          qs.length ? button({ label: q ? 'Zmień' : 'Przypisz', size: 'sm', onClick: () => { picking = picking === l.i ? null : l.i; draw(); } }) : null);
        return row;
      }),
      h('div', { class: 'nt-foot' }, button({ label: 'Wklej inny transkrypt', size: 'sm', onClick: () => { d.raw = ''; d.tags = {}; save(); draw(); } }))));
  }
  function draw() { drawMain(); drawSide(); }

  async function saveScores() {
    const ids = Object.keys(d.scores);
    if (!ids.length) { toast('Wpisz przynajmniej jedną ocenę.', 'warn'); return; }
    if (!stage) { toast('Stanowisko nie ma etapów — nie ma gdzie zapisać karty.', 'warn'); return; }
    try {
      const me = ctx.user || { id: 'me', name: 'Ty' };
      const card = await ctx.store.scorecards.get(cand.id, stage);
      card.rubric_id = card.rubric_id || (rubric && rubric.id) || null;
      card.ratings = (card.ratings || []).filter((r) => !(r.rater_id === me.id && ids.includes(r.question_id)));
      for (const qid of ids) card.ratings.push({ question_id: qid, rater_id: me.id, rater_name: me.name || me.email || 'Ty', score: d.scores[qid] });
      await ctx.store.scorecards.save(card);
      toast('Oceny zapisane w karcie oceny.', 'good');
    } catch (e) { toast(e.message || 'Nie udało się zapisać ocen.', 'bad'); }
  }
  function exportTxt() {
    const lines = parse().map((l) => `[${l.t}] ${l.who}: ${l.text}`).join('\n');
    const url = URL.createObjectURL(new Blob([lines], { type: 'text/plain;charset=utf-8' }));
    const a = h('a', { href: url, download: `rozmowa-${cand.full_name.replace(/\s+/g, '-').toLowerCase()}.txt` }); document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  setHeader(ctx, { title: 'Notatki z rozmowy', width: 'wide', actions: [
    button({ label: 'Eksport', icon: 'arrow', onClick: exportTxt }), button({ label: 'Zapisz oceny', variant: 'primary', icon: 'check', onClick: saveScores })] });

  const consent = h('label', { class: 'nt-badge' }, h('input', { type: 'checkbox', checked: d.consent }), 'Mam zgodę kandydata na notatki z rozmowy');
  consent.querySelector('input').addEventListener('change', (e) => { d.consent = e.target.checked; save(); });
  draw();
  if (!qs.length && !parse().length) { /* pusty stan obsługuje formularz wklejania */ }
  return h('div', { class: 'nt' },
    h('p', { class: 'muted nt-sub' }, `${cand.full_name}${pos ? ` · ${pos.title}` : ''}${stage ? ` · ${stage}` : ''}`),
    h('div', { class: 'nt-badges' }, consent, h('span', { class: 'nt-badge muted' }, icon('lock'), 'Transkrypt zostaje w tej przeglądarce')),
    h('div', { class: 'nt-grid' }, area, side));
}
