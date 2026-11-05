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
    for (const a of st.attention || []) out.push({ key: `att:${a.type}:${a.href}`, tone: a.tone || 'warn', title: a.title, text: a.text, href: a.href });
  } catch { /* brak danych */ }
  try {
    const [people, tasks] = await Promise.all([store.people.list(), store.tasks.list()]);
    for (const p of people.filter((x) => x.status === 'onboarding')) {
      const day = dayOf(p.start_date);
      const late = tasks.filter((t) => t.person_id === p.id && !t.done && day > t.due_day).length;
      if (late) out.push({ key: `late:${p.id}:${late}`, tone: 'warn', title: `${p.full_name}: ${late} ${late === 1 ? 'zadanie' : late < 5 ? 'zadania' : 'zadań'} po terminie`, text: 'Plan pierwszych 90 dni', href: `#/people/${p.id}` });
    }
  } catch { /* moduł bez migracji */ }
  try {
    const goals = await store.goals.list();
    const today = iso(new Date()), soon = iso(new Date(Date.now() + 7 * 86400000));
    for (const g of goals.filter((x) => x.status !== 'done' && x.due_date)) {
      if (g.due_date < today) out.push({ key: `goal-late:${g.id}`, tone: 'bad', title: `Cel po terminie: ${g.title}`, text: `Postęp ${g.progress}%`, href: '#/goals' });
      else if (g.due_date <= soon) out.push({ key: `goal-soon:${g.id}`, tone: 'warn', title: `Termin celu w tym tygodniu: ${g.title}`, text: `Postęp ${g.progress}%`, href: '#/goals' });
    }
  } catch { /* moduł bez migracji */ }
  return out;
}

const keyFor = (orgId) => `tekma.seen.${orgId || 'x'}`;
export function readSeen(orgId) { try { return new Set(JSON.parse(localStorage.getItem(keyFor(orgId)) || '[]')); } catch { return new Set(); } }
export function markSeen(orgId, items) { try { localStorage.setItem(keyFor(orgId), JSON.stringify(items.map((i) => i.key).slice(-200))); } catch { /* brak storage */ } }
