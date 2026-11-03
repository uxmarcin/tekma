/**
 * store.js — fasada danych Tekmy. Wybiera adapter po config.js:
 *   SUPABASE_URL puste → local.js (tryb demo, localStorage); inaczej → supabase.js (REST).
 * Interfejs jest identyczny dla obu adapterów. Wszystkie metody są async; błąd = Error z polskim komunikatem.
 *
 *   store.mode                        'supabase' | 'demo'
 *   store.auth.session()              -> {user:{id,email,name}} | null
 *   store.auth.signUp({email,password,name}) -> {session|null, needsConfirmation}
 *   store.auth.signIn({email,password}) -> session
 *   store.auth.signOut() / .resetPassword(email) / .onChange(cb) -> unsubscribe
 *   store.org.current()               -> {id,name,role} | null
 *   store.org.create({name})          -> org (twórca = owner)
 *   store.org.loadDemoData()          -> wstawia seed.js do bieżącej firmy (pomija, gdy firma ma już dane)
 *   store.positions.list() / get(id) / create({title,department,location,stages?,rubric_id?,description?}) / update(id,patch)
 *   store.candidates.list({position_id?}) / get(id) / create({position_id,full_name,email,source,cv_score?}) / move(id,stage) / reject(id,reason) / update(id,patch)
 *   store.rubrics.list() / get(id) / create({name,questions}) / update(id,patch)   // update podnosi version, gdy zmieniły się pytania
 *   store.scorecards.get(candidate_id, stage) -> karta oceny (tworzy pustą, jeśli brak) / save(scorecard) / list()
 *   store.stats.dashboard()           -> {openPositions, activeCandidates, interviewsThisWeek:null, attention:[…]}
 *
 * attention[] = {type:'discrepancy'|'stale'|'no-rubric', tone, title, text, href}
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { createLocalAdapter } from './local.js';
import { createSupabaseAdapter } from './supabase.js';
import { SEED, DEFAULT_STAGES } from './seed.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const now = () => new Date().toISOString();
const str = (v) => String(v ?? '').trim();

export function createStore(adapter) {
  const positions = {
    list: () => adapter.positions.list(),
    get: (id) => adapter.positions.get(id),
    async create({ title, department, location, stages, rubric_id, description, status } = {}) {
      title = str(title);
      if (title.length < 2) throw new Error('Podaj nazwę stanowiska.');
      const st = Array.isArray(stages) && stages.length ? stages.map(str).filter(Boolean) : DEFAULT_STAGES;
      if (st.length < 2) throw new Error('Lejek musi mieć co najmniej 2 etapy.');
      return adapter.positions.create({
        title, department: str(department), location: str(location),
        status: status === 'closed' ? 'closed' : 'open',
        stages: st, rubric_id: rubric_id || null, description: str(description),
      });
    },
    async update(id, patch = {}) {
      const p = { ...patch };
      if ('title' in p && str(p.title).length < 2) throw new Error('Podaj nazwę stanowiska.');
      if ('stages' in p && (!Array.isArray(p.stages) || p.stages.length < 2)) throw new Error('Lejek musi mieć co najmniej 2 etapy.');
      if ('status' in p && !['open', 'closed'].includes(p.status)) throw new Error('Status stanowiska musi być „open” albo „closed”.');
      return adapter.positions.update(id, p);
    },
  };

  const candidates = {
    list: ({ position_id } = {}) => adapter.candidates.list(position_id ? { position_id } : {}),
    get: (id) => adapter.candidates.get(id),
    async create({ position_id, full_name, email, source, cv_score, stage } = {}) {
      full_name = str(full_name);
      email = str(email).toLowerCase();
      if (!position_id) throw new Error('Wybierz stanowisko dla kandydata.');
      if (full_name.length < 2) throw new Error('Podaj imię i nazwisko kandydata.');
      if (email && !EMAIL_RE.test(email)) throw new Error('Podaj poprawny adres e-mail kandydata.');
      const pos = await adapter.positions.get(position_id);
      if (!pos) throw new Error('Nie znaleziono stanowiska. Odśwież listę i spróbuj ponownie.');
      const firstStage = (pos.stages && pos.stages[0]) || DEFAULT_STAGES[0];
      if (stage && !(pos.stages || []).includes(stage)) throw new Error('Ten etap nie istnieje w lejku stanowiska.');
      return adapter.candidates.create({
        position_id, full_name, email, source: str(source) || 'Inne',
        stage: stage || firstStage,
        cv_score: typeof cv_score === 'number' ? Math.max(0, Math.min(100, Math.round(cv_score))) : null,
        status: 'active', reject_reason: null, applied_at: now(),
      });
    },
    async move(id, stage) {
      stage = str(stage);
      const c = await adapter.candidates.get(id);
      if (!c) throw new Error('Nie znaleziono kandydata.');
      const pos = await adapter.positions.get(c.position_id);
      if (pos && !(pos.stages || []).includes(stage)) throw new Error('Ten etap nie istnieje w lejku stanowiska.');
      return adapter.candidates.update(id, { stage });
    },
    async reject(id, reason) {
      reason = str(reason);
      if (reason.length < 3) throw new Error('Podaj powód odrzucenia — kandydat ma prawo go poznać.');
      return adapter.candidates.update(id, { status: 'rejected', reject_reason: reason });
    },
    async update(id, patch = {}) {
      const p = { ...patch };
      if ('full_name' in p && str(p.full_name).length < 2) throw new Error('Podaj imię i nazwisko kandydata.');
      if ('email' in p && p.email && !EMAIL_RE.test(str(p.email))) throw new Error('Podaj poprawny adres e-mail kandydata.');
      if ('status' in p && !['active', 'rejected', 'hired'].includes(p.status)) throw new Error('Nieprawidłowy status kandydata.');
      if ('cv_score' in p && p.cv_score !== null && (typeof p.cv_score !== 'number' || p.cv_score < 0 || p.cv_score > 100)) throw new Error('Dopasowanie CV musi być liczbą 0–100.');
      return adapter.candidates.update(id, p);
    },
  };

  function validateQuestions(questions) {
    if (!Array.isArray(questions) || !questions.length) throw new Error('Rubryka musi mieć co najmniej jedno pytanie.');
    return questions.map((q, i) => {
      const text = str(q.text);
      if (!text) throw new Error(`Pytanie ${i + 1} nie ma treści.`);
      const weight = Number(q.weight) || 1;
      if (![1, 2, 3].includes(weight)) throw new Error(`Waga pytania ${i + 1} musi wynosić 1, 2 albo 3.`);
      const anchors = {};
      for (const k of ['1', '2', '3', '4', '5']) anchors[k] = str(q.anchors && (q.anchors[k] ?? q.anchors[Number(k)]));
      return {
        id: q.id || `q-${Date.now().toString(36)}-${i}`,
        text, competency: str(q.competency), weight,
        minutes: Number(q.minutes) || 10, anchors,
      };
    });
  }

  const rubrics = {
    list: () => adapter.rubrics.list(),
    get: (id) => adapter.rubrics.get(id),
    async create({ name, questions, version } = {}) {
      name = str(name);
      if (name.length < 2) throw new Error('Podaj nazwę rubryki.');
      return adapter.rubrics.create({ name, version: Number(version) || 1, questions: validateQuestions(questions), updated_at: now() });
    },
    async update(id, patch = {}) {
      const p = { ...patch, updated_at: now() };
      if ('name' in p && str(p.name).length < 2) throw new Error('Podaj nazwę rubryki.');
      if ('questions' in p) {
        p.questions = validateQuestions(p.questions);
        const prev = await adapter.rubrics.get(id);
        if (!prev) throw new Error('Nie znaleziono rubryki.');
        if (JSON.stringify(prev.questions) !== JSON.stringify(p.questions)) p.version = (Number(prev.version) || 1) + 1;
      }
      return adapter.rubrics.update(id, p);
    },
  };

  const scorecards = {
    list: () => adapter.scorecards.list(),
    async get(candidate_id, stage) {
      stage = str(stage);
      if (!candidate_id || !stage) throw new Error('Karta oceny wymaga kandydata i etapu.');
      const existing = await adapter.scorecards.find(candidate_id, stage);
      if (existing) return normalizeCard(existing);
      const c = await adapter.candidates.get(candidate_id);
      if (!c) throw new Error('Nie znaleziono kandydata.');
      const pos = await adapter.positions.get(c.position_id);
      return normalizeCard(await adapter.scorecards.create({
        candidate_id, stage, rubric_id: (pos && pos.rubric_id) || null, ratings: [], ai: {}, decision: null, updated_at: now(),
      }));
    },
    async save(card) {
      if (!card || !card.id) throw new Error('Brak karty oceny do zapisania.');
      const ratings = (card.ratings || []).map((r) => {
        const score = Number(r.score);
        if (!(score >= 1 && score <= 5)) throw new Error('Ocena musi być liczbą od 1 do 5.');
        return { question_id: r.question_id, rater_id: r.rater_id, rater_name: r.rater_name || '', score };
      });
      if (card.decision && !['yes', 'maybe', 'no'].includes(card.decision)) throw new Error('Decyzja musi być „yes”, „maybe” albo „no”.');
      return normalizeCard(await adapter.scorecards.update(card.id, {
        rubric_id: card.rubric_id || null, ratings, ai: card.ai || {}, decision: card.decision || null, updated_at: now(),
      }));
    },
  };
  function normalizeCard(c) {
    return { ...c, ratings: Array.isArray(c.ratings) ? c.ratings : [], ai: c.ai && typeof c.ai === 'object' ? c.ai : {} };
  }

  const org = {
    current: () => adapter.org.current(),
    create: (data) => adapter.org.create(data),
    async loadDemoData() {
      const o = await adapter.org.current();
      if (!o) throw new Error('Najpierw utwórz firmę.');
      const existing = await adapter.positions.list();
      if (existing.length) return { skipped: true, positions: existing.length };
      const session = await adapter.auth.session();
      const me = session ? session.user : { id: 'demo-me', name: 'Ty' };

      const rubricIds = {};
      for (const r of SEED.rubrics) {
        const row = await adapter.rubrics.create({ name: r.name, version: r.version, questions: r.questions, updated_at: now() });
        rubricIds[r.key] = row.id;
      }
      const positionIds = {};
      for (const p of SEED.positions) {
        const row = await adapter.positions.create({
          title: p.title, department: p.department, location: p.location, status: p.status,
          stages: p.stages, rubric_id: p.rubric_key ? rubricIds[p.rubric_key] : null,
          description: p.description, created_at: p.created_at,
        });
        positionIds[p.key] = row.id;
      }
      const candidateIds = {};
      for (const c of SEED.candidates) {
        const row = await adapter.candidates.create({
          position_id: positionIds[c.position_key], full_name: c.full_name, email: c.email, source: c.source,
          stage: c.stage, cv_score: c.cv_score, status: c.status, reject_reason: c.reject_reason || null, applied_at: c.applied_at,
        });
        candidateIds[c.key] = row.id;
      }
      for (const s of SEED.scorecards) {
        const ratings = s.ratings.map((r) => {
          const rater = r.rater === 'me' ? { id: me.id, name: me.name || 'Ty' } : SEED.raters[r.rater];
          return { question_id: r.question_id, rater_id: rater.id, rater_name: rater.name, score: r.score };
        });
        await adapter.scorecards.create({
          candidate_id: candidateIds[s.candidate_key], stage: s.stage, rubric_id: rubricIds[s.rubric_key],
          ratings, ai: {}, decision: s.decision, updated_at: now(),
        });
      }
      return { skipped: false, positions: SEED.positions.length, candidates: SEED.candidates.length, rubrics: SEED.rubrics.length };
    },
  };

  const stats = {
    async dashboard() {
      const [pos, cands, cards] = await Promise.all([adapter.positions.list(), adapter.candidates.list(), adapter.scorecards.list()]);
      const posById = Object.fromEntries(pos.map((p) => [p.id, p]));
      const candById = Object.fromEntries(cands.map((c) => [c.id, c]));
      const attention = [];

      // rozbieżne oceny (≥ 2 pkt w jednym pytaniu)
      for (const card of cards) {
        const byQ = {};
        for (const r of card.ratings || []) (byQ[r.question_id] ||= []).push(Number(r.score));
        let worst = null;
        for (const [qid, scores] of Object.entries(byQ)) {
          if (scores.length < 2) continue;
          const gap = Math.max(...scores) - Math.min(...scores);
          if (gap >= 2 && (!worst || gap > worst.gap)) worst = { qid, gap };
        }
        if (worst) {
          const c = candById[card.candidate_id];
          if (!c) continue;
          attention.push({
            type: 'discrepancy', tone: 'warn', title: 'Rozbieżne oceny',
            candidate_id: c.id, question_id: worst.qid,
            text: `${c.full_name}: oceny różnią się o ${worst.gap} pkt (${card.stage}). Porozmawiajcie, zanim zapadnie decyzja.`,
            href: `#/candidates/${c.id}?stage=${encodeURIComponent(card.stage)}`,
          });
        }
      }
      // kandydaci czekający na pierwszym etapie ponad 7 dni
      const weekAgo = Date.now() - 7 * 864e5;
      for (const c of cands) {
        if (c.status !== 'active') continue;
        const p = posById[c.position_id];
        const first = p && p.stages && p.stages[0];
        if (first && c.stage === first && new Date(c.applied_at).getTime() < weekAgo) {
          const days = Math.round((Date.now() - new Date(c.applied_at).getTime()) / 864e5);
          attention.push({
            type: 'stale', tone: 'info', title: 'Czeka na screening', candidate_id: c.id,
            text: `${c.full_name} czeka na etapie „${first}” od ${days} dni.`,
            href: `#/positions/${c.position_id}`,
          });
        }
      }
      // otwarte stanowiska bez rubryki
      for (const p of pos) {
        if (p.status === 'open' && !p.rubric_id) {
          attention.push({
            type: 'no-rubric', tone: 'neutral', title: 'Brak rubryki', position_id: p.id,
            text: `${p.title} nie ma przypisanej rubryki — rozmowy nie będą porównywalne.`,
            href: `#/positions/${p.id}`,
          });
        }
      }
      return {
        openPositions: pos.filter((p) => p.status === 'open').length,
        activeCandidates: cands.filter((c) => c.status === 'active').length,
        interviewsThisWeek: null,
        attention,
      };
    },
  };

  return { mode: adapter.mode, auth: adapter.auth, org, positions, candidates, rubrics, scorecards, stats, adapter };
}

const adapter = SUPABASE_URL
  ? createSupabaseAdapter({ url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY })
  : createLocalAdapter();

export const store = createStore(adapter);
export default store;
