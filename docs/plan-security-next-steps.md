# Plan: bezpieczeństwo i zgodność — kolejne kroki

Legenda: ✅ zrobione · 🟡 gotowe, czeka na zgodę/decyzję · ⬜ do zrobienia

## Faza 1 — baza (Supabase)
- ✅ Audyt RLS i regionu (docs/audit-rls-2026-11.md); region: West EU (Ireland)
- ✅ Migracja 1.2 napisana i przetestowana lokalnie (Postgres 16): db/migrations/1.2-hardening.sql
  - dziennik zmian audit_log (kto/kiedy/które kolumny; bez wartości), widoczny dla ownera
  - pole ai tylko od owner/recruiter (rozmówca nie sfałszuje sugestii)
  - retencja: organizations.retention_months, candidates.closed_at, purge_expired_candidates()
  - delete_org(org, nazwa) — usunięcie firmy wraz z danymi przez właściciela
- ✅ Skrypt kontrolny db/checks/rls-check.sql (oczekiwane 0 wierszy)
- ✅ Migracja 1.2 zastosowana na Supabase 2026-11-04 (kontrola: 0 problemów RLS, wszystkie elementy obecne)
- 🟡 Plan Pro (backupy), MFA na Supabase i GitHub — decyzja/działanie właściciela
- ⬜ Harmonogram retencji (pg_cron) — po zgodzie i po ustaleniu domyślnych okresów z klientami

## Faza 2 — aplikacja (po 1.2)
- ⬜ UI: ustawienie retencji (Ustawienia → Zgodność), „Usuń firmę” z potwierdzeniem nazwą, podgląd dziennika zmian
- ⬜ Rozmówca: widzi tylko przypisanych kandydatów i ślepa ocena (wymaga tabeli przypisań + zmiany polityk)
- ⬜ Eksport danych kandydata (prawo dostępu) i usunięcie na żądanie

## Faza 3 — publiczne aplikowanie kandydatów
- ⬜ Edge Function: walidacja, limit żądań, anty-spam, skanowanie CV, zgoda RODO; brak bezpośredniego zapisu anonimowego do tabel

## Faza 4 — AI
- ⬜ Konto Anthropic Console dla Tekmy, klucz tylko po stronie serwera (Edge Function)
- ⬜ Tabela zużycia + limity wg planu (10/25/60 rozmów), twarde limity wydatków
- ⬜ Dostawca transkrypcji jako podwykonawca; Anthropic na liście podwykonawców

## Faza 5 — prawo i organizacja (poza kodem)
- ⬜ Wzór umowy powierzenia, lista podwykonawców, RoPA, procedura incydentu — z prawnikiem
- ⬜ Polityka prywatności i regulamin (dane podmiotu)
- ⬜ Wybór hostingu strony (docs/todo-compliance.md), OC/cyber
- ⬜ JDG → sp. z o.o. przed pierwszym dużym klientem (docs/migration-to-spolka.md)
