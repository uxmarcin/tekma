/**
 * config.js — konfiguracja połączenia z Supabase.
 *
 * Puste wartości = tryb demo (dane w localStorage tej przeglądarki, bez sieci).
 *
 * Skąd wziąć wartości: Supabase → Twój projekt → Project Settings → API:
 *   - "Project URL"      → SUPABASE_URL      (np. 'https://abcdefghijkl.supabase.co')
 *   - "anon public" key  → SUPABASE_ANON_KEY
 * Klucz anon jest publiczny z założenia — trafia do przeglądarki każdego użytkownika.
 * Bezpieczeństwo danych zapewnia RLS (Row Level Security) zdefiniowane w db/schema.sql,
 * a nie tajność tego klucza. Nigdy nie wklejaj tu klucza "service_role".
 */
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';
