/**
 * supabase.js — adapter REST do Supabase (Auth + PostgREST) przez fetch, BEZ SDK.
 *
 * Ten sam interfejs adaptera, co local.js (store.js dokleja warstwę wspólną):
 *   mode: 'supabase'
 *   auth:       session(), signUp, signIn, signOut, resetPassword, verifyEmailCode, resendEmailCode, onChange
 *   org:        current(), create({name})       — create przez RPC /rest/v1/rpc/create_org
 *   positions / candidates / rubrics / scorecards: list, get, create, update (+ scorecards.find)
 *
 * Auth:  POST /auth/v1/signup, /auth/v1/token?grant_type=password, /auth/v1/logout, /auth/v1/recover,
 *        potwierdzenie rejestracji KODEM z e-maila: /auth/v1/verify {type:'signup', email, token},
 *        ponowna wysyłka kodu: /auth/v1/resend {type:'signup', email},
 *        odświeżanie: /auth/v1/token?grant_type=refresh_token. Sesja w localStorage (`tekma.sb.session`).
 * Błędy auth to Error z polskim komunikatem i polem `code` (np. 'email_not_confirmed', 'otp_expired',
 * 'rate_limit', 'network'), żeby widok mógł zareagować bez parsowania tekstu.
 * Dane:  /rest/v1/<tabela>?select=…&org_id=eq.<id>&order=… z nagłówkami apikey + Authorization: Bearer.
 * Błędy Supabase są mapowane na polskie, konkretne komunikaty (mapAuthError / mapRestError).
 *
 * Użycie: createSupabaseAdapter({ url, anonKey, fetch? , storage? }) — fetch/storage można podmienić w testach.
 */

export const SESSION_KEY = 'tekma.sb.session';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function createSupabaseAdapter({ url, anonKey, fetch: fetchImpl, storage } = {}) {
  const base = String(url || '').replace(/\/+$/, '');
  const doFetch = fetchImpl || ((...a) => globalThis.fetch(...a));
  const store = storage || globalThis.localStorage;
  const listeners = new Set();
  let session = readSession();
  let orgCache = null;
  let refreshing = null;

  /* ------------------------------------------------ sesja */
  function readSession() {
    try { const raw = store.getItem(SESSION_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
  }
  function writeSession(s) {
    session = s;
    try { if (s) store.setItem(SESSION_KEY, JSON.stringify(s)); else store.removeItem(SESSION_KEY); } catch { /* ignoruj */ }
  }
  function emit() {
    const s = sessionObj();
    for (const cb of listeners) { try { cb(s); } catch (e) { console.error(e); } }
  }
  function userFrom(u) {
    if (!u) return null;
    const meta = u.user_metadata || {};
    return { id: u.id, email: u.email, name: meta.name || meta.full_name || (u.email ? u.email.split('@')[0] : '') };
  }
  function sessionObj() {
    return session && session.user ? { user: userFrom(session.user) } : null;
  }
  function fromTokenResponse(data) {
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at ? data.expires_at * 1000 : Date.now() + (data.expires_in || 3600) * 1000,
      user: data.user,
    };
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => { if (e.key === SESSION_KEY) { session = readSession(); orgCache = null; emit(); } });
  }

  /* ------------------------------------------------ HTTP */
  async function http(path, { method = 'GET', body, auth = true, headers = {}, query } = {}) {
    let u = base + path;
    if (query) {
      const qs = Object.entries(query).filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
      if (qs) u += (u.includes('?') ? '&' : '?') + qs;
    }
    const h = { apikey: anonKey, 'Content-Type': 'application/json', ...headers };
    if (auth) {
      const token = await accessToken();
      h.Authorization = `Bearer ${token || anonKey}`;
    } else if (!h.Authorization) {
      h.Authorization = `Bearer ${anonKey}`;
    }
    let res;
    try {
      res = await doFetch(u, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined });
    } catch {
      throw authError('Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.', 'network');
    }
    const text = await res.text();
    let data = null;
    if (text) { try { data = JSON.parse(text); } catch { data = { message: text }; } }
    return { ok: res.ok, status: res.status, data, headers: res.headers };
  }

  async function accessToken() {
    if (!session) return null;
    if (session.expires_at && Date.now() > session.expires_at - 60_000) {
      await refresh();
    }
    return session ? session.access_token : null;
  }

  async function refresh() {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      if (!session || !session.refresh_token) { writeSession(null); return; }
      const r = await http('/auth/v1/token?grant_type=refresh_token', { method: 'POST', auth: false, body: { refresh_token: session.refresh_token } });
      if (!r.ok || !r.data || !r.data.access_token) {
        writeSession(null); orgCache = null; emit();
        throw new Error('Sesja wygasła. Zaloguj się ponownie.');
      }
      writeSession(fromTokenResponse(r.data));
    })();
    try { return await refreshing; } finally { refreshing = null; }
  }

  /** PostgREST z obsługą wygaśnięcia tokenu (jedna próba odświeżenia). */
  async function rest(path, opts = {}) {
    let r = await http('/rest/v1' + path, opts);
    if (r.status === 401 && session && session.refresh_token) {
      await refresh();
      r = await http('/rest/v1' + path, opts);
    }
    if (!r.ok) throw new Error(mapRestError(r.status, r.data));
    return r.data;
  }

  /* ------------------------------------------------ auth */
  const auth = {
    async session() {
      if (!session) return null;
      if (session.expires_at && Date.now() > session.expires_at - 60_000) {
        try { await refresh(); } catch { return null; }
      }
      return sessionObj();
    },

    async signUp({ email, password, name }) {
      email = String(email || '').trim().toLowerCase();
      name = String(name || '').trim();
      if (!name) throw new Error('Podaj imię i nazwisko.');
      if (!EMAIL_RE.test(email)) throw new Error('Podaj poprawny adres e-mail.');
      if (!password || password.length < 10) throw new Error('Hasło musi mieć co najmniej 10 znaków.');
      const r = await http('/auth/v1/signup', { method: 'POST', auth: false, body: { email, password, data: { name, full_name: name } } });
      if (!r.ok) throw authErrorFrom(r.status, r.data, 'signup');
      const d = r.data || {};
      if (d.access_token) {
        writeSession(fromTokenResponse(d)); orgCache = null; emit();
        return { session: sessionObj(), needsConfirmation: false };
      }
      // Włączone „Confirm email”: Supabase zwraca użytkownika bez sesji.
      // Dla zajętego adresu zwraca „pustego” użytkownika z identities = [] (ochrona przed enumeracją).
      const user = d.user || d;
      if (user && Array.isArray(user.identities) && user.identities.length === 0) {
        throw new Error('Ten adres e-mail ma już konto. Zaloguj się albo zresetuj hasło.');
      }
      return { session: null, needsConfirmation: true };
    },

    async signIn({ email, password }) {
      email = String(email || '').trim().toLowerCase();
      if (!EMAIL_RE.test(email)) throw new Error('Podaj poprawny adres e-mail.');
      if (!password) throw new Error('Podaj hasło.');
      const r = await http('/auth/v1/token?grant_type=password', { method: 'POST', auth: false, body: { email, password } });
      if (!r.ok) throw authErrorFrom(r.status, r.data, 'signin');
      writeSession(fromTokenResponse(r.data)); orgCache = null; emit();
      return sessionObj();
    },

    /**
     * Potwierdzenie rejestracji kodem z e-maila (szablon „Confirm signup” z {{ .Token }}).
     * POST /auth/v1/verify {type:'signup', email, token} → sesja (access_token/refresh_token/user).
     */
    async verifyEmailCode({ email, code }) {
      email = String(email || '').trim().toLowerCase();
      code = String(code || '').replace(/\D/g, '');
      if (!EMAIL_RE.test(email)) throw authError('Podaj poprawny adres e-mail.', 'validation');
      if (code.length !== 6) throw authError('Wpisz 6-cyfrowy kod z e-maila.', 'validation');
      const r = await http('/auth/v1/verify', { method: 'POST', auth: false, body: { type: 'signup', email, token: code } });
      if (!r.ok) throw authErrorFrom(r.status, r.data, 'verify');
      const d = r.data || {};
      if (!d.access_token) {
        throw authError('Kod przyjęty, ale serwer nie zwrócił sesji. Zaloguj się e-mailem i hasłem.', 'no_session');
      }
      writeSession(fromTokenResponse(d)); orgCache = null; emit();
      return sessionObj();
    },

    /** Ponowna wysyłka kodu potwierdzającego: POST /auth/v1/resend {type:'signup', email}. */
    async resendEmailCode({ email }) {
      email = String(email || '').trim().toLowerCase();
      if (!EMAIL_RE.test(email)) throw authError('Podaj poprawny adres e-mail.', 'validation');
      const r = await http('/auth/v1/resend', { method: 'POST', auth: false, body: { type: 'signup', email } });
      if (!r.ok) throw authErrorFrom(r.status, r.data, 'resend');
      return true;
    },

    async signOut() {
      const token = session && session.access_token;
      writeSession(null); orgCache = null; emit();
      if (token) {
        try { await http('/auth/v1/logout', { method: 'POST', auth: false, headers: { Authorization: `Bearer ${token}` } }); } catch { /* lokalnie i tak wylogowani */ }
      }
    },

    async resetPassword(email) {
      email = String(email || '').trim().toLowerCase();
      if (!EMAIL_RE.test(email)) throw new Error('Podaj poprawny adres e-mail.');
      const redirect = typeof location !== 'undefined' ? `${location.origin}${location.pathname}#/login` : undefined;
      const r = await http('/auth/v1/recover', { method: 'POST', auth: false, body: { email, ...(redirect ? { redirect_to: redirect } : {}) } });
      if (!r.ok) throw authErrorFrom(r.status, r.data, 'recover');
      return true;
    },

    onChange(cb) { listeners.add(cb); return () => listeners.delete(cb); },
  };

  function requireUserId() {
    if (!session || !session.user) throw new Error('Sesja wygasła. Zaloguj się ponownie.');
    return session.user.id;
  }

  /* ------------------------------------------------ org */
  const org = {
    async current() {
      if (!session) return null;
      if (orgCache) return orgCache;
      const uid = requireUserId();
      let rows;
      try { rows = await rest('/members', { query: { select: 'role,org:organizations(id,name,logo)', user_id: `eq.${uid}`, limit: 1 } }); }
      catch (e) { // kolumna `logo` jeszcze nie istnieje (migracja 1.4) — działamy bez logo
        rows = await rest('/members', { query: { select: 'role,org:organizations(id,name)', user_id: `eq.${uid}`, limit: 1 } });
      }
      const m = Array.isArray(rows) ? rows[0] : null;
      if (!m || !m.org) return null;
      orgCache = { id: m.org.id, name: m.org.name, role: m.role, logo: m.org.logo || null };
      return orgCache;
    },
    async create({ name }) {
      name = String(name || '').trim();
      if (name.length < 2) throw new Error('Podaj nazwę firmy (co najmniej 2 znaki).');
      requireUserId();
      const data = await rest('/rpc/create_org', { method: 'POST', body: { name } });
      const id = typeof data === 'string' ? data : (data && (data.id || data.create_org));
      if (!id) throw new Error('Nie udało się utworzyć firmy. Sprawdź, czy funkcja create_org istnieje (db/schema.sql).');
      orgCache = { id, name, role: 'owner' };
      return orgCache;
    },
    /** Zmiana nazwy firmy — RLS pozwala tylko właścicielowi (grant kolumnowy: tylko `name`). */
    async rename(name) {
      name = String(name || '').trim();
      if (name.length < 2) throw new Error('Podaj nazwę firmy (co najmniej 2 znaki).');
      const oid = await orgId();
      const rows = await rest('/organizations', { method: 'PATCH', headers: { Prefer: 'return=representation' }, query: { id: `eq.${oid}` }, body: { name } });
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row) throw new Error('Nazwę firmy może zmienić tylko właściciel.');
      orgCache = { ...orgCache, name: row.name };
      return orgCache;
    },
    /** Logo firmy (data-URL albo null). Wymaga migracji db/migrations/1.4-org-logo.sql. */
    async setLogo(dataUrl) {
      const oid = await orgId();
      let rows;
      try { rows = await rest('/organizations', { method: 'PATCH', headers: { Prefer: 'return=representation' }, query: { id: `eq.${oid}` }, body: { logo: dataUrl || null } }); }
      catch (e) { throw new Error('Nie udało się zapisać logo. Upewnij się, że w bazie uruchomiono migrację 1.4 (kolumna logo).'); }
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row) throw new Error('Logo firmy może zmienić tylko właściciel.');
      orgCache = { ...orgCache, logo: row.logo || null };
      return orgCache;
    },
  };
  async function orgId() {
    const o = await org.current();
    if (!o) throw new Error('Najpierw utwórz firmę.');
    return o.id;
  }

  /* ------------------------------------------------ CRUD */
  const REPR = { Prefer: 'return=representation' };
  const ROLES = ['owner', 'recruiter', 'interviewer'];
  function table(name, { order = 'created_at.desc' } = {}) {
    return {
      async list(filter = {}) {
        const oid = await orgId();
        const query = { select: '*', org_id: `eq.${oid}`, order };
        for (const [k, v] of Object.entries(filter)) if (v !== undefined && v !== null) query[k] = `eq.${v}`;
        return rest(`/${name}`, { query });
      },
      async get(id) {
        const oid = await orgId();
        const rows = await rest(`/${name}`, { query: { select: '*', id: `eq.${id}`, org_id: `eq.${oid}`, limit: 1 } });
        return rows[0] || null;
      },
      async create(data) {
        const oid = await orgId();
        const rows = await rest(`/${name}`, { method: 'POST', headers: REPR, body: { ...data, org_id: oid } });
        return Array.isArray(rows) ? rows[0] : rows;
      },
      async update(id, patch) {
        const oid = await orgId();
        const rows = await rest(`/${name}`, { method: 'PATCH', headers: REPR, query: { id: `eq.${id}`, org_id: `eq.${oid}` }, body: patch });
        const row = Array.isArray(rows) ? rows[0] : rows;
        if (!row) throw new Error('Nie znaleziono rekordu. Może został usunięty.');
        return row;
      },
      async remove(id) {
        const oid = await orgId();
        const rows = await rest(`/${name}`, { method: 'DELETE', headers: REPR, query: { id: `eq.${id}`, org_id: `eq.${oid}` } });
        if (!Array.isArray(rows) || !rows.length) throw new Error('Nie udało się usunąć. Brak uprawnień albo rekord już nie istnieje.');
        return true;
      },
    };
  }

  const positionsBase = table('positions');
  // work_mode / contract_types wymagają migracji 1.7 — bez niej zapisujemy stanowisko bez tych pól
  const WORK_KEYS = ['work_mode', 'contract_types', 'category', 'salary_min', 'salary_max', 'salary_currency'];
  const stripWork = (d) => Object.fromEntries(Object.entries(d || {}).filter(([k]) => !WORK_KEYS.includes(k)));
  const hasWork = (d) => WORK_KEYS.some((k) => d && k in d);
  const positions = {
    ...positionsBase,
    async create(data) {
      try { return await positionsBase.create(data); }
      catch (err) { if (!hasWork(data)) throw err; const row = await positionsBase.create(stripWork(data)); row._workSkipped = true; return row; }
    },
    async update(id, patch) {
      try { return await positionsBase.update(id, patch); }
      catch (err) { if (!hasWork(patch)) throw err; const row = await positionsBase.update(id, stripWork(patch)); row._workSkipped = true; return row; }
    },
  };
  const candidates = table('candidates', { order: 'applied_at.desc' });
  const rubrics = table('rubrics', { order: 'updated_at.desc' });
  // moduły Ludzie i Cele — wymagają migracji db/migrations/1.5-people-goals.sql
  const people = table('people', { order: 'start_date.desc' });
  const onboarding_tasks = table('onboarding_tasks', { order: 'position.asc' });
  const person_reviews = table('person_reviews', { order: 'created_at.desc' });
  const goals = table('goals');
  const feedback = table('feedback'); // migracja db/migrations/1.6-feedback.sql
  const talent_pool = table('talent_pool'); // migracja db/migrations/1.9-talent-pool.sql
  const scorecards = {
    ...table('scorecards', { order: 'updated_at.desc' }),
    async find(candidate_id, stage) {
      const oid = await orgId();
      const rows = await rest('/scorecards', { query: { select: '*', org_id: `eq.${oid}`, candidate_id: `eq.${candidate_id}`, stage: `eq.${stage}`, limit: 1 } });
      return rows[0] || null;
    },
  };

  /* ------------------------------------------------ członkowie firmy */
  const members = {
    async list() {
      const oid = await orgId();
      const me = requireUserId();
      const [ms, ps] = await Promise.all([
        rest('/members', { query: { select: 'user_id,role,created_at', org_id: `eq.${oid}`, order: 'created_at.asc' } }),
        rest('/profiles', { query: { select: 'user_id,full_name' } }), // RLS: tylko profile członków tej samej firmy
      ]);
      const names = new Map((Array.isArray(ps) ? ps : []).map((p) => [p.user_id, p.full_name]));
      return (Array.isArray(ms) ? ms : []).map((m) => ({
        user_id: m.user_id, role: m.role, created_at: m.created_at,
        name: names.get(m.user_id) || '', is_me: m.user_id === me,
      }));
    },
    async setRole(user_id, role) {
      if (!ROLES.includes(role)) throw new Error('Nieznana rola.');
      const oid = await orgId();
      const rows = await rest('/members', { method: 'PATCH', headers: { Prefer: 'return=representation' }, query: { org_id: `eq.${oid}`, user_id: `eq.${user_id}` }, body: { role } });
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row) throw new Error('Rolę może zmienić tylko właściciel.');
      if (orgCache && user_id === requireUserId()) orgCache = { ...orgCache, role };
      return row;
    },
  };

  return { mode: 'supabase', auth, org, members, positions, candidates, rubrics, scorecards, people, onboarding_tasks, goals, feedback, talent_pool, person_reviews };
}

/* ================================================== mapowanie błędów */
function msgOf(data) {
  if (!data) return '';
  if (typeof data === 'string') return data;
  return data.msg || data.message || data.error_description || data.error || data.hint || '';
}
function codeOf(data) {
  if (!data || typeof data !== 'object') return '';
  return data.error_code || data.code || '';
}

/** Error z polskim komunikatem i stabilnym `code` (widok reaguje po kodzie, nie po tekście). */
export function authError(message, code = 'auth') {
  const e = new Error(message);
  e.code = code;
  return e;
}
function authErrorFrom(status, data, op) {
  return authError(mapAuthError(status, data, op), authErrorCode(status, data));
}

/** Stabilny kod błędu auth: 'email_not_confirmed' | 'otp_expired' | 'rate_limit' | 'invalid_credentials' | … */
export function authErrorCode(status, data) {
  const m = msgOf(data).toLowerCase();
  const c = String(codeOf(data)).toLowerCase();
  if (c === 'email_not_confirmed' || m.includes('email not confirmed')) return 'email_not_confirmed';
  if (c === 'otp_expired' || c === 'otp_disabled' || m.includes('token has expired or is invalid')) return 'otp_expired';
  if (c === 'over_email_send_rate_limit' || c === 'over_request_rate_limit' || c === 'over_sms_send_rate_limit' || m.includes('rate limit') || m.includes('for security purposes') || status === 429) return 'rate_limit';
  if (c === 'user_already_exists' || c === 'email_exists' || m.includes('already registered') || m.includes('already been registered')) return 'user_exists';
  if (c === 'invalid_credentials' || m.includes('invalid login credentials')) return 'invalid_credentials';
  if (c === 'weak_password') return 'weak_password';
  if (c === 'validation_failed') return 'validation';
  return c || `http_${status}`;
}

/**
 * mapAuthError(status, data, op?) → polski komunikat. `op` ('signup'|'signin'|'verify'|'resend'|'recover')
 * doprecyzowuje tekst dla kodu z e-maila i ponownej wysyłki.
 */
export function mapAuthError(status, data, op = '') {
  const m = msgOf(data).toLowerCase();
  const c = String(codeOf(data)).toLowerCase();
  if (c === 'user_already_exists' || c === 'email_exists' || m.includes('already registered') || m.includes('already been registered')) {
    return 'Ten adres e-mail ma już konto. Zaloguj się albo zresetuj hasło.';
  }
  if (c === 'weak_password' || m.includes('password should be at least') || m.includes('password is too short')) {
    return 'Hasło musi mieć co najmniej 10 znaków.';
  }
  if (c === 'otp_expired' || m.includes('token has expired or is invalid') || (op === 'verify' && (m.includes('invalid') || m.includes('expired') || m.includes('otp')))) {
    return 'Kod jest nieprawidłowy lub wygasł. Poproś o nowy.';
  }
  if (c === 'otp_disabled' || (op === 'verify' && m.includes('disabled'))) {
    return 'Logowanie kodem jest wyłączone w projekcie Supabase. Włącz „Confirm email” w Authentication → Providers → Email.';
  }
  if (c === 'invalid_credentials' || m.includes('invalid login credentials') || (c === 'invalid_grant' && !m.includes('refresh'))) {
    return 'Nieprawidłowy e-mail lub hasło. Sprawdź dane i spróbuj ponownie.';
  }
  if (c === 'email_not_confirmed' || m.includes('email not confirmed')) {
    return 'Potwierdź adres e-mail: wpisz kod, który wysłaliśmy po rejestracji.';
  }
  if (c === 'over_email_send_rate_limit' || c === 'over_request_rate_limit' || m.includes('rate limit') || m.includes('for security purposes') || status === 429) {
    const base = 'Za dużo prób. Odczekaj chwilę i spróbuj ponownie.';
    if (op === 'resend' || c === 'over_email_send_rate_limit') {
      const sec = /after (\d+) seconds?/.exec(m);
      return `${base} Kolejny e-mail możemy wysłać najwcześniej po ok. ${sec ? sec[1] : 60} s.`;
    }
    return base;
  }
  if (c === 'validation_failed' && op === 'verify') {
    return 'Wpisz 6-cyfrowy kod z e-maila.';
  }
  if (c === 'validation_failed' || m.includes('invalid format') || m.includes('unable to validate email')) {
    return 'Podaj poprawny adres e-mail.';
  }
  if (c === 'signup_disabled' || m.includes('signups not allowed')) {
    return 'Rejestracja jest wyłączona w tym projekcie Supabase. Włącz ją w Authentication → Providers → Email.';
  }
  if (c === 'email_provider_disabled' || m.includes('email logins are disabled')) {
    return 'Logowanie e-mailem jest wyłączone w projekcie Supabase. Włącz je w Authentication → Providers → Email.';
  }
  if (c === 'refresh_token_not_found' || c === 'session_not_found' || m.includes('refresh token')) {
    return 'Sesja wygasła. Zaloguj się ponownie.';
  }
  if (c === 'user_not_found' || m.includes('user not found')) {
    return 'Nie ma konta z tym adresem e-mail. Załóż konto.';
  }
  if (status === 401 && (m.includes('invalid api key') || m.includes('apikey'))) {
    return 'Nieprawidłowy klucz Supabase. Sprawdź SUPABASE_ANON_KEY w js/config.js.';
  }
  if (status >= 500) return 'Serwer Supabase nie odpowiada poprawnie. Spróbuj ponownie za chwilę.';
  const raw = msgOf(data);
  return raw ? `Nie udało się: ${raw}` : `Nie udało się wykonać operacji (kod ${status}).`;
}

export function mapRestError(status, data) {
  const code = String(codeOf(data));
  const m = msgOf(data).toLowerCase();
  if (code === '42501' || m.includes('row-level security')) {
    // 42501 zwraca RLS: zarówno gdy nie należysz do firmy, jak i gdy Twoja rola (np. rozmówca)
    // nie pozwala na zapis stanowisk, kandydatów i rubryk (db/schema.sql, wersja 1.1).
    return 'Brak uprawnień do tej operacji. Sprawdź, czy należysz do tej firmy i czy Twoja rola na to pozwala (rozmówca tylko ocenia).';
  }
  if (code === '23505') return 'Taki rekord już istnieje.';
  if (code === '23503') return 'Powiązany rekord nie istnieje (np. stanowisko zostało usunięte).';
  if (code === '23514' || code === '22P02') return 'Dane mają nieprawidłowy format. Sprawdź wartości i spróbuj ponownie.';
  if (code === '42P01') return 'Brak tabel w bazie. Uruchom db/schema.sql w Supabase SQL Editor.';
  if (code === 'PGRST202' || (status === 404 && m.includes('function'))) {
    return 'Brak funkcji create_org w bazie. Uruchom db/schema.sql w Supabase SQL Editor.';
  }
  if (code === 'PGRST205' || code === '42P01') return 'Brak tabeli w bazie (relation does not exist). Uruchom brakującą migrację z katalogu db/migrations.';
  if (code === 'PGRST116') return 'Nie znaleziono rekordu. Może został usunięty.';
  if (code === 'PGRST301' || status === 401 || m.includes('jwt expired') || m.includes('jwt')) {
    return 'Sesja wygasła. Zaloguj się ponownie.';
  }
  if (status === 404) return 'Nie znaleziono zasobu. Sprawdź SUPABASE_URL w js/config.js.';
  if (status >= 500) return 'Serwer Supabase nie odpowiada poprawnie. Spróbuj ponownie za chwilę.';
  const raw = msgOf(data);
  return raw ? `Nie udało się zapisać danych: ${raw}` : `Nie udało się wykonać operacji (kod ${status}).`;
}

export default createSupabaseAdapter;
