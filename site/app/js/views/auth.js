/**
 * views/auth.js — logowanie (#/login, Figma 22:1908), rejestracja (#/signup, Figma 22:1686), reset hasła (#/reset)
 * oraz ekran „Sprawdź skrzynkę” (kod 6-cyfrowy z e-maila) po rejestracji z needsConfirmation
 * i po próbie logowania niepotwierdzonym adresem (błąd `email_not_confirmed` → automatyczna ponowna wysyłka).
 *
 * Układ z Figmy: lewa kolumna (logo, formularz 380 px, stopka ©), prawa kolumna „Showcase” na czerni
 * z podglądem karty oceny (ukryta poniżej 900 px). Tryb wybiera ctx.path.
 * Stany: ładowanie (przycisk busy), błąd (nad formularzem / pod polem kodu), „sprawdź skrzynkę”.
 * export default async function render(ctx) -> HTMLElement
 */

const RESEND_SECONDS = 60;
const CODE_LENGTH = 6;
const DEMO_CODE = '123456';
const RATE_LIMIT_MSG = 'Wysłaliśmy już kilka wiadomości — odczekaj chwilę (limit wysyłki e-maili) i spróbuj ponownie.';
const LOGO_PATHS = '<path d="M3 6H17.5V22.5L12.5 28V12H3Z"/><path d="M20 6H29L20 12.5Z"/>';

export default async function render(ctx) {
  await ctx.ui.loadCss(new URL('./auth.css', import.meta.url));
  const mode = ctx.path === '#/signup' ? 'signup' : ctx.path === '#/reset' ? 'reset' : 'login';
  const { h } = ctx.ui;

  const formSlot = h('div', { class: 'auth-form-slot' });
  // swap(el, focusEl?) podmienia kartę w miejscu (ekran kodu ↔ formularz) bez zmiany trasy
  const swap = (el, focusEl) => {
    formSlot.replaceChildren(el);
    if (ctx.store.mode === 'demo') formSlot.appendChild(demoNote(ctx));
    const target = focusEl || el.querySelector('h1');
    if (target) {
      if (target.tagName === 'H1') target.setAttribute('tabindex', '-1');
      requestAnimationFrame(() => target.focus({ preventScroll: true }));
    }
  };
  const view = { ctx, swap };
  formSlot.appendChild(mode === 'signup' ? signupCard(view) : mode === 'reset' ? resetCard(view) : loginCard(view));
  if (ctx.store.mode === 'demo') formSlot.appendChild(demoNote(ctx));

  const page = h('div', { class: 'auth' },
    h('div', { class: 'auth-side' },
      logo(ctx),
      h('div', { class: 'auth-spacer', 'aria-hidden': 'true' }),
      formSlot,
      h('div', { class: 'auth-spacer', 'aria-hidden': 'true' }),
      h('p', { class: 'auth-copy' }, '© 2026 Tekma · ', h('a', { href: '../polityka-prywatnosci.html' }, 'Prywatność'), ' · ', h('a', { href: '../regulamin.html' }, 'Regulamin')),
    ),
    showcase(ctx),
  );
  return page;
}

export function logo(ctx, cls = 'logo') {
  const { h } = ctx.ui;
  const el = h('a', { class: cls, href: '../', 'aria-label': 'Tekma — strona główna' });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 32 32');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = LOGO_PATHS;
  el.append(svg, h('span', null, 'tekma'));
  return el;
}

function demoNote(ctx) {
  const { h, icon } = ctx.ui;
  return h('div', { class: 'demo-banner', role: 'note' }, icon('info'),
    h('span', null, h('b', null, 'Tryb demo: '), 'dane zostają tylko w tej przeglądarce. Konto demo zakładasz w kilka sekund.'));
}

/** Przycisk „Kontynuuj z Google” + separator „lub” (Figma). Logowanie Google nie jest jeszcze podłączone. */
function googleRow(ctx) {
  const { h, icon, toast } = ctx.ui;
  const g = h('button', { type: 'button', class: 'auth-google' }, icon('google'), h('span', null, 'Kontynuuj z Google'));
  g.addEventListener('click', () => toast('Logowanie przez Google pojawi się wkrótce. Użyj adresu e-mail i hasła.', 'neutral'));
  return [g, h('div', { class: 'auth-or', 'aria-hidden': 'true' }, h('i'), h('span', null, 'lub'), h('i'))];
}

/** Wspólny szkielet formularza z obsługą błędu i stanu ładowania. */
function form(ctx, { onSubmit, fields, submit, error, before = [], after = [] }) {
  const { h } = ctx.ui;
  const errorSlot = h('div');
  const f = h('form', { class: 'auth-f', novalidate: true, on: { submit: async (e) => {
    e.preventDefault();
    errorSlot.replaceChildren();
    for (const fl of fields) if (fl.setError) fl.setError('');
    submit.setBusy(true);
    try {
      await onSubmit();
    } catch (err) {
      const msg = (err && err.code === 'rate_limit') ? RATE_LIMIT_MSG : ((err && err.message) || 'Coś poszło nie tak. Spróbuj ponownie.');
      errorSlot.replaceChildren(ctx.ui.formError(msg));
    } finally {
      submit.setBusy(false);
    }
  } } }, errorSlot, before, fields, after, submit);
  if (error) errorSlot.replaceChildren(ctx.ui.formError(error));
  return f;
}

/* ------------------------------------------------ logowanie (Figma 22:1908) */
function loginCard({ ctx, swap }, { prefillEmail = '' } = {}) {
  const { h, field, button } = ctx.ui;
  const email = field({ label: 'E-mail służbowy', name: 'email', type: 'email', autocomplete: 'email', required: true, placeholder: 'anna@nordlight.io', value: prefillEmail });
  const password = field({ label: 'Hasło', name: 'password', type: 'password', autocomplete: 'current-password', required: true, placeholder: '••••••••••' });
  const submit = button({ label: 'Zaloguj się', variant: 'primary', type: 'submit', block: true });
  const f = form(ctx, {
    fields: [email, password], submit, before: googleRow(ctx),
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
  const card = h('div', { class: 'auth-card' },
    h('h1', null, 'Witaj ponownie'),
    h('p', { class: 'lead' }, 'Zaloguj się do Tekmy.'),
    f,
    h('p', { class: 'auth-foot' }, 'Nie masz konta? ', h('a', { href: '#/signup' }, 'Załóż je za darmo')),
    h('p', { class: 'auth-foot' }, h('a', { href: '#/reset' }, 'Nie pamiętasz hasła?')),
  );
  queueFocus(prefillEmail ? password.input : email.input);
  return card;
}

/* ------------------------------------------------ rejestracja (Figma 22:1686) */
function signupCard({ ctx, swap }, { prefill = {} } = {}) {
  const { h, field, button } = ctx.ui;
  const name = field({ label: 'Imię i nazwisko', name: 'name', type: 'text', autocomplete: 'name', required: true, placeholder: 'Anna Kowalczyk', value: prefill.name || '' });
  const email = field({ label: 'E-mail służbowy', name: 'email', type: 'email', autocomplete: 'email', required: true, placeholder: 'anna@nordlight.io', value: prefill.email || '' });
  const password = field({ label: 'Hasło', name: 'password', type: 'password', autocomplete: 'new-password', required: true, placeholder: '••••••••••', hint: 'Co najmniej 10 znaków. Najlepiej zdanie, które łatwo zapamiętać.' });
  const consentInput = h('input', { type: 'checkbox', name: 'consent', id: 'consent', checked: Boolean(prefill.consent) });
  const consentErr = h('div', { class: 'error', role: 'alert' });
  const consent = h('div', { class: 'field auth-consent' },
    h('label', { class: 'check', htmlFor: 'consent' }, consentInput, h('span', null, 'Akceptuję ', h('a', { href: '../regulamin.html', target: '_blank', rel: 'noopener' }, 'regulamin'), ' i ', h('a', { href: '../polityka-prywatnosci.html', target: '_blank', rel: 'noopener' }, 'politykę prywatności'), '. Dane przechowujemy w UE.')),
    consentErr,
  );
  consent.setError = (m) => { consentErr.textContent = m || ''; consent.classList.toggle('has-error', Boolean(m)); };
  consentInput.addEventListener('change', () => consent.setError(''));
  const submit = button({ label: 'Utwórz konto', variant: 'primary', type: 'submit', block: true });
  const card = h('div', { class: 'auth-card' });

  const f = form(ctx, {
    fields: [name, email, password, consent], submit, before: googleRow(ctx),
    onSubmit: async () => {
      let bad = false;
      if (!name.value.trim()) { name.setError('Podaj imię i nazwisko.'); bad = true; }
      if (!email.value.trim()) { email.setError('Podaj adres e-mail.'); bad = true; }
      if (password.value.length < 10) { password.setError('Hasło musi mieć co najmniej 10 znaków.'); bad = true; }
      if (!consentInput.checked) { consent.setError('Zaakceptuj regulamin, żeby założyć konto.'); bad = true; }
      if (bad) { const first = [name, email, password].find((x) => x.classList.contains('has-error')); (first ? first.input : consentInput).focus(); return; }
      const res = await ctx.store.auth.signUp({ name: name.value, email: email.value, password: password.value });
      if (res.needsConfirmation) {
        showCodeScreen({ ctx, swap }, {
          email: email.value.trim().toLowerCase(), reason: 'signup', back: 'signup',
          prefill: { name: name.value.trim(), email: email.value.trim(), consent: true },
        });
        return;
      }
      ctx.navigate('#/onboarding?krok=1');
    },
  });
  card.append(
    h('h1', null, 'Załóż konto'),
    h('p', { class: 'lead' }, 'Pierwsze stanowisko skonfigurujesz w 5 minut. Bez karty.'),
    f,
    h('p', { class: 'auth-foot' }, 'Masz już konto? ', h('a', { href: '#/login' }, 'Zaloguj się')),
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
      setError((err && err.code === 'rate_limit') ? RATE_LIMIT_MSG : ((err && err.message) || 'Nie udało się potwierdzić kodu. Spróbuj ponownie.'));
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
      // limit wysyłki (ok. 60 s między e-mailami) → komunikat z Figmy + blokada przycisku na czas odliczania
      if (err && err.code === 'rate_limit') {
        setError(RATE_LIMIT_MSG);
        const sec = /po ok\. (\d+) s/.exec(err.message || '');
        startCountdown(sec ? Number(sec[1]) : RESEND_SECONDS);
      } else {
        setError((err && err.message) || 'Nie udało się wysłać kodu. Spróbuj ponownie.');
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

  const card = h('div', { class: 'auth-card code-card' },
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
  const email = field({ label: 'E-mail służbowy', name: 'email', type: 'email', autocomplete: 'email', required: true, placeholder: 'anna@nordlight.io' });
  const submit = button({ label: 'Wyślij link', variant: 'primary', type: 'submit', block: true });
  const card = h('div', { class: 'auth-card' });
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
    h('p', { class: 'auth-foot' }, h('a', { href: '#/login' }, 'Wróć do logowania')),
  );
  queueFocus(email.input);
  return card;
}

function queueFocus(el) {
  // router po wstawieniu widoku ustawia fokus na [autofocus] (desktop) albo na h1
  el.setAttribute('autofocus', '');
}

/* ------------------------------------------------ Showcase (prawa kolumna z Figmy): podgląd karty oceny w skali 0,62 */
function showcase(ctx) {
  const { h, icon } = ctx.ui;
  const badge = (text, tone = 'neutral') => h('span', { class: `tag ${tone}` }, text);
  const scoreRow = (sel, ai) => h('div', { class: 'sc-score' },
    [1, 2, 3, 4, 5].map((n) => h('span', { class: `sc-n${n === sel ? ' on' : ''}` }, String(n))),
    h('span', { class: 'sp' }),
    h('span', { class: 'ai-note' }, icon('spark', 12), `AI sugeruje ${ai}`),
  );
  const question = (text, comp, weight, raters, sel, ai, flag) => h('div', { class: 'sc-q' },
    h('b', null, text),
    h('div', { class: 'sc-meta' }, badge(comp), h('small', null, `Waga ×${weight}`), flag ? badge(flag, 'warn') : null, h('span', { class: 'sp' }), h('small', null, raters)),
    scoreRow(sel, ai),
  );
  const line = (time, who, text, hi) => h('div', { class: 'sc-line' },
    h('span', { class: 'sc-time' }, time),
    h('div', { class: `sc-txt${hi ? ' hi' : ''}` }, h('b', null, who), h('p', null, text)),
  );
  const match = (ok, text) => h('div', { class: 'sc-match' }, icon(ok ? 'check' : 'flag', 16), h('span', null, text));
  const mock = h('div', { class: 'sc-mock', 'aria-hidden': 'true' },
    h('div', { class: 'sc-cols' },
      h('div', { class: 'panel sc-card' },
        h('div', { class: 'panel-h' }, h('b', null, 'Karta oceny · Rozmowa techniczna'), h('span', { class: 'r' }, 'Rubryka v3 · 4 pytania')),
        question('Opowiedz o swoim największym wyzwaniu ze skalowaniem systemu.', 'Projektowanie systemów', 3, 'Anna 4 · Tomasz 4', 4, 4),
        question('Jak debugujesz problem, którego nie da się odtworzyć lokalnie?', 'Rozwiązywanie problemów', 2, 'Anna 5 · Tomasz 4', 5, 5),
        question('Opisz decyzję techniczną, która budziła Twój sprzeciw.', 'Współpraca', 2, 'Anna 2 · Tomasz 5', 3, 3, '⚑ Rozbieżność 3 pkt'),
        question('Jak dbasz o jakość kodu w małym zespole?', 'Jakość', 1, 'Anna 4 · Tomasz 4', 4, 4),
        h('div', { class: 'sc-result' },
          h('div', null, h('small', null, 'Wynik etapu (ważony)'), h('b', null, '4,1 / 5')),
          h('div', { class: 'sc-rec' }, h('small', null, 'Rekomendacja'), badge('Tak (2 z 2 rozmówców)', 'good')),
        ),
      ),
      h('div', { class: 'sc-side' },
        h('div', { class: 'panel' },
          h('div', { class: 'panel-h' }, h('b', null, 'Dopasowanie CV'), h('span', { class: 'r' }, 'Dlaczego taki wynik?')),
          h('div', { class: 'sc-cv' },
            h('div', { class: 'sc-ring' }, h('b', null, '86')),
            h('div', { class: 'sc-matches' },
              match(true, '6 lat z Go i PostgreSQL'), match(true, 'Skalowała kolejki zadań do 2 mln/dzień'), match(true, 'Mentoring juniorów'),
              match(false, 'Brak doświadczenia z Kafką'), match(false, 'Krótko w ostatniej firmie (8 mies.)'),
            ),
          ),
        ),
        h('div', { class: 'panel' },
          h('div', { class: 'panel-h' }, h('b', null, 'Nagranie i transkrypcja'), h('span', { class: 'r' }, '48:12')),
          h('div', { class: 'sc-lines' },
            line('12:04', 'Tomasz', 'Co pękło jako pierwsze, gdy ruch się podwoił?'),
            line('12:11', 'Marta', 'Kolejka w monolicie. Przenieśliśmy ją na partycjonowane tabele — p95 spadło z 4 s do 0,4 s.', true),
            line('12:48', 'Tomasz', 'Która część tej decyzji była Twoja?'),
          ),
        ),
        h('div', { class: 'sc-note' }, icon('shield', 16), h('span', null, 'Sugestie AI są pomocnicze i zawsze mają uzasadnienie. Decyzję podejmuje człowiek (AI Act, zał. III).')),
      ),
    ),
  );
  return h('aside', { class: 'auth-show', 'aria-label': 'Co daje Tekma' },
    h('h2', null, 'Zatrudniaj na podstawie tego, co kandydat naprawdę powiedział.'),
    h('p', null, 'Rubryki, notetaker AI i karty ocen w jednym miejscu. Po ofercie — plan pierwszych 90 dni.'),
    h('div', { class: 'auth-preview' }, mock),
  );
}
