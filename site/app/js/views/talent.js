/**
 * views/talent.js — moduł „Baza talentów”: kandydaci spoza aktywnych procesów, każdy ze zgodą RODO.
 *   #/talent   lista z wyszukiwarką i filtrem zgody, baner o wygasających zgodach,
 *              dodawanie osoby, import z odrzuconych kandydatów, prośba o zgodę, usuwanie wygasłych.
 * Dane: store.talent (migracja 1.9). Zgoda: granted (ważna 12 mies.) | pending | none; stan liczy talentConsent().
 * Zapis: owner i recruiter; rozmówca tylko czyta.
 */
import { setHeader } from './positions.js';
import { talentConsent } from '../store.js';

const FILTERS = [['all', 'Wszyscy'], ['ok', 'Ważna zgoda'], ['soon', 'Wygasa'], ['none', 'Bez zgody']];
const canWrite = (ctx) => ctx.org && (ctx.org.role === 'owner' || ctx.org.role === 'recruiter');
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');

function consentTag(ctx, row) {
  const { tag, formatDate } = ctx.ui;
  const c = talentConsent(row);
  if (c.state === 'granted') return tag(`do ${formatDate(row.consent_until)}`, 'good');
  if (c.state === 'expiring') return tag(c.days === 0 ? 'wygasa dziś' : `wygasa za ${ctx.ui.plural(c.days, 'dzień', 'dni', 'dni')}`, 'warn');
  if (c.state === 'expired') return tag('zgoda wygasła', 'bad');
  if (c.state === 'pending') return tag('czeka na odpowiedź', 'blue');
  return tag('brak zgody', 'bad');
}

export default async function render(ctx) {
  const { h, button, tag, avatar, emptyState, icon, toast, confirm, plural, formatDate } = ctx.ui;
  await ctx.ui.loadCss(new URL('./talent.css', import.meta.url));
  const write = canWrite(ctx);
  const add = button({ label: 'Dodaj osobę', variant: 'primary', icon: 'plus', disabled: !write, onClick: () => openTalent(ctx, { onSaved: load }) });
  const imp = button({ label: 'Z odrzuconych', variant: 'secondary', icon: 'users', disabled: !write, onClick: () => openImport(ctx, { onSaved: load }) });
  setHeader(ctx, { title: 'Baza talentów', actions: write ? [imp, add] : [], width: 'wide' });
  const root = h('div', { class: 'tp' });
  let rows = [], filter = 'all', q = '';

  async function load() {
    root.replaceChildren(h('div', { class: 'tp-skel', 'aria-busy': 'true', 'aria-label': 'Ładowanie' }, h('i'), h('i'), h('i')));
    try { rows = await ctx.store.talent.list(); paint(); }
    catch (err) {
      console.error('[talent]', err);
      const noTable = err && err.code === 'no_table';
      root.replaceChildren(h('div', { class: 'state', role: 'alert' },
        h('div', { class: 'glyph' }, icon(noTable ? 'construction' : 'alert', 20)),
        h('h2', null, noTable ? 'Ten moduł czeka na migrację bazy' : 'Nie udało się wczytać bazy talentów'),
        h('p', null, noTable ? 'Uruchom migrację 1.9 (talent_pool) w Supabase, a baza talentów zacznie działać.' : (err.message || 'Spróbuj ponownie.')),
        noTable ? null : h('div', { class: 'actions' }, button({ label: 'Spróbuj ponownie', variant: 'primary', onClick: load }))));
    }
  }

  const act = async (fn, okMsg) => { try { await fn(); if (okMsg) toast(okMsg, 'good'); await load(); } catch (err) { toast(err.message || 'Nie udało się wykonać akcji.', 'bad'); } };

  function paint() {
    if (!rows.length) {
      root.replaceChildren(emptyState({
        icon: 'users', title: 'Baza talentów jest pusta',
        text: 'Zapisuj tu osoby, do których chcesz wrócić przy kolejnej rekrutacji. Każda musi wyrazić zgodę na przechowywanie danych.',
        action: write ? { label: 'Dodaj osobę', icon: 'plus', onClick: () => add.click() } : null,
      }));
      return;
    }
    const cs = rows.map((r) => [r, talentConsent(r)]);
    const soon = cs.filter(([, c]) => c.state === 'expiring' || c.state === 'expired').length;
    const dead = cs.filter(([r, c]) => c.state === 'expired' || r.consent_status === 'none').length;
    const match = ([r, c]) => {
      if (filter === 'ok' && c.state !== 'granted') return false;
      if (filter === 'soon' && c.state !== 'expiring' && c.state !== 'expired') return false;
      if (filter === 'none' && !(c.state === 'none' || c.state === 'pending')) return false;
      if (!q) return true;
      return norm([r.full_name, r.role_title, r.location, (r.tags || []).join(' '), r.source].join(' ')).includes(norm(q));
    };
    const shown = cs.filter(match);
    const parts = [];
    if (soon) {
      parts.push(h('div', { class: 'tp-banner', role: 'status' },
        icon('alert', 18),
        h('p', null, `${plural(soon, 'zgoda wygasa', 'zgody wygasają', 'zgód wygasa')} w ciągu 14 dni albo już wygasło. Po terminie dane trzeba usunąć.`),
        write ? button({ label: 'Pokaż', variant: 'secondary', size: 'sm', onClick: () => { filter = 'soon'; paint(); } }) : null));
    }
    const seg = h('div', { class: 'segment', role: 'group', 'aria-label': 'Filtr zgody' }, FILTERS.map(([k, l]) =>
      h('button', { type: 'button', 'aria-pressed': String(filter === k), on: { click: () => { filter = k; paint(); } } }, l)));
    const search = h('input', { type: 'search', class: 'tp-q', placeholder: 'Szukaj po imieniu, roli lub tagu…', 'aria-label': 'Szukaj w bazie talentów', value: q });
    search.addEventListener('input', () => { q = search.value; const pos = search.selectionStart; paint(); const el = root.querySelector('.tp-q'); if (el) { el.focus(); el.setSelectionRange(pos, pos); } });
    parts.push(h('div', { class: 'tp-bar' }, search, seg,
      h('span', { class: 'muted tp-count' }, `${plural(shown.length, 'osoba', 'osoby', 'osób')}`),
      write && dead ? button({ label: `Usuń bez zgody (${dead})`, variant: 'ghost', size: 'sm', icon: 'trash', onClick: async () => {
        if (!(await confirm({ title: 'Usunąć osoby bez ważnej zgody?', text: `Usuniemy ${plural(dead, 'wpis', 'wpisy', 'wpisów')} z wygasłą zgodą lub bez zgody. Tej operacji nie można cofnąć.`, confirmLabel: 'Usuń', danger: true }))) return;
        act(async () => { await ctx.store.talent.purgeExpired(); }, 'Usunięto wpisy bez ważnej zgody.');
      } }) : null));
    if (!shown.length) {
      parts.push(h('p', { class: 'muted tp-none' }, 'Nikt nie pasuje do tych filtrów.'));
    } else {
      parts.push(h('div', { class: 'card tp-card' }, h('ul', { class: 'tp-list' }, shown.map(([r, c]) => {
        const needs = write && (c.state === 'expiring' || c.state === 'expired' || c.state === 'none');
        return h('li', { class: 'tp-row' },
          h('div', { class: 'tp-who' }, avatar(r.full_name),
            h('div', { class: 'tp-name' }, h('b', null, r.full_name), h('small', { class: 'muted' }, [r.location, r.email].filter(Boolean).join(' · ') || 'Brak danych kontaktowych'))),
          h('div', { class: 'tp-role' }, r.role_title || h('span', { class: 'muted' }, '—')),
          h('div', { class: 'tp-tags' }, (r.tags || []).slice(0, 3).map((t) => tag(t, 'neutral'))),
          h('div', { class: 'tp-consent' }, consentTag(ctx, r)),
          h('div', { class: 'tp-last muted' }, r.last_contact ? formatDate(r.last_contact, { relative: true }) : '—'),
          h('div', { class: 'tp-act' },
            write && c.state === 'pending' ? button({ label: 'Zgoda udzielona', size: 'sm', variant: 'secondary', onClick: () => act(() => ctx.store.talent.grantConsent(r.id), 'Zapisano zgodę na 12 miesięcy.') }) : null,
            needs ? button({ label: 'Poproś o zgodę', size: 'sm', variant: 'secondary', icon: 'mail', onClick: () => act(() => ctx.store.talent.requestConsent(r.id), 'Zaznaczono prośbę o zgodę. Wyślij wiadomość do kandydata.') }) : null,
            write ? h('button', { type: 'button', class: 'tp-edit', 'aria-label': `Edytuj: ${r.full_name}`, title: 'Edytuj', on: { click: () => openTalent(ctx, { row: r, onSaved: load }) } }, icon('edit', 16)) : null));
      }))));
    }
    root.replaceChildren(...parts);
  }
  await load();
  return root;
}

export function openTalent(ctx, { row = null, onSaved } = {}) {
  const { h, field, button, modal, formError, toast, confirm } = ctx.ui;
  const name = field({ label: 'Imię i nazwisko', name: 'full_name', required: true, value: row ? row.full_name : '', autocomplete: 'off' });
  const email = field({ label: 'E-mail', name: 'email', type: 'email', value: row ? row.email : '', autocomplete: 'off', hint: 'Potrzebny, żeby poprosić o zgodę.' });
  const role = field({ label: 'Rola', name: 'role_title', value: row ? row.role_title : '', placeholder: 'np. Senior Backend Engineer' });
  const loc = field({ label: 'Lokalizacja', name: 'location', value: row ? row.location : '', placeholder: 'np. Warszawa · zdalnie' });
  const tags = field({ label: 'Tagi', name: 'tags', value: row ? (row.tags || []).join(', ') : '', placeholder: 'Go, Kafka, Lead', hint: 'Oddziel przecinkami. Maksymalnie 12.' });
  const note = field({ label: 'Notatka', name: 'note', type: 'textarea', rows: 3, value: row ? row.note : '' });
  const consent = h('input', { type: 'checkbox', id: 'tp-consent', name: 'consent' });
  const consentRow = row ? null : h('label', { class: 'tp-check', for: 'tp-consent' }, consent, h('span', null, 'Osoba wyraziła zgodę na przechowywanie danych przez 12 miesięcy. ', h('small', { class: 'muted' }, 'Bez zaznaczenia wpis czeka na odpowiedź.')));
  const errorSlot = h('div');
  const submit = button({ label: row ? 'Zapisz' : 'Dodaj do bazy', variant: 'primary', type: 'submit' });
  submit.setAttribute('form', 'tp-form');
  const cancel = button({ label: 'Anuluj', variant: 'secondary' });
  const del = row ? button({ label: 'Usuń', variant: 'ghost', icon: 'trash', onClick: async () => {
    if (!(await confirm({ title: 'Usunąć z bazy talentów?', text: `Dane osoby „${row.full_name}” zostaną trwale usunięte.`, confirmLabel: 'Usuń', danger: true }))) return;
    try { await ctx.store.talent.remove(row.id); m.close(); toast('Usunięto z bazy talentów.', 'good'); if (onSaved) onSaved(); } catch (err) { toast(err.message || 'Nie udało się usunąć.', 'bad'); }
  } }) : null;
  const form = h('form', { id: 'tp-form', novalidate: true }, errorSlot, name, h('div', { class: 'form-row' }, email, role), h('div', { class: 'form-row' }, loc, tags), note, consentRow);
  const m = modal({ title: row ? 'Edytuj osobę' : 'Nowa osoba w bazie talentów', body: form, actions: [del, cancel, submit].filter(Boolean) });
  cancel.addEventListener('click', () => m.close());
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); errorSlot.replaceChildren(); name.setError('');
    if (name.value.trim().length < 2) { name.setError('Wpisz imię i nazwisko.'); name.input.focus(); return; }
    submit.setBusy(true);
    try {
      const data = { full_name: name.value, email: email.value, role_title: role.value, location: loc.value, tags: tags.value, note: note.value };
      if (row) await ctx.store.talent.update(row.id, data); else await ctx.store.talent.create({ ...data, consent_status: consent.checked ? 'granted' : 'pending' });
      m.close(); ctx.ui.toast(row ? 'Zapisano zmiany.' : 'Dodano do bazy talentów.', 'good'); if (onSaved) onSaved();
    } catch (err) { errorSlot.replaceChildren(formError(err.message || 'Nie udało się zapisać.')); } finally { submit.setBusy(false); }
  });
}

/** Okno: odrzuceni kandydaci, których można zaprosić do bazy (wpis startuje jako „czeka na odpowiedź”). */
export function openImport(ctx, { onSaved } = {}) {
  const { h, button, modal, toast, avatar, plural } = ctx.ui;
  const body = h('div', { class: 'tp-imp' }, h('p', { class: 'muted' }, 'Ładowanie…'));
  const cancel = button({ label: 'Zamknij', variant: 'secondary' });
  const m = modal({ title: 'Dodaj z odrzuconych kandydatów', body, actions: [cancel] });
  cancel.addEventListener('click', () => m.close());
  ctx.store.talent.rejectedCandidates().then((list) => {
    if (!list.length) { body.replaceChildren(h('p', { class: 'muted' }, 'Wszyscy odrzuceni kandydaci są już w bazie albo nikogo jeszcze nie odrzucono.')); return; }
    const sel = new Set(list.map((c) => c.id));
    const items = list.map((c) => {
      const cb = h('input', { type: 'checkbox', checked: true, 'aria-label': c.full_name });
      cb.addEventListener('change', () => { cb.checked ? sel.add(c.id) : sel.delete(c.id); go.disabled = !sel.size; });
      return h('label', { class: 'tp-imp-row' }, cb, avatar(c.full_name), h('span', { class: 'tp-imp-n' }, h('b', null, c.full_name), h('small', { class: 'muted' }, c.position_title || 'Bez stanowiska')));
    });
    const go = button({ label: `Dodaj do bazy`, variant: 'primary', onClick: async () => {
      go.setBusy(true);
      try {
        let n = 0;
        for (const c of list) if (sel.has(c.id)) { await ctx.store.talent.addFromCandidate(c); n++; }
        m.close(); toast(`Dodano ${plural(n, 'osobę', 'osoby', 'osób')}. Poproś je o zgodę.`, 'good'); if (onSaved) onSaved();
      } catch (err) { toast(err.message || 'Nie udało się dodać.', 'bad'); go.setBusy(false); }
    } });
    body.replaceChildren(h('p', { class: 'muted' }, 'Wpisy dostaną status „czeka na odpowiedź”. Żeby trzymać dane dłużej, potrzebujesz zgody kandydata.'), h('div', { class: 'tp-imp-list' }, items));
    cancel.before(go);
  }).catch((err) => body.replaceChildren(h('p', { class: 'muted' }, err.message || 'Nie udało się wczytać kandydatów.')));
}
