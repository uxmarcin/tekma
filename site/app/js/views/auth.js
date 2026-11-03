/**
 * views/auth.js — logowanie (#/login), rejestracja (#/signup), reset hasła (#/reset).
 * Tryb wybiera ctx.path. Stany: ładowanie (przycisk busy), błąd (nad formularzem), „sprawdź skrzynkę”
 * po rejestracji z needsConfirmation i po wysłaniu linku resetu.
 * export default async function render(ctx) -> HTMLElement
 */

export default async function render(ctx) {
  const mode = ctx.path === '#/signup' ? 'signup' : ctx.path === '#/reset' ? 'reset' : 'login';
  const { h } = ctx.ui;
  const wrap = h('div', { style: 'width:100%;display:flex;flex-direction:column;align-items:center' });
  wrap.appendChild(mode === 'signup' ? signupCard(ctx) : mode === 'reset' ? resetCard(ctx) : loginCard(ctx));
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
      // błąd dotyczący konkretnego pola pokazujemy przy polu
      const target = fields.find((fl) => fl.input.name && msg.toLowerCase().includes(fieldKeyword(fl.input.name)));
      if (target) { target.setError(msg); target.input.focus(); }
      else { errorSlot.replaceChildren(ctx.ui.formError(msg)); }
    } finally {
      submit.setBusy(false);
    }
  } } }, errorSlot, fields, submit);
  if (error) errorSlot.replaceChildren(ctx.ui.formError(error));
  return f;
}
function fieldKeyword(name) {
  return { email: 'e-mail', password: 'hasło', name: 'imię' }[name] || '\u0000';
}

/* ------------------------------------------------ logowanie */
function loginCard(ctx) {
  const { h, field, button } = ctx.ui;
  const email = field({ label: 'E-mail', name: 'email', type: 'email', autocomplete: 'email', required: true, placeholder: 'anna@firma.pl' });
  const password = field({ label: 'Hasło', name: 'password', type: 'password', autocomplete: 'current-password', required: true });
  const submit = button({ label: 'Zaloguj się', variant: 'primary', type: 'submit', block: true });
  const f = form(ctx, {
    fields: [email, password], submit,
    onSubmit: async () => {
      if (!email.value.trim()) { email.setError('Podaj adres e-mail.'); email.input.focus(); return; }
      if (!password.value) { password.setError('Podaj hasło.'); password.input.focus(); return; }
      await ctx.store.auth.signIn({ email: email.value, password: password.value });
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
  queueFocus(email.input);
  return card;
}

/* ------------------------------------------------ rejestracja */
function signupCard(ctx) {
  const { h, field, button } = ctx.ui;
  const name = field({ label: 'Imię i nazwisko', name: 'name', type: 'text', autocomplete: 'name', required: true, placeholder: 'Anna Nowak' });
  const email = field({ label: 'Służbowy e-mail', name: 'email', type: 'email', autocomplete: 'email', required: true, placeholder: 'anna@firma.pl' });
  const password = field({ label: 'Hasło', name: 'password', type: 'password', autocomplete: 'new-password', required: true, hint: 'Co najmniej 8 znaków. Najlepiej zdanie, które łatwo zapamiętać.' });
  const submit = button({ label: 'Załóż konto', variant: 'primary', type: 'submit', block: true });
  const card = h('div', { class: 'bare-card' });

  const f = form(ctx, {
    fields: [name, email, password], submit,
    onSubmit: async () => {
      let bad = false;
      if (!name.value.trim()) { name.setError('Podaj imię i nazwisko.'); bad = true; }
      if (!email.value.trim()) { email.setError('Podaj adres e-mail.'); bad = true; }
      if (password.value.length < 8) { password.setError('Hasło musi mieć co najmniej 8 znaków.'); bad = true; }
      if (bad) { [name, email, password].find((x) => x.classList.contains('has-error')).input.focus(); return; }
      const res = await ctx.store.auth.signUp({ name: name.value, email: email.value, password: password.value });
      if (res.needsConfirmation) {
        card.replaceChildren(
          h('h1', null, 'Sprawdź skrzynkę'),
          h('p', { class: 'lead' }, `Wysłaliśmy link potwierdzający na ${email.value.trim()}. Kliknij go, a potem zaloguj się.`),
          ctx.ui.formSuccess('Sprawdź skrzynkę: wysłaliśmy link potwierdzający.'),
          button({ label: 'Przejdź do logowania', variant: 'primary', block: true, onClick: () => ctx.navigate('#/login') }),
          h('div', { class: 'bare-foot' }, 'Nie widzisz wiadomości? Sprawdź spam albo odczekaj minutę.'),
        );
        const h1 = card.querySelector('h1'); h1.setAttribute('tabindex', '-1'); h1.focus();
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
  queueFocus(name.input);
  return card;
}

/* ------------------------------------------------ reset hasła */
function resetCard(ctx) {
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
  // po wstawieniu do DOM router ustawia fokus na h1; dla formularzy wygodniej na pierwszym polu
  setTimeout(() => { if (el.isConnected && window.innerWidth >= 900) el.focus({ preventScroll: true }); }, 30);
}
