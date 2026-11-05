/**
 * local.js — adapter demo: wszystko w localStorage (klucz `tekma.demo.v1`), bez sieci.
 *
 * Implementuje ten sam interfejs adaptera, co supabase.js (store.js dokleja warstwę wspólną):
 *   mode: 'demo'
 *   auth:       session(), signUp({email,password,name}), signIn({email,password}), signOut(), resetPassword(email),
 *               verifyEmailCode({email,code}), resendEmailCode({email}), onChange(cb)
 *   Demo nie wymaga potwierdzenia e-maila (signUp loguje od razu). verifyEmailCode/resendEmailCode są atrapami
 *   do testów ekranu kodu: kod demo to zawsze DEMO_CODE ('123456'), e-maile nie są wysyłane.
 *   org:        current(), create({name})
 *   positions:  list(), get(id), create(data), update(id, patch)
 *   candidates: list({position_id?}), get(id), create(data), update(id, patch)
 *   rubrics:    list(), get(id), create(data), update(id, patch)
 *   scorecards: list(), find(candidate_id, stage), create(data), update(id, patch)
 *
 * Hasła są haszowane SHA-256 (crypto.subtle) tylko dla porządku — to nie jest system bezpieczeństwa,
 * dane żyją wyłącznie w tej przeglądarce. Wszystkie błędy to Error z polskim komunikatem.
 */

export const STORAGE_KEY = 'tekma.demo.v1';
/** Kod potwierdzający w trybie demo (atrapa — w demo nie wysyłamy e-maili). */
export const DEMO_CODE = '123456';

const EMPTY = () => ({
  v: 1,
  users: [],       // {id, email, name, password_hash, created_at}
  session: null,   // {user_id, created_at}
  orgs: [],        // {id, name, created_at, created_by}
  members: [],     // {org_id, user_id, role}
  positions: [],
  candidates: [],
  rubrics: [],
  scorecards: [],
  people: [],
  onboarding_tasks: [],
  goals: [],
  feedback: [],
  talent_pool: [],
});

function uuid() {
  if (globalThis.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function sha256(text) {
  try {
    if (globalThis.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch { /* brak secure context — niżej fallback */ }
  // fallback (np. http bez localhost): prosty hasz, wyraźnie oznaczony
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  return 'weak:' + (h >>> 0).toString(16);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();
const clone = (x) => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const normEmail = (e) => String(e || '').trim().toLowerCase();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function createLocalAdapter() {
  let db = load();
  const listeners = new Set();

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return EMPTY();
      const parsed = JSON.parse(raw);
      return { ...EMPTY(), ...parsed };
    } catch {
      return EMPTY();
    }
  }
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      throw new Error('Nie udało się zapisać danych w tej przeglądarce. Sprawdź, czy localStorage nie jest zablokowany (tryb prywatny?).');
    }
  }
  function emit() {
    const s = sessionObj();
    for (const cb of listeners) { try { cb(s); } catch (e) { console.error(e); } }
  }
  // zmiany w innej karcie
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) { db = load(); emit(); }
    });
  }

  function currentUser() {
    if (!db.session) return null;
    return db.users.find((u) => u.id === db.session.user_id) || null;
  }
  function sessionObj() {
    const u = currentUser();
    return u ? { user: { id: u.id, email: u.email, name: u.name } } : null;
  }
  function requireUser() {
    const u = currentUser();
    if (!u) throw new Error('Sesja wygasła. Zaloguj się ponownie.');
    return u;
  }
  function currentOrg() {
    const u = currentUser();
    if (!u) return null;
    const m = db.members.find((x) => x.user_id === u.id);
    if (!m) return null;
    const o = db.orgs.find((x) => x.id === m.org_id);
    return o ? { id: o.id, name: o.name, role: m.role, logo: o.logo || null } : null;
  }
  function requireOrg() {
    const o = currentOrg();
    if (!o) throw new Error('Najpierw utwórz firmę.');
    return o;
  }

  /* ------------------------------------------------ auth */
  const auth = {
    async session() { await sleep(0); return sessionObj(); },

    async signUp({ email, password, name }) {
      email = normEmail(email);
      name = String(name || '').trim();
      if (!name) throw new Error('Podaj imię i nazwisko.');
      if (!EMAIL_RE.test(email)) throw new Error('Podaj poprawny adres e-mail.');
      if (!password || password.length < 10) throw new Error('Hasło musi mieć co najmniej 10 znaków.');
      if (db.users.some((u) => u.email === email)) throw new Error('Ten adres e-mail ma już konto. Zaloguj się albo zresetuj hasło.');
      const user = { id: uuid(), email, name, password_hash: await sha256(password), created_at: now() };
      db.users.push(user);
      db.session = { user_id: user.id, created_at: now() };
      save(); emit();
      return { session: sessionObj(), needsConfirmation: false };
    },

    async signIn({ email, password }) {
      email = normEmail(email);
      await sleep(120);
      const user = db.users.find((u) => u.email === email);
      const ok = user && user.password_hash === (await sha256(password || ''));
      if (!ok) throw new Error('Nieprawidłowy e-mail lub hasło. Sprawdź dane i spróbuj ponownie.');
      db.session = { user_id: user.id, created_at: now() };
      save(); emit();
      return sessionObj();
    },

    async signOut() {
      db.session = null;
      save(); emit();
    },

    async resetPassword(email) {
      email = normEmail(email);
      if (!EMAIL_RE.test(email)) throw new Error('Podaj poprawny adres e-mail.');
      throw new Error('W trybie demo nie wysyłamy e-maili, więc reset hasła nie działa. Załóż nowe konto demo — zajmie to chwilę.');
    },

    /** Atrapa: przyjmuje wyłącznie DEMO_CODE dla istniejącego konta demo i loguje je. */
    async verifyEmailCode({ email, code }) {
      email = normEmail(email);
      code = String(code || '').replace(/\D/g, '');
      if (!EMAIL_RE.test(email)) throw new Error('Podaj poprawny adres e-mail.');
      if (code.length !== 6) throw new Error('Wpisz 6-cyfrowy kod z e-maila.');
      await sleep(120);
      const user = db.users.find((u) => u.email === email);
      if (!user) throw new Error('Nie ma konta demo z tym adresem e-mail. Załóż konto.');
      if (code !== DEMO_CODE) {
        const e = new Error(`Kod jest nieprawidłowy lub wygasł. Poproś o nowy. (Tryb demo: kod to ${DEMO_CODE}.)`);
        e.code = 'otp_expired';
        throw e;
      }
      db.session = { user_id: user.id, created_at: now() };
      save(); emit();
      return sessionObj();
    },

    /** Atrapa: w demo nie wysyłamy e-maili — zwraca true, kod to zawsze DEMO_CODE. */
    async resendEmailCode({ email }) {
      email = normEmail(email);
      if (!EMAIL_RE.test(email)) throw new Error('Podaj poprawny adres e-mail.');
      await sleep(120);
      return true;
    },

    onChange(cb) { listeners.add(cb); return () => listeners.delete(cb); },
  };

  /* ------------------------------------------------ org */
  const org = {
    async current() { await sleep(0); return currentOrg(); },
    async create({ name }) {
      const u = requireUser();
      name = String(name || '').trim();
      if (name.length < 2) throw new Error('Podaj nazwę firmy (co najmniej 2 znaki).');
      if (currentOrg()) throw new Error('Masz już firmę. W tej wersji konto może należeć do jednej firmy.');
      const o = { id: uuid(), name, created_at: now(), created_by: u.id };
      db.orgs.push(o);
      db.members.push({ org_id: o.id, user_id: u.id, role: 'owner' });
      save();
      return { id: o.id, name: o.name, role: 'owner' };
    },
    async rename(name) {
      const cur = requireOrg();
      name = String(name || '').trim();
      if (name.length < 2) throw new Error('Podaj nazwę firmy (co najmniej 2 znaki).');
      if (cur.role !== 'owner') throw new Error('Nazwę firmy może zmienić tylko właściciel.');
      db.orgs.find((x) => x.id === cur.id).name = name;
      save();
      return { ...cur, name };
    },
    async setLogo(dataUrl) {
      const cur = requireOrg();
      if (cur.role !== 'owner') throw new Error('Logo firmy może zmienić tylko właściciel.');
      if (dataUrl && (!/^data:image\//.test(dataUrl) || dataUrl.length > 300000)) throw new Error('Logo jest zbyt duże. Wybierz mniejszy plik.');
      db.orgs.find((x) => x.id === cur.id).logo = dataUrl || null;
      save();
      return { ...cur, logo: dataUrl || null };
    },
  };

  /* ------------------------------------------------ członkowie firmy */
  const ROLES = ['owner', 'recruiter', 'interviewer'];
  const members = {
    async list() {
      const o = requireOrg(); const me = requireUser();
      await sleep(0);
      const org = db.orgs.find((x) => x.id === o.id);
      return db.members.filter((m) => m.org_id === o.id).map((m) => {
        const u = db.users.find((x) => x.id === m.user_id) || {};
        return { user_id: m.user_id, role: m.role, created_at: m.created_at || (org && org.created_at) || now(), name: u.name || '', is_me: m.user_id === me.id };
      });
    },
    async setRole(user_id, role) {
      const o = requireOrg();
      if (!ROLES.includes(role)) throw new Error('Nieznana rola.');
      if (o.role !== 'owner') throw new Error('Rolę może zmienić tylko właściciel.');
      const m = db.members.find((x) => x.org_id === o.id && x.user_id === user_id);
      if (!m) throw new Error('Nie znaleziono członka zespołu.');
      if (m.role === 'owner' && role !== 'owner' && db.members.filter((x) => x.org_id === o.id && x.role === 'owner').length < 2) {
        throw new Error('W firmie musi zostać co najmniej jeden właściciel.');
      }
      m.role = role; save();
      return { ...m };
    },
  };

  /* ------------------------------------------------ generyczne CRUD po org_id */
  function table(name, { order = 'created_at', dir = 'desc' } = {}) {
    return {
      async list(filter = {}) {
        const o = requireOrg();
        await sleep(0);
        let rows = db[name].filter((r) => r.org_id === o.id);
        for (const [k, v] of Object.entries(filter)) if (v !== undefined && v !== null) rows = rows.filter((r) => r[k] === v);
        rows.sort((a, b) => (a[order] < b[order] ? 1 : -1) * (dir === 'desc' ? 1 : -1));
        return clone(rows);
      },
      async get(id) {
        const o = requireOrg();
        await sleep(0);
        const r = db[name].find((x) => x.id === id && x.org_id === o.id);
        return r ? clone(r) : null;
      },
      async create(data) {
        const o = requireOrg();
        const row = { id: uuid(), org_id: o.id, created_at: now(), ...clone(data) };
        db[name].push(row);
        save();
        return clone(row);
      },
      async update(id, patch) {
        const o = requireOrg();
        const r = db[name].find((x) => x.id === id && x.org_id === o.id);
        if (!r) throw new Error('Nie znaleziono rekordu. Może został usunięty.');
        Object.assign(r, clone(patch));
        save();
        return clone(r);
      },
      async remove(id) {
        const o = requireOrg();
        const i = db[name].findIndex((x) => x.id === id && x.org_id === o.id);
        if (i < 0) throw new Error('Nie znaleziono rekordu. Może został usunięty.');
        db[name].splice(i, 1);
        if (name === 'people') { // kaskada jak w bazie
          db.onboarding_tasks = db.onboarding_tasks.filter((t) => t.person_id !== id);
          db.goals = db.goals.filter((g) => g.person_id !== id);
        }
        save();
        return true;
      },
    };
  }

  const positions = table('positions');
  const candidates = table('candidates', { order: 'applied_at' });
  const rubrics = table('rubrics', { order: 'updated_at' });
  const people = table('people', { order: 'start_date' });
  const onboarding_tasks = table('onboarding_tasks', { order: 'position', dir: 'asc' });
  const goals = table('goals');
  const feedback = table('feedback');
  const talent_pool = table('talent_pool');
  const scorecardsBase = table('scorecards', { order: 'updated_at' });
  const scorecards = {
    ...scorecardsBase,
    async find(candidate_id, stage) {
      const o = requireOrg();
      await sleep(0);
      const r = db.scorecards.find((x) => x.org_id === o.id && x.candidate_id === candidate_id && x.stage === stage);
      return r ? clone(r) : null;
    },
  };

  /** Czyści dane demo (do testów / resetu). Nie usuwa kont. */
  async function resetData() {
    const o = requireOrg();
    for (const t of ['positions', 'candidates', 'rubrics', 'scorecards', 'people', 'onboarding_tasks', 'goals', 'talent_pool']) db[t] = db[t].filter((r) => r.org_id !== o.id);
    save();
  }

  return { mode: 'demo', auth, org, members, positions, candidates, rubrics, scorecards, people, onboarding_tasks, goals, feedback, talent_pool, resetData, _db: () => db };
}

export default createLocalAdapter;
