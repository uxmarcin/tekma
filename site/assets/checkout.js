/* Tekma — strona zamówienia. Bez bibliotek. */
const CONFIG = { email: 'hello@tekma.app', stripeLinks: { starter: '', pro: '' } };

(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const PLANS = {
    starter: { name: 'Starter', price: 49, features: ['5 aktywnych stanowisk', '25 rozmów z analizą AI / mies.', 'Notetaker dołącza sam', 'Raporty lejka', 'Strona kariery i portal kandydata'] },
    pro: { name: 'Pro', price: 129, features: ['Bez limitu stanowisk', '60 rozmów z analizą AI / mies., kolejne po 2 €', 'Coach AI na żywo', 'Kalibracja rozmówców', 'Gmail, Outlook, Slack i kalendarze', 'Eksport rejestru decyzji AI'] },
  };
  const STEP_NAMES = { 1: 'Pakiet', 2: 'Dane do faktury', 3: 'Wysyłka zamówienia' };
  const FIELDS = ['email', 'name', 'company', 'nip', 'country', 'street', 'postal', 'city'];
  const LABELS = { email: 'E-mail', name: 'Imię i nazwisko', company: 'Nazwa firmy', nip: 'NIP', country: 'Kraj', street: 'Ulica i numer', postal: 'Kod pocztowy', city: 'Miasto' };

  /* pamięć sesji — strona działa też bez niej */
  const store = {
    get(k) { try { return JSON.parse(sessionStorage.getItem('tekma-checkout-' + k)); } catch { return null; } },
    set(k, v) { try { sessionStorage.setItem('tekma-checkout-' + k, JSON.stringify(v)); } catch { /* brak pamięci sesji */ } },
  };

  /* stan */
  let plan = 'pro';
  let step = 1;
  let shownPrice = PLANS.pro.price;
  let doneMax = 0; // najwyższy krok, do którego użytkownik dotarł z poprawnymi danymi

  const form = $('#ck-form');
  const stepper = $('#ck-stepper');
  const live = $('#ck-step-live');
  const panels = $$('.ck-panel');
  const field = n => $('#f-' + n);
  const errEl = n => $('#e-' + n);

  /* ---------- pakiet ---------- */
  const planFromUrl = () => {
    const p = new URLSearchParams(location.search).get('plan');
    return p && PLANS[p] ? p : null;
  };

  const animateAmount = (from, to) => {
    const els = $$('[data-amount]');
    const counters = els.filter(e => e.classList.contains('ck-amount'));
    els.filter(e => !e.classList.contains('ck-amount')).forEach(e => e.textContent = to);
    if (reduce || from === to) { counters.forEach(e => e.textContent = to); return; }
    const t0 = performance.now(), dur = 420;
    const tick = now => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      const v = Math.round(from + (to - from) * e);
      counters.forEach(el => el.textContent = v);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const setPlan = (p, { animate = true } = {}) => {
    plan = p;
    const P = PLANS[p];
    $$('.ck-plan').forEach(c => c.classList.toggle('is-selected', $('input', c).value === p));
    const input = $('#plan-' + p); if (input && !input.checked) input.checked = true;
    $$('[data-plan-name]').forEach(e => e.textContent = P.name);
    document.title = `Zamówienie pakietu ${P.name} — Tekma`;
    $('#ck-sum-list').innerHTML = P.features.slice(0, 4).map(f => `<li>${f}</li>`).join('');
    animateAmount(animate ? shownPrice : P.price, P.price);
    shownPrice = P.price;
    store.set('plan', p);
  };

  $$('.ck-plan-input').forEach(i => i.addEventListener('change', () => setPlan(i.value)));

  /* ---------- walidacja ---------- */
  const normalizeNip = v => v.replace(/^\s*PL/i, '').replace(/[\s-]/g, '');
  const nipValid = v => {
    if (!/^\d{10}$/.test(v)) return false;
    const w = [6, 5, 7, 2, 3, 4, 5, 6, 7];
    const sum = w.reduce((s, x, i) => s + x * +v[i], 0);
    const c = sum % 11;
    return c !== 10 && c === +v[9];
  };

  const validators = {
    email: v => !v ? 'Wpisz adres e-mail.' : !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? 'Wpisz adres e-mail w formacie nazwa@firma.pl.' : '',
    name: v => !v ? 'Wpisz imię i nazwisko.' : '',
    company: v => !v ? 'Wpisz nazwę firmy.' : '',
    nip: v => { if (!v) return ''; const n = normalizeNip(v); return !/^\d{10}$/.test(n) ? 'NIP ma 10 cyfr, na przykład 526-025-02-74.' : !nipValid(n) ? 'Ten NIP ma błędną cyfrę kontrolną. Sprawdź, czy wszystkie cyfry się zgadzają.' : ''; },
    country: v => !v ? 'Wybierz kraj.' : '',
    street: v => !v ? 'Wpisz ulicę i numer.' : '',
    postal: v => { if (!v) return 'Wpisz kod pocztowy.'; if (field('country').value === 'Polska' && !/^\d{2}-\d{3}$/.test(v)) return 'Wpisz kod pocztowy w formacie 00-000.'; return ''; },
    city: v => !v ? 'Wpisz miasto.' : '',
  };

  const normalizers = {
    nip: v => { const n = normalizeNip(v); return /^\d{10}$/.test(n) ? n.replace(/(\d{3})(\d{3})(\d{2})(\d{2})/, '$1-$2-$3-$4') : v.trim(); },
    postal: v => { const t = v.trim(); return field('country').value === 'Polska' && /^\d{5}$/.test(t) ? t.slice(0, 2) + '-' + t.slice(2) : t; },
    email: v => v.trim().toLowerCase(),
  };

  const validateField = (n, { show = true } = {}) => {
    const el = field(n);
    if (normalizers[n]) el.value = normalizers[n](el.value); else el.value = el.value.trim();
    const msg = validators[n](el.value);
    if (show) { errEl(n).textContent = msg; el.setAttribute('aria-invalid', msg ? 'true' : 'false'); if (!msg) el.removeAttribute('aria-invalid'); }
    return msg;
  };

  const errsum = $('#ck-errsum');
  const validateAll = () => {
    const errs = FIELDS.map(n => [n, validateField(n)]).filter(([, m]) => m);
    if (!errs.length) { errsum.hidden = true; return true; }
    $('#ck-errsum-t').textContent = errs.length === 1 ? 'Popraw 1 pole, żeby przejść dalej.' : `Popraw ${errs.length} ${errs.length < 5 ? 'pola' : 'pól'}, żeby przejść dalej.`;
    $('#ck-errsum-list').innerHTML = errs.map(([n, m]) => `<li><button type="button" data-field="${n}">${LABELS[n]}: ${m}</button></li>`).join('');
    errsum.hidden = false;
    field(errs[0][0]).focus();
    return false;
  };
  errsum.addEventListener('click', e => { const b = e.target.closest('[data-field]'); if (b) field(b.dataset.field).focus(); });

  FIELDS.forEach(n => {
    const el = field(n);
    el.addEventListener('blur', () => { if (el.value || el.hasAttribute('aria-invalid')) validateField(n); saveForm(); });
    el.addEventListener('input', () => { if (el.getAttribute('aria-invalid') === 'true') validateField(n); });
    if (n === 'country') el.addEventListener('change', () => { if (field('postal').hasAttribute('aria-invalid')) validateField('postal'); saveForm(); });
  });

  /* ---------- dane formularza ---------- */
  const formData = () => Object.fromEntries(FIELDS.map(n => [n, field(n).value.trim()]));
  const saveForm = () => store.set('form', formData());
  const restoreForm = () => { const d = store.get('form'); if (!d) return; FIELDS.forEach(n => { if (d[n] != null) field(n).value = d[n]; }); };

  /* ---------- przegląd ---------- */
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const renderReview = () => {
    const d = formData();
    $('#r-email').textContent = d.email;
    $('#r-person').innerHTML = `${esc(d.name)}<small>${esc(d.company)}${d.nip ? ' · <span class="ck-nowrap">NIP ' + esc(d.nip) + '</span>' : ''}</small>`;
    $('#r-address').innerHTML = `${esc(d.street)}<small>${esc(d.postal)} ${esc(d.city)}, ${esc(d.country)}</small>`;
    const link = CONFIG.stripeLinks[plan];
    $('#ck-submit').textContent = link ? 'Przejdź do płatności' : 'Wyślij zamówienie';
    $('#ck-send-note').hidden = !!link;
  };

  /* ---------- kroki ---------- */
  const canEnter = n => n === 1 || (n === 2) || (n === 3 && FIELDS.every(f => !validators[f](field(f).value.trim())));

  const showStep = (n, { push = true, focus = true, history: useHistory = true } = {}) => {
    if (!canEnter(n)) n = 2;
    step = n;
    panels.forEach(p => { p.hidden = +p.dataset.panel !== n; });
    $$('.ck-step', stepper).forEach(s => {
      const k = +s.dataset.step;
      s.classList.toggle('is-done', k < n);
      if (k === n) s.setAttribute('aria-current', 'step'); else s.removeAttribute('aria-current');
    });
    if (n === 3) renderReview();
    live.textContent = `Krok ${n} z 3: ${STEP_NAMES[n]}`;
    const hash = '#krok-' + n;
    if (useHistory && push && location.hash !== hash) history.pushState({ step: n }, '', hash);
    else if (useHistory && !push) history.replaceState({ step: n }, '', hash);
    if (focus) { const h = $('#ck-h-' + n); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } }
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    closeMobileSummary();
  };

  form.addEventListener('click', e => {
    const next = e.target.closest('[data-next]');
    const prev = e.target.closest('[data-prev]');
    const goto = e.target.closest('[data-goto]');
    if (next) {
      const n = +next.dataset.next;
      if (n === 3 && !validateAll()) return;
      if (n === 2) saveForm();
      showStep(n);
    } else if (prev) {
      saveForm(); showStep(+prev.dataset.prev);
    } else if (goto) {
      showStep(+goto.dataset.goto, { focus: !goto.dataset.focus });
      if (goto.dataset.focus) field(goto.dataset.focus.replace('f-', '')).focus();
    }
  });
  $('#ck-change-plan').addEventListener('click', () => showStep(1));
  form.addEventListener('submit', e => { e.preventDefault(); if (step === 2 && validateAll()) showStep(3); });
  form.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('input') && step === 2) { e.preventDefault(); if (validateAll()) showStep(3); }
  });

  window.addEventListener('popstate', () => {
    const m = /^#krok-(\d)$/.exec(location.hash);
    const n = m ? +m[1] : 1;
    if (!$('#ck-done').hidden) return; // po potwierdzeniu zostajemy na potwierdzeniu
    showStep(n, { push: false });
  });

  /* ---------- panel na mobile ---------- */
  const summary = $('#ck-summary'), toggle = $('#ck-mobile-toggle');
  const closeMobileSummary = () => { summary.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); };
  toggle.addEventListener('click', () => {
    const open = summary.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  /* ---------- wysyłka ---------- */
  const orderNo = () => {
    let n = store.get('order');
    if (n) return n;
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const buf = new Uint8Array(5); (crypto.getRandomValues ? crypto.getRandomValues(buf) : buf.map(() => Math.random() * 256));
    n = 'TK-2026-' + [...buf].map(b => A[b % A.length]).join('');
    store.set('order', n);
    return n;
  };

  const orderText = (no) => {
    const d = formData(), P = PLANS[plan];
    return [
      `Zamówienie Tekma ${P.name} ${no}`,
      '',
      `Pakiet: ${P.name}, ${P.price} € / mies.`,
      `E-mail: ${d.email}`,
      `Imię i nazwisko: ${d.name}`,
      `Firma: ${d.company}`,
      `NIP: ${d.nip || 'nie podano'}`,
      `Adres: ${d.street}, ${d.postal} ${d.city}, ${d.country}`,
      '',
      'Proszę o fakturę proforma i link do płatności.',
    ].join('\n');
  };

  const renderDone = (no) => {
    const d = formData(), P = PLANS[plan];
    const row = (t, v) => `<div class="ck-rev-row"><dt>${t}</dt><dd>${v}</dd></div>`;
    $('#ck-done-rev').innerHTML =
      row('Pakiet', `<b>${P.name}</b><span class="ck-rev-price">${P.price} € / mies.</span>`) +
      row('E-mail', esc(d.email)) +
      row('Zamawia', `${esc(d.name)}<small>${esc(d.company)}${d.nip ? ' · <span class="ck-nowrap">NIP ' + esc(d.nip) + '</span>' : ''}</small>`) +
      row('Adres', `${esc(d.street)}<small>${esc(d.postal)} ${esc(d.city)}, ${esc(d.country)}</small>`);
    $('#ck-order-no').textContent = no;
  };

  $('#ck-submit').addEventListener('click', () => {
    const d = formData(), P = PLANS[plan];
    const link = CONFIG.stripeLinks[plan];
    if (link) {
      const u = new URL(link);
      u.searchParams.set('prefilled_email', d.email);
      location.href = u.toString();
      return;
    }
    const no = orderNo();
    const text = orderText(no);
    const subject = `Zamówienie Tekma ${P.name} ${no}`;
    renderDone(no);
    $('#ck-review').hidden = true;
    const done = $('#ck-done'); done.hidden = false;
    $$('.ck-step', stepper).forEach(s => { s.classList.add('is-done'); s.removeAttribute('aria-current'); });
    live.textContent = `Zamówienie ${no} gotowe do wysłania`;
    history.replaceState({ step: 3, done: true }, '', '#gotowe');
    done.focus();
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    location.href = `mailto:${CONFIG.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  });

  /* kopiowanie treści */
  const copyMsg = $('#ck-copy-msg');
  $('#ck-copy').addEventListener('click', async () => {
    const text = orderText($('#ck-order-no').textContent);
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch { /* fallback poniżej */ }
    if (!ok) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(ta); ta.select();
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      ta.remove();
    }
    copyMsg.textContent = ok ? 'Skopiowano. Wklej treść w wiadomości do hello@tekma.app.' : 'Nie udało się skopiować. Zaznacz dane powyżej i skopiuj je ręcznie.';
    copyMsg.style.color = ok ? '' : 'var(--bad)';
  });

  /* ---------- start ---------- */
  restoreForm();
  const initial = planFromUrl() || store.get('plan') || 'pro';
  shownPrice = PLANS[initial].price;
  setPlan(initial, { animate: false });
  const m = /^#krok-(\d)$/.exec(location.hash);
  // Bez zapisu hasha przy starcie: zmiana adresu przed zdarzeniem load przewinęłaby stronę do sekcji kroku.
  showStep(m ? +m[1] : 1, { push: false, focus: false, history: !!m });
  if (m) addEventListener('load', () => scrollTo(0, 0), { once: true });
})();
