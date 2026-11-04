/**
 * views/auth.js — logowanie (#/login), rejestracja (#/signup), reset hasła (#/reset)
 * oraz ekran „Sprawdź skrzynkę” (kod 6-cyfrowy z e-maila) po rejestracji z needsConfirmation
 * i po próbie logowania niepotwierdzonym adresem (błąd `email_not_confirmed` → automatyczna ponowna wysyłka).
 *
 * Tryb wybiera ctx.path. Stany: ładowanie (przycisk busy), błąd (nad formularzem / pod polem kodu),
 * „sprawdź skrzynkę” po wysłaniu linku resetu.
 * export default async function render(ctx) -> HTMLElement
 */

const RESEND_SECONDS = 60;
const CODE_LENGTH = 6;
const DEMO_CODE = '123456';

export default async function render(ctx) {
  await ctx.ui.loadCss(new URL('./auth.css', import.meta.url));
  const mode = ctx.path === '#/signup' ? 'signup' : ctx.path === '#/reset' ? 'reset' : 'login';
  const { h } = ctx.ui;
  const wrap = h('div', { style: 'width:100%;display:flex;flex-direction:column;align-items:center' });
  // swap(el, focusEl?) podmienia kartę w miejscu (ekran kodu ↔ formularz) bez zmiany trasy
  const swap = (el, focusEl) => {
    wrap.replaceChildren(el);
    if (ctx.store.mode === 'demo') wrap.appendChild(demoNote(ctx));
    const target = focusEl || el.querySelector('h1');
    if (target) {
      if (target.tagName === 'H1') target.setAttribute('tabindex', '-1');
      requestAnimationFrame(() => target.focus({ preventScroll: true }));
    }
  };
  const view = { ctx, swap };
  wrap.appendChild(mode === 'signup' ? signupCard(view) : mode === 'reset' ? resetCard(view) : loginCard(view));
  if (ctx.store.mode === 'demo') wrap.appendChild(demoNote(ctx));
  return wrap;
}

function demoNote(ctx) {
  const { h, icon } = ctx.ui;
  return h('div', { class: 'demo-banner', role: 'note' }, icon('info'),
    h('span', null, h('b', null, 'Tryb demo: '), 'dane zostają tylko w tej przeglądarce. Konto demo zakładasz w kilka sekund.'));
}

/** Wspólny szkielet formularza z obsługą błędu i stanu ładowania. */
function form(ctx, { onSubmit, fields, submit, error }) {
  const { h } = ctx.ui;
  const errorSlot = h('div');
  const f = h('form', { novalidate: true, on: { submit: async (e) => {
    e.preventDefault();
    errorSlot.replaceChildren();
    for (const fl of fields) fl.setError('');
    submit.setBusy(true);
    try {
      await onSubmit();
    } catch (err) {
      const msg = (err && err.message) || 'Coś poszło nie tak. Spróbuj ponownie.';
      errorSlot.replaceChildren(ctx.ui.formError(msg));
    } finally {
      submit.setBusy(false);
    }
  } } }, errorSlot, fields, submit);
  if (error) errorSlot.replaceChildren(ctx.ui.formError(error));
  return f;
}

/* ------------------------------------------------ logowanie */
function loginCard({ ctx, swap }, { prefillEmail = '' } = {}) {
  const { h, field, button } = ctx.ui;
  const email = field({ label: 'E-mail', name: 'email', type: 'email', autocomplete: 'email', required: true, placeholder: 'anna@firma.pl', value: prefillEmail });
  const password = field({ label: 'Hasło', name: 'password', type: 'password', autocomplete: 'current-password', required: true });
  const submit = button({ label: 'Zaloguj się', variant: 'primary', type: 'submit', block: true });
  const f = form(ctx, {
    fields: [email, password], submit,
    onSubmit: async () => {
      if (!email.value.trim()) { email.setError('Podaj adres e-mail.'); email.input.focus(); return; }
      if (!password.value) { password.setError('Podaj hasło.'); password.input.focus(); return; }
      try {
        await ctx.store.auth.signIn({ email: email.value, password: password.value });
      } catch (err) {
        if (err && err.code === 'email_not_confirmed') {
          // konto istnieje, ale e-mail nie został potwierdzony → ekran kodu + automatyczna wysyłka nowego kodu
          showCodeScreen({ ctx, swap }, { email: email.value.trim().toLowerCase(), reason: 'unconfirmed', back: 'login' });
          return;
        }
        throw err;
      }
      ctx.navigate('#/');
    },
  });
  const card = h('div', { class: 'bare-card' },
    h('h1', null, 'Zaloguj się'),
    h('p', { class: 'lead' }, 'Wróć do swoich stanowisk, kandydatów i kart oceny.'),
    f,
    h('div', { class: 'bare-foot' }, h('a', { href: '#/reset' }, 'Nie pamiętasz hasła?')),
    h('div', { class: 'bare-foot' }, 'Nie masz konta? ', h('a', { href: '#/signup' }, 'Załóż konto')),
  );
  queueFocus(prefillEmail ? password.input : email.input);
  return card;
}

/* ------------------------------------------------ rejestracja */
function signupCard({ ctx, swap }, { prefill = {} } = {}) {
  const { h, field, button } = ctx.ui;
  const name = field({ label: 'Imię i nazwisko', name: 'name', type: 'text', autocomplete: 'name', required: true, placeholder: 'Anna Nowak', value: prefill.name || '' });
  const email = field({ label: 'Służbowy e-mail', name: 'email', type: 'email', autocomplete: 'email', required: true, placeholder: 'anna@firma.pl', value: prefill.email || '' });
  const password = field({ label: 'Hasło', name: 'password', type: 'password', autocomplete: 'new-password', required: true, hint: 'Co najmniej 10 znaków. Najlepiej zdanie, które łatwo zapamiętać.' });
  const submit = button({ label: 'Załóż konto', variant: 'primary', type: 'submit', block: true });
  const card = h('div', { class: 'bare-card' });

  const f = form(ctx, {
    fields: [name, email, password], submit,
    onSubmit: async () => {
      let bad = false;
      if (!name.value.trim()) { name.setError('Podaj imię i nazwisko.'); bad = true; }
      if (!email.value.trim()) { email.setError('Podaj adres e-mail.'); bad = true; }
      if (password.value.length < 10) { password.setError('Hasło musi mieć co najmniej 10 znaków.'); bad = true; }
      if (bad) { [name, email, password].find((x) => x.classList.contains('has-error')).input.focus(); return; }
      const res = await ctx.store.auth.signUp({ name: name.value, email: email.value, password: password.value });
      if (res.needsConfirmation) {
        showCodeScreen({ ctx, swap }, {
          email: email.value.trim().toLowerCase(), reason: 'signup', back: 'signup',
          prefill: { name: name.value.trim(), email: email.value.trim() },
        });
        return;
      }
      ctx.navigate('#/onboarding');
    },
  });
  card.append(
    h('h1', null, 'Załóż konto'),
    h('p', { class: 'lead' }, 'Strukturalna rekrutacja z AI, która tylko podpowiada. Decyzje zostają po Twojej stronie.'),
    f,
    h('div', { class: 'bare-foot' }, 'Masz już konto? ', h('a', { href: '#/login' }, 'Zaloguj się')),
  );
  queueFocus(prefill.email ? email.input : name.input);
  return card;
}

/* ------------------------------------------------ kod z e-maila */
/**
 * Ekran „Sprawdź skrzynkę”: jedno pole na 6-cyfrowy kod, „Dalej”, „Wyślij ponownie” (odliczanie 60 s),
 * „Zmień adres e-mail”. reason: 'signup' (kod właśnie wysłany) | 'unconfirmed' (wysyłamy nowy kod automatycznie).
 */
function showCodeScreen(view, opts) {
  const el = codeCard(view, opts);
  view.swap(el, el.codeInput);
  if (opts.reason === 'unconfirmed') el.autoResend();
}

function codeCard({ ctx, swap }, { email, back, prefill }) {
  const { h, button } = ctx.ui;
  const isDemo = ctx.store.mode === 'demo';
  const id = `code-${Date.now().toString(36)}`;
  let busy = false;
  let lastTried = '';
  let timer = null;

  const input = h('input', {
    id, name: 'code', type: 'text', class: 'code-input',
    inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: String(CODE_LENGTH), pattern: '[0-9]*',
    placeholder: 'Kod', 'aria-describedby': `${id}-err ${id}-status`, 'aria-invalid': 'false', spellcheck: 'false',
  });
  const errEl = h('div', { class: 'code-error', id: `${id}-err`, role: 'alert', 'aria-live': 'assertive' });
  const statusEl = h('div', { class: 'code-status', id: `${id}-status`, role: 'status', 'aria-live': 'polite' });
  const submit = button({ label: 'Dalej', variant: 'primary', type: 'submit', block: true });
  const resendBtn = h('button', { type: 'button', class: 'link code-link' }, 'Wyślij ponownie');
  const resendWrap = h('span', { class: 'code-resend' }, 'Nie dostałeś kodu? ', resendBtn);
  const changeBtn = h('button', { type: 'button', class: 'link code-link' }, 'Zmień adres e-mail');

  const setError = (msg) => {
    errEl.textContent = msg || '';
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    input.classList.toggle('has-error', Boolean(msg));
  };
  const setStatus = (msg) => { statusEl.textContent = msg || ''; };
  const setBusy = (b) => {
    busy = b;
    submit.setBusy(b);
    input.disabled = b;
    resendBtn.disabled = b || timer !== null;
    changeBtn.disabled = b;
  };
  const digits = () => input.value.replace(/\D/g, '').slice(0, CODE_LENGTH);

  async function verify() {
    const code = digits();
    if (code.length !== CODE_LENGTH) { setError('Wpisz 6-cyfrowy kod z e-maila.'); input.focus(); return; }
    if (busy) return;
    setError(''); setStatus('');
    lastTried = code;
    setBusy(true);
    try {
      await ctx.store.auth.verifyEmailCode({ email, code });
      setStatus('Adres potwierdzony. Przechodzimy dalej…');
      ctx.navigate('#/');   // strażnik: brak firmy → #/onboarding, inaczej pulpit
    } catch (err) {
      setBusy(false);
      setError((err && err.message) || 'Nie udało się potwierdzić kodu. Spróbuj ponownie.');
      input.focus(); input.select();
    }
  }

  function startCountdown(seconds = RESEND_SECONDS) {
    if (timer) clearInterval(timer);
    let left = seconds;
    const render = () => {
      resendBtn.disabled = true;
      resendBtn.textContent = `Wyślij ponownie (${left} s)`;
      resendBtn.setAttribute('aria-label', `Wyślij ponownie — dostępne za ${left} s`);
    };
    render();
    timer = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(timer); timer = null;
        resendBtn.disabled = busy;
        resendBtn.textContent = 'Wyślij ponownie';
        resendBtn.removeAttribute('aria-label');
      } else render();
    }, 1000);
  }

  async function resend({ silent = false } = {}) {
    if (busy || timer) return;
    setError('');
    setStatus(silent ? 'Wysyłamy nowy kod…' : '');
    resendBtn.disabled = true;
    try {
      await ctx.store.auth.resendEmailCode({ email });
      setStatus(isDemo
        ? `Gotowe. W demo kod to zawsze ${DEMO_CODE}.`
        : (silent ? `Twoje konto czeka na potwierdzenie. Wysłaliśmy nowy kod na ${email}.` : `Wysłaliśmy nowy kod na ${email}. Sprawdź też folder spam.`));
      startCountdown();
    } catch (err) {
      resendBtn.disabled = false;
      setError((err && err.message) || 'Nie udało się wysłać kodu. Spróbuj ponownie.');
      // limit wysyłki (ok. 60 s między e-mailami) → zablokuj przycisk na czas odliczania
      if (err && err.code === 'rate_limit') {
        const sec = /po ok\. (\d+) s/.exec(err.message || '');
        startCountdown(sec ? Number(sec[1]) : RESEND_SECONDS);
      }
    }
    input.focus();
  }

  // tylko cyfry, maks. 6; wklejanie „12 34 56” też działa; auto-submit po 6 cyfrach
  input.addEventListener('input', () => {
    const clean = digits();
    if (input.value !== clean) input.value = clean;
    if (errEl.textContent) setError('');
    if (clean.length === CODE_LENGTH && clean !== lastTried && !busy) verify();
  });
  input.addEventListener('paste', (e) => {
    const text = (e.clipboardData || window.clipboardData)?.getData('text') || '';
    const clean = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (!clean) return;
    e.preventDefault();
    input.value = clean;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  resendBtn.addEventListener('click', () => resend());
  changeBtn.addEventListener('click', () => {
    if (timer) { clearInterval(timer); timer = null; }
    if (back === 'login') { const c = loginCard({ ctx, swap }, { prefillEmail: email }); swap(c, c.querySelector('input[name=email]')); }
    else { const c = signupCard({ ctx, swap }, { prefill: prefill || { email } }); swap(c, c.querySelector('input[name=email]')); }
  });

  const f = h('form', { class: 'code-form', novalidate: true, on: { submit: (e) => { e.preventDefault(); verify(); } } },
    h('label', { class: 'sr-only', htmlFor: id }, 'Kod z e-maila (6 cyfr)'),
    input,
    errEl,
    submit,
  );

  const card = h('div', { class: 'bare-card code-card' },
    h('h1', null, 'Sprawdź skrzynkę'),
    h('p', { class: 'lead' }, 'Wpisz kod, który wysłaliśmy na ', h('b', null, email), '.'),
    f,
    statusEl,
    isDemo ? h('p', { class: 'code-demo', role: 'note' }, `Tryb demo: nie wysyłamy e-maili. Wpisz kod ${DEMO_CODE}.`) : null,
    h('div', { class: 'code-foot' }, resendWrap, changeBtn),
  );
  card.codeInput = input;
  card.autoResend = () => resend({ silent: true });
  return card;
}

/* ------------------------------------------------ reset hasła */
function resetCard({ ctx }) {
  const { h, field, button } = ctx.ui;
  const email = field({ label: 'E-mail', name: 'email', type: 'email', autocomplete: 'email', required: true, placeholder: 'anna@firma.pl' });
  const submit = button({ label: 'Wyślij link', variant: 'primary', type: 'submit', block: true });
  const card = h('div', { class: 'bare-card' });
  const f = form(ctx, {
    fields: [email], submit,
    onSubmit: async () => {
      if (!email.value.trim()) { email.setError('Podaj adres e-mail.'); email.input.focus(); return; }
      await ctx.store.auth.resetPassword(email.value);
      card.replaceChildren(
        h('h1', null, 'Sprawdź skrzynkę'),
        h('p', { class: 'lead' }, `Jeśli ${email.value.trim()} ma konto, wysłaliśmy link do ustawienia nowego hasła.`),
        button({ label: 'Wróć do logowania', variant: 'primary', block: true, onClick: () => ctx.navigate('#/login') }),
      );
      const h1 = card.querySelector('h1'); h1.setAttribute('tabindex', '-1'); h1.focus();
    },
  });
  card.append(
    h('h1', null, 'Reset hasła'),
    h('p', { class: 'lead' }, 'Podaj e-mail konta. Wyślemy link do ustawienia nowego hasła.'),
    f,
    h('div', { class: 'bare-foot' }, h('a', { href: '#/login' }, 'Wróć do logowania')),
  );
  queueFocus(email.input);
  return card;
}

function queueFocus(el) {
  // router po wstawieniu widoku ustawia fokus na [autofocus] (desktop) albo na h1
  el.setAttribute('autofocus', '');
}
