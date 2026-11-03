/**
 * views/onboarding.js — pierwsze kroki po rejestracji.
 *   Krok 1: nazwa firmy → store.org.create({name})
 *   Krok 2: „Zacznij od przykładowych danych” (store.org.loadDemoData) albo „Zacznij od pustego konta” → #/
 * Jeśli firma już istnieje (np. odświeżenie po kroku 1), od razu pokazuje krok 2.
 * export default async function render(ctx) -> HTMLElement
 */

export default async function render(ctx) {
  const { h } = ctx.ui;
  const wrap = h('div', { class: 'bare-content' });
  const card = h('div', { class: 'bare-card' });
  wrap.appendChild(card);
  const existing = ctx.org || (await ctx.store.org.current());
  if (existing) stepTwo(ctx, card, existing); else stepOne(ctx, card);
  if (ctx.store.mode === 'demo') {
    wrap.appendChild(h('div', { class: 'demo-banner', role: 'note' }, ctx.ui.icon('info'),
      h('span', null, h('b', null, 'Tryb demo: '), 'dane zostają tylko w tej przeglądarce.')));
  }
  return wrap;
}

function steps(ctx, n) {
  const { h } = ctx.ui;
  return h('div', { class: 'bare-steps', role: 'img', 'aria-label': `Krok ${n} z 2` }, h('i', { class: n >= 1 ? 'on' : '' }), h('i', { class: n >= 2 ? 'on' : '' }));
}

function stepOne(ctx, card) {
  const { h, field, button, formError } = ctx.ui;
  const name = field({ label: 'Nazwa firmy', name: 'org', type: 'text', required: true, placeholder: 'np. Nordlight Labs', autocomplete: 'organization', hint: 'Zobaczy ją Twój zespół. Zmienisz ją później w ustawieniach.' });
  const submit = button({ label: 'Utwórz firmę', variant: 'primary', type: 'submit', block: true });
  const errorSlot = h('div');
  const form = h('form', { novalidate: true, on: { submit: async (e) => {
    e.preventDefault();
    errorSlot.replaceChildren(); name.setError('');
    if (name.value.trim().length < 2) { name.setError('Podaj nazwę firmy (co najmniej 2 znaki).'); name.input.focus(); return; }
    submit.setBusy(true);
    try {
      const org = await ctx.store.org.create({ name: name.value });
      ctx.ui.toast(`Firma „${org.name}” gotowa.`, 'good');
      stepTwo(ctx, card, org);
    } catch (err) {
      errorSlot.replaceChildren(formError(err.message || 'Nie udało się utworzyć firmy.'));
    } finally { submit.setBusy(false); }
  } } }, errorSlot, name, submit);
  card.replaceChildren(
    steps(ctx, 1),
    h('h1', null, `Witaj${ctx.user && ctx.user.name ? `, ${ctx.user.name.split(' ')[0]}` : ''}`),
    h('p', { class: 'lead' }, 'Zacznijmy od Twojej firmy. To do niej należą stanowiska, kandydaci i rubryki.'),
    form,
  );
  name.input.setAttribute('autofocus', '');
  if (name.input.isConnected && window.innerWidth >= 900) name.input.focus({ preventScroll: true });
}

function stepTwo(ctx, card, org) {
  const { h, button, icon, formError } = ctx.ui;
  const errorSlot = h('div');
  const demoBtn = button({ label: 'Zacznij od przykładowych danych', variant: 'primary', block: true, icon: 'spark' });
  const emptyBtn = button({ label: 'Zacznij od pustego konta', variant: 'secondary', block: true });
  const busy = (on) => { demoBtn.setBusy(on); emptyBtn.disabled = on; };
  demoBtn.addEventListener('click', async () => {
    errorSlot.replaceChildren(); busy(true);
    try {
      const res = await ctx.store.org.loadDemoData();
      await ctx.refreshShell();
      ctx.ui.toast(res.skipped ? 'Firma ma już dane — pomijamy przykładowe.' : 'Dodaliśmy przykładowe stanowiska, kandydatów i rubryki.', 'good');
      ctx.navigate('#/');
    } catch (err) {
      errorSlot.replaceChildren(formError(err.message || 'Nie udało się wczytać przykładowych danych.'));
      busy(false);
    }
  });
  emptyBtn.addEventListener('click', async () => {
    await ctx.refreshShell();
    ctx.navigate('#/');
  });
  card.replaceChildren(
    steps(ctx, 2),
    h('h1', null, 'Jak chcesz zacząć?'),
    h('p', { class: 'lead' }, `Firma „${org.name}” jest gotowa. Możesz od razu zobaczyć Tekmę w akcji na przykładowych danych.`),
    errorSlot,
    h('div', { class: 'stack' },
      h('div', { class: 'card strong', style: 'display:flex;gap:14px;align-items:flex-start' },
        h('span', { class: 'av dark', 'aria-hidden': 'true' }, icon('spark', 16)),
        h('div', null,
          h('h3', { style: 'margin-bottom:4px' }, 'Przykładowe dane'),
          h('p', { class: 'muted small' }, '4 stanowiska, 13 kandydatów na różnych etapach, rubryka z kotwicami ocen i kilka kart oceny — w tym jedna z rozbieżnością, którą warto obejrzeć.'),
        ),
      ),
      demoBtn,
      emptyBtn,
    ),
    h('p', { class: 'bare-foot' }, 'Przykładowe dane możesz później usunąć. Nic nie wysyłamy do kandydatów.'),
  );
  const h1 = card.querySelector('h1'); h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true });
}
