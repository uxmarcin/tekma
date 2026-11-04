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
export const SUPABASE_URL = 'https://rhblifzuoqdypewwwgcz.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoYmxpZnp1b3FkeXBld3d3Z2N6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3NzQ5MTcsImV4cCI6MjEwOTM1MDkxN30.IgQh-22mR0RIJ0lyYkcQ5FWocPyMVgwB6QyfF161rmE';
