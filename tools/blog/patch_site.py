#!/usr/bin/env python3
"""Jednorazowo i idempotentnie: dopina blog i podstawy SEO do istniejących stron marketingowych
(index, produkt, ai, integracje, po-zatrudnieniu, dla-kandydatow), generuje sitemap.xml i robots.txt.
Uruchom po build.py:  python3 tools/blog/patch_site.py
Nie dotyka site/app/. Strony te są dziś edytowane ręcznie (tools/build-pages.py jest nieaktualny)."""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build as B

SITE, BASE, TODAY = B.SITE, B.BASE, B.TODAY
PAGES = ['index.html', 'produkt.html', 'ai.html', 'integracje.html', 'po-zatrudnieniu.html', 'dla-kandydatow.html']
NAMES = {'produkt.html': 'Rubryki i karty ocen', 'ai.html': 'AI w Tekmie', 'integracje.html': 'Integracje', 'po-zatrudnieniu.html': 'Pierwsze 90 dni', 'dla-kandydatow.html': 'Dla kandydatów'}

def rd(n): return open(os.path.join(SITE, n), encoding='utf-8').read()
def wr(n, s): open(os.path.join(SITE, n), 'w', encoding='utf-8').write(s)

def ld_script(graph): return B.jsonld({'@context': 'https://schema.org', '@graph': graph})

HOME_LD = [
  {**B.ORG, 'email': 'hello@tekma.app', 'description': 'Tekma to narzędzie do strukturalnej rekrutacji z AI, które podpowiada, a człowiek decyduje: rubryki, karty ocen, notetaker i plan pierwszych 90 dni.',
   'address': {'@type': 'PostalAddress', 'addressLocality': 'Rzeszów', 'addressCountry': 'PL'}},
  {'@type': 'WebSite', '@id': BASE + '#website', 'url': BASE, 'name': 'Tekma', 'inLanguage': 'pl', 'publisher': {'@id': BASE + '#org'}},
  {'@type': 'SoftwareApplication', '@id': BASE + '#app', 'name': 'Tekma', 'url': BASE, 'applicationCategory': 'BusinessApplication', 'operatingSystem': 'Web', 'inLanguage': 'pl',
   'description': 'Rubryki, notetaker AI i karty ocen w jednym miejscu. Te same pytania dla każdego, decyzja po dwóch niezależnych ocenach, a po ofercie plan pierwszych 90 dni.',
   'publisher': {'@id': BASE + '#org'},
   'offers': [
     {'@type': 'Offer', 'name': 'Free', 'price': '0', 'priceCurrency': 'EUR', 'url': BASE + '#cennik'},
     {'@type': 'Offer', 'name': 'Pro', 'price': '129', 'priceCurrency': 'EUR', 'url': BASE + '#cennik',
      'priceSpecification': {'@type': 'UnitPriceSpecification', 'price': '129', 'priceCurrency': 'EUR', 'billingDuration': 'P1M'}}]},
]

def head_patch(s, name):
    title = re.search(r'<title>(.*?)</title>', s, re.S).group(1)
    desc = re.search(r'<meta name="description" content="(.*?)">', s, re.S).group(1)
    canon = re.search(r'<link rel="canonical" href="(.*?)">', s).group(1)
    if 'hreflang="pl"' not in s:
        s = s.replace(f'<link rel="canonical" href="{canon}">', f'<link rel="canonical" href="{canon}">\n<link rel="alternate" hreflang="pl" href="{canon}">', 1)
    if 'og:site_name' not in s:
        s = s.replace('<meta property="og:type" content="website">', '<meta property="og:type" content="website">\n<meta property="og:site_name" content="Tekma">\n<meta property="og:locale" content="pl_PL">', 1)
    if 'twitter:title' not in s:
        s = s.replace('<meta name="twitter:card" content="summary_large_image">',
          f'<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="{title}">\n<meta name="twitter:description" content="{desc}">\n<meta name="twitter:image" content="{BASE}assets/og.png">', 1)
    s = re.sub(r'landing\.css\?v=[a-z0-9]+', f'landing.css?v={B.CSS_V}', s)
    if name == 'index.html' and 'assets/blog.css' not in s:
        s = s.replace(f'<link rel="stylesheet" href="assets/landing.css?v={B.CSS_V}">', f'<link rel="stylesheet" href="assets/landing.css?v={B.CSS_V}">\n<link rel="stylesheet" href="assets/blog.css?v={B.BLOG_V}">', 1)
    # JSON-LD
    if 'application/ld+json' not in s:
        if name == 'index.html':
            graph = HOME_LD
        else:
            graph = [B.ORG, B.breadcrumb_ld([('Tekma', ''), (NAMES[name], name)])]
            if name == 'ai.html':
                faq = re.findall(r'<details[^>]*><summary>(.*?)</summary><p>(.*?)</p></details>', s, re.S)
                import html as H
                faq = [(H.unescape(re.sub(r'<[^>]+>', '', q)), H.unescape(re.sub(r'<[^>]+>', '', a))) for q, a in faq]
                graph.append(B.faq_ld(faq))
        s = s.replace('</head>', ld_script(graph) + '\n</head>', 1)
    return s

def nav_patch(s):
    if 'href="blog/"' in s: return s
    s = s.replace('<a href="/#cennik">Cennik</a></nav>', '<a href="blog/">Blog</a><a href="/#cennik">Cennik</a></nav>', 1)
    s = s.replace('<a href="/#cennik">Cennik</a><a href="app/">', '<a href="blog/">Blog</a><a href="/#cennik">Cennik</a><a href="app/">', 1)
    col = ('<div><h5>Poradniki</h5><ul><li><a href="blog/">Blog: hiring playbooks</a></li><li><a href="blog/jak-zatrudnic-pierwszego-programiste.html">Pierwszy programista</a></li>'
           '<li><a href="blog/scorecard-rekrutacyjny.html">Scorecard rekrutacyjny</a></li><li><a href="blog/ai-act-a-rekrutacja.html">AI Act a rekrutacja</a></li><li><a href="tekma-vs-arkusz-vs-ats.html">Tekma vs arkusz vs ATS</a></li></ul></div>\n      ')
    s = s.replace('<div><h5>Firma</h5>', col + '<div><h5>Firma</h5>', 1)
    return s

def home_teaser(s):
    if 'id="blog"' in s: return s
    items = [i for i in B.card_items() if i['slug'] in ('scorecard-rekrutacyjny', 'ai-act-a-rekrutacja', 'jak-zatrudnic-pierwszego-programiste')]
    items.sort(key=lambda i: ['jak-zatrudnic-pierwszego-programiste', 'scorecard-rekrutacyjny', 'ai-act-a-rekrutacja'].index(i['slug']))
    sec = f'''<!-- BLOG -->
<section class="sec" id="blog">
  <div class="wrap">
    <div class="sec-head-row">
      <div class="reveal"><span class="eyebrow">Hiring playbooks</span><h2>Jak rekrutować lepiej: poradniki z konkretami</h2><p class="lede">Karta oceny kandydata, AI Act, widełki płacowe, pierwszy programista i plan 30-60-90 dni. Po polsku, bez ogólników.</p></div>
      <a class="link-arrow reveal" href="blog/">Wszystkie poradniki <i aria-hidden="true">→</i></a>
    </div>
    {B.cards(items, '')}
    <p class="lede" style="margin-top:28px;font-size:15px">Zobacz też: <a href="blog/widelki-plac-w-ogloszeniu.html" style="text-decoration:underline;text-underline-offset:3px">widełki płacowe i jawność wynagrodzeń</a>, <a href="blog/onboarding-30-60-90-dni.html" style="text-decoration:underline;text-underline-offset:3px">onboarding 30-60-90</a>, <a href="tekma-vs-arkusz-vs-ats.html" style="text-decoration:underline;text-underline-offset:3px">Tekma vs arkusz vs ATS</a>.</p>
  </div>
</section>

'''
    return s.replace('<!-- FINAL CTA -->', sec + '<!-- FINAL CTA -->', 1)

def sitemap():
    def u(path, alts=None):
        loc = BASE + path
        x = f'  <url>\n    <loc>{loc}</loc>\n    <lastmod>{TODAY}</lastmod>\n'
        for lang, href in (alts or []):
            x += f'    <xhtml:link rel="alternate" hreflang="{lang}" href="{BASE}{href}"/>\n'
        return x + '  </url>\n'
    pl_sc, en_sc = 'blog/scorecard-rekrutacyjny.html', 'en/interview-scorecard.html'
    alts = [('pl', pl_sc), ('en', en_sc), ('x-default', pl_sc)]
    out = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
    for path in ['', 'produkt.html', 'ai.html', 'integracje.html', 'po-zatrudnieniu.html', 'dla-kandydatow.html', 'blog/', 'tekma-vs-arkusz-vs-ats.html']: out += u(path)
    for a in B.ARTICLES:
        path = f'blog/{a["slug"]}.html'
        out += u(path, alts if path == pl_sc else None)
    out += u(en_sc, alts)
    return out + '</urlset>\n'

if __name__ == '__main__':
    for n in PAGES:
        s = rd(n)
        s = head_patch(s, n); s = nav_patch(s)
        if n == 'index.html': s = home_teaser(s)
        wr(n, s); print('patched', n)
    wr('sitemap.xml', sitemap()); print('wrote sitemap.xml')
    wr('robots.txt', '# Strona marketingowa Tekmy\nUser-agent: *\nAllow: /\nDisallow: /tools/\n\nSitemap: https://tekma.app/sitemap.xml\n'); print('wrote robots.txt')
