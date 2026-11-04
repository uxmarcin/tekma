# Tekma app — przebudowa 1:1 z Figmą (strona „📱 App screens”)

Figma: plik `qhcKkp18fdKpPfZadblsaK`, sesja MCP `44ec2415-028f-4f0d-968e-6e5e455d709c` (create_session już zrobione — używaj tego sessionId).
Ekrany (id ramki → ekran) — 46 sztuk, sekcje 53:5907…53:5914:
Start: 22:1686 Rejestracja, 22:1908 Logowanie, 22:2118/22:2175/22:2233 Onboarding 1-3.
Pulpit: 9:2 Pulpit, 32:5484 Pulpit pusty, 32:5680 Powiadomienia, 32:5867 Wyszukiwarka ⌘K, 33:5764 Mobile Pulpit, 33:5834 Mobile Kandydat.
Rekrutacja: 9:380 Stanowiska, 24:2100 Nowe stanowisko 1, 24:2341 Nowe stanowisko 2, 26:3069 Rubryki, 11:832 Rubryka edytor, 27:2992 Biblioteka szablonów, 26:2814 Stanowisko Zespół, 26:2568 Stanowisko Ogłoszenie, 13:1684 Strona kariery, 13:1741 Portal kandydata mobile.
Pipeline: 10:435 Pipeline, 13:1345 Kandydaci, 24:2629 Stanowisko Raport.
Rozmowa: 10:780 Scorecard, 28:3679 Rozmowa na żywo (coach AI), 28:3798 Ocena po rozmowie, 27:3249 Porównanie, 27:3550 Modal Odrzuć, 27:3756 Modal Przesuń dalej.
Po zatrudnieniu: 11:1105 Osoba, 29:3709 Ludzie, 29:3934 1:1, 29:4159 Check-iny, 30:4101 Cele osoby, 30:4335 Szkolenia, 12:1085 Cele, 30:4549 Check-in mobile, 30:4590 Powtórka z kursu mobile.
Ustawienia: 31:4384 Firma, 31:4585 Zespół i uprawnienia, 31:4872 Integracje, 31:5113 Plan i płatności, 12:1352 RODO i AI Act.
Marketplace: 32:4954 Marketplace, 32:5281 Profil rekrutera.

## Zasady
- Cel: wizualnie 1:1 z Figmą — układ, odstępy, rozmiary i wagi fontów, promienie, kolory, ikony, treści (polskie teksty i dane z ramki przepisz dokładnie, to ma być dane demo), stany. Dla każdego swojego ekranu: `get_design_context` (kod referencyjny + screenshot) i `get_screenshot` z `enableBase64Response:true` (shell nie ma dostępu do figma.com — nie używaj curl). Szczegóły (wymiary, fonty, kolory) czytaj z design_context, nie zgaduj z oka.
- Żadnych nowych zależności ani builda: vanilla ES, `ui.js` (h, icon, button, …), tokeny z `site/app/app.css` (nazwy tokenów są stałe; nie zmieniaj ich). Ikony: nowe dopisuj lokalnie w swoim pliku (SVG inline), nie edytuj ui.js (poza agentem A).
- Własność plików: edytuj TYLKO swoje pliki `site/app/js/views/<nazwa>.js` + `<nazwa>.css` (ładowane przez ui.loadCss). Wspólne pliki (router.js, app.css, ui.js, store.js, local.js, supabase.js, seed.js) należą do agenta A — jeśli potrzebujesz zmiany, zrób ją lokalnie w swoim widoku albo opisz w raporcie. Trasy są już w router.js (ROUTES) — nie zmieniaj.
- Dane: istniejące encje (positions, candidates, rubrics, scorecards) przez `ctx.store`. Nowe encje (ludzie, cele, check-iny, powiadomienia, rekruterzy, ustawienia, plan…) — plik `js/views/<obszar>-data.js` z danymi demo z Figmy, zapis w localStorage (`tekma.demo.<obszar>`), bez zmian schematu bazy. Akcje (przyciski) mają działać sensownie na tych danych (przełączanie zakładek, filtry, dodawanie, zapisywanie), a nie być martwe; zasada AI Act z docs/app-contract.md obowiązuje (AI tylko sugeruje).
- Responsywność: ekrany desktop 1440; ramki mobile 390 odwzoruj dokładnie, a pozostałe widoki muszą być sensowne na 390 (bez poziomego scrolla).
- Dostępność: kontrast, focus, role, klawiatura. Ciemny motyw (prefers-color-scheme) ma nie psuć widoku (używaj tokenów).
- Test: serwuj `cd /home/claude/tekma-repo/site && python3 -m http.server <TWÓJ_PORT>`; tryb demo = podmień config przez Playwright: `page.route('**/js/config.js', r=>r.fulfill({contentType:'text/javascript', body:"export const SUPABASE_URL='';export const SUPABASE_ANON_KEY='';"}))`. Playwright/Chromium zainstalowane (require('playwright'), deviceScaleFactor 1). Zrób screenshoty swoich ekranów w 1440 (i 390 gdzie dotyczy) i porównaj z screenshotem Figmy — iteruj aż różnice będą niezauważalne (sprawdzaj: wysokość nagłówka, szerokości kolumn, padding kart, rozmiary fontów, kolory chipów, grubość linii). NIE używaj `pkill -f http.server` (zabija powłokę) — zabij tylko własny PID.
- Nie commituj i nie pushuj (robi to koordynator). Pracuj w katalogu /home/claude/tekma-repo na gałęzi wip-figma-parity.
- Raport końcowy (≤200 słów): zbudowane widoki/pliki, odstępstwa od Figmy, rzeczy do zmiany we wspólnych plikach, wyniki testów.
