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
  try {
    const { talentConsent: tc } = await import('./store.js');
    const rows = await store.talent.list();
    const exp = rows.filter((r) => tc(r).state === 'expiring').length;
    const dead = rows.filter((r) => tc(r).state === 'expired').length;
    if (exp) out.push({ key: `talent-exp:${exp}`, tone: 'warn', title: `${exp} ${exp === 1 ? 'zgoda w bazie talentów wygasa' : 'zgody w bazie talentów wygasają'} w 14 dni`, text: 'Poproś o odnowienie zgody', href: '#/talent' });
    if (dead) out.push({ key: `talent-dead:${dead}`, tone: 'bad', title: `${dead} ${dead === 1 ? 'wpis' : 'wpisów'} w bazie talentów bez ważnej zgody`, text: 'Dane do usunięcia (RODO)', href: '#/talent' });
  } catch { /* moduł bez migracji */ }
  try {
    const due = await store.privacy.due();
    if (due.length) out.push({ key: `priv:${due.length}`, tone: 'warn', title: `${due.length} ${due.length === 1 ? 'kandydat po terminie przechowywania' : 'kandydatów po terminie przechowywania'}`, text: 'Zanonimizuj lub wyeksportuj dane', href: '#/settings/prywatnosc' });
  } catch { /* brak danych */ }
  try {
    const { adCheck } = await import('./ad-check.js');
    const pos = (await store.positions.list()).filter((p) => p.status !== 'closed');
    for (const p of pos) if (!adCheck(p).ready) out.push({ key: `ad:${p.id}`, tone: 'warn', title: `Ogłoszenie „${p.title}” nie jest gotowe do publikacji`, text: 'Uzupełnij widełki wynagrodzenia i treść', href: '#/publishing' });
  } catch { /* brak danych */ }
  return out;
}

export const CATEGORY = { att: 'Rekrutacja', late: 'Wdrożenie', 'goal-late': 'Cele', 'goal-soon': 'Cele', 'talent-exp': 'Baza talentów', 'talent-dead': 'Baza talentów', priv: 'Prywatność', ad: 'Ogłoszenia' };
export const categoryOf = (item) => CATEGORY[String(item.key).split(':')[0]] || 'Inne';

const keyFor = (orgId) => `tekma.seen.${orgId || 'x'}`;
export function readSeen(orgId) { try { return new Set(JSON.parse(localStorage.getItem(keyFor(orgId)) || '[]')); } catch { return new Set(); } }
export function markSeen(orgId, items) { try { localStorage.setItem(keyFor(orgId), JSON.stringify(items.map((i) => i.key).slice(-200))); } catch { /* brak storage */ } }
