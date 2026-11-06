#!/usr/bin/env python3
"""Generuje blog „hiring playbooks”, artykuł EN i stronę porównawczą z jednego szablonu.

Źródła treści: tools/blog/src/<slug>.html (sam środek artykułu).
Metadane, FAQ, źródła i tabela porównawcza: ten plik.
Wynik: site/blog/*.html, site/en/interview-scorecard.html, site/tekma-vs-arkusz-vs-ats.html
Uruchom z katalogu głównego repo:  python3 tools/blog/build.py
Skrypt nie rusza site/app/ ani istniejących stron (do nich: tools/blog/patch_site.py).
"""
import json, os, re, html

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SITE = os.path.join(ROOT, 'site')
SRC = os.path.join(ROOT, 'tools', 'blog', 'src')
BASE = 'https://tekma.app/'
CSS_V = 'light13'
BLOG_V = '1'
TODAY = '2026-11-06'
ACCESS = 'mailto:hello@tekma.app?subject=Wcze%C5%9Bniejszy%20dost%C4%99p%20do%20Tekmy'
SIGNUP = 'app/index.html#/signup'
MONTHS = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia']

_index = open(os.path.join(SITE, 'index.html'), encoding='utf-8').read()
SPRITE = re.search(r'<svg width="0" height="0" style="position:absolute" aria-hidden="true">.*?</svg>', _index, re.S).group(0)
DIALOG = re.search(r'<dialog class="access".*?</dialog>', _index, re.S).group(0)

# ---------------------------------------------------------------- treści
ARTICLES = [
 dict(slug='jak-zatrudnic-pierwszego-programiste', tag='Rekrutacja techniczna',
  h1='Jak zatrudnić pierwszego programistę: plan krok po kroku',
  card='Jak zatrudnić pierwszego programistę',
  title='Jak zatrudnić pierwszego programistę — plan krok po kroku | Tekma',
  desc='Jak zatrudnić pierwszego programistę w firmie: rezultaty na 90 dni, forma współpracy, ogłoszenie z widełkami, proces w kilku krokach i ocena rubryką.',
  lede='Pierwszy programista nie ma nad sobą seniora, który sprawdzi jego kod, ani działu HR, który dopilnuje procesu. Dlatego rekrutację warto ułożyć z góry: od rezultatów na 90 dni, przez ogłoszenie z widełkami, po ocenę tą samą rubryką.',
  keywords=['jak zatrudnić pierwszego programistę', 'rekrutacja programisty', 'zatrudnienie programisty', 'pierwszy programista w firmie'],
  related=['rubryka-oceny-rozmowy-rekrutacyjnej', 'widelki-plac-w-ogloszeniu', 'onboarding-30-60-90-dni'],
  sources=[
   ('P. R. Sackett, C. Zhang, C. M. Berry, F. Lievens (2022), Revisiting meta-analytic estimates of validity in personnel selection, Journal of Applied Psychology 107, 2040–2068', 'https://doi.org/10.1037/apl0000994', 'DOI'),
   ('UODO, Ochrona danych osobowych w miejscu pracy. Poradnik dla pracodawców (rozdział o rekrutacji)', 'https://uodo.gov.pl/file/1469', 'uodo.gov.pl'),
   ('Ustawa z 4 czerwca 2025 r. o zmianie ustawy – Kodeks pracy (Dz.U. 2025 poz. 807)', 'https://eli.gov.pl/eli/DU/2025/807/ogl', 'eli.gov.pl'),
  ]),
 dict(slug='scorecard-rekrutacyjny', tag='Ocena kandydatów',
  h1='Scorecard rekrutacyjny: jak zbudować kartę oceny kandydata',
  card='Scorecard rekrutacyjny (karta oceny kandydata)',
  title='Scorecard rekrutacyjny — jak zbudować kartę oceny kandydata | Tekma',
  desc='Scorecard rekrutacyjny, czyli karta oceny kandydata: kryteria, wagi, skala z opisami, dowody i przykład wyniku ważonego. Jak zbudować i używać karty w 7 krokach.',
  lede='Scorecard rekrutacyjny to karta oceny, którą każdy rozmówca wypełnia o każdym kandydacie według tych samych zasad. Dzięki niej decyzja opiera się na zapisanych dowodach, a nie na wrażeniu po kilku rozmowach.',
  keywords=['scorecard rekrutacyjny', 'karta oceny kandydata', 'scorecard rekrutacja', 'ocena kandydatów'],
  related=['rubryka-oceny-rozmowy-rekrutacyjnej', 'jak-zatrudnic-pierwszego-programiste', 'ai-act-a-rekrutacja'],
  hreflang_en='en/interview-scorecard.html',
  sources=[
   ('P. R. Sackett, C. Zhang, C. M. Berry, F. Lievens (2022), Revisiting meta-analytic estimates of validity in personnel selection, Journal of Applied Psychology 107, 2040–2068', 'https://doi.org/10.1037/apl0000994', 'DOI'),
   ('Kodeks pracy (tekst jednolity), art. 18³ᵃ i następne oraz art. 22¹ — Internetowy System Aktów Prawnych', 'https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19740240141', 'isap.sejm.gov.pl'),
   ('UODO, Ochrona danych osobowych w miejscu pracy. Poradnik dla pracodawców (rozdział o rekrutacji)', 'https://uodo.gov.pl/file/1469', 'uodo.gov.pl'),
   ('Ustawa z 4 czerwca 2025 r. o zmianie ustawy – Kodeks pracy (Dz.U. 2025 poz. 807)', 'https://eli.gov.pl/eli/DU/2025/807/ogl', 'eli.gov.pl'),
  ]),
 dict(slug='ai-act-a-rekrutacja', tag='Prawo i zgodność',
  h1='AI Act a rekrutacja: co musi wiedzieć pracodawca',
  card='AI Act a rekrutacja',
  title='AI Act a rekrutacja — co musi wiedzieć pracodawca | Tekma',
  desc='AI w rekrutacji to w AI Act system wysokiego ryzyka. Terminy po zmianach, obowiązki pracodawcy, zakazy, związek z RODO i lista kontrolna na dziś.',
  lede='Systemy AI do rekrutacji i selekcji są w AI Act zaliczone do wysokiego ryzyka. Wyjaśniamy, od kiedy obowiązują wymogi, co spoczywa na pracodawcy jako użytkowniku narzędzia i co możesz zrobić już teraz.',
  keywords=['AI Act a rekrutacja', 'AI Act rekrutacja', 'system wysokiego ryzyka rekrutacja', 'AI w rekrutacji RODO'],
  related=['scorecard-rekrutacyjny', 'widelki-plac-w-ogloszeniu', 'jak-zatrudnic-pierwszego-programiste'],
  faq=[
   ('Czy AI Act obowiązuje już w rekrutacji?', 'Częściowo. Zakazy z art. 5, w tym zakaz wnioskowania o emocjach w miejscu pracy, obowiązują od 2 lutego 2025 r. Wymogi dla systemów wysokiego ryzyka z załącznika III, do których należy AI w rekrutacji, mają według zmian zatwierdzonych przez Radę UE 29 czerwca 2026 r. zacząć obowiązywać 2 grudnia 2027 r. RODO obowiązuje już dziś, niezależnie od AI Act.'),
   ('Czy arkusz albo ręczna ocena CV podlegają AI Act?', 'AI Act reguluje systemy AI. Ręczna ocena kandydatów i arkusz ze zwykłymi formułami nie są systemem AI. Narzędzie, które za pomocą modelu uczenia maszynowego układa kandydatów w ranking, filtruje podania lub ocenia odpowiedzi, w rekrutacji należy traktować jako system wysokiego ryzyka.'),
   ('Czy muszę informować kandydatów, że używam AI?', 'RODO wymaga poinformowania kandydata o przetwarzaniu danych już dziś (art. 13). Po rozpoczęciu stosowania przepisów dla systemów wysokiego ryzyka art. 26 ust. 11 AI Act wymaga też informowania osób, wobec których system podejmuje lub wspiera decyzje. Najprościej zrobić to od razu: w ogłoszeniu lub klauzuli informacyjnej.'),
   ('Czy AI może automatycznie odrzucać kandydatów?', 'Art. 22 RODO daje prawo do niepodlegania decyzji opartej wyłącznie na zautomatyzowanym przetwarzaniu, jeśli wywołuje skutki prawne lub w podobny sposób istotnie wpływa na osobę. Odrzucenie kandydata bez udziału człowieka jest scenariuszem, którego warto unikać. W Tekmie AI nigdy nie odrzuca kandydatów; tylko proponuje ocenę, a decyzję podejmuje człowiek.'),
  ],
  sources=[
   ('Rada UE, oś czasu aktu o sztucznej inteligencji (m.in. porozumienie z 7 maja 2026 r. i ostateczna zgoda Rady z 29 czerwca 2026 r.)', 'https://www.consilium.europa.eu/en/policies/artificial-intelligence-act/timeline-artificial-intelligence/', 'consilium.europa.eu'),
   ('Rozporządzenie (UE) 2024/1689 (AI Act): załącznik III pkt 4, art. 5, art. 6, art. 26 — EUR-Lex', 'https://eur-lex.europa.eu/legal-content/PL/TXT/?uri=CELEX:32024R1689', 'eur-lex.europa.eu'),
   ('Rozporządzenie (UE) 2016/679 (RODO): art. 13 i art. 22 — EUR-Lex', 'https://eur-lex.europa.eu/legal-content/PL/TXT/?uri=CELEX:32016R0679', 'eur-lex.europa.eu'),
   ('UODO, Ochrona danych osobowych w miejscu pracy. Poradnik dla pracodawców (rozdział o rekrutacji)', 'https://uodo.gov.pl/file/1469', 'uodo.gov.pl'),
   ('Wolters Kluwer, The Prohibition of AI Emotion Recognition Technologies in the Workplace under the AI Act (komentarz do wytycznych Komisji Europejskiej)', 'https://legalblogs.wolterskluwer.com/global-workplace-law-and-policy/the-prohibition-of-ai-emotion-recognition-technologies-in-the-workplace-under-the-ai-act/', 'komentarz, nie źródło urzędowe'),
  ]),
 dict(slug='rubryka-oceny-rozmowy-rekrutacyjnej', tag='Ocena kandydatów',
  h1='Rubryka oceny rozmowy rekrutacyjnej: jak ją napisać i stosować',
  card='Rubryka oceny rozmowy rekrutacyjnej',
  title='Rubryka oceny rozmowy rekrutacyjnej — wzór z opisami ocen | Tekma',
  desc='Rubryka oceny rozmowy rekrutacyjnej: kryteria, wagi, pytania i opisy ocen 1–5. Przykład wypełnionej rubryki, zasady pisania kotwic i pytań, czego nie pytać.',
  lede='Rubryka zapisuje przed rozmową, jakie zachowania odpowiadają każdej ocenie. Dzięki temu dwie osoby słuchające tej samej odpowiedzi dochodzą do porównywalnych wniosków.',
  keywords=['rubryka oceny rozmowy rekrutacyjnej', 'ocena rozmowy rekrutacyjnej', 'kryteria oceny kandydata', 'pytania behawioralne rekrutacja'],
  related=['scorecard-rekrutacyjny', 'jak-zatrudnic-pierwszego-programiste', 'widelki-plac-w-ogloszeniu'],
  sources=[
   ('Kodeks pracy (tekst jednolity), art. 22¹ i art. 18³ᵃ — Internetowy System Aktów Prawnych', 'https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19740240141', 'isap.sejm.gov.pl'),
   ('Ustawa z 4 czerwca 2025 r. o zmianie ustawy – Kodeks pracy (Dz.U. 2025 poz. 807)', 'https://eli.gov.pl/eli/DU/2025/807/ogl', 'eli.gov.pl'),
   ('UODO, Ochrona danych osobowych w miejscu pracy. Poradnik dla pracodawców (rozdział o rekrutacji)', 'https://uodo.gov.pl/file/1469', 'uodo.gov.pl'),
  ]),
 dict(slug='widelki-plac-w-ogloszeniu', tag='Prawo i zgodność',
  h1='Widełki płacowe w ogłoszeniu o pracę i jawność wynagrodzeń',
  card='Widełki płacowe w ogłoszeniu i jawność wynagrodzeń',
  title='Widełki płacowe w ogłoszeniu i jawność wynagrodzeń — co mówi prawo | Tekma',
  desc='Widełki płacowe w ogłoszeniu o pracę: co od 24 grudnia 2025 r. wynika z Kodeksu pracy, zakaz pytania o dotychczasowe zarobki i jak ustalić widełki, które się bronią.',
  lede='Od 24 grudnia 2025 r. kandydat musi dostać informację o wynagrodzeniu z wyprzedzeniem, a pracodawca nie może pytać o zarobki z poprzednich prac. Sprawdzamy, co to znaczy w praktyce i jak ustalić widełki.',
  keywords=['widełki płacowe w ogłoszeniu', 'jawność wynagrodzeń', 'jawność wynagrodzeń w ogłoszeniach o pracę', 'dyrektywa o przejrzystości wynagrodzeń'],
  related=['jak-zatrudnic-pierwszego-programiste', 'rubryka-oceny-rozmowy-rekrutacyjnej', 'ai-act-a-rekrutacja'],
  faq=[
   ('Czy muszę podać widełki w treści ogłoszenia?', 'Kodeks pracy (art. 18³ᶜᵃ) wymaga, by kandydat dostał informację o wynagrodzeniu z wyprzedzeniem: w ogłoszeniu o naborze, a jeśli nie ogłoszono naboru, przed rozmową kwalifikacyjną; jeśli nie zrobiono tego wcześniej, przed nawiązaniem stosunku pracy. Najprostszym i najbezpieczniejszym sposobem jest umieszczenie widełek w ogłoszeniu.'),
   ('Czy mogę zapytać kandydata o dotychczasowe zarobki?', 'Nie. Od 24 grudnia 2025 r. informacje o wynagrodzeniu w obecnym i poprzednich stosunkach pracy nie mieszczą się w zakresie danych, których pracodawca może żądać od kandydata (art. 22¹ § 1 pkt 6 Kodeksu pracy). Pytanie o oczekiwania wobec przyszłego wynagrodzenia to co innego.'),
   ('Czy przepis dotyczy też współpracy B2B?', 'Przepisy z grudnia 2025 r. znajdują się w Kodeksie pracy i dotyczą kandydatów do zatrudnienia na jego podstawie. Przy współpracy B2B podawanie widełek jest dobrą praktyką, ale nie wynika wprost z tego przepisu. W razie wątpliwości skonsultuj się z prawnikiem.'),
   ('Czy dyrektywa o przejrzystości wynagrodzeń jest już wdrożona w Polsce?', 'Termin wdrożenia dyrektywy (UE) 2023/970 upłynął 7 czerwca 2026 r. Według opracowań z połowy 2026 r. Polska nie miała jeszcze pełnej ustawy wdrażającej; projekt był na etapie konsultacji. Sprawdź aktualny stan prac przed zmianą procedur.'),
  ],
  sources=[
   ('Ustawa z 4 czerwca 2025 r. o zmianie ustawy – Kodeks pracy (Dz.U. 2025 poz. 807), art. 18³ᶜᵃ i art. 22¹ § 1 pkt 6 — ELI', 'https://eli.gov.pl/eli/DU/2025/807/ogl', 'eli.gov.pl'),
   ('Państwowa Inspekcja Pracy (OIP Białystok), Jawność wynagrodzeń i równość szans. Nowe obowiązki pracodawców na przełomie roku 2025/2026', 'https://bialystok.pip.gov.pl/aktualnosci/jawnosc-wynagrodzen-i-rownosc-szans-nowe-obowiazki-pracodawcow-na-przelomie-roku-2025-2026', 'pip.gov.pl'),
   ('Dyrektywa (UE) 2023/970 w sprawie wzmocnienia stosowania zasady równości wynagrodzeń — EUR-Lex', 'https://eur-lex.europa.eu/legal-content/PL/TXT/?uri=CELEX:32023L0970', 'eur-lex.europa.eu'),
   ('Domański Zakrzewski Palinka, Nowy projekt ustawy o równości i jawności płac (UC 127), 5 maja 2026 r.', 'https://www.dzp.pl/blog/labour/wynagrodzenia/nowy-projekt-ustawy-o-rownosci-i-jawnosci-plac', 'komentarz, nie źródło urzędowe'),
   ('Infor.pl, 7 czerwca 2026 r. minął termin na wdrożenie dyrektywy o jawności wynagrodzeń (stan z 28 sierpnia 2026 r.)', 'https://kadry.infor.pl/kadry/wynagrodzenia/ochrona_wynagrodzenia/7602279,czy-pracownik-moze-zadac-podania-wysokosci-zarobkow-kolegow-7-czerwca-2026-r-minal-termin-na-wdrozenie-dyrektywy-o-jawnosci-wynagrodzen-polska-opoznia-sie-z-ustawa.html', 'komentarz, nie źródło urzędowe'),
  ]),
 dict(slug='onboarding-30-60-90-dni', tag='Po zatrudnieniu',
  h1='Onboarding 30-60-90 dni: plan pierwszych trzech miesięcy',
  card='Onboarding 30-60-90 dni',
  title='Onboarding 30-60-90 dni — plan i pytania na przeglądy | Tekma',
  desc='Plan onboardingu 30-60-90 dni: co przygotować przed startem, cele na każdy miesiąc, pytania na przeglądy w dniach 7, 30, 60 i 90 oraz najczęstsze błędy.',
  lede='Plan 30-60-90 dzieli pierwsze trzy miesiące na etapy: poznawanie, współtworzenie, odpowiedzialność. Dostajesz szablon, listę rzeczy do przygotowania przed startem i pytania na każdy przegląd.',
  keywords=['onboarding 30-60-90 dni', 'plan 30 60 90 dni', 'plan wdrożenia nowego pracownika', 'onboarding pracownika'],
  related=['jak-zatrudnic-pierwszego-programiste', 'scorecard-rekrutacyjny', 'rubryka-oceny-rozmowy-rekrutacyjnej'],
  sources=[]),
]
EN = dict(slug='interview-scorecard', lang='en', tag='English',
  h1='Interview scorecard: how to build one (with an example)',
  card='Interview scorecard: how to build one',
  title='Interview scorecard — how to build one, with an example | Tekma',
  desc='An interview scorecard turns interview impressions into comparable evidence. Criteria, weights, scale anchors, a worked example and common mistakes.',
  lede='An interview scorecard is a one-page form every interviewer fills in about every candidate, using the same rules. It makes the hiring decision rest on written evidence instead of on the blur after a few conversations.',
  keywords=['interview scorecard', 'candidate scorecard', 'hiring scorecard', 'structured interview'],
  hreflang_pl='blog/scorecard-rekrutacyjny.html',
  sources=[('P. R. Sackett, C. Zhang, C. M. Berry, F. Lievens (2022), Revisiting meta-analytic estimates of validity in personnel selection, Journal of Applied Psychology 107, 2040–2068', 'https://doi.org/10.1037/apl0000994', 'DOI')],
  related=[])
COMPARE = dict(slug='tekma-vs-arkusz-vs-ats', path='tekma-vs-arkusz-vs-ats.html', tag='Porównanie',
  h1='Tekma vs arkusz vs ATS: czym prowadzić rekrutację?',
  card='Tekma vs arkusz vs ATS',
  title='Tekma vs arkusz vs ATS — porównanie narzędzi do rekrutacji',
  desc='Porównanie trzech sposobów prowadzenia rekrutacji: arkusz kalkulacyjny, klasyczny ATS i Tekma. Tabela funkcji, koszt, RODO i wskazówki, co wybrać.',
  lede='Rekrutację da się prowadzić w arkuszu, w klasycznym systemie ATS albo w narzędziu zbudowanym wokół oceny kandydatów. Porównujemy je uczciwie: co każde robi dobrze, czego nie robi i kiedy warto wybrać które.',
  keywords=['Tekma vs ATS', 'arkusz czy ATS rekrutacja', 'porównanie ATS', 'rekrutacja w excelu'],
  faq=[
   ('Czy Tekma zastępuje ATS?', 'To zależy od tego, czego potrzebujesz od ATS. Tekma obejmuje kanban kandydatów, rubryki i karty ocen, notetaker, portal kandydata, stronę kariery i plan pierwszych 90 dni. Jeśli głównym zadaniem jest masowa publikacja ogłoszeń na wielu portalach albo rozbudowane raporty dla działu rekrutacji, sprawdź, czy ten zakres Ci wystarcza. Jeśli masz już ATS, możesz zaimportować z niego kandydatów i historię etapów.'),
   ('Czy mogę zacząć od arkusza i przejść do Tekmy później?', 'Tak. Tekma przyjmuje import kandydatów i historii etapów z pliku CSV. Żeby przeniesienie było łatwiejsze, prowadź w arkuszu jedną kolumnę na każde kryterium rubryki i osobną zakładkę na każdego rozmówcę.'),
   ('Ile kosztuje Tekma?', 'Plan Free kosztuje 0 € i obejmuje 1 otwarte stanowisko oraz 5 rozmów z analizą AI miesięcznie, razem z rubrykami, notetakerem, kartami ocen, stroną kariery i portalem kandydata. Plan Pro kosztuje 129 € miesięcznie i obejmuje stanowiska bez limitu oraz 60 rozmów z analizą AI miesięcznie, potem 2 € za rozmowę. Scale wyceniamy indywidualnie. Osoby z zespołu dodajesz bez opłat, a kandydaci zawsze korzystają z portalu za darmo.'),
   ('Czy rekrutacja w arkuszu może być zgodna z RODO?', 'Może, ale pilnowanie zgodności spoczywa wtedy w całości na Tobie: informowanie kandydatów, ograniczanie dostępu do pliku i usuwanie danych po zakończeniu rekrutacji. UODO wskazuje, że dane kandydatów, z którymi nie zawarto umowy, co do zasady należy usunąć niezwłocznie po rekrutacji, chyba że kandydat zgodził się na dłuższe przechowywanie. W arkuszach rozsyłanych e-mailem trudno to dopilnować.'),
   ('Czy AI w Tekmie decyduje o kandydatach?', 'Nie. AI proponuje ocenę z cytatem z rozmowy i pokazuje dopasowanie CV z wyjaśnieniem, ale nigdy nie odrzuca ani nie przesuwa kandydatów. Decyzję podejmuje człowiek, po dwóch niezależnych ocenach.'),
  ],
  sources=[])

# legenda: y = tak, m = częściowo / zależy, n = brak, '' = bez oceny
CMP = [
 ('Ocena kandydatów', [
  ('Te same pytania i opisy ocen (rubryka)', ('m', 'Możliwe ręcznie: osobna zakładka z pytaniami. Spójność zależy od Ciebie.'), ('m', 'Zwykle są karty oceny; zakres i opisy ocen różnią się między produktami.'), ('y', 'Edytor rubryki: pytanie, waga, czas i opis każdej oceny; szablony per rola.')),
  ('Niezależne oceny rozmówców', ('n', 'Trudne do wymuszenia: ukryta kolumna albo osobne pliki, w które łatwo zajrzeć.'), ('m', 'Zależy od produktu; ukrywanie ocen do czasu wysłania własnej bywa opcją.'), ('y', 'Oceny innych widać dopiero po wysłaniu własnej. Decyzja po dwóch ocenach.')),
  ('Wynik ważony i rozbieżności', ('m', 'Formuły, które sam piszesz i utrzymujesz.'), ('m', 'Zależy od produktu.'), ('y', 'Wynik liczony z wag pytań; rozbieżność 2+ punkty dostaje flagę.')),
  ('Transkrypcja rozmów', ('n', 'Notatki ręczne.'), ('m', 'Zwykle przez integrację z innym narzędziem.'), ('y', 'Notetaker dołącza do rozmów (kalendarz Google, Zoom), nagrywa za zgodą kandydata i transkrybuje po polsku i angielsku.')),
  ('Podpowiedzi AI', ('n', 'Brak.'), ('m', 'Coraz częściej, o różnym zakresie.'), ('y', 'Propozycja oceny z cytatem, dopasowanie CV 0–100 z wyjaśnieniem. AI nigdy nie odrzuca kandydatów.')),
 ]),
 ('Proces rekrutacji', [
  ('Śledzenie kandydatów', ('m', 'Kolumna „etap”, ręczne aktualizacje i brak przypomnień.'), ('y', 'Mocna strona: etapy, powiadomienia, filtry.'), ('y', 'Kanban etapów, dni bez ruchu, przypomnienia, filtry (źródło, ocena AI, właściciel).')),
  ('Publikacja ogłoszeń', ('n', 'Poza arkuszem.'), ('y', 'Często publikacja na wielu portalach jednym kliknięciem (zależy od produktu i integracji).'), ('m', 'Strona kariery i szablony grafik do ogłoszeń (LinkedIn, Instagram, Story, Facebook) z widełkami.')),
  ('Komunikacja z kandydatem', ('n', 'Poczta poza arkuszem.'), ('y', 'Szablony wiadomości i historia korespondencji.'), ('y', 'Portal kandydata ze statusem etapu; korespondencja z Gmaila w jednym wątku.')),
 ]),
 ('Dane i zgodność', [
  ('RODO: zgody i retencja', ('n', 'Usuwanie danych po rekrutacji i kontrola dostępu spoczywają na Tobie.'), ('m', 'Zwykle są zgody i retencja; zakres zależy od produktu.'), ('y', 'Zgody i okres przechowywania zapisane przy aplikacji; kandydat pobiera, poprawia lub usuwa dane w portalu. Dane w UE.')),
  ('Nadzór nad AI i rejestr decyzji', ('', 'Nie dotyczy (brak AI).'), ('m', 'Zależy od dostawcy: dopytaj o dokumentację i logi.'), ('y', 'Rejestr podpowiedzi AI z wersją modelu i decyzją człowieka; nadzór człowieka wbudowany.')),
 ]),
 ('Po zatrudnieniu', [
  ('Plan 90 dni, 1:1, check-iny', ('n', 'Osobne pliki i przypomnienia w kalendarzu.'), ('n', 'Zwykle poza zakresem: to oddzielny moduł lub inne narzędzie.'), ('y', 'Plan z przeglądami w dniach 7, 30, 60 i 90, 1:1 ze wspólną agendą, check-in nastroju, cele.')),
 ]),
 ('Koszt i wdrożenie', [
  ('Koszt', ('', '0 zł, jeśli masz już Excela lub Google Workspace.'), ('', 'Abonament zależny od produktu i liczby użytkowników.'), ('', 'Free 0 €, Pro 129 € / mies., Scale indywidualnie. Osoby z zespołu bez opłat, kandydaci za darmo.')),
  ('Czas startu', ('', 'Godziny, jeśli masz gotowy wzór.'), ('', 'Od dni do tygodni, zależnie od konfiguracji.'), ('', 'Pierwsze stanowisko w około 5 minut, z szablonu lub z opisu stanowiska.')),
  ('Elastyczność', ('y', 'Pełna: zmienisz wszystko.'), ('m', 'Duża, ale w granicach produktu.'), ('m', 'Rubryki i etapy edytujesz. Opiera się na ustrukturyzowanej rozmowie i niezależnej ocenie.')),
 ]),
]

# ---------------------------------------------------------------- pomocnicze
def esc(s): return html.escape(s, quote=True)
def pl_date(iso):
    y, m, d = iso.split('-'); return f'{int(d)} {MONTHS[int(m)-1]} {y}'
def jsonld(obj):
    return '<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/') + '</script>'
def read(slug): return open(os.path.join(SRC, slug + '.html'), encoding='utf-8').read()
def words(s): return len(re.sub(r'<[^>]+>', ' ', s).split())
def relpath(frm_dir, to):  # ścieżki względem site/
    r = os.path.relpath(to, frm_dir or '.')
    return r.replace(os.sep, '/')
def faq_html(faq):
    out = ['<div class="faq">']
    for i, (q, a) in enumerate(faq):
        out.append(f'<details{" open" if i == 0 else ""}><summary>{esc(q)}</summary><p>{esc(a)}</p></details>')
    out.append('</div>')
    return ''.join(out)
def faq_ld(faq):
    return {'@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in faq]}

ORG = {'@type': 'Organization', '@id': BASE + '#org', 'name': 'Tekma', 'url': BASE, 'logo': BASE + 'assets/icon-512.png'}

# ---------------------------------------------------------------- szkielet
def head(p, a, canonical, extra_links='', ld=None, og_type='website', published=None, lang='pl'):
    loc = 'en_US' if lang == 'en' else 'pl_PL'
    t, d = esc(a['title']), esc(a['desc'])
    parts = [f'<!doctype html>\n<html lang="{lang}">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">',
      f'<title>{t}</title>', f'<meta name="description" content="{d}">', '<meta name="theme-color" content="#ffffff">',
      f'<link rel="icon" href="{p}assets/favicon.svg" type="image/svg+xml">', f'<link rel="icon" href="{p}favicon.ico" sizes="48x48">',
      f'<link rel="apple-touch-icon" href="{p}apple-touch-icon.png">', f'<link rel="manifest" href="{p}site.webmanifest">',
      f'<link rel="canonical" href="{BASE}{canonical}">', extra_links,
      f'<meta property="og:type" content="{og_type}">', '<meta property="og:site_name" content="Tekma">', f'<meta property="og:locale" content="{loc}">',
      f'<meta property="og:title" content="{t}">', f'<meta property="og:description" content="{d}">', f'<meta property="og:url" content="{BASE}{canonical}">',
      f'<meta property="og:image" content="{BASE}assets/og.png">', '<meta property="og:image:width" content="1200">', '<meta property="og:image:height" content="630">']
    if published:
        parts += [f'<meta property="article:published_time" content="{published}">', f'<meta property="article:modified_time" content="{TODAY}">', f'<meta property="article:section" content="{esc(a["tag"])}">']
    parts += ['<meta name="twitter:card" content="summary_large_image">', f'<meta name="twitter:title" content="{t}">', f'<meta name="twitter:description" content="{d}">', f'<meta name="twitter:image" content="{BASE}assets/og.png">',
      f'<link rel="preload" href="{p}assets/fonts/InterDisplay-SemiBold.woff" as="font" type="font/woff" crossorigin>',
      f'<link rel="preload" href="{p}assets/fonts/Inter-Regular.woff" as="font" type="font/woff" crossorigin>',
      "<script>document.documentElement.classList.add('js')</script>",
      f'<link rel="stylesheet" href="{p}assets/landing.css?v={CSS_V}">', f'<link rel="stylesheet" href="{p}assets/blog.css?v={BLOG_V}">']
    if ld: parts.append(jsonld({'@context': 'https://schema.org', '@graph': ld}))
    parts.append('</head>\n<body>')
    return '\n'.join(parts) + '\n'

def header(p, current=None, lang='pl'):
    if lang == 'en':
        links = [('produkt.html', 'Product'), ('ai.html', 'AI in Tekma'), ('blog/', 'Playbooks (PL)'), ('/#cennik', 'Pricing')]
        right = f'<a class="login" href="{p}app/">Log in</a><a class="btn btn-ink btn-sm" href="{p}{SIGNUP}">Start free</a>'
        mright = f'<a href="{p}app/">Log in</a><a class="btn btn-ink" href="{p}{SIGNUP}">Start free</a>'
    else:
        links = [('produkt.html', 'Produkt'), ('integracje.html', 'Integracje'), ('ai.html', 'AI w Tekmie'), ('dla-kandydatow.html', 'Dla kandydatów'), ('blog/', 'Blog'), ('/#cennik', 'Cennik')]
        right = f'<a class="login" href="{p}app/">Zaloguj się</a><a data-access class="btn btn-ink btn-sm" href="{ACCESS}">Poproś o dostęp</a>'
        mright = f'<a href="{p}app/">Zaloguj się</a><a data-access class="btn btn-ink" href="{ACCESS}">Poproś o wcześniejszy dostęp</a>'
    def href(h): return h if h.startswith('/') else p + h
    nl = ''.join(f'<a href="{href(h)}"{" aria-current=\"page\"" if h == current else ""}>{t}</a>' for h, t in links)
    ml = ''.join(f'<a href="{href(h)}">{t}</a>' for h, t in links)
    return f'''{SPRITE}
<header class="nav" id="nav">
  <div class="wrap nav-in">
    <a class="logo" href="/" aria-label="Tekma — {"home" if lang == "en" else "strona główna"}"><svg aria-hidden="true"><use href="#mark"/></svg>tekma</a>
    <nav class="nav-links" aria-label="{"Main" if lang == "en" else "Główna nawigacja"}">{nl}</nav>
    <div class="nav-r">{right}</div>
    <button class="burger" id="burger" aria-label="Menu" aria-expanded="false" aria-controls="mmenu"><span></span></button>
  </div>
  <div class="mmenu" id="mmenu">{ml}{mright}</div>
</header>
'''

def footer(p, lang='pl'):
    if lang == 'en':
        return f'''<footer class="foot">
  <div class="wrap">
    <div class="brand"><a class="logo" href="/"><svg aria-hidden="true"><use href="#mark"/></svg>tekma</a><p>© 2026 Tekma · Rzeszów, Poland · data in the EU</p></div>
    <div class="foot-cols">
      <div><h5>Product</h5><ul><li><a href="{p}produkt.html">Rubrics and scorecards (PL)</a></li><li><a href="{p}ai.html">AI in Tekma (PL)</a></li></ul></div>
      <div><h5>Playbooks</h5><ul><li><a href="{p}blog/">Hiring playbooks (PL)</a></li><li><a href="{p}blog/scorecard-rekrutacyjny.html">Scorecard rekrutacyjny (PL)</a></li></ul></div>
      <div><h5>Company</h5><ul><li><a href="mailto:hello@tekma.app">Contact</a></li></ul></div>
    </div>
  </div>
</footer>
<script src="{p}assets/landing.js?v=mesh1" defer></script>
</body>
</html>
'''
    return f'''<footer class="foot">
  <div class="wrap">
    <div class="brand"><a class="logo" href="/"><svg aria-hidden="true"><use href="#mark"/></svg>tekma</a><p>© 2026 Tekma · Rzeszów · dane w UE</p></div>
    <div class="foot-cols">
      <div><h5>Produkt</h5><ul><li><a href="{p}produkt.html">Rubryki i karty ocen</a></li><li><a href="{p}integracje.html">Integracje</a></li><li><a href="{p}ai.html">AI w Tekmie</a></li><li><a href="{p}po-zatrudnieniu.html">Pierwsze 90 dni</a></li></ul></div>
      <div><h5>Poradniki</h5><ul><li><a href="{p}blog/">Blog: hiring playbooks</a></li><li><a href="{p}blog/jak-zatrudnic-pierwszego-programiste.html">Pierwszy programista</a></li><li><a href="{p}blog/scorecard-rekrutacyjny.html">Scorecard rekrutacyjny</a></li><li><a href="{p}blog/ai-act-a-rekrutacja.html">AI Act a rekrutacja</a></li><li><a href="{p}tekma-vs-arkusz-vs-ats.html">Tekma vs arkusz vs ATS</a></li></ul></div>
      <div><h5>Firma</h5><ul><li><a href="/#jak">Jak to działa</a></li><li><a href="/#cennik">Cennik</a></li><li><a href="mailto:hello@tekma.app">Kontakt</a></li></ul></div>
      <div><h5>Zaufanie</h5><ul><li><a href="{p}ai.html#nadzor">RODO i AI Act</a></li><li><a href="{p}dla-kandydatow.html">Dla kandydatów</a></li></ul></div>
    </div>
  </div>
</footer>
{DIALOG}
<script src="{p}assets/access.js" defer></script>
<script src="{p}assets/landing.js?v=mesh1" defer></script>
</body>
</html>
'''

MESH = '<div class="mesh" aria-hidden="true"><i></i><i></i><i></i><i></i></div>'

def crumbs(items, lang='pl'):
    out = []
    for i, (label, href) in enumerate(items):
        out.append(f'<a href="{href}">{esc(label)}</a>' if href else f'<span aria-current="page">{esc(label)}</span>')
    return '<nav class="crumbs" aria-label="' + ('Breadcrumb' if lang == 'en' else 'Okruszki') + '">' + '<i aria-hidden="true">/</i>'.join(out) + '</nav>'

def breadcrumb_ld(items):
    return {'@type': 'BreadcrumbList', 'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'name': n, 'item': BASE + u} for i, (n, u) in enumerate(items)]}

def cta_band(p, lang='pl'):
    if lang == 'en':
        return f'''<aside class="cta-band" aria-labelledby="cta-t">
<h2 id="cta-t">Try the scorecard with your next hire</h2>
<p>Tekma is a hiring workspace with rubrics, independent scorecards and an AI notetaker. Start on the free plan: one open role and five AI-analysed interviews a month. The interface is currently in Polish.</p>
<div class="row"><a class="btn btn-blue btn-lg" href="{p}{SIGNUP}">Create a free account</a><a class="btn btn-ghost btn-lg" href="{p}produkt.html">See how rubrics work (PL)</a></div>
<p class="fine">No card required.</p>
</aside>'''
    return f'''<aside class="cta-band" aria-labelledby="cta-t">
<h2 id="cta-t">Zrób pierwszą rubrykę i kartę oceny w Tekmie</h2>
<p>Rubryki, niezależne karty ocen, notetaker i plan pierwszych 90 dni w jednym miejscu. Zacznij od planu Free: 1 otwarte stanowisko i 5 rozmów z analizą AI miesięcznie.</p>
<div class="row"><a class="btn btn-blue btn-lg" href="{p}{SIGNUP}">Załóż darmowe konto</a><a class="btn btn-ghost btn-lg" href="{p}produkt.html">Zobacz, jak działa rubryka</a></div>
<p class="fine">Bez karty. Zmienisz wszystko później.</p>
</aside>'''

def sources_html(srcs, lang='pl'):
    if not srcs: return ''
    items = ''.join(f'<li><a href="{esc(u)}" rel="noopener" target="_blank">{esc(t)}</a> <span>({esc(n)})</span></li>' for t, u, n in srcs)
    return f'<h2 id="zrodla">{"Sources" if lang == "en" else "Źródła"}</h2>\n<div class="srcs"><ol>{items}</ol></div>'

def related_html(rel, here_dir):
    if not rel: return ''
    by = {a['slug']: a for a in ARTICLES}
    items = ''.join(f'<li><a href="{by[s]["slug"]}.html">{esc(by[s]["card"])}</a></li>' for s in rel)
    items += f'<li><a href="../tekma-vs-arkusz-vs-ats.html">Tekma vs arkusz vs ATS: porównanie</a></li>'
    return f'<h2 id="dalej">Czytaj dalej</h2>\n<ul class="rel">{items}</ul>'

# ---------------------------------------------------------------- strony
def build_article(a, lang='pl'):
    en = lang == 'en'
    p = '../'
    out_path = ('en/' if en else 'blog/') + a['slug'] + '.html'
    body = read(a['slug'])
    h2s = re.findall(r'<h2 id="([^"]+)">(.*?)</h2>', body)
    wc = words(body)
    minutes = max(3, round(wc / 200))
    faq = a.get('faq')
    toc = list(h2s)
    if faq: toc.append(('pytania', 'Najczęstsze pytania'))
    if a.get('related') and not en: toc.append(('dalej', 'Czytaj dalej'))
    if a['sources']: toc.append(('zrodla', 'Sources' if en else 'Źródła'))
    toc_html = f'<nav class="toc" aria-label="{"Contents" if en else "Spis treści"}"><p class="toc-t">{"In this article" if en else "W tym tekście"}</p><ol>' + ''.join(f'<li><a href="#{i}">{t}</a></li>' for i, t in toc) + '</ol></nav>'
    faq_block = f'<h2 id="pytania">Najczęstsze pytania</h2>\n{faq_html(faq)}' if faq else ''
    # canonical + hreflang
    alt = ''
    if a.get('hreflang_en'):
        alt = (f'<link rel="alternate" hreflang="pl" href="{BASE}{out_path}">\n<link rel="alternate" hreflang="en" href="{BASE}{a["hreflang_en"]}">\n<link rel="alternate" hreflang="x-default" href="{BASE}{out_path}">')
    elif a.get('hreflang_pl'):
        alt = (f'<link rel="alternate" hreflang="en" href="{BASE}{out_path}">\n<link rel="alternate" hreflang="pl" href="{BASE}{a["hreflang_pl"]}">\n<link rel="alternate" hreflang="x-default" href="{BASE}{a["hreflang_pl"]}">')
    else:
        alt = f'<link rel="alternate" hreflang="pl" href="{BASE}{out_path}">'
    if en:
        bc = [('Tekma', ''), (a['card'], out_path)]
        bc_links = [('Tekma', p)]
    else:
        bc = [('Tekma', ''), ('Blog', 'blog/'), (a['card'], out_path)]
        bc_links = [('Tekma', p), ('Blog', './')]
    article_ld = {'@type': 'Article', '@id': BASE + out_path + '#article', 'headline': a['h1'], 'description': a['desc'], 'inLanguage': lang,
      'datePublished': TODAY, 'dateModified': TODAY, 'mainEntityOfPage': {'@type': 'WebPage', '@id': BASE + out_path},
      'image': [BASE + 'assets/og.png'], 'author': {'@type': 'Organization', 'name': 'Zespół Tekmy' if not en else 'Tekma team', 'url': BASE},
      'publisher': ORG, 'keywords': ', '.join(a['keywords']), 'wordCount': wc}
    ld = [ORG, article_ld, breadcrumb_ld(bc)]
    if faq: ld.append(faq_ld(faq))
    crumb_html = crumbs(bc_links + [(a['card'], None)], lang)
    lang_sw = ''
    if a.get('hreflang_en'): lang_sw = f'<a class="lang-sw" href="../{a["hreflang_en"]}" hreflang="en" lang="en">English version</a>'
    if a.get('hreflang_pl'): lang_sw = f'<a class="lang-sw" href="../{a["hreflang_pl"]}" hreflang="pl" lang="pl">Wersja polska</a>'
    date_txt = pl_date(TODAY) if not en else 'November 6, 2026'
    meta = (f'<div class="post-meta"><span><b>{"Tekma team" if en else "Zespół Tekmy"}</b></span><time datetime="{TODAY}">{date_txt}</time><span>{minutes} {"min read" if en else "min czytania"}</span></div>')
    page = (head(p, a, out_path, alt, ld, 'article', TODAY, lang) + header(p, None, lang) + f'''<main id="top">
<section class="hero sub post-hero">
  {MESH}
  <div class="wrap"><div class="hero-copy">
    {crumb_html}
    <span class="eyebrow fade">{esc(a['tag'])}</span>
    <h1>{esc(a['h1'])}</h1>
    <p class="post-lede">{esc(a['lede'])}</p>
    {meta}
    {lang_sw}
  </div></div>
</section>
<section class="post-body">
  <div class="wrap"><div class="post-grid">
    <aside>{toc_html}</aside>
    <article>
      <div class="prose">
{body}
{faq_block}
{related_html(a.get('related'), 'blog') if not en else ''}
{sources_html(a['sources'], lang)}
      </div>
      {cta_band(p, lang)}
    </article>
  </div></div>
</section>
''' + footer(p, lang))
    # </main> przed stopką
    page = page.replace('<footer class="foot">', '</main>\n<footer class="foot">', 1)
    write(out_path, page)

def cards(items, p):
    out = []
    for a in items:
        url = a.get('path') or f'blog/{a["slug"]}.html'
        if a.get('lang') == 'en': url = 'en/' + a['slug'] + '.html'
        mins = a.get('mins')
        meta = f'<span class="meta">{mins} min czytania</span>' if mins else ''
        lang_attr = ' hreflang="en" lang="en"' if a.get('lang') == 'en' else ''
        out.append(f'<a class="pcard{" feat" if a.get("feat") else ""}" href="{p}{url}"{lang_attr}><span class="tag">{esc(a["tag"])}</span><h3>{esc(a["card"])}</h3><p>{esc(a["blurb"])}</p>{meta}<span class="more">{"Read" if a.get("lang") == "en" else "Czytaj"} <i aria-hidden="true">→</i></span></a>')
    return '<div class="pgrid">' + ''.join(out) + '</div>'

BLURB = {
 'jak-zatrudnic-pierwszego-programiste': 'Od rezultatów na 90 dni, przez ogłoszenie z widełkami, po proces i ocenę rubryką.',
 'scorecard-rekrutacyjny': 'Kryteria, wagi, skala z opisami i przykład wyniku ważonego. Jak zbudować kartę w siedmiu krokach.',
 'ai-act-a-rekrutacja': 'Dlaczego AI w rekrutacji to system wysokiego ryzyka, od kiedy i co zrobić już teraz.',
 'rubryka-oceny-rozmowy-rekrutacyjnej': 'Jak pisać opisy ocen 1–5 i pytania, żeby dwie osoby oceniały tak samo.',
 'widelki-plac-w-ogloszeniu': 'Co od grudnia 2025 r. wynika z Kodeksu pracy i jak ustalić widełki, które się bronią.',
 'onboarding-30-60-90-dni': 'Szablon trzech etapów, lista przed startem i pytania na przeglądy w dniach 7, 30, 60 i 90.',
 'interview-scorecard': 'English: how to build a scorecard, with a worked example of a weighted score.',
 'tekma-vs-arkusz-vs-ats': 'Tabela funkcji, koszt, RODO i wskazówki, kiedy wystarczy arkusz, a kiedy ATS lub Tekma.',
}
def card_items():
    items = []
    for a in ARTICLES:
        b = dict(a); b['blurb'] = BLURB[a['slug']]; b['mins'] = max(3, round(words(read(a['slug'])) / 200)); items.append(b)
    en = dict(EN); en['blurb'] = BLURB['interview-scorecard']; en['mins'] = None; items.append(en)
    return items

def build_hub():
    p = '../'
    hub = dict(title='Hiring playbooks — poradniki o rekrutacji | Blog Tekmy', tag='Blog',
      desc='Praktyczne poradniki o rekrutacji: pierwszy programista, scorecard, rubryka oceny rozmowy, AI Act, widełki płacowe i onboarding 30-60-90 dni.')
    items = card_items()
    ld = [ORG,
      {'@type': 'CollectionPage', '@id': BASE + 'blog/#page', 'name': 'Hiring playbooks', 'description': hub['desc'], 'url': BASE + 'blog/', 'inLanguage': 'pl', 'isPartOf': {'@type': 'WebSite', 'url': BASE, 'name': 'Tekma'}, 'publisher': ORG,
       'mainEntity': {'@type': 'ItemList', 'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'url': BASE + (('en/' + a['slug']) if a.get('lang') == 'en' else ('blog/' + a['slug'])) + '.html', 'name': a['card']} for i, a in enumerate(items)]}},
      breadcrumb_ld([('Tekma', ''), ('Blog', 'blog/')])]
    alt = f'<link rel="alternate" hreflang="pl" href="{BASE}blog/">'
    page = head(p, hub, 'blog/', alt, ld, 'website') + header(p, 'blog/') + f'''<main id="top">
<section class="hero sub post-hero wide">
  {MESH}
  <div class="wrap"><div class="hero-copy">
    {crumbs([('Tekma', p), ('Blog', None)])}
    <span class="eyebrow fade">Blog Tekmy</span>
    <h1>Hiring playbooks: praktyczne poradniki o rekrutacji</h1>
    <p class="post-lede">Krótkie, konkretne teksty dla zespołów, które rekrutują bez dużego działu HR: jak ocenić kandydatów, co mówi prawo i jak zaplanować pierwsze 90 dni nowej osoby. Bez ogólników i bez wymyślonych statystyk.</p>
  </div></div>
</section>
<section class="sec" style="padding-top:32px">
  <div class="wrap">
    <h2 class="h2-sm" style="margin-bottom:24px">Wszystkie poradniki</h2>
    {cards(items, p)}
  </div>
</section>
<section class="sec alt">
  <div class="wrap">
    <div class="sec-head-row">
      <div><span class="eyebrow">Porównanie</span><h2>Arkusz, ATS czy Tekma?</h2><p class="lede">Zestawiamy trzy sposoby prowadzenia rekrutacji w jednej tabeli i mówimy wprost, kiedy wystarczy arkusz.</p></div>
      <a class="link-arrow" href="{p}tekma-vs-arkusz-vs-ats.html">Zobacz porównanie <i aria-hidden="true">→</i></a>
    </div>
  </div>
</section>
<section class="sec final"><div class="wrap reveal"><h2>Pierwsza rubryka gotowa w 3 minuty — z szablonu albo z opisu stanowiska.</h2><p class="lede">Bez karty. Zmienisz wszystko później.</p><div class="hero-actions"><a class="btn btn-blue btn-lg" href="{p}{SIGNUP}">Załóż darmowe konto</a><a class="btn btn-ghost btn-lg" href="{p}produkt.html">Zobacz produkt</a></div></div></section>
''' + footer(p)
    page = page.replace('<footer class="foot">', '</main>\n<footer class="foot">', 1)
    write('blog/index.html', page)

def cmp_cell(kind, text, tk=False):
    cls = ' class="tk"' if tk else ''
    if kind == 'y': inner = f'<span class="yes"><svg aria-hidden="true"><use href="#check"/></svg><span><span class="sr">Tak: </span>{esc(text)}</span></span>'
    elif kind == 'm': inner = f'<span class="mid"><span><span class="sr">Częściowo lub zależy: </span>{esc(text)}</span></span>'
    elif kind == 'n': inner = f'<span class="no"><span><span class="sr">Brak: </span>{esc(text)}</span></span>'
    else: inner = esc(text)
    return f'<td{cls}>{inner}</td>'

def cmp_table():
    rows = []
    for grp, items in CMP:
        rows.append(f'<tr class="grp"><th colspan="4" scope="colgroup">{esc(grp)}</th></tr>')
        for label, a, b, c in items:
            rows.append(f'<tr><th scope="row">{esc(label)}</th>{cmp_cell(*a)}{cmp_cell(*b)}{cmp_cell(*c, tk=True)}</tr>')
    head_ = '<thead><tr><th scope="col">Co porównujemy</th><th scope="col">Arkusz<small>Excel, Google Sheets</small></th><th scope="col">Klasyczny ATS<small>typowe cechy kategorii</small></th><th scope="col" class="tk">Tekma<small>rubryki, oceny, AI, plan 90 dni</small></th></tr></thead>'
    return f'<div class="cmp-wrap" role="region" aria-label="Tabela porównawcza, przewijana poziomo" tabindex="0"><table class="cmp"><caption class="sr">Porównanie arkusza, klasycznego ATS i Tekmy</caption>{head_}<tbody>{"".join(rows)}</tbody></table></div>'

def build_compare():
    c = COMPARE; p = ''
    body = read(c['slug']).replace('{{TABLE}}', cmp_table()).replace('{{FAQ}}', faq_html(c['faq']))
    bc = [('Tekma', ''), (c['card'], c['path'])]
    ld = [ORG,
      {'@type': 'WebPage', '@id': BASE + c['path'] + '#page', 'name': c['h1'], 'description': c['desc'], 'url': BASE + c['path'], 'inLanguage': 'pl', 'datePublished': TODAY, 'dateModified': TODAY, 'isPartOf': {'@type': 'WebSite', 'url': BASE, 'name': 'Tekma'}, 'publisher': ORG},
      breadcrumb_ld(bc), faq_ld(c['faq'])]
    alt = f'<link rel="alternate" hreflang="pl" href="{BASE}{c["path"]}">'
    page = head(p, c, c['path'], alt, ld, 'website') + header(p) + f'''<main id="top">
<section class="hero sub post-hero wide">
  {MESH}
  <div class="wrap"><div class="hero-copy">
    {crumbs([('Tekma', '/'), (c['card'], None)])}
    <span class="eyebrow fade">Porównanie</span>
    <h1>{esc(c['h1'])}</h1>
    <p class="post-lede">{esc(c['lede'])}</p>
    <div class="post-meta"><span><b>Zespół Tekmy</b></span><time datetime="{TODAY}">{pl_date(TODAY)}</time></div>
  </div></div>
</section>
{body}
<section class="sec final"><div class="wrap reveal"><h2>Sprawdź, jak wygląda rekrutacja z rubryką i niezależnymi ocenami.</h2><p class="lede">Plan Free: 1 otwarte stanowisko i 5 rozmów z analizą AI miesięcznie. Bez karty.</p><div class="hero-actions"><a class="btn btn-blue btn-lg" href="{SIGNUP}">Załóż darmowe konto</a><a class="btn btn-ghost btn-lg" href="produkt.html">Zobacz produkt</a></div></div></section>
''' + footer(p)
    page = page.replace('<footer class="foot">', '</main>\n<footer class="foot">', 1)
    write(c['path'], page)

def write(rel, content):
    path = os.path.join(SITE, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w', encoding='utf-8').write(content)
    print('wrote', rel, len(content))

if __name__ == '__main__':
    for a in ARTICLES: build_article(a)
    build_article(EN, 'en')
    build_hub()
    build_compare()
