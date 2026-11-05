/**
 * notifications.js — powiadomienia wyliczane z danych (bez serwera): „Wymaga uwagi” z pulpitu,
 * zaległe zadania planu wdrożenia i cele po terminie / z bliskim terminem.
 * Stan „przeczytane” trzyma localStorage (per firma i przeglądarka).
 */
import { dayOf } from './plan.js';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export async function collect(store) {
  const out = [];
  try {
    const st = await store.stats.dashboard();
    for (const a of st.attention || []) out.push({ key: `att:${a.type}:${a.href}`, tone: a.tone || 'warn', who: a.who || a.title, what: a.what || a.text, at: a.at || null, icon: a.icon || null, href: a.href });
  } catch { /* brak danych */ }
  try {
    const [people, tasks] = await Promise.all([store.people.list(), store.tasks.list()]);
    for (const p of people.filter((x) => x.status === 'onboarding')) {
      const day = dayOf(p.start_date);
      const late = tasks.filter((t) => t.person_id === p.id && !t.done && day > t.due_day).length;
      if (late) out.push({ key: `late:${p.id}:${late}`, tone: 'warn', who: p.full_name, what: `${late} ${late === 1 ? 'zadanie' : late < 5 ? 'zadania' : 'zadań'} po terminie w planie pierwszych 90 dni`, at: null, href: `#/people/${p.id}` });
    }
  } catch { /* moduł bez migracji */ }
  try {
    const goals = await store.goals.list();
    const today = iso(new Date()), soon = iso(new Date(Date.now() + 7 * 86400000));
    for (const g of goals.filter((x) => x.status !== 'done' && x.due_date)) {
      if (g.due_date < today) out.push({ key: `goal-late:${g.id}`, tone: 'bad', who: g.title, what: `Cel po terminie · postęp ${g.progress}%`, at: g.due_date, icon: 'target', href: '#/goals' });
      else if (g.due_date <= soon) out.push({ key: `goal-soon:${g.id}`, tone: 'warn', who: g.title, what: `Termin celu w tym tygodniu · postęp ${g.progress}%`, at: g.due_date, icon: 'target', href: '#/goals' });
    }
  } catch { /* moduł bez migracji */ }
  try {
    const { talentConsent: tc } = await import('./store.js');
    const rows = await store.talent.list();
    const exp = rows.filter((r) => tc(r).state === 'expiring').length;
    const dead = rows.filter((r) => tc(r).state === 'expired').length;
    if (exp) out.push({ key: `talent-exp:${exp}`, tone: 'warn', who: 'Baza talentów', what: `${exp} ${exp === 1 ? 'zgoda wygasa' : 'zgody wygasają'} w ciągu 14 dni: poproś o odnowienie`, at: null, icon: 'user-plus', href: '#/talent' });
    if (dead) out.push({ key: `talent-dead:${dead}`, tone: 'bad', who: 'Baza talentów', what: `${dead} ${dead === 1 ? 'wpis' : 'wpisów'} bez ważnej zgody: dane do usunięcia (RODO)`, at: null, icon: 'user-plus', href: '#/talent' });
  } catch { /* moduł bez migracji */ }
  try {
    const due = await store.privacy.due();
    if (due.length) out.push({ key: `priv:${due.length}`, tone: 'warn', who: 'Prywatność danych', what: `${due.length} ${due.length === 1 ? 'kandydat po terminie' : 'kandydatów po terminie'} przechowywania: zanonimizuj lub wyeksportuj`, at: null, icon: 'shield', href: '#/settings/prywatnosc' });
  } catch { /* brak danych */ }
  try {
    const { adCheck } = await import('./ad-check.js');
    const pos = (await store.positions.list()).filter((p) => p.status !== 'closed');
    for (const p of pos) if (!adCheck(p).ready) out.push({ key: `ad:${p.id}`, tone: 'warn', who: p.title, what: 'Ogłoszenie niegotowe: uzupełnij widełki i treść', at: null, icon: 'megaphone', href: '#/publishing' });
  } catch { /* brak danych */ }
  return out;
}

export const CATEGORY = { att: 'Rekrutacja', late: 'Wdrożenie', 'goal-late': 'Cele', 'goal-soon': 'Cele', 'talent-exp': 'Baza talentów', 'talent-dead': 'Baza talentów', priv: 'Prywatność', ad: 'Ogłoszenia' };
export const categoryOf = (item) => CATEGORY[String(item.key).split(':')[0]] || 'Inne';

const keyFor = (orgId) => `tekma.seen.${orgId || 'x'}`;
export function readSeen(orgId) { try { return new Set(JSON.parse(localStorage.getItem(keyFor(orgId)) || '[]')); } catch { return new Set(); } }
export function markSeen(orgId, items) { try { localStorage.setItem(keyFor(orgId), JSON.stringify(items.map((i) => i.key).slice(-200))); } catch { /* brak storage */ } }

/**
 * Wiersz powiadomienia: [avatar/ikona] KTO (pogrubione) · KIEDY, pod spodem CO się stało i dlaczego.
 * Używany w dzwonku i w Inboxie, żeby oba wyglądały tak samo. Kropka na awatarze = nieprzeczytane (kolor = waga).
 */
export function notifRow(ui, item, { unread = false, extra = null, tag = 'a' } = {}) {
  const { h, icon, avatar, formatDate } = ui;
  const lead = item.icon ? h('span', { class: 'nt-ic', 'aria-hidden': 'true' }, icon(item.icon, 16)) : avatar(item.who, 'md');
  const when = item.at ? formatDate(item.at, { relative: true }) : '';
  const el = h(tag, { class: `nt ${item.tone || ''}${unread ? ' is-new' : ''}`, ...(tag === 'a' ? { href: item.href } : {}) },
    h('span', { class: 'nt-lead' }, lead, h('i', { class: 'nt-dot', 'aria-hidden': 'true' })),
    h('span', { class: 'nt-t' }, h('span', { class: 'nt-top' }, h('b', null, item.who), when ? h('time', null, when) : null), h('small', null, item.what || '')),
    extra);
  return el;
}
