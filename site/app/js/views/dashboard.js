/**
 * views/dashboard.js — pulpit (#/). Ekran startowy jak w ChatGPT: powitanie z imieniem,
 * cztery liczniki, lista „Wymaga uwagi” (store.stats.dashboard().attention) i „Stanowiska w skrócie”
 * z mini-lejkiem. Konto bez stanowisk → jeden ekran z jedną akcją główną.
 * Dane: store.stats.dashboard(), store.positions.list(), store.candidates.list().
 * Stany: skeleton, błąd z „Spróbuj ponownie”, puste listy z jedną akcją.
 * export default async function render(ctx) -> HTMLElement
 */

import { miniFunnel, setHeader } from './positions.js';

const ATTENTION_LABEL = { discrepancy: 'Rozbieżność', stale: 'Zaległość', 'no-rubric': 'Brak rubryki' };
const ATTENTION_ICON = { discrepancy: 'alert', stale: 'clock', 'no-rubric': 'rubric' };
const MAX_ATTENTION = 5;
const MAX_POSITIONS = 5;

export default async function render(ctx) {
  const { h, button, loadCss } = ctx.ui;
  await loadCss(new URL('./dashboard.css', import.meta.url));

  const addBtn = button({ label: 'Dodaj stanowisko', variant: 'primary', icon: 'plus', onClick: () => ctx.navigate('#/positions?new=1') });
  setHeader(ctx, { title: 'Pulpit', actions: [addBtn], width: 'wide' });

  const root = h('div', { class: 'dash' });
  let showAllAttention = false;

  function renderSkeleton() {
    root.replaceChildren(
      h('div', { class: 'dash-skel', 'aria-busy': 'true', 'aria-label': 'Ładowanie pulpitu' },
        h('i', { class: 'dash-skel-title' }),
        h('i', { class: 'dash-skel-sub' }),
        h('div', { class: 'dash-stats' }, [0, 1, 2, 3].map(() => h('i', { class: 'dash-skel-stat' }))),
        h('div', { class: 'dash-cols' }, h('i', { class: 'dash-skel-card' }), h('i', { class: 'dash-skel-card' })),
      ),
    );
  }

  function renderError(err) {
    const { icon } = ctx.ui;
    root.replaceChildren(h('div', { class: 'state', role: 'alert' },
      h('div', { class: 'glyph' }, icon('alert', 20)),
      h('h2', null, 'Nie udało się wczytać pulpitu'),
      h('p', null, (err && err.message) || 'Sprawdź połączenie i spróbuj ponownie.'),
      h('div', { class: 'actions' }, button({ label: 'Spróbuj ponownie', variant: 'primary', onClick: load })),
    ));
  }

  async function load() {
    renderSkeleton();
    try {
      const [stats, positions, candidates] = await Promise.all([
        ctx.store.stats.dashboard(), ctx.store.positions.list(), ctx.store.candidates.list(),
      ]);
      renderContent({ stats, positions, candidates });
    } catch (err) {
      console.error('[dashboard]', err);
      renderError(err);
    }
  }

  function renderContent({ stats, positions, candidates }) {
    const { h } = ctx.ui;
    const name = firstName(ctx.user);
    const attention = Array.isArray(stats.attention) ? stats.attention : [];

    // Konto bez stanowisk: ekran startowy z jedną akcją główną.
    if (!positions.length) {
      root.replaceChildren(ctx.ui.heroState({
        title: `${greeting()}${name ? `, ${name}` : ''}`,
        text: 'Zacznij od pierwszego stanowiska. Dodasz do niego kandydatów i rubrykę, a Tekma pokaże lejek i podpowie, gdzie oceny się rozjeżdżają.',
        action: { label: 'Dodaj stanowisko', icon: 'plus', onClick: () => ctx.navigate('#/positions?new=1') },
        secondary: { label: 'Zobacz rubryki', onClick: () => ctx.navigate('#/rubrics') },
      }));
      return;
    }

    // Na mobile pasek nagłówka (z akcją główną) jest ukryty — akcja trafia pod powitanie.
    const mobileAdd = button({ label: 'Dodaj stanowisko', variant: 'secondary', size: 'sm', icon: 'plus', onClick: () => ctx.navigate('#/positions?new=1') });
    mobileAdd.classList.add('dash-add-mobile');
    const head = h('header', { class: 'dash-head' },
      h('h1', null, `${greeting()}${name ? `, ${name}` : ''}`),
      h('p', null, todayLine(stats, attention.length)),
      mobileAdd,
    );

    const statsEl = h('div', { class: 'dash-stats', role: 'list', 'aria-label': 'Podsumowanie' },
      stat('Otwarte stanowiska', stats.openPositions, { href: '#/positions', sub: positions.length > stats.openPositions ? `${positions.length - stats.openPositions} zamkn.` : 'wszystkie aktywne' }),
      stat('Kandydaci w procesie', stats.activeCandidates, { href: '#/candidates', sub: `${candidates.length} w bazie` }),
      stat('Rozmowy w tym tygodniu', stats.interviewsThisWeek, { sub: 'po podłączeniu kalendarza' }),
      stat('Wymaga uwagi', attention.length, { sub: attention.length ? 'sprawdź poniżej' : 'nic pilnego', tone: attention.length ? 'warn' : null }),
    );

    const cols = h('div', { class: 'dash-cols' }, attentionCard(attention), positionsCard(positions, candidates));
    root.replaceChildren(head, statsEl, cols);
  }

  function stat(label, value, { href, sub, tone } = {}) {
    const { h } = ctx.ui;
    const isNull = value === null || value === undefined;
    const content = [
      h('small', null, label),
      h('b', { class: isNull ? 'is-null' : (tone ? `tone-${tone}` : '') }, isNull ? '—' : String(value)),
      sub ? h('span', { class: 'sub' }, sub) : null,
    ];
    const attrs = { class: `dash-stat${href ? ' is-link' : ''}`, role: 'listitem' };
    if (isNull) attrs['aria-label'] = `${label}: brak danych`;
    return href ? h('a', { ...attrs, href }, content) : h('div', attrs, content);
  }

  /* ---------------------------------------------- Wymaga uwagi */
  function attentionCard(attention) {
    const { h, icon, button } = ctx.ui;
    const card = h('section', { class: 'dash-card', 'aria-labelledby': 'dash-att-h' });
    const head = h('div', { class: 'dash-card-h' },
      h('h2', { id: 'dash-att-h' }, 'Wymaga uwagi'),
      attention.length ? h('span', { class: 'dash-card-n' }, String(attention.length)) : null,
    );
    if (!attention.length) {
      card.append(head, h('div', { class: 'dash-empty' },
        h('span', { class: 'dash-empty-glyph' }, icon('check', 18)),
        h('b', null, 'Nic nie czeka na decyzję'),
        h('p', null, 'Oceny są zgodne, a kandydaci nie zalegają na pierwszym etapie.'),
        button({ label: 'Przejdź do kandydatów', variant: 'secondary', size: 'sm', onClick: () => ctx.navigate('#/candidates') }),
      ));
      return card;
    }
    const shown = showAllAttention ? attention : attention.slice(0, MAX_ATTENTION);
    const list = h('ul', { class: 'dash-list' }, shown.map((a) => h('li', null,
      h('a', { class: 'dash-item', href: a.href || '#/candidates' },
        h('span', { class: `dash-item-ico tone-${a.tone || 'neutral'}`, 'aria-hidden': 'true' }, icon(ATTENTION_ICON[a.type] || 'info')),
        h('span', { class: 'dash-item-t' },
          h('b', null, a.title || ATTENTION_LABEL[a.type] || 'Do sprawdzenia'),
          h('small', null, a.text || ''),
        ),
        h('span', { class: 'dash-item-chev', 'aria-hidden': 'true' }, icon('chevron-right')),
      ),
    )));
    card.append(head, list);
    if (attention.length > MAX_ATTENTION) {
      card.appendChild(h('div', { class: 'dash-card-f' }, button({
        label: showAllAttention ? 'Pokaż mniej' : `Pokaż wszystkie (${attention.length})`, variant: 'ghost', size: 'sm',
        onClick: () => { showAllAttention = !showAllAttention; card.replaceWith(attentionCard(attention)); },
      })));
    }
    card.appendChild(h('p', { class: 'dash-note' }, 'To podpowiedzi. Decyzję o kandydacie zawsze podejmuje człowiek.'));
    return card;
  }

  /* ---------------------------------------------- Stanowiska w skrócie */
  function positionsCard(positions, candidates) {
    const { h, icon, button, plural } = ctx.ui;
    const open = positions.filter((p) => p.status === 'open');
    const card = h('section', { class: 'dash-card', 'aria-labelledby': 'dash-pos-h' });
    const head = h('div', { class: 'dash-card-h' },
      h('h2', { id: 'dash-pos-h' }, 'Stanowiska w skrócie'),
      h('a', { class: 'dash-card-link', href: '#/positions' }, 'Wszystkie', icon('arrow', 14)),
    );
    if (!open.length) {
      card.append(head, h('div', { class: 'dash-empty' },
        h('span', { class: 'dash-empty-glyph' }, icon('briefcase', 18)),
        h('b', null, 'Brak otwartych stanowisk'),
        h('p', null, 'Wszystkie stanowiska są zamknięte. Otwórz nowe, żeby zacząć rekrutację.'),
        button({ label: 'Dodaj stanowisko', variant: 'primary', size: 'sm', icon: 'plus', onClick: () => ctx.navigate('#/positions?new=1') }),
      ));
      return card;
    }
    const sorted = open.slice().sort((a, b) => activeCount(b) - activeCount(a));
    function activeCount(p) { return candidates.filter((c) => c.position_id === p.id && c.status === 'active').length; }
    const list = h('ul', { class: 'dash-list' }, sorted.slice(0, MAX_POSITIONS).map((p) => {
      const active = candidates.filter((c) => c.position_id === p.id && c.status === 'active');
      const meta = [p.department, p.location].filter(Boolean).join(' · ');
      return h('li', null, h('a', { class: 'dash-item', href: `#/positions/${encodeURIComponent(p.id)}` },
        h('span', { class: 'dash-item-t' },
          h('b', null, p.title),
          h('small', null, `${plural(active.length, 'kandydat', 'kandydatów', 'kandydatów')}${meta ? ' · ' + meta : ''}${!p.rubric_id ? ' · bez rubryki' : ''}`),
        ),
        miniFunnel(ctx, p, active),
        h('span', { class: 'dash-item-chev', 'aria-hidden': 'true' }, icon('chevron-right')),
      ));
    }));
    card.append(head, list);
    if (open.length > MAX_POSITIONS) {
      card.appendChild(h('div', { class: 'dash-card-f' }, button({ label: `Zobacz wszystkie (${open.length})`, variant: 'ghost', size: 'sm', onClick: () => ctx.navigate('#/positions') })));
    }
    return card;
  }

  function todayLine(stats, attentionCount) {
    const { plural } = ctx.ui;
    const parts = [
      plural(stats.openPositions, 'otwarte stanowisko', 'otwarte stanowiska', 'otwartych stanowisk'),
      plural(stats.activeCandidates, 'kandydat w procesie', 'kandydatów w procesie', 'kandydatów w procesie'),
    ];
    if (attentionCount) parts.push(`${plural(attentionCount, 'sprawa wymaga', 'sprawy wymagają', 'spraw wymaga')} uwagi`);
    return `${dateLabel()} · ${parts.join(' · ')}`;
  }

  await load();
  return root;
}

/* ---------------------------------------------- pomocnicze */
function firstName(user) {
  const n = user && user.name ? String(user.name).trim() : '';
  if (!n) return '';
  return n.split(/\s+/)[0];
}
function greeting(d = new Date()) {
  const hr = d.getHours();
  if (hr < 5) return 'Cześć';
  if (hr < 18) return 'Dzień dobry';
  return 'Dobry wieczór';
}
function dateLabel(d = new Date()) {
  try {
    const s = d.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  } catch {
    return '';
  }
}
