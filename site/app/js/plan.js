/** plan.js — domyślny plan pierwszych 90 dni (fazy 30/60/90). due_day = dzień od startu. */
export const PHASES = [
  { phase: 30, label: 'Pierwsze 30 dni', goal: 'Poznaj ludzi, narzędzia i zasady' },
  { phase: 60, label: 'Dni 31–60', goal: 'Prowadź pierwsze zadania samodzielnie' },
  { phase: 90, label: 'Dni 61–90', goal: 'Przejmij odpowiedzialność za swój obszar' },
];

export const DEFAULT_PLAN = [
  [30, 1, 'Dostęp do poczty, komunikatora i narzędzi zespołu'],
  [30, 1, 'Spotkanie powitalne z przełożonym'],
  [30, 5, 'Przedstaw się zespołowi i poznaj kluczowe osoby'],
  [30, 10, 'Przeczytaj dokumentację i zasady pracy w zespole'],
  [30, 20, 'Pierwsze małe zadanie dowiezione od początku do końca'],
  [30, 30, 'Rozmowa podsumowująca pierwszy miesiąc'],
  [60, 40, 'Ustal z przełożonym cele na kolejne 60 dni'],
  [60, 45, 'Poprowadź samodzielnie jedno zadanie lub projekt'],
  [60, 55, 'Zbierz opinię od współpracowników'],
  [60, 60, 'Rozmowa podsumowująca drugi miesiąc'],
  [90, 75, 'Zaproponuj usprawnienie w swoim obszarze'],
  [90, 85, 'Podsumuj swoje osiągnięcia i plan na kolejny kwartał'],
  [90, 90, 'Rozmowa kończąca okres wdrożenia'],
];

export function planTasks() {
  return DEFAULT_PLAN.map(([phase, due_day, title], i) => ({ phase, due_day, title, done: false, done_at: null, position: i }));
}

/** Dzień wdrożenia (1 = pierwszy dzień pracy); <1 gdy jeszcze przed startem. */
export function dayOf(startDate, today = new Date()) {
  const s = new Date(`${startDate}T00:00:00`);
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.floor((t - s) / 86400000) + 1;
}
