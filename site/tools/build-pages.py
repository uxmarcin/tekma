#!/usr/bin/env python3
"""Generuje podstrony landingu z jednego szablonu (nav, head, footer, dialog, ikony).
Uruchom: python3 tools/build-pages.py   (z katalogu site/)."""
import os, re, json

V = "light11"
SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

ICONS = {
 'mark':'<path d="M3 6H17.5V22.5L12.5 28V12H3Z"/><path d="M20 6H29L20 12.5Z"/>',
 'check':'<path d="M2.5 7 5.5 10 11.5 4"/>',
 'l-file':'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
 'l-users':'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
 'l-clip':'<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
 'l-rocket':'<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
 'l-shield':'<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
 'l-scroll':'<path d="M15 12h-5"/><path d="M15 8h-5"/><path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"/>',
 'l-pin':'<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
 'l-q':'<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
 'l-mic':'<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>',
 'l-plug':'<path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>',
 'l-cal':'<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
 'l-term':'<polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/>',
 'l-quote':'<path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/><path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/>',
 'l-user':'<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
 'l-list':'<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>',
 'l-scale':'<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
 'l-eye':'<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
 'l-flag':'<path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-7.333-2q-2 0-3.067.8"/>',
 'l-clock':'<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
 'l-msg':'<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
 'l-smile':'<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/>',
 'l-target':'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
}
# brand logos (same drawings as in Figma)
LOGOS = {
 'gcal':'<svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="2" fill="#fff"/><path fill="#4285F4" d="M2 4a2 2 0 0 1 2-2h14v3H5v14H2V4z"/><path fill="#34A853" d="M19 5h3v14h-3z"/><path fill="#FBBC04" d="M5 19h14v3H5z"/><path fill="#EA4335" d="M19 19h3v1a2 2 0 0 1-2 2h-1v-3z"/><path fill="#1967D2" d="M19 2h1a2 2 0 0 1 2 2v1h-3V2z"/><path fill="#188038" d="M2 19h3v3H4a2 2 0 0 1-2-2v-1z"/><text x="12" y="15.6" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="8.5" fill="#4285F4">31</text></svg>',
 'gmail':'<svg viewBox="0 0 24 24"><path fill="#4285F4" d="M1.636 20h3.819v-8.27L0 7.64v10.724C0 19.268.732 20 1.636 20z"/><path fill="#34A853" d="M18.545 20h3.819C23.268 20 24 19.268 24 18.364V7.64l-5.455 4.09V20z"/><path fill="#FBBC04" d="M18.545 4.64v7.09L24 7.64V5.457c0-2.023-2.309-3.178-3.927-1.964L18.545 4.64z"/><path fill="#EA4335" d="M5.455 11.73V4.64L12 9.548l6.545-4.908v7.09L12 16.64 5.455 11.73z"/><path fill="#C5221F" d="M0 5.457V7.64l5.455 4.09V4.64L3.927 3.493C2.309 2.28 0 3.434 0 5.457z"/></svg>',
 'ms':'<svg viewBox="0 0 24 24"><rect x="2" y="2" width="9.5" height="9.5" fill="#F25022"/><rect x="12.5" y="2" width="9.5" height="9.5" fill="#7FBA00"/><rect x="2" y="12.5" width="9.5" height="9.5" fill="#00A4EF"/><rect x="12.5" y="12.5" width="9.5" height="9.5" fill="#FFB900"/></svg>',
 'slack':'<svg viewBox="0 0 24 24"><path fill="#E01E5A" d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"/><path fill="#36C5F0" d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z"/><path fill="#2EB67D" d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z"/><path fill="#ECB22E" d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/></svg>',
 'linkedin':'<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#0A66C2"/><path fill="#fff" d="M6.94 8.5a1.44 1.44 0 1 1 0-2.88 1.44 1.44 0 0 1 0 2.88zM5.7 9.6h2.48V18H5.7V9.6zm4.1 0h2.38v1.15h.03c.33-.63 1.14-1.3 2.35-1.3 2.5 0 2.97 1.65 2.97 3.8V18h-2.48v-4.2c0-1 0-2.3-1.4-2.3s-1.6 1.1-1.6 2.22V18H9.8V9.6z"/></svg>',
 'zoom':'<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#0B5CFF"/><rect x="4.5" y="8" width="10" height="8" rx="2" fill="#fff"/><path fill="#fff" d="M15.5 10.4 19.5 8v8l-4-2.4z"/></svg>',
 'claude':'<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#D97757"/><path fill="#fff" d="m14.6 13.2 4.6 2.6-.6 1.4-5.1-1.6 2.9 4.1-1.3.9-3.2-4.6-.4 5.2h-1.6l-.4-5.2-3.2 4.6-1.3-.9 2.9-4.1-5.1 1.6-.6-1.4 4.6-2.6L2 11.7l.4-1.5 5 1.9L4 8l1-1.1 4 3.4L7.3 5.5l1.4-.7 2.8 4.6.4-5.2h1.6l.4 5.2 2.8-4.6 1.4.7-1.7 4.8 4-3.4L21.5 8l-3.4 4.1 5-1.9.4 1.5-5.1 1.5z"/></svg>',
 'stripe':'<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#635BFF"/><path fill="#fff" d="M11.1 9.2c0-.66.55-.92 1.44-.92 1.28 0 2.9.39 4.18 1.08V5.4c-1.4-.56-2.78-.78-4.18-.78-3.42 0-5.7 1.79-5.7 4.77 0 4.66 6.4 3.9 6.4 5.92 0 .78-.68 1.03-1.63 1.03-1.4 0-3.2-.58-4.62-1.35v4.02c1.57.68 3.16.96 4.62.96 3.5 0 5.92-1.73 5.92-4.76 0-5.03-6.43-4.13-6.43-6.01z"/></svg>',
 'ats':'<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#F4F4F6"/><circle cx="7" cy="12" r="3" fill="#24A47F"/><circle cx="12.5" cy="12" r="3" fill="#2E3A59"/><circle cx="18" cy="12" r="3" fill="#F15A24"/></svg>',
}

ACCESS = 'mailto:hello@tekma.app?subject=Wcze%C5%9Bniejszy%20dost%C4%99p%20do%20Tekmy'
NAV = [('produkt.html','Produkt'),('integracje.html','Integracje'),('ai.html','AI w Tekmie'),('dla-kandydatow.html','Dla kandydatów'),('/#cennik','Cennik')]

def svg_symbols():
    return '<svg width="0" height="0" style="position:absolute" aria-hidden="true">' + ''.join(f'<symbol id="{k}" viewBox="0 0 {"32 32" if k=="mark" else "14 14" if k=="check" else "24 24"}">{v}</symbol>' for k,v in ICONS.items()) + '</svg>'

def head(title, desc, path):
    return f'''<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="theme-color" content="#ffffff">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="icon" href="favicon.ico" sizes="48x48">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="manifest" href="site.webmanifest">
<link rel="canonical" href="https://tekma.app/{path}">
<meta property="og:type" content="website">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="https://tekma.app/{path}">
<meta property="og:image" content="https://tekma.app/assets/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="preload" href="assets/fonts/InterDisplay-SemiBold.woff" as="font" type="font/woff" crossorigin>
<link rel="preload" href="assets/fonts/Inter-Regular.woff" as="font" type="font/woff" crossorigin>
<script>document.documentElement.classList.add('js')</script>
<link rel="stylesheet" href="assets/landing.css?v={V}">
</head>
<body>
'''

def nav(current):
    links = ''.join(f'<a href="{h}"{" aria-current=\"page\"" if h==current else ""}>{t}</a>' for h,t in NAV)
    mlinks = ''.join(f'<a href="{h}">{t}</a>' for h,t in NAV)
    return f'''{svg_symbols()}
<header class="nav" id="nav">
  <div class="wrap nav-in">
    <a class="logo" href="/" aria-label="Tekma — strona główna"><svg aria-hidden="true"><use href="#mark"/></svg>tekma</a>
    <nav class="nav-links" aria-label="Główna nawigacja">{links}</nav>
    <div class="nav-r"><a class="login" href="app/">Zaloguj się</a><a data-access class="btn btn-ink btn-sm" href="{ACCESS}">Poproś o dostęp</a></div>
    <button class="burger" id="burger" aria-label="Menu" aria-expanded="false" aria-controls="mmenu"><span></span></button>
  </div>
  <div class="mmenu" id="mmenu">{mlinks}<a href="app/">Zaloguj się</a><a data-access class="btn btn-ink" href="{ACCESS}">Poproś o wcześniejszy dostęp</a></div>
</header>
<main id="top">
'''

FOOTER = f'''</main>
<footer class="foot">
  <div class="wrap">
    <div class="brand"><a class="logo" href="/"><svg aria-hidden="true"><use href="#mark"/></svg>tekma</a><p>© 2026 Tekma · Rzeszów · dane w UE</p></div>
    <div class="foot-cols">
      <div><h5>Produkt</h5><ul><li><a href="produkt.html">Rubryki i karty ocen</a></li><li><a href="integracje.html">Integracje</a></li><li><a href="ai.html">AI w Tekmie</a></li><li><a href="po-zatrudnieniu.html">Pierwsze 90 dni</a></li></ul></div>
      <div><h5>Firma</h5><ul><li><a href="/#jak">Jak to działa</a></li><li><a href="/#cennik">Cennik</a></li><li><a href="mailto:hello@tekma.app">Kontakt</a></li></ul></div>
      <div><h5>Zaufanie</h5><ul><li><a href="ai.html#nadzor">RODO i AI Act</a></li><li><a href="dla-kandydatow.html">Dla kandydatów</a></li></ul></div>
    </div>
  </div>
</footer>
<dialog class="access" id="access" aria-labelledby="access-t">
  <form method="dialog" class="access-x"><button aria-label="Zamknij">&times;</button></form>
  <div class="access-body" id="access-form-wrap">
    <h2 id="access-t">Poproś o wcześniejszy dostęp</h2>
    <p class="access-lede">Otwieramy Tekmę etapami. Zostaw e-mail, a odezwiemy się, gdy przyjdzie Twoja kolej.</p>
    <form id="access-form" novalidate>
      <label for="access-email">Adres e-mail</label>
      <input id="access-email" name="email" type="email" inputmode="email" autocomplete="email" placeholder="imie@firma.pl" maxlength="254" required>
      <input class="hp" name="website" type="text" tabindex="-1" autocomplete="off" aria-hidden="true">
      <label class="check" for="access-consent"><input id="access-consent" name="consent" type="checkbox" required><span id="access-consent-text">Wyrażam zgodę na przetwarzanie mojego adresu e-mail przez Creative Vision w celu kontaktu w sprawie wcześniejszego dostępu do Tekmy. Zgodę mogę wycofać w każdej chwili, pisząc na hello@tekma.app.</span></label>
      <p class="access-err" id="access-err" role="alert" hidden></p>
      <button class="btn btn-blue btn-lg" id="access-submit" type="submit">Poproś o wcześniejszy dostęp</button>
    </form>
  </div>
  <div class="access-body access-ok" id="access-ok" hidden>
    <span class="access-tick" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg></span>
    <h2>Dziękujemy!</h2>
    <p class="access-lede">Zapisaliśmy Twój adres. Odezwiemy się, gdy otworzymy dostęp do Tekmy.</p>
    <form method="dialog"><button class="btn btn-ghost btn-lg">Zamknij</button></form>
  </div>
</dialog>
<script src="assets/access.js" defer></script>
<script src="assets/landing.js?v={V}" defer></script>
</body>
</html>
'''

# ---------- blocks ----------
def hero(ey, h1, lede, cta2=None, cta2href='#'):
    words = h1.replace('\n',' <br> ').split(' ')
    ws=[]; i=0
    for w in words:
        if w=='<br>': ws.append('<br>'); continue
        ws.append(f'<span class="w" style="--i:{i}" aria-hidden="true">{w}</span>'); i+=1
    c2 = f'<a class="btn btn-ghost btn-lg" href="{cta2href}">{cta2}</a>' if cta2 else ''
    return f'''<section class="hero sub">
  <div class="hero-glow" aria-hidden="true"></div>
  <div class="wrap"><div class="hero-copy">
    <span class="eyebrow fade">{ey}</span>
    <h1 aria-label="{h1.replace(chr(10),' ')}">{' '.join(ws)}</h1>
    <p class="hero-lede fade" style="animation-delay:.5s">{lede}</p>
    <div class="hero-actions fade" style="animation-delay:.6s"><a data-access class="btn btn-blue btn-lg" href="{ACCESS}">Poproś o wcześniejszy dostęp</a>{c2}</div>
  </div></div>
</section>
'''

def shot(name, w, h, alt, url, lazy=True):
    return f'''<div class="browser reveal" data-delay="2"><div class="browser-bar" aria-hidden="true"><i style="background:#fb7185"></i><i style="background:#fbbf24"></i><i style="background:#34d399"></i><span class="url">{url}</span></div><img src="assets/landing/{name}.webp?v=3" srcset="assets/landing/{name}-1x.webp?v=3 {w}w, assets/landing/{name}.webp?v=3 {w*2}w" sizes="(max-width:1200px) 100vw, 1120px" width="{w}" height="{h}" alt="{alt}"{' loading="lazy"' if lazy else ''}></div>'''

def phone(name, w, h, alt):
    return f'''<div class="phone reveal" data-delay="2"><img src="assets/landing/{name}.webp?v=3" srcset="assets/landing/{name}-1x.webp?v=3 {w}w, assets/landing/{name}.webp?v=3 {w*2}w" sizes="320px" width="{w}" height="{h}" alt="{alt}" loading="lazy"></div>'''

def checks(items):
    return '<ul class="checks">' + ''.join(f'<li><svg><use href="#check"/></svg>{i}</li>' for i in items) + '</ul>'

def feature_full(id_, ey, h2, p, bullets, media, alt=''):
    return f'''<section class="sec alt feature"{f' id="{id_}"' if id_ else ''}>
  <div class="wrap">
    <div class="feature-head">
      <div class="reveal"><span class="eyebrow">{ey}</span><h2>{h2}</h2></div>
      <div class="right reveal" data-delay="1"><p class="lede">{p}</p>{checks(bullets)}</div>
    </div>
    {media}
  </div>
</section>
'''

def split(ey, h2, p, bullets, media, flip=False, kind='browser'):
    t = f'<div class="split-text reveal"><span class="eyebrow">{ey}</span><h2 class="h2-sm">{h2}</h2><p class="lede">{p}</p>{checks(bullets)}</div>'
    m = f'<div class="split-media{" is-phone" if kind=="phone" else ""}">{media}</div>'
    return f'<div class="split{" flip" if flip else ""}">{t if not flip else m}{m if not flip else t}</div>'

def section(inner, bg=False, id_=None, cls=''):
    return f'<section class="sec{" alt" if bg else ""} {cls}"{f" id={chr(34)}{id_}{chr(34)}" if id_ else ""}><div class="wrap">{inner}</div></section>\n'

def center_head(ey, h2, p=None):
    return f'<div class="center reveal"><span class="eyebrow">{ey}</span><h2>{h2}</h2>{f"<p class={chr(34)}lede{chr(34)} style={chr(34)}margin-top:12px{chr(34)}>{p}</p>" if p else ""}</div>'

def tiles(items, href_default='#'):
    out=[]
    for i,(ic,t,d,href) in enumerate(items):
        out.append(f'<a class="tile reveal" data-delay="{i%4}" href="{href or href_default}"><div class="tile-top"><svg aria-hidden="true"><use href="#{ic}"/></svg><small>{i+1:02d}</small></div><div class="tile-body"><h3>{t}</h3><div class="tile-more"><p>{d}</p><span>Zobacz więcej <i>→</i></span></div></div></a>')
    return '<div class="tiles">' + ''.join(out) + '</div>'

def dark(ey, h2, p, cards=None, media=None, id_=None):
    if cards:
        right = '<div class="tcards reveal" data-delay="1">' + ''.join(f'<div class="tcard"><header><span class="ico"><svg><use href="#{ic}"/></svg></span><b>{t}</b></header><p>{d}</p></div>' for ic,t,d in cards) + '</div>'
    else:
        right = f'<div class="reveal" data-delay="1">{media}</div>'
    return f'''<section class="sec trust"{f' id="{id_}"' if id_ else ''}><div class="wrap">
    <div class="reveal"><span class="eyebrow">{ey}</span><h2>{h2}</h2><p class="lede" style="margin-top:20px">{p}</p></div>{right}
  </div></section>
'''

def final(h2, p):
    return f'''<section class="sec final"><div class="wrap reveal"><h2>{h2}</h2><p class="lede">{p}</p><div class="hero-actions"><a data-access class="btn btn-blue btn-lg" href="{ACCESS}">Poproś o wcześniejszy dostęp</a><a class="btn btn-ghost btn-lg" href="mailto:hello@tekma.app?subject=Rozmowa%20o%20Tekmie">Umów demo</a></div></div></section>
'''

def carousel():
    cards = [
      ('live','gcal','wide','Rozmowa na żywo z transkrypcją i coachem AI'),
      ('checkin',None,'tall','Check-in nastroju na telefonie'),
      ('scorecard','zoom','wide','Karta oceny z sugestiami AI'),
      ('portal',None,'tall','Portal kandydata'),
      ('after','ms','wide','Ocena po rozmowie'),
    ]
    out=[]
    for name,badge,kind,alt in cards:
        b = f'<span class="badge">{LOGOS[badge]}</span>' if badge else ''
        out.append(f'<div class="car-card {kind}">{b}<img src="assets/landing/{name}-1x.webp?v=3" srcset="assets/landing/{name}-1x.webp?v=3 1x, assets/landing/{name}.webp?v=3 2x" alt="{alt}" loading="lazy"></div>')
    return f'''<section class="sec carousel" id="notetaker">
  <div class="wrap">
    <h2 class="car-h reveal">Notatki z rozmów ginęły w zeszytach. <br>Teraz każda rozmowa ma transkrypcję.</h2>
    <p class="car-lede reveal" data-delay="1">Każdy rekruter ma ten plik. Dziesiątki notatek z rozmów, <br>a mimo to nikt nie pamięta, co kandydat naprawdę powiedział.</p>
    <div class="car-label reveal" data-delay="2"><svg><use href="#l-mic"/></svg>Notetaker w rozmowie</div>
    <div class="voice reveal" data-delay="3" aria-hidden="true"><span class="rec"><i></i>Nagrywanie · 18:42</span><div class="wave"><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b></div><span class="lang">PL · auto</span></div>
    <div class="voice reveal" data-delay="3" aria-hidden="true"><span class="rec"><i></i>Nagrywanie · 18:42</span><div class="wave"><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b></div><span class="lang">PL · auto</span></div>
  </div>
  <div class="car-track" data-car><div class="car-strip">{''.join(out)}</div></div>
</section>
'''

# ---------- pages ----------
pages = {}

# INTEGRACJE
integ = [('gcal','Kalendarz Google','Notetaker dołącza do rozmów z kalendarza sam. Zero linków do kopiowania.',True),
 ('gmail','Gmail','Cała korespondencja z kandydatem w jednym wątku, z poziomu Tekmy.',True),
 ('ms','Outlook i Teams','Kalendarz, poczta i nagrywanie rozmów dla zespołów na Microsoft 365.',False),
 ('slack','Slack','Powiadomienia o nowych ocenach, rozbieżnościach i zaległych 1:1.',True),
 ('linkedin','LinkedIn','Wtyczka do Chrome: dodajesz kandydata z profilu jednym kliknięciem.',False),
 ('zoom','Zoom','Notetaker w rozmowach na Zoomie, z transkrypcją po polsku i angielsku.',True),
 ('claude','Claude i MCP','Pytaj o kandydatów, lejki i raporty z poziomu Claude. Tylko odczyt.',True),
 ('stripe','Stripe','Rozliczenia z rekruterami z marketplace — faktura automatycznie.',False),
 ('ats','Import z ATS','Greenhouse, Lever, Ashby albo CSV. Kandydaci i historia etapów.',True)]
igrid = '<div class="igrid">' + ''.join(f'<div class="icard reveal" data-delay="{i%3}"><div class="icard-top"><span class="ilogo">{LOGOS[l]}</span><span class="chip {"on" if on else ""}">{"Dostępne" if on else "Wkrótce"}</span></div><b>{t}</b><p>{d}</p></div>' for i,(l,t,d,on) in enumerate(integ)) + '</div>'
chat = '''<div class="chat reveal" data-delay="2">
  <div class="chat-q"><span>Kto czeka najdłużej na Senior Backend Engineer i co z nim zrobić?</span></div>
  <div class="chat-a"><span class="chat-av">C</span><div>
    <p>Trzy osoby w etapie Screening CV czekają ponad tydzień bez ruchu:</p>
    <ul><li><b>Oskar Kamiński</b><small>9 dni · CV 64 · AI: są luki (brak doświadczenia z Kafką)</small></li><li><b>Julia Majewska</b><small>7 dni · CV 78 · AI: częściowo pasuje</small></li><li><b>Adam Wójcik</b><small>7 dni · CV 72 · Rozmowa wstępna · Sugeruje 3,2</small></li></ul>
    <p>Najprościej: zaplanować rozmowę wstępną z Julią (najwyższe dopasowanie) i odpowiedzieć Oskarowi — przy obecnej rubryce luki są trudne do nadrobienia. Decyzję podejmiesz w Tekmie; mogę tylko podpowiedzieć.</p>
    <small class="chat-src"><svg><use href="#l-shield"/></svg>Dane z Tekma MCP · tylko odczyt · zapytanie w rejestrze decyzji AI</small>
  </div></div>
</div>'''
pages['integracje.html'] = dict(title='Integracje — Tekma', desc='Kalendarz, poczta, Slack, Zoom, Teams, Claude i import z ATS. Notetaker sam dołącza do rozmów, oceny trafiają tam, gdzie pracujecie.', body=
 hero('Integracje','Tekma wpina się w to,\nczego już używacie.','Kalendarz, poczta, Slack, Zoom, Teams — notetaker sam dołącza do rozmów, oceny trafiają tam, gdzie pracujecie, a kandydatów importujesz z dotychczasowego ATS w kilka minut.','Zobacz wszystkie integracje','#lista')
 + section(igrid, bg=True, id_='lista')
 + carousel()
 + section(split('Claude i MCP','Zapytaj Claude: „Kto czeka najdłużej na Senior Backend?”','Tekma udostępnia serwer MCP tylko do odczytu. Podłączasz go w Claude i pytasz o lejki, kandydatów i raporty naturalnym językiem — bez wchodzenia w panel. AI nie zmienia etapów ani ocen; to nadal robi człowiek w Tekmie.',['Lejki, kandydaci, raporty, rubryki — tylko odczyt','Uprawnienia jak w Tekmie: widzisz to, do czego masz dostęp','Każde zapytanie w rejestrze, zgodnie z AI Act'], chat), bg=True)
 + section(center_head('Jak podłączyć','Trzy kliknięcia i jedna zgoda') + tiles([('l-plug','Wybierz narzędzie','Ustawienia → Integracje → Połącz. Logujesz się do Google, Microsoft, Slacka albo Zooma.','#lista'),('l-shield','Zatwierdź zakres','Tekma prosi tylko o to, co potrzebne: kalendarz do odczytu, poczta do wysyłki, nagrywanie w spotkaniach.','ai.html#nadzor'),('l-cal','Zaproś na rozmowę','Notetaker pojawi się na pierwszej rozmowie z kalendarza. Nic więcej nie konfigurujesz.','#notetaker'),('l-term','Dla deweloperów','Serwer MCP i webhooki. Dokumentacja i klucze API w ustawieniach zespołu.','mailto:hello@tekma.app?subject=MCP%20i%20API')]), bg=False)
 + section(shot('integrations',1440,900,'Ustawienia › Integracje w Tekmie','app.tekma.app/ustawienia/integracje'), bg=True)
 + final('Podłącz kalendarz. Resztą zajmie się Tekma.','Pierwsze stanowisko w 5 minut. Bez karty.'))

# AI
faq = [('Jaki model stoi za Tekmą?','Modele z rodziny Claude, uruchamiane w UE. Wersję modelu widzisz przy każdej podpowiedzi w rejestrze.'),('Czy AI uczy się na danych naszych kandydatów?','Nie. Dane nie służą do trenowania modeli — ani naszych, ani dostawcy. Służą tylko do wygenerowania podpowiedzi dla Was.'),('Co widzi kandydat?','W portalu może poprosić o wyjaśnienie, jak AI wpłynęło na jego ocenę. Dostaje te same powody, które widział rekruter.'),('Czy mogę wyłączyć AI w ogóle?','Tak — per stanowisko albo dla całej firmy. Rubryki, karty ocen i plan 90 dni działają bez AI.'),('Co z AI Act?','Rekrutacja to system wysokiego ryzyka (zał. III). Tekma zapewnia nadzór człowieka, rejestr decyzji, informację dla kandydata i kontrolę stronniczości — dokumentację dostajesz w panelu.')]
faqh = '<div class="faq reveal">' + ''.join(f'<details{" open" if i==0 else ""}><summary>{q}</summary><p>{a}</p></details>' for i,(q,a) in enumerate(faq)) + '</div>'
pages['ai.html'] = dict(title='AI w Tekmie — podpowiada, nie decyduje', desc='Dopasowanie CV z wyjaśnieniem, sugestia oceny z cytatem, coach w trakcie rozmowy. AI nigdy nie odrzuca kandydatów. Zgodnie z AI Act.', body=
 hero('AI w Tekmie','AI podpowiada. Decyzję\nzawsze podejmuje człowiek.','Tekma używa AI tam, gdzie oszczędza czas i zmniejsza stronniczość: dopasowanie CV, propozycja oceny z cytatem, coach w trakcie rozmowy. Nigdzie nie odrzuca i nie przesuwa kandydatów — tego nie da się włączyć.','Jak to działa pod spodem','#nadzor')
 + section(center_head('Cztery zasady','Jak AI zachowuje się w Tekmie') + tiles([('l-quote','Zawsze z cytatem','Każda propozycja oceny wskazuje fragment transkrypcji, na którym się opiera. Bez cytatu nie ma podpowiedzi.','#funkcje'),('l-user','Nigdy nie decyduje','AI nie odrzuca, nie przesuwa i nie zatrudnia. Rozmówcy oceniają niezależnie, a decyzja zapada po dwóch ocenach.','#funkcje'),('l-scroll','Wszystko w rejestrze','Każda podpowiedź jest zapisana z wersją modelu, danymi wejściowymi i decyzją człowieka. Eksport dla audytu.','#nadzor'),('l-shield','Zgodnie z AI Act','Rekrutacja to system wysokiego ryzyka. Nadzór człowieka, prawo do wyjaśnienia i kontrola stronniczości są wbudowane.','#nadzor')]), bg=True)
 + section('<div class="splits">'
   + split('Dopasowanie CV','Wynik 0–100 i pięć powodów, dlaczego.','AI porównuje CV z kryteriami stanowiska i pokazuje, co pasuje, a co nie — jako listę, nie czarną skrzynkę. Rekruter widzi luki od razu i decyduje, czy warto zaprosić.',['Kryteria z rubryki, nie z ogólnego modelu','„Dlaczego taki wynik?” w jednym kliknięciu','Kandydat może poprosić o to samo wyjaśnienie w portalu'], shot('scorecard',1440,1093,'Karta kandydatki z dopasowaniem CV','app.tekma.app/kandydaci/marta-kaminska'))
   + split('Sugestia oceny','Propozycja oceny do każdego pytania — z fragmentem rozmowy.','Po rozmowie AI zestawia odpowiedź kandydata z opisami ocen w rubryce i proponuje wynik. Rozmówca przyjmuje, zmienia albo odrzuca. Oceny innych widzi dopiero po wysłaniu swojej.',['Opisy ocen 1–5 z rubryki, te same dla każdego','Rozbieżność 2+ pkt między rozmówcami dostaje flagę','Kalibracja: kto ocenia łagodniej, a kto surowiej'], shot('after',1440,900,'Ocena po rozmowie z sugestią AI','app.tekma.app/ocena/marta-kaminska'), flip=True)
   + split('Coach na żywo','W trakcie rozmowy: czego jeszcze nie zapytaliście.','Notetaker słucha i porównuje z rubryką. Gdy brakuje dowodu na kryterium — np. „kompromisy” — podpowiada pytanie. Widzą to tylko rozmówcy, kandydat zgodził się na nagranie.',['Pokrycie rubryki na żywo','Transkrypcja PL/EN z rozpoznaniem mówców','Następne pytania z czasem, żeby zmieścić się w 45 min'], shot('live',1440,900,'Rozmowa na żywo z coachem AI','app.tekma.app/rozmowa/na-zywo'))
   + split('Porównanie kandydatów','Trzy osoby, ta sama rubryka, jedna tabela.','Po etapie Tekma zestawia kandydatów pytanie po pytaniu. AI podsumowuje mocne strony i ryzyka — a Wy podejmujecie decyzję, patrząc na te same dane.',['Wyniki ważone wagami pytań','Rozbieżności i cytaty pod ręką','Rekomendacja „dalej / nie” tylko jako podpowiedź'], shot('compare',1440,900,'Porównanie trzech kandydatów','app.tekma.app/porownanie'), flip=True)
   + '</div>', id_='funkcje')
 + dark('Nadzór i rejestr','Każda podpowiedź ma ślad. Każda decyzja — autora.','W Ustawieniach → RODO i AI Act włączasz zgody na nagrywanie, wyjaśnienia dla kandydatów i miesięczny raport stronniczości. Jedno ustawienie jest zawsze włączone: AI tylko sugeruje.', media=shot('rodo',1440,1265,'Ustawienia RODO i AI Act','app.tekma.app/ustawienia/rodo-ai-act'), id_='nadzor')
 + section(center_head('Pytania','Najczęstsze pytania o AI') + faqh, bg=True)
 + final('AI, które pomaga podjąć decyzję — nie podejmuje jej za Was.','Pierwsze stanowisko w 5 minut. Bez karty.'))

# PRODUKT (rubryki)
pages['produkt.html'] = dict(title='Rubryki i karty ocen — Tekma', desc='Te same pytania dla każdego, wagi, opisy ocen i niezależne karty ocen. Rozbieżności dostają flagę, zanim zapadnie decyzja.', body=
 hero('Rubryki i karty ocen','Te same pytania dla każdego.\nOceny, które da się porównać.','Rubryka to zestaw pytań z wagami i opisem, co znaczy 1, a co 5. Każdy rozmówca dostaje tę samą, ocenia niezależnie, a wynik etapu liczy się sam. Bez „wydaje mi się”.','Zobacz bibliotekę szablonów','#biblioteka')
 + section(center_head('Edytor rubryki','Pytanie, waga, czas — i opis każdej oceny','Zaczynasz od szablonu albo prosisz AI o pytania z opisu stanowiska. Każde pytanie ma kotwice: co musi paść w odpowiedzi na 3, a co na 5.') + shot('rubric',1440,900,'Edytor rubryki','app.tekma.app/rubryki/backend-rozmowa-techniczna'), bg=True)
 + section('<div class="splits">'
   + split('Karta oceny','Rozmówca widzi pytania, wagi i swoją kartę. Nic więcej.','Oceny innych pojawiają się dopiero po wysłaniu własnej. Dzięki temu pierwsza opinia nie ciągnie reszty — a rozbieżności są prawdziwe, nie wygładzone.',['Skala 1–5 z opisem przy każdym pytaniu','AI proponuje ocenę z cytatem, Ty decydujesz','Wynik etapu ważony wagami pytań'], shot('scorecard',1440,1093,'Karta oceny kandydatki','app.tekma.app/kandydaci/marta-kaminska'))
   + split('Rozbieżności','2 i 5 w tym samym pytaniu? Zanim zdecydujecie, posłuchajcie fragmentu.','Gdy rozmówcy różnią się o 2 punkty lub więcej, Tekma zaznacza pytanie i podlinkowuje moment w nagraniu. Rozmawiacie o dowodach, nie o wrażeniach.',['Flaga w karcie, w lejku i na pulpicie','Kalibracja: kto ocenia łagodniej, a kto surowiej','Decyzja dopiero po dwóch ocenach'], shot('compare',1440,900,'Porównanie kandydatów z flagą rozbieżności','app.tekma.app/porownanie'), flip=True)
   + split('Biblioteka','Sprawdzone procesy na start. Skopiuj i dopasuj.','Pierwszy inżynier, pierwszy handlowiec, Product Designer, Customer Success — gotowe etapy, pytania i wagi. Zmienisz wszystko, ale nie zaczynasz od pustej kartki.',['Szablony per rola i etap','Wersjonowanie: rubryka v3 ≠ v2','Jedna rubryka w wielu stanowiskach'], shot('templates',1440,900,'Biblioteka szablonów','app.tekma.app/szablony'))
   + '</div>', id_='biblioteka')
 + section(center_head('Dlaczego to działa','Cztery rzeczy, które zmieniają jakość decyzji') + tiles([('l-list','Te same pytania','Każdy kandydat na to samo stanowisko odpowiada na identyczny zestaw. Porównujesz odpowiedzi, nie rozmowy.','#'),('l-scale','Wagi, nie wrażenia','Pytanie o projektowanie systemów waży ×3, o jakość kodu ×1. Wynik etapu liczy się z wag, a nie z „ogólnego feelingu”.','#'),('l-eye','Niezależne oceny','Rozmówca nie widzi ocen innych, dopóki nie wyśle swojej. Pierwsza opinia nie ustawia pozostałych.','#'),('l-flag','Rozbieżność to sygnał','Różnica 2+ pkt dostaje flagę i link do nagrania. To najczęściej tam leży najlepsza decyzja.','#')]), bg=True)
 + final('Pierwsza rubryka gotowa w 3 minuty — z szablonu albo z opisu stanowiska.','Bez karty. Zmienisz wszystko później.'))

# KANDYDACI
pages['dla-kandydatow.html'] = dict(title='Dla kandydatów — Tekma', desc='Widzisz etapy, dostajesz odpowiedź w 10 dni i możesz zapytać, jak AI wpłynęło na Twoją ocenę. Dane w UE, nagranie tylko za zgodą.', body=
 hero('Dla kandydatów','Wiesz, na czym stoisz.\nZawsze.','Tekma to rekrutacja, w której kandydat widzi etapy, dostaje odpowiedź w 10 dni i może zapytać, jak AI wpłynęło na jego ocenę. Bo dobra rekrutacja to też dobre wrażenie, gdy odpowiedź brzmi „nie”.','Jak chronimy Twoje dane','#dane')
 + section('<div class="splits">'
   + split('Portal kandydata','Etap, termin, co dalej — na telefonie.','Po aplikacji kandydat dostaje link do swojego portalu: widzi, na którym jest etapie, kiedy następna rozmowa i czego się spodziewać. Zero „czy mogę zapytać o status?”.',['Oś etapów z datami i rozmówcami','Opis rozmowy: ile trwa, o co zapytamy, czy nagrywamy','Dodaj do kalendarza jednym kliknięciem'], phone('portal',380,896,'Portal kandydata na telefonie'), kind='phone')
   + split('Strona kariery','Jedna strona, która mówi, jak rekrutujecie.','Tekma generuje stronę kariery z profilu firmy: wartości, proces, otwarte stanowiska i obietnica odpowiedzi w 10 dni. Własna domena, wersja angielska, widełki — jeśli chcesz.',['Ogłoszenia z lejka, zawsze aktualne','Aplikacja bez konta, z CV albo z LinkedIn','RODO: zgody i okres przechowywania zapisane przy aplikacji'], shot('career',1440,1020,'Strona kariery Nordlight Labs','nordlight.tekma.app/kariera'), flip=True)
   + '</div>', bg=True)
 + section(center_head('Nasze obietnice','Cztery rzeczy, które kandydat dostaje zawsze') + tiles([('l-clock','Odpowiedź w 10 dni','Każda aplikacja dostaje odpowiedź — także odmowną. Po 5 dniach bez ruchu Tekma przypomina właścicielowi stanowiska.','#'),('l-list','Te same pytania','Każdy kandydat na to samo stanowisko odpowiada na ten sam zestaw. Ocena opiera się na tym, co powiedziałeś.','produkt.html'),('l-shield','Nagranie za zgodą','Notetaker dołącza tylko, gdy się zgodzisz. Nagrania i transkrypcje są w UE, usuwane po okresie, który widzisz w portalu.','#dane'),('l-msg','Prawo do wyjaśnienia','Zapytaj, jak AI wpłynęło na Twoją ocenę. Dostaniesz te same powody, które widział rekruter — i decyzję, którą podjął człowiek.','ai.html')]))
 + dark('Twoje dane','Pobierz, popraw albo usuń swoje dane. W portalu, bez pisania do nikogo.','Wniosek trafia do firmy z 30-dniowym terminem i licznikiem na jej pulpicie. Po odrzuceniu Tekma sama usuwa dane po ustalonym okresie — chyba że zgodzisz się zostać w bazie.', media=shot('rodo',1440,1265,'Ustawienia RODO i AI Act','app.tekma.app/ustawienia/rodo-ai-act'), id_='dane')
 + final('Rekrutujesz? Daj kandydatom to, czego sam byś chciał.','Pierwsze stanowisko w 5 minut. Bez karty.'))

# 90 DNI
pages['po-zatrudnieniu.html'] = dict(title='Pierwsze 90 dni — Tekma', desc='Plan 90 dni, 1:1, check-iny nastroju, cele i szkolenia. Tekma podpowiada, o co zapytać, i mówi, kiedy ktoś zaczyna gasnąć.', body=
 hero('Po zatrudnieniu','Oferta to nie koniec.\nTo dzień 1 z 90.','Nowa osoba dostaje plan na pierwsze 90 dni z przeglądami na dzień 7, 30, 60 i 90. Menedżer — rytm 1:1 i cotygodniowy check-in nastroju. Tekma podpowiada, o co zapytać, i mówi, kiedy ktoś zaczyna gasnąć.','Zobacz plan 90 dni','#profil')
 + section(center_head('Profil osoby','Wszystko o pierwszych 90 dniach w jednym widoku','Plan, najbliższe 1:1, nastrój z check-inów, szkolenia i wynik z rekrutacji — żeby menedżer nie szukał po pięciu narzędziach.') + shot('person',1440,983,'Profil nowej osoby z planem 90 dni','app.tekma.app/ludzie/katarzyna-mazur'), bg=True, id_='profil')
 + section('<div class="splits">'
   + split('Check-in','Jedna minuta w piątek. Widzi to tylko menedżer.','Pięć pytań na telefonie: jak minął tydzień, co wpłynęło, co się udało, co blokuje. Odpowiedzi nie trafiają do HR ani do zarządu — tylko do bezpośredniego menedżera.',['Nastrój 1–5 z tagami: tempo, zespół, cele, wsparcie','Seria check-inów i trend na profilu','Spadek nastroju trafia na pulpit menedżera'], phone('checkin',390,844,'Check-in nastroju na telefonie'), kind='phone')
   + split('1:1','Wspólna agenda i podpowiedź, o co zapytać.','Punkty dodają obie strony. Tekma dokłada sugestię na podstawie ostatniego check-inu i celów — np. „Katarzyna napisała, że mniej gasi pożarów. Zapytaj, co chciałaby przejąć”.',['Rytm co 1 albo 2 tygodnie, z kalendarza','Notatki widzą tylko dwie osoby','Zaległe 1:1 widać na pulpicie i w Slacku'], shot('one',1440,900,'Widok 1:1 ze wspólną agendą','app.tekma.app/ludzie/katarzyna-mazur/1-1'), flip=True)
   + split('Cele','Firma → zespół → osoba. Każdy widzi, do czego dokłada się jego praca.','Cele firmy rozpisane na zespoły i osoby, z postępem i terminem. Nowa osoba od pierwszego dnia wie, co ma dowieźć w 90 dni — bo zapisaliście to jeszcze w rekrutacji.',['Oczekiwania na 90 dni przenoszą się z ogłoszenia','Postęp per cel i per osoba','Przeglądy na dzień 30, 60 i 90'], shot('goals',1440,900,'Drzewo celów firma → zespół → osoba','app.tekma.app/cele'))
   + split('Szkolenia','Krótkie powtórki co dzień zamiast wideo, którego nikt nie dokończy.','Kursy wewnętrzne i certyfikacje jako 2–3-minutowe powtórki na telefonie. Seria, postęp, voucher po ukończeniu. Menedżer przypisuje, osoba robi w kolejce do kawy.',['Klub książki, onboarding do on-call, certyfikacje','Powtórka z kursu na mobile','Postęp widoczny na profilu'], phone('course',390,844,'Powtórka z kursu na telefonie'), kind='phone', flip=True)
   + '</div>')
 + section(center_head('Dlaczego 90 dni','Większość rezygnacji zapada w pierwszym kwartale') + tiles([('l-cal','Dzień 7','Pierwszy check-in i 1:1. Dostępy, zespół, pierwsze zadanie. Tu wychodzi, czy onboarding w ogóle zadziałał.','#'),('l-target','Dzień 30','Pierwszy przegląd celów. Czy oczekiwania z rekrutacji są realne? Czy jest wsparcie?','#'),('l-smile','Dzień 60','Trend nastroju z 8 tygodni. Spadek to sygnał dla menedżera, zanim ktoś zacznie szukać.','#'),('l-users','Dzień 90','Przegląd końcowy: wynik z rekrutacji vs. pierwsze 90 dni. Czego nauczyliście się o własnej rubryce.','#')]), bg=True)
 + final('Plan 90 dni gotowy, zanim nowa osoba zacznie pracę.','Powstaje z oczekiwań zapisanych w rekrutacji. Bez karty.'))

for path, p in pages.items():
    html = head(p['title'], p['desc'], path) + nav(path) + p['body'] + FOOTER
    with open(os.path.join(SITE, path), 'w') as f: f.write(html)
    print('wrote', path, len(html))

# patch index.html: nav links, carousel, Free plan, css version
idx = os.path.join(SITE,'index.html'); s = open(idx).read()
s = re.sub(r'<svg width="0" height="0" style="position:absolute" aria-hidden="true">.*?</svg>\n', svg_symbols()+'\n', s, count=1, flags=re.S)
s = re.sub(r'<header class="nav" id="nav">.*?</header>\n', nav('index.html').split('\n',1)[1].split('<main id="top">')[0], s, count=1, flags=re.S)
s = s.replace('<main id="top">\n\n<main id="top">','<main id="top">')
if 'id="notetaker"' not in s:
    s = s.replace('<!-- FEATURE 2 -->', carousel() + '\n<!-- FEATURE 2 -->')
s = s.replace('<header><b>Starter</b></header>','<header><b>Free</b></header>').replace('<div class="price"><b>49 €</b><span>/ mies.</span></div>','<div class="price"><b>0 €</b><span>na zawsze</span></div>').replace('<p class="sub">Dla pierwszych rekrutacji</p>','<p class="sub">Na pierwsze rekrutacje — bez karty</p>').replace('10 rozmów z analizą AI / mies.','5 rozmów z analizą AI / mies.').replace('>Zacznij za darmo</a>','>Załóż konto</a>').replace('data-plan="starter"','data-plan="free"').replace('%20%E2%80%94%20Starter','%20%E2%80%94%20Free')
s = re.sub(r'landing\.(css|js)\?v=[a-z0-9]+', lambda m: f'landing.{m.group(1)}?v={V}', s)
# footer swap
s = re.sub(r'<footer class="foot">.*?</footer>', FOOTER.split('</main>\n',1)[1].split('<dialog',1)[0].rstrip(), s, count=1, flags=re.S)
open(idx,'w').write(s); print('patched index.html')
