/**
 * views/prep.js — Coach AI: przygotowanie do rozmowy (#/candidates/:id/prep). Wg Figma „N7”.
 * Pytania pochodzą z rubryki stanowiska (człowiek ją ustalił). AI tylko PROPONUJE dodatkowe pytania — wybiera je człowiek.
 */
import { setHeader } from './positions.js';

const DONT = [
  ['Dotychczasowe zarobki', 'Zamiast: oczekiwania finansowe i widełki roli'],
  ['Plany rodzinne, ciąża', 'Zamiast: dostępność i terminy startu'],
  ['Wiek, pochodzenie, zdrowie', 'Zamiast: doświadczenie i umiejętności'],
];

export default async function render(ctx) {
  const { h, icon, button, tag, avatar, toast } = ctx.ui;
  await ctx.ui.loadCss(new URL('./prep.css', import.meta.url));
  const cand = await ctx.store.candidates.get(ctx.params.id);
  if (!cand) throw new Error('Nie znaleziono kandydata.');
  const [pos, members] = await Promise.all([ctx.store.positions.get(cand.position_id), ctx.store.members.list().catch(() => [])]);
  const rubric = pos && pos.rubric_id ? await ctx.store.rubrics.get(pos.rubric_id).catch(() => null) : null;
  const qs = (rubric && rubric.questions) || [];

  const KEY = `tekma_prep_v1:${cand.id}`;
  let picked = []; try { picked = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { /* brak zapisu */ }

  const gaps = [
    ctx.ai.cvReason(cand, pos).replace(/^[^:]+: /, 'Dopasowanie z CV: '),
    `Zapytaj o największy projekt, który kandydat ${pos ? `dowiózł w roli ${pos.title}` : 'dowiózł samodzielnie'}, i co zrobiłby inaczej.`,
  ];

  const qCard = (q) => h('div', { class: 'pp-q' },
    h('div', { class: 'pp-qh' }, h('strong', null, q.competency || 'Kryterium'), tag(`waga ${q.weight || 1}`, 'blue')),
    h('p', null, q.text),
    q.anchors ? h('small', { class: 'muted' }, ['5', '3', '1'].filter((k) => q.anchors[k]).map((k) => `${k} = ${q.anchors[k]}`).join(' · ')) : null);

  const gapRows = gaps.map((g, i) => {
    const cb = h('input', { type: 'checkbox', checked: picked.includes(i), 'aria-label': g });
    cb.addEventListener('change', () => { picked = cb.checked ? [...new Set([...picked, i])] : picked.filter((x) => x !== i); try { localStorage.setItem(KEY, JSON.stringify(picked)); } catch { /* */ } });
    return h('label', { class: 'pp-gap' }, cb, h('span', null, g));
  });

  const open = () => ctx.navigate(`#/candidates/${cand.id}${cand.stage ? `?stage=${encodeURIComponent(cand.stage)}` : ''}`);
  setHeader(ctx, { title: 'Przygotowanie do rozmowy', width: 'wide', actions: [
    button({ label: 'Karta oceny', icon: 'rubric', onClick: open }), button({ label: 'Zacznij rozmowę', variant: 'primary', icon: 'arrow', onClick: open })] });

  const panel = (members.length ? members : []).slice(0, 4).map((m, i) => ({ name: m.name || 'Członek zespołu', area: (qs[i % Math.max(qs.length, 1)] || {}).competency || 'Ogólna ocena' }));

  return h('div', { class: 'pp' },
    h('p', { class: 'muted pp-sub' }, `${cand.full_name}${pos ? ` · ${pos.title}` : ''}${cand.stage ? ` · ${cand.stage}` : ''}`),
    h('div', { class: 'pp-grid' },
      h('div', { class: 'pp-main' },
        h('section', { class: 'card pp-card' }, h('h2', null, 'Pytania z rubryki · Twoje kryteria'),
          qs.length ? qs.map(qCard) : h('p', { class: 'muted' }, 'To stanowisko nie ma jeszcze rubryki. Dodaj ją w Rubrykach, a pytania pojawią się tutaj.')),
        h('section', { class: 'card pp-card' }, h('h2', null, 'Pytania uzupełniające do luk w CV'),
          h('div', { class: 'pp-ai' }, icon('spark'), 'Propozycja AI. Wybierz pytania, które chcesz zadać.'), gapRows)),
      h('div', { class: 'pp-side' },
        h('section', { class: 'card pp-card' }, h('h2', null, 'Czego nie pytać'),
          DONT.map(([a, b]) => h('div', { class: 'pp-dont' }, icon('x'), h('div', null, h('strong', null, a), h('small', { class: 'muted' }, b))))),
        h('section', { class: 'card pp-card' }, h('h2', null, 'Panel i podział kryteriów'),
          panel.length ? panel.map((p) => h('div', { class: 'pp-who' }, avatar(p.name), h('div', null, h('strong', null, p.name), h('small', { class: 'muted' }, p.area))))
            : h('p', { class: 'muted' }, 'Dodaj osoby do zespołu w Ustawieniach, żeby podzielić kryteria.')))));
}
