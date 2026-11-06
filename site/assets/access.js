/* Formularz „Poproś o wcześniejszy dostęp” → Supabase (tabela waitlist, tylko insert dla anon). */
(() => {
  const dlg = document.getElementById('access');
  if (!dlg || typeof dlg.showModal !== 'function') return;          // bez <dialog>: zostaje link mailto
  const EN = document.documentElement.lang === 'en';
  const T = EN ? { email: 'Enter a valid email address.', consent: 'Please tick the consent to process your email address.', fail: 'We could not save your address. Try again in a moment or write to hello@tekma.app.' }
               : { email: 'Wpisz poprawny adres e-mail.', consent: 'Zaznacz zgodę na przetwarzanie adresu e-mail.', fail: 'Nie udało się zapisać adresu. Spróbuj ponownie za chwilę lub napisz na hello@tekma.app.' };
  const form = document.getElementById('access-form');
  const wrap = document.getElementById('access-form-wrap');
  const ok = document.getElementById('access-ok');
  const err = document.getElementById('access-err');
  const btn = document.getElementById('access-submit');
  const email = document.getElementById('access-email');
  const consent = document.getElementById('access-consent');
  let ctx = { source: 'nav', plan: null };
  const RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  const show = msg => { err.textContent = msg; err.hidden = !msg; };
  const open = (src, plan) => {
    ctx = { source: src, plan };
    show(''); wrap.hidden = false; ok.hidden = true; btn.disabled = false;
    dlg.showModal(); email.focus();
  };
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-access]');
    if (!a) return;
    e.preventDefault();
    const m = document.getElementById('mmenu'); if (m) m.classList.remove('open');
    open(a.closest('.hero') ? 'hero' : a.closest('.plan-card') ? 'cennik' : a.closest('header,.nav,.mobile-menu') ? 'nav' : 'cta', a.dataset.plan || null);
  });
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });   // klik w tło

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const val = email.value.trim().toLowerCase();
    if (!RE.test(val) || val.length > 254) { show(T.email); email.focus(); return; }
    if (!consent.checked) { show(T.consent); consent.focus(); return; }
    if (form.elements.website.value) { wrap.hidden = true; ok.hidden = false; return; }   // honeypot
    show(''); btn.disabled = true;
    try {
      const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import('../app/js/config.js');
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('config');
      const r = await fetch(SUPABASE_URL + '/rest/v1/waitlist', {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
          'Content-Type': 'application/json', Prefer: 'return=minimal,resolution=ignore-duplicates'
        },
        body: JSON.stringify({
          email: val, consent: true,
          consent_text: document.getElementById('access-consent-text').textContent.trim(),
          source: ctx.source, plan: ctx.plan
        })
      });
      if (!r.ok) throw new Error(String(r.status));
      wrap.hidden = true; ok.hidden = false;
      ok.querySelector('button').focus();
    } catch (x) {
      btn.disabled = false;
      show(T.fail);
    }
  });
})();
