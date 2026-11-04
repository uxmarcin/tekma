/**
 * supabase.js — adapter REST do Supabase (Auth + PostgREST) przez fetch, BEZ SDK.
 *
 * Ten sam interfejs adaptera, co local.js (store.js dokleja warstwę wspólną):
 *   mode: 'supabase'
 *   auth:       session(), signUp, signIn, signOut, resetPassword, onChange
 *   org:        current(), create({name})       — create przez RPC /rest/v1/rpc/create_org
 *   positions / candidates / rubrics / scorecards: list, get, create, update (+ scorecards.find)
 *
 * Auth:  POST /auth/v1/signup, /auth/v1/token?grant_type=password, /auth/v1/logout, /auth/v1/recover,
 *        odświeżanie: /auth/v1/token?grant_type=refresh_token. Sesja w localStorage (`tekma.sb.session`).
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
      throw new Error('Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.');
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
      if (!password || password.length < 8) throw new Error('Hasło musi mieć co najmniej 8 znaków.');
      const r = await http('/auth/v1/signup', { method: 'POST', auth: false, body: { email, password, data: { name, full_name: name } } });
      if (!r.ok) throw new Error(mapAuthError(r.status, r.data));
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
      if (!r.ok) throw new Error(mapAuthError(r.status, r.data));
      writeSession(fromTokenResponse(r.data)); orgCache = null; emit();
      return sessionObj();
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
      if (!r.ok) throw new Error(mapAuthError(r.status, r.data));
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
      const rows = await rest('/members', { query: { select: 'role,org:organizations(id,name)', user_id: `eq.${uid}`, limit: 1 } });
      const m = Array.isArray(rows) ? rows[0] : null;
      if (!m || !m.org) return null;
      orgCache = { id: m.org.id, name: m.org.name, role: m.role };
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
  };
  async function orgId() {
    const o = await org.current();
    if (!o) throw new Error('Najpierw utwórz firmę.');
    return o.id;
  }

  /* ------------------------------------------------ CRUD */
  const REPR = { Prefer: 'return=representation' };
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
    };
  }

  const positions = table('positions');
  const candidates = table('candidates', { order: 'applied_at.desc' });
  const rubrics = table('rubrics', { order: 'updated_at.desc' });
  const scorecards = {
    ...table('scorecards', { order: 'updated_at.desc' }),
    async find(candidate_id, stage) {
      const oid = await orgId();
      const rows = await rest('/scorecards', { query: { select: '*', org_id: `eq.${oid}`, candidate_id: `eq.${candidate_id}`, stage: `eq.${stage}`, limit: 1 } });
      return rows[0] || null;
    },
  };

  return { mode: 'supabase', auth, org, positions, candidates, rubrics, scorecards };
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

export function mapAuthError(status, data) {
  const m = msgOf(data).toLowerCase();
  const c = String(codeOf(data)).toLowerCase();
  if (c === 'user_already_exists' || c === 'email_exists' || m.includes('already registered') || m.includes('already been registered')) {
    return 'Ten adres e-mail ma już konto. Zaloguj się albo zresetuj hasło.';
  }
  if (c === 'weak_password' || m.includes('password should be at least') || m.includes('password is too short')) {
    return 'Hasło musi mieć co najmniej 8 znaków.';
  }
  if (c === 'invalid_credentials' || m.includes('invalid login credentials') || (c === 'invalid_grant' && !m.includes('refresh'))) {
    return 'Nieprawidłowy e-mail lub hasło. Sprawdź dane i spróbuj ponownie.';
  }
  if (c === 'email_not_confirmed' || m.includes('email not confirmed')) {
    return 'Potwierdź adres e-mail: sprawdź skrzynkę i kliknij link, który wysłaliśmy po rejestracji.';
  }
  if (c === 'over_email_send_rate_limit' || c === 'over_request_rate_limit' || m.includes('rate limit') || status === 429) {
    return 'Za dużo prób w krótkim czasie. Odczekaj minutę i spróbuj ponownie.';
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
