import re,glob,os
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+'/'
PAIRS={'/':'/en/','/produkt.html':'/en/product.html','/integracje.html':'/en/integrations.html','/ai.html':'/en/ai.html','/dla-kandydatow.html':'/en/for-candidates.html','/po-zatrudnieniu.html':'/en/first-90-days.html','/tekma-vs-arkusz-vs-ats.html':'/en/tekma-vs-spreadsheet-vs-ats.html','/blog/scorecard-rekrutacyjny.html':'/en/interview-scorecard.html'}
EN2PL={v:k for k,v in PAIRS.items()}
def alt(path,lang):
    if lang=='pl':
        return PAIRS.get(path,'/en/')
    return EN2PL.get(path,'/')
def sw(cur,href,ex=False):
    EX=' data-exact' if ex else ''
    if cur=='pl': return f'<span class="lang" role="group" aria-label="Język / Language"><a aria-current="true" lang="pl">PL</a><a href="{href}" hreflang="en" lang="en" aria-label="Switch to English" data-lang="en"{EX}>EN</a></span>'
    return f'<span class="lang" role="group" aria-label="Language / Język"><a href="{href}" hreflang="pl" lang="pl" aria-label="Polski" data-lang="pl">PL</a><a aria-current="true" lang="en">EN</a></span>'
files=[f for f in glob.glob(ROOT+'**/*.html',recursive=True) if '/app/' not in f and 'checkout' not in f]
for f in files:
    s=open(f).read()
    rel='/'+os.path.relpath(f,ROOT)
    path=rel[:-len('index.html')] if rel.endswith('/index.html') else rel
    if path=='/index.html': path='/'
    lang='en' if path.startswith('/en/') else 'pl'
    s=re.sub(r'<span class="lang".*?</span>(?=<a class="login")','',s,flags=re.S)
    s=re.sub(r'<span class="lang" role="group"[^>]*>.*?</a></span>','',s,flags=re.S)
    href=alt(path,lang); ctl=sw(lang,href,path in PAIRS)
    if '<a class="login"' not in s: print('no nav',f); continue
    s=s.replace('<a class="login"',ctl+'<a class="login"',1)
    # mobile menu
    s=re.sub(r'(<div class="mmenu" id="mmenu">)',r'\1'+ctl.replace('\\','\\\\'),s,count=1)
    if 'assets/lang.js' not in s: s=s.replace('<script>document.documentElement.classList.add(\'js\')</script>','<script>document.documentElement.classList.add(\'js\')</script>\n<script src="/assets/lang.js"></script>',1)
    open(f,'w').write(s); print('ok',lang,path)
