/**
 * ui.js — komponenty bazowe Tekmy (bez zależności).
 *
 * API (stabilne, wg kontraktu):
 *   h(tag, attrs, ...children)       -> HTMLElement
 *       attrs: class | className, id, on:{click,…} lub onClick/onInput…, aria-*, data-*, dataset:{},
 *              style (string|obiekt), html (innerHTML — tylko dla zaufanych treści), pozostałe = atrybuty
 *       children: string | Node | Array | null/false (pomijane)
 *   icon(name, size=16)              -> SVGElement (obrys 24×24, stroke 1.6, round)
 *   button({label, variant, size, icon, onClick, disabled, type, block, title, attrs}) -> HTMLButtonElement
 *       + el.setBusy(bool) — stan ładowania
 *   field({label, name, type, value, error, hint, required, autocomplete, placeholder, options, rows, min, max, step})
 *       -> HTMLElement .field; el.input, el.setError(msg), el.value
 *   avatar(name, size?)              -> span.av z inicjałami
 *   tag(text, tone)                  -> span.tag   (tone: neutral|good|warn|bad|info|blue)
 *   toast(message, tone)             -> usuwa się sam po ~4 s
 *   modal({title, body, actions, size, onClose}) -> {close, el}
 *   confirm({title, text, confirmLabel, cancelLabel, danger}) -> Promise<boolean>
 *   emptyState({title, text, action, icon}) -> HTMLElement
 *   loadCss(url)                     -> Promise (idempotentne)
 *   formatDate(iso, {relative})      -> "3 lis 2026" | "dziś", "wczoraj", "3 dni temu"
 *   fmtScore(n, digits=1)            -> "3,5" (przecinek dziesiętny)
 *   skeleton({lines, block})         -> element ładowania
 *   formError(message) / formSuccess(message) -> komunikat nad formularzem
 *   aiBadge(text='AI sugeruje')     -> etykieta sugestii AI (iskra, czerń/szarość — nigdy kolor)
 *   heroState({title, text, action}) -> centralny ekran startowy (nagłówek + jedno główne działanie)
 *   initials(name)                   -> "ML"
 *   orgAvatar(org, size?)            -> awatar firmy (logo albo litera)
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/* ---------------------------------------------------------------- h() */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs && typeof attrs === 'object' && !(attrs instanceof Node) && !Array.isArray(attrs)) {
    for (const [key, val] of Object.entries(attrs)) {
      if (val === null || val === undefined || val === false) continue;
      if (key === 'class' || key === 'className') el.className = val;
      else if (key === 'on' && typeof val === 'object') {
        for (const [evt, fn] of Object.entries(val)) if (fn) el.addEventListener(evt, fn);
      } else if (/^on[A-Z]/.test(key) && typeof val === 'function') el.addEventListener(key.slice(2).toLowerCase(), val);
      else if (key === 'dataset' && typeof val === 'object') Object.assign(el.dataset, val);
      else if (key === 'style') {
        if (typeof val === 'string') el.style.cssText = val; else Object.assign(el.style, val);
      } else if (key === 'html') el.innerHTML = val;
      else if (key === 'value' && 'value' in el) el.value = val;
      else if (key === 'checked' || key === 'disabled' || key === 'selected' || key === 'readOnly' || key === 'autofocus') {
        el[key] = Boolean(val); if (val) el.setAttribute(key.toLowerCase(), '');
      } else if (key === 'htmlFor') el.setAttribute('for', val);
      else el.setAttribute(key, val === true ? '' : String(val));
    }
  } else if (attrs !== undefined && attrs !== null) {
    children.unshift(attrs);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false || c === true) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

/* ---------------------------------------------------------------- icon() */
/* Ikony: Lucide (lucide.dev), 24×24, obrys 2 px — wyeksportowane z pliku Figma „Tekma.app”, strona Icons. */
const ICONS = {
  'dashboard': '<path d="M9 3H4C3.44772 3 3 3.44772 3 4V11C3 11.5523 3.44772 12 4 12H9C9.55228 12 10 11.5523 10 11V4C10 3.44772 9.55228 3 9 3Z"/><path d="M20 3H15C14.4477 3 14 3.44772 14 4V7C14 7.55228 14.4477 8 15 8H20C20.5523 8 21 7.55228 21 7V4C21 3.44772 20.5523 3 20 3Z"/><path d="M20 12H15C14.4477 12 14 12.4477 14 13V20C14 20.5523 14.4477 21 15 21H20C20.5523 21 21 20.5523 21 20V13C21 12.4477 20.5523 12 20 12Z"/><path d="M9 16H4C3.44772 16 3 16.4477 3 17V20C3 20.5523 3.44772 21 4 21H9C9.55228 21 10 20.5523 10 20V17C10 16.4477 9.55228 16 9 16Z"/>',
  'briefcase': '<path d="M16 20V4C16 3.46957 15.7893 2.96086 15.4142 2.58579C15.0391 2.21071 14.5304 2 14 2H10C9.46957 2 8.96086 2.21071 8.58579 2.58579C8.21071 2.96086 8 3.46957 8 4V20M4 6H20C21.1046 6 22 6.89543 22 8V18C22 19.1046 21.1046 20 20 20H4C2.89543 20 2 19.1046 2 18V8C2 6.89543 2.89543 6 4 6Z"/>',
  'rubric': '<path d="M16 4H18C18.5304 4 19.0391 4.21071 19.4142 4.58579C19.7893 4.96086 20 5.46957 20 6V20C20 20.5304 19.7893 21.0391 19.4142 21.4142C19.0391 21.7893 18.5304 22 18 22H6C5.46957 22 4.96086 21.7893 4.58579 21.4142C4.21071 21.0391 4 20.5304 4 20V6C4 5.46957 4.21071 4.96086 4.58579 4.58579C4.96086 4.21071 5.46957 4 6 4H8M9 14L11 16L15 12M9 2H15C15.5523 2 16 2.44772 16 3V5C16 5.55228 15.5523 6 15 6H9C8.44772 6 8 5.55228 8 5V3C8 2.44772 8.44772 2 9 2Z"/>',
  'users': '<path d="M16 21V19C16 17.9391 15.5786 16.9217 14.8284 16.1716C14.0783 15.4214 13.0609 15 12 15H6C4.93913 15 3.92172 15.4214 3.17157 16.1716C2.42143 16.9217 2 17.9391 2 19V21M16 3.12793C16.8578 3.3503 17.6174 3.85119 18.1597 4.55199C18.702 5.25279 18.9962 6.11382 18.9962 6.99993C18.9962 7.88604 18.702 8.74707 18.1597 9.44787C17.6174 10.1487 16.8578 10.6496 16 10.8719M22 20.9999V18.9999C21.9993 18.1136 21.7044 17.2527 21.1614 16.5522C20.6184 15.8517 19.8581 15.3515 19 15.1299M13 7C13 9.20914 11.2091 11 9 11C6.79086 11 5 9.20914 5 7C5 4.79086 6.79086 3 9 3C11.2091 3 13 4.79086 13 7Z"/>',
  'target': '<path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"/><path d="M12 18C15.3137 18 18 15.3137 18 12C18 8.68629 15.3137 6 12 6C8.68629 6 6 8.68629 6 12C6 15.3137 8.68629 18 12 18Z"/><path d="M12 14C13.1046 14 14 13.1046 14 12C14 10.8954 13.1046 10 12 10C10.8954 10 10 10.8954 10 12C10 13.1046 10.8954 14 12 14Z"/>',
  'settings': '<path d="M9.67106 4.13615C9.72616 3.55649 9.99539 3.0182 10.4262 2.62643C10.8569 2.23467 11.4183 2.01758 12.0006 2.01758C12.5828 2.01758 13.1442 2.23467 13.575 2.62643C14.0057 3.0182 14.275 3.55649 14.3301 4.13615C14.3632 4.51061 14.486 4.87157 14.6882 5.18849C14.8904 5.50541 15.1659 5.76896 15.4915 5.95683C15.8171 6.1447 16.1832 6.25135 16.5588 6.26777C16.9343 6.28419 17.3083 6.20989 17.6491 6.05115C18.1782 5.81093 18.7777 5.77617 19.3311 5.95364C19.8844 6.1311 20.3519 6.5081 20.6426 7.01126C20.9333 7.51441 21.0263 8.10772 20.9037 8.67572C20.7811 9.24372 20.4515 9.74577 19.9791 10.0842C19.6714 10.3 19.4203 10.5868 19.247 10.9202C19.0736 11.2536 18.9831 11.6239 18.9831 11.9997C18.9831 12.3754 19.0736 12.7457 19.247 13.0791C19.4203 13.4125 19.6714 13.6993 19.9791 13.9152C20.4515 14.2535 20.7811 14.7556 20.9037 15.3236C21.0263 15.8916 20.9333 16.4849 20.6426 16.988C20.3519 17.4912 19.8844 17.8682 19.3311 18.0457C18.7777 18.2231 18.1782 18.1884 17.6491 17.9482C17.3083 17.7894 16.9343 17.7151 16.5588 17.7315C16.1832 17.7479 15.8171 17.8546 15.4915 18.0425C15.1659 18.2303 14.8904 18.4939 14.6882 18.8108C14.486 19.1277 14.3632 19.4887 14.3301 19.8632C14.275 20.4428 14.0057 20.9811 13.575 21.3729C13.1442 21.7646 12.5828 21.9817 12.0006 21.9817C11.4183 21.9817 10.8569 21.7646 10.4262 21.3729C9.99539 20.9811 9.72616 20.4428 9.67106 19.8632C9.638 19.4886 9.51516 19.1275 9.31293 18.8104C9.11069 18.4934 8.83503 18.2298 8.50929 18.0419C8.18355 17.854 7.81733 17.7474 7.44164 17.7311C7.06595 17.7147 6.69186 17.7892 6.35106 17.9482C5.82195 18.1884 5.22239 18.2231 4.66906 18.0457C4.11573 17.8682 3.64823 17.4912 3.35754 16.988C3.06685 16.4849 2.97377 15.8916 3.09642 15.3236C3.21907 14.7556 3.54866 14.2535 4.02106 13.9152C4.32868 13.6993 4.57979 13.4125 4.75315 13.0791C4.92651 12.7457 5.01701 12.3754 5.01701 11.9997C5.01701 11.6239 4.92651 11.2536 4.75315 10.9202C4.57979 10.5868 4.32868 10.3 4.02106 10.0842C3.54932 9.7456 3.22031 9.24375 3.09796 8.67613C2.97561 8.10852 3.06867 7.51569 3.35904 7.01286C3.64942 6.51004 4.11637 6.13313 4.66915 5.95539C5.22193 5.77766 5.82104 5.81179 6.35006 6.05115C6.69082 6.20989 7.0648 6.28419 7.44036 6.26777C7.81592 6.25135 8.18199 6.1447 8.5076 5.95683C8.8332 5.76896 9.10875 5.50541 9.31093 5.18849C9.5131 4.87157 9.63594 4.51061 9.66906 4.13615M15 12C15 13.6569 13.6569 15 12 15C10.3431 15 9 13.6569 9 12C9 10.3431 10.3431 9 12 9C13.6569 9 15 10.3431 15 12Z"/>',
  'search': '<path d="M20.9999 21.0002L16.6599 16.6602M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z"/>',
  'plus': '<path d="M5 12H19M12 5V19"/>',
  'check': '<path d="M20 6L9 17L4 12"/>',
  'x': '<path d="M18 6L6 18M6 6L18 18"/>',
  'flag': '<path d="M4 22V4C4 3.84475 4.03614 3.69164 4.10557 3.55279C4.175 3.41393 4.2758 3.29315 4.4 3.2C5.43858 2.42107 6.70178 2 8 2C11 2 13 4 15.333 4C16.6663 4 17.6887 3.73333 18.4 3.2C18.5486 3.08857 18.7252 3.02072 18.9102 3.00404C19.0952 2.98736 19.2811 3.02252 19.4472 3.10557C19.6133 3.18863 19.753 3.31629 19.8507 3.47427C19.9483 3.63224 20 3.81429 20 4V14C20 14.1552 19.9639 14.3084 19.8944 14.4472C19.825 14.5861 19.7242 14.7069 19.6 14.8C18.5614 15.5789 17.2982 16 16 16C13 16 11 14 8 14C6.52412 14 5.10002 14.544 4 15.528"/>',
  'spark': '<path d="M20 2V6M22 4H18M11.017 2.81395C11.0598 2.58456 11.1815 2.37737 11.3611 2.22827C11.5406 2.07917 11.7666 1.99756 12 1.99756C12.2333 1.99756 12.4593 2.07917 12.6389 2.22827C12.8184 2.37737 12.9401 2.58456 12.983 2.81395L14.034 8.37195C14.1086 8.7671 14.3006 9.13057 14.585 9.41492C14.8693 9.69928 15.2328 9.89131 15.628 9.96595L21.186 11.017C21.4153 11.0598 21.6225 11.1815 21.7716 11.3611C21.9207 11.5406 22.0023 11.7666 22.0023 12C22.0023 12.2333 21.9207 12.4593 21.7716 12.6389C21.6225 12.8184 21.4153 12.9401 21.186 12.983L15.628 14.034C15.2328 14.1086 14.8693 14.3006 14.585 14.585C14.3006 14.8693 14.1086 15.2328 14.034 15.628L12.983 21.186C12.9401 21.4153 12.8184 21.6225 12.6389 21.7716C12.4593 21.9207 12.2333 22.0023 12 22.0023C11.7666 22.0023 11.5406 21.9207 11.3611 21.7716C11.1815 21.6225 11.0598 21.4153 11.017 21.186L9.96595 15.628C9.89131 15.2328 9.69928 14.8693 9.41492 14.585C9.13057 14.3006 8.7671 14.1086 8.37195 14.034L2.81395 12.983C2.58456 12.9401 2.37737 12.8184 2.22827 12.6389C2.07917 12.4593 1.99756 12.2333 1.99756 12C1.99756 11.7666 2.07917 11.5406 2.22827 11.3611C2.37737 11.1815 2.58456 11.0598 2.81395 11.017L8.37195 9.96595C8.7671 9.89131 9.13057 9.69928 9.41492 9.41492C9.69928 9.13057 9.89131 8.7671 9.96595 8.37195L11.017 2.81395ZM6 20C6 21.1046 5.10457 22 4 22C2.89543 22 2 21.1046 2 20C2 18.8954 2.89543 18 4 18C5.10457 18 6 18.8954 6 20Z"/>',
  'arrow': '<path d="M5 12H19M12 19L19 12L12 5"/>',
  'arrow-left': '<path d="M12 5L5 12L12 19M5 12H19"/>',
  'logout': '<path d="M16 7L21 12L16 17M21 12H9M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9"/>',
  'sun': '<path d="M12 2V4M12 20V22M4.93005 4.93018L6.34005 6.34018M17.66 17.6602L19.07 19.0702M2 12H4M20 12H22M6.34005 17.6602L4.93005 19.0702M19.07 4.93018L17.66 6.34018M16 12C16 14.2091 14.2091 16 12 16C9.79086 16 8 14.2091 8 12C8 9.79086 9.79086 8 12 8C14.2091 8 16 9.79086 16 12Z"/>',
  'moon': '<path d="M20.985 12.486C20.8912 14.2222 20.2966 15.894 19.273 17.2994C18.2494 18.7049 16.8406 19.7837 15.217 20.4056C13.5933 21.0274 11.8243 21.1657 10.1237 20.8036C8.42318 20.4415 6.86392 19.5946 5.63442 18.3652C4.40493 17.1358 3.55785 15.5767 3.19558 13.8761C2.83331 12.1756 2.97136 10.4066 3.59304 8.78285C4.21472 7.15912 5.29342 5.75022 6.69874 4.72647C8.10406 3.70272 9.77583 3.10794 11.512 3.01403C11.917 2.99203 12.129 3.47403 11.914 3.81703C11.1949 4.96759 10.8869 6.3279 11.0405 7.67598C11.194 9.02407 11.7999 10.2803 12.7593 11.2397C13.7187 12.1991 14.9749 12.805 16.323 12.9585C17.6711 13.1121 19.0314 12.8041 20.182 12.085C20.526 11.87 21.007 12.081 20.985 12.486Z"/>',
  'monitor': '<path d="M8 21H16M12 17V21M4 3H20C21.1046 3 22 3.89543 22 5V15C22 16.1046 21.1046 17 20 17H4C2.89543 17 2 16.1046 2 15V5C2 3.89543 2.89543 3 4 3Z"/>',
  'menu': '<path d="M4 5H20M4 12H20M4 19H20"/>',
  'mic': '<path d="M12 19V22M5 10V12C5 13.8565 5.7375 15.637 7.05025 16.9497C8.36301 18.2625 10.1435 19 12 19C13.8565 19 15.637 18.2625 16.9497 16.9497C18.2625 15.637 19 13.8565 19 12V10M12 2C13.6569 2 15 3.34315 15 5V12C15 13.6569 13.6569 15 12 15C10.3431 15 9 13.6569 9 12V5C9 3.34315 10.3431 2 12 2Z"/>',
  'calendar': '<path d="M8 2V6M16 2V6M3 10H21M5 4H19C20.1046 4 21 4.89543 21 6V20C21 21.1046 20.1046 22 19 22H5C3.89543 22 3 21.1046 3 20V6C3 4.89543 3.89543 4 5 4Z"/>',
  'mail': '<path d="M22 7L13.009 12.727C12.7039 12.9042 12.3573 12.9976 12.0045 12.9976C11.6517 12.9976 11.3051 12.9042 11 12.727L2 7M4 4H20C21.1046 4 22 4.89543 22 6V18C22 19.1046 21.1046 20 20 20H4C2.89543 20 2 19.1046 2 18V6C2 4.89543 2.89543 4 4 4Z"/>',
  'trash': '<path d="M10 11V17M14 11V17M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6M3 6H21M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6"/>',
  'edit': '<path d="M15 5L19 9M21.1739 6.81189C21.7026 6.28332 21.9997 5.56636 21.9998 4.81875C21.9999 4.07113 21.703 3.3541 21.1744 2.82539C20.6459 2.29668 19.9289 1.99961 19.1813 1.99951C18.4337 1.99942 17.7166 2.29632 17.1879 2.82489L3.84193 16.1739C3.60975 16.4054 3.43805 16.6904 3.34193 17.0039L2.02093 21.3559C1.99509 21.4424 1.99314 21.5342 2.01529 21.6217C2.03743 21.7092 2.08285 21.7891 2.14673 21.8529C2.21061 21.9167 2.29055 21.962 2.37809 21.984C2.46563 22.006 2.55749 22.0039 2.64393 21.9779L6.99693 20.6579C7.3101 20.5626 7.59511 20.392 7.82693 20.1609L21.1739 6.81189Z"/>',
  'user': '<path d="M19 21V19C19 17.9391 18.5786 16.9217 17.8284 16.1716C17.0783 15.4214 16.0609 15 15 15H9C7.93913 15 6.92172 15.4214 6.17157 16.1716C5.42143 16.9217 5 17.9391 5 19V21M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z"/>',
  'building': '<path d="M10 12H14M10 8H14M14 21V18C14 17.4696 13.7893 16.9609 13.4142 16.5858C13.0391 16.2107 12.5304 16 12 16C11.4696 16 10.9609 16.2107 10.5858 16.5858C10.2107 16.9609 10 17.4696 10 18V21M6 10H4C3.46957 10 2.96086 10.2107 2.58579 10.5858C2.21071 10.9609 2 11.4696 2 12V19C2 19.5304 2.21071 20.0391 2.58579 20.4142C2.96086 20.7893 3.46957 21 4 21H20C20.5304 21 21.0391 20.7893 21.4142 20.4142C21.7893 20.0391 22 19.5304 22 19V9C22 8.46957 21.7893 7.96086 21.4142 7.58579C21.0391 7.21071 20.5304 7 20 7H18M6 21V5C6 4.46957 6.21071 3.96086 6.58579 3.58579C6.96086 3.21071 7.46957 3 8 3H16C16.5304 3 17.0391 3.21071 17.4142 3.58579C17.7893 3.96086 18 4.46957 18 5V21"/>',
  'shield': '<path d="M9 12L11 14L15 10M20 13C20 18 16.5 20.5 12.34 21.95C12.1222 22.0238 11.8855 22.0202 11.67 21.94C7.5 20.5 4 18 4 13V5.99996C4 5.73474 4.10536 5.48039 4.29289 5.29285C4.48043 5.10532 4.73478 4.99996 5 4.99996C7 4.99996 9.5 3.79996 11.24 2.27996C11.4519 2.09896 11.7214 1.99951 12 1.99951C12.2786 1.99951 12.5481 2.09896 12.76 2.27996C14.51 3.80996 17 4.99996 19 4.99996C19.2652 4.99996 19.5196 5.10532 19.7071 5.29285C19.8946 5.48039 20 5.73474 20 5.99996V13Z"/>',
  'chevron': '<path d="M6 9L12 15L18 9"/>',
  'chevron-right': '<path d="M9 18L15 12L9 6"/>',
  'alert': '<path d="M12 9V13M12 17H12.01M21.7301 18.0002L13.7301 4.00022C13.5556 3.69243 13.3027 3.43641 12.997 3.25829C12.6913 3.08017 12.3438 2.98633 11.9901 2.98633C11.6363 2.98633 11.2888 3.08017 10.9831 3.25829C10.6774 3.43641 10.4245 3.69243 10.2501 4.00022L2.25005 18.0002C2.07373 18.3056 1.98128 18.6521 1.98206 19.0047C1.98284 19.3573 2.07683 19.7035 2.2545 20.008C2.43217 20.3126 2.6872 20.5648 2.99375 20.7391C3.30029 20.9133 3.64746 21.0034 4.00005 21.0002H20.0001C20.351 20.9999 20.6956 20.9072 20.9993 20.7315C21.3031 20.5558 21.5553 20.3033 21.7306 19.9993C21.9059 19.6954 21.9981 19.3506 21.998 18.9997C21.9979 18.6488 21.9055 18.3041 21.7301 18.0002Z"/>',
  'info': '<path d="M12 16V12M12 8H12.01M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z"/>',
  'clock': '<path d="M12 6V12L16 14M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z"/>',
  'eye': '<path d="M2.06202 12.3481C1.97868 12.1236 1.97868 11.8766 2.06202 11.6521C2.87372 9.68397 4.25153 8.00116 6.02079 6.81701C7.79004 5.63287 9.87106 5.00073 12 5.00073C14.129 5.00073 16.21 5.63287 17.9792 6.81701C19.7485 8.00116 21.1263 9.68397 21.938 11.6521C22.0214 11.8766 22.0214 12.1236 21.938 12.3481C21.1263 14.3163 19.7485 15.9991 17.9792 17.1832C16.21 18.3674 14.129 18.9995 12 18.9995C9.87106 18.9995 7.79004 18.3674 6.02079 17.1832C4.25153 15.9991 2.87372 14.3163 2.06202 12.3481Z"/><path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z"/>',
  'eye-off': '<path d="M10.733 5.07599C13.0624 4.7984 15.4186 5.29081 17.4419 6.47804C19.4652 7.66527 21.0442 9.48207 21.938 11.651C22.0214 11.8755 22.0214 12.1225 21.938 12.347C21.5705 13.238 21.0848 14.0755 20.494 14.837M14.084 14.158C13.5182 14.7045 12.7604 15.0069 11.9738 15C11.1872 14.9932 10.4348 14.6777 9.87856 14.1215C9.32233 13.5652 9.00683 12.8128 8.99999 12.0262C8.99316 11.2396 9.29554 10.4818 9.84201 9.91602M17.479 17.499C16.1525 18.2848 14.6725 18.776 13.1394 18.9394C11.6063 19.1028 10.056 18.9345 8.59365 18.4459C7.13133 17.9573 5.79121 17.1599 4.66423 16.1078C3.53725 15.0556 2.64977 13.7734 2.06202 12.348C1.97868 12.1235 1.97868 11.8765 2.06202 11.652C2.94865 9.50189 4.50869 7.69728 6.50802 6.50903M2 2L22 22"/>',
  'more': '<path d="M12 13C12.5523 13 13 12.5523 13 12C13 11.4477 12.5523 11 12 11C11.4477 11 11 11.4477 11 12C11 12.5523 11.4477 13 12 13Z"/><path d="M19 13C19.5523 13 20 12.5523 20 12C20 11.4477 19.5523 11 19 11C18.4477 11 18 11.4477 18 12C18 12.5523 18.4477 13 19 13Z"/><path d="M5 13C5.55228 13 6 12.5523 6 12C6 11.4477 5.55228 11 5 11C4.44772 11 4 11.4477 4 12C4 12.5523 4.44772 13 5 13Z"/>',
  'copy': '<path d="M4 16C2.9 16 2 15.1 2 14V4C2 2.9 2.9 2 4 2H14C15.1 2 16 2.9 16 4M10 8H20C21.1046 8 22 8.89543 22 10V20C22 21.1046 21.1046 22 20 22H10C8.89543 22 8 21.1046 8 20V10C8 8.89543 8.89543 8 10 8Z"/>',
  'construction': '<path d="M17 14V21M7 14V21M17 3V6M7 3V6M10 14L2.30005 6.30005M14 6L21.7 13.7M8 6L16 14M3 6H21C21.5523 6 22 6.44772 22 7V13C22 13.5523 21.5523 14 21 14H3C2.44772 14 2 13.5523 2 13V7C2 6.44772 2.44772 6 3 6Z"/>',
  'bell': '<path d="M10.2679 21C10.4435 21.304 10.696 21.5565 11 21.732C11.304 21.9075 11.6489 21.9999 11.9999 21.9999C12.351 21.9999 12.6959 21.9075 12.9999 21.732C13.3039 21.5565 13.5564 21.304 13.7319 21M3.262 15.326C3.13137 15.4692 3.04516 15.6472 3.01386 15.8385C2.98256 16.0298 3.00752 16.226 3.08571 16.4034C3.1639 16.5807 3.29194 16.7316 3.45426 16.8375C3.61658 16.9434 3.80618 16.9999 4 17H20C20.1938 17.0001 20.3834 16.9438 20.5459 16.8381C20.7083 16.7324 20.8365 16.5817 20.9149 16.4045C20.9933 16.2273 21.0185 16.0311 20.9874 15.8398C20.9564 15.6485 20.8704 15.4703 20.74 15.327C19.41 13.956 18 12.499 18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 12.499 4.589 13.956 3.262 15.326Z"/>',
  'message': '<path d="M22 17C22 17.5304 21.7893 18.0391 21.4142 18.4142C21.0391 18.7893 20.5304 19 20 19H6.828C6.29761 19.0001 5.78899 19.2109 5.414 19.586L3.212 21.788C3.1127 21.8873 2.9862 21.9549 2.84849 21.9823C2.71077 22.0097 2.56803 21.9956 2.43831 21.9419C2.30858 21.8881 2.1977 21.7971 2.11969 21.6804C2.04167 21.5637 2.00002 21.4264 2 21.286V5C2 4.46957 2.21071 3.96086 2.58579 3.58579C2.96086 3.21071 3.46957 3 4 3H20C20.5304 3 21.0391 3.21071 21.4142 3.58579C21.7893 3.96086 22 4.46957 22 5V17Z"/>',
  'inbox': '<path d="M22 12H16L14 15H10L8 12H2M2 12L5.45 5.11C5.61558 4.77679 5.87083 4.49637 6.18704 4.30028C6.50326 4.10419 6.86792 4.0002 7.24 4H16.76C17.1321 4.0002 17.4967 4.10419 17.813 4.30028C18.1292 4.49637 18.3844 4.77679 18.55 5.11L22 12V18C22 18.5304 21.7893 19.0391 21.4142 19.4142C21.0391 19.7893 20.5304 20 20 20H4C3.46957 20 2.96086 19.7893 2.58579 19.4142C2.21071 19.0391 2 18.5304 2 18V12Z"/>',
  'filter': '<path d="M10 20C9.99992 20.1858 10.0516 20.368 10.1493 20.5261C10.247 20.6842 10.3868 20.8119 10.553 20.895L12.553 21.895C12.7055 21.9712 12.8749 22.0072 13.0452 21.9994C13.2156 21.9917 13.3811 21.9406 13.526 21.8509C13.671 21.7613 13.7907 21.636 13.8736 21.4871C13.9566 21.3381 14.0001 21.1705 14 21V14C14.0002 13.5044 14.1845 13.0265 14.517 12.659L21.74 4.67C21.8695 4.52656 21.9546 4.34868 21.9851 4.15788C22.0156 3.96708 21.9902 3.77153 21.9119 3.59487C21.8336 3.41822 21.7058 3.26802 21.544 3.16245C21.3822 3.05688 21.1932 3.00046 21 3H3.00001C2.80661 3.00007 2.61739 3.05622 2.45526 3.16164C2.29312 3.26706 2.16503 3.41723 2.08651 3.59396C2.00799 3.7707 1.98239 3.96641 2.01283 4.15739C2.04327 4.34837 2.12843 4.52643 2.25801 4.67L9.48301 12.659C9.81554 13.0265 9.99978 13.5044 10 14V20Z"/>',
  'star': '<path d="M11.525 2.29502C11.5688 2.20648 11.6365 2.13195 11.7204 2.07984C11.8044 2.02773 11.9012 2.00012 12 2.00012C12.0988 2.00012 12.1956 2.02773 12.2795 2.07984C12.3634 2.13195 12.4311 2.20648 12.475 2.29502L14.785 6.97402C14.9371 7.28198 15.1618 7.54842 15.4396 7.75047C15.7174 7.95251 16.0401 8.08413 16.38 8.13402L21.546 8.89002C21.6439 8.9042 21.7358 8.94549 21.8115 9.00921C21.8871 9.07294 21.9434 9.15656 21.974 9.25062C22.0046 9.34468 22.0082 9.44542 21.9846 9.54145C21.9609 9.63748 21.9108 9.72497 21.84 9.79402L18.104 13.432C17.8576 13.6721 17.6732 13.9685 17.5668 14.2956C17.4604 14.6228 17.435 14.9709 17.493 15.31L18.375 20.45C18.3922 20.5479 18.3817 20.6486 18.3445 20.7407C18.3073 20.8328 18.2449 20.9126 18.1645 20.971C18.0841 21.0294 17.9889 21.064 17.8898 21.0709C17.7907 21.0778 17.6917 21.0567 17.604 21.01L12.986 18.582C12.6817 18.4222 12.3431 18.3388 11.9995 18.3388C11.6558 18.3388 11.3173 18.4222 11.013 18.582L6.39597 21.01C6.3083 21.0564 6.20937 21.0773 6.11042 21.0703C6.01147 21.0632 5.91649 21.0286 5.83626 20.9702C5.75604 20.9119 5.6938 20.8322 5.65662 20.7402C5.61945 20.6483 5.60883 20.5477 5.62597 20.45L6.50697 15.311C6.56516 14.9717 6.53995 14.6234 6.43351 14.2961C6.32706 13.9687 6.14258 13.6722 5.89597 13.432L2.15997 9.79502C2.08856 9.72605 2.03796 9.63841 2.01393 9.54209C1.9899 9.44577 1.99341 9.34463 2.02405 9.25021C2.05469 9.15578 2.11124 9.07186 2.18725 9.008C2.26326 8.94414 2.35567 8.90291 2.45397 8.88902L7.61897 8.13402C7.95923 8.08451 8.28236 7.95307 8.56055 7.751C8.83875 7.54893 9.06367 7.28229 9.21597 6.97402L11.525 2.29502Z"/>',
};

export function icon(name, size = 16) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('ico', `ico-${name}`);
  svg.innerHTML = ICONS[name] || ICONS.info;
  return svg;
}
export const iconNames = Object.keys(ICONS);

/* ---------------------------------------------------------------- button() */
export function button({ label, variant = 'secondary', size = 'md', icon: iconName, onClick, disabled = false, type = 'button', block = false, title, attrs = {} } = {}) {
  const classes = ['btn', `btn-${variant}`];
  if (size === 'sm') classes.push('btn-sm');
  if (block) classes.push('btn-block');
  if (!label && iconName) classes.push('btn-icon');
  const el = h('button', { class: classes.join(' '), type, disabled, title, 'aria-label': !label ? (title || iconName) : null, ...attrs },
    iconName ? icon(iconName) : null,
    label ? h('span', null, label) : null,
  );
  if (onClick) el.addEventListener('click', onClick);
  el.setBusy = (busy) => {
    el.classList.toggle('is-busy', Boolean(busy));
    el.disabled = Boolean(busy) || disabled;
    el.setAttribute('aria-busy', busy ? 'true' : 'false');
  };
  return el;
}

/* ---------------------------------------------------------------- field() */
let fieldSeq = 0;
export function field({ label, name, type = 'text', value = '', error = '', hint = '', required = false, autocomplete, placeholder, options, rows, min, max, step, inputmode, disabled = false, id } = {}) {
  const fid = id || `f-${name || 'x'}-${++fieldSeq}`;
  const hintId = hint ? `${fid}-hint` : null;
  const errId = `${fid}-err`;
  let input;
  if (type === 'select') {
    input = h('select', { id: fid, name, required, disabled },
      (options || []).map((o) => {
        const opt = typeof o === 'string' ? { value: o, label: o } : o;
        return h('option', { value: opt.value, selected: String(opt.value) === String(value) }, opt.label);
      }));
  } else if (type === 'textarea') {
    input = h('textarea', { id: fid, name, required, placeholder, rows: rows || 4, disabled, autocomplete });
    input.value = value;
  } else {
    input = h('input', { id: fid, name, type, required, placeholder, autocomplete, min, max, step, inputmode, disabled });
    input.value = value;
  }
  const describedBy = [hintId, errId].filter(Boolean).join(' ');
  if (describedBy) input.setAttribute('aria-describedby', describedBy);

  let inputWrap = input;
  if (type === 'password') {
    const reveal = h('button', { type: 'button', class: 'reveal', 'aria-label': 'Pokaż hasło', 'aria-pressed': 'false', tabindex: '-1' }, icon('eye'));
    reveal.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      reveal.setAttribute('aria-pressed', show ? 'true' : 'false');
      reveal.setAttribute('aria-label', show ? 'Ukryj hasło' : 'Pokaż hasło');
      reveal.replaceChildren(icon(show ? 'eye-off' : 'eye'));
      input.focus();
    });
    inputWrap = h('div', { class: 'input-wrap' }, input, reveal);
  }

  const errEl = h('div', { class: 'error', id: errId, role: 'alert' });
  const el = h('div', { class: 'field' },
    label ? h('label', { htmlFor: fid }, label, required ? h('span', { class: 'req', 'aria-hidden': 'true' }, '') : null) : null,
    inputWrap,
    hint ? h('div', { class: 'hint', id: hintId }, hint) : null,
    errEl,
  );
  el.input = input;
  el.setError = (msg) => {
    errEl.textContent = msg || '';
    el.classList.toggle('has-error', Boolean(msg));
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  };
  Object.defineProperty(el, 'value', { get: () => input.value, set: (v) => { input.value = v; } });
  if (error) el.setError(error);
  input.addEventListener('input', () => { if (el.classList.contains('has-error')) el.setError(''); });
  return el;
}

/* ---------------------------------------------------------------- avatar / tag */
/** Awatar firmy: logo (data-URL) albo pierwsza litera nazwy. size: '', 'sm', 'lg'. */
export function orgAvatar(org, size = '') {
  const el = h('span', { class: `av dark${size ? ' ' + size : ''}${org && org.logo ? ' has-logo' : ''}`, 'aria-hidden': 'true' });
  if (org && org.logo) el.append(h('img', { src: org.logo, alt: '', draggable: 'false' }));
  else el.textContent = org ? initials(org.name).slice(0, 1) : '?';
  return el;
}

export function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
export function avatar(name, size) {
  const el = h('span', { class: `av${size ? ' ' + size : ''}`, title: name || '', 'aria-hidden': 'true' }, initials(name));
  return el;
}
export function tag(text, tone = 'neutral') {
  return h('span', { class: `tag ${tone}` }, text);
}

/* ---------------------------------------------------------------- toast() */
let toastHost = null;
const TOAST_ICON = { good: 'check', warn: 'alert', bad: 'x', info: 'info', neutral: 'info' };
export function toast(message, tone = 'neutral', { duration = 4000 } = {}) {
  if (!toastHost) {
    toastHost = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'false' });
    document.body.appendChild(toastHost);
  }
  const el = h('div', { class: `toast ${tone}` }, icon(TOAST_ICON[tone] || 'info'), h('span', null, message));
  toastHost.appendChild(el);
  const remove = () => { el.classList.add('leaving'); setTimeout(() => el.remove(), 200); };
  const t = setTimeout(remove, duration);
  el.addEventListener('click', () => { clearTimeout(t); remove(); });
  return { close: remove };
}

/* ---------------------------------------------------------------- modal() */
export function modal({ title, body, actions = [], size, onClose, closeOnBackdrop = true } = {}) {
  const previouslyFocused = document.activeElement;
  const titleId = `m-title-${++fieldSeq}`;
  const closeBtn = h('button', { type: 'button', class: 'close', 'aria-label': 'Zamknij' }, icon('x'));
  const actionEls = actions.map((a) => (a instanceof Node ? a : button(a)));
  const box = h('div', { class: `modal${size ? ' ' + size : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
    h('div', { class: 'modal-h' }, h('h2', { id: titleId }, title || ''), closeBtn),
    h('div', { class: 'modal-b' }, body),
    actionEls.length ? h('div', { class: 'modal-f' }, actionEls) : null,
  );
  const backdrop = h('div', { class: 'modal-backdrop' }, box);
  let closed = false;
  const close = (result) => {
    if (closed) return; closed = true;
    document.removeEventListener('keydown', onKey, true);
    backdrop.remove();
    if (!document.querySelector('.modal-backdrop')) document.body.classList.remove('has-modal');
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus();
    if (onClose) onClose(result);
  };
  const focusables = () => Array.from(box.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'));
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') {
      const list = focusables(); if (!list.length) return;
      const first = list[0], last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  closeBtn.addEventListener('click', () => close());
  if (closeOnBackdrop) backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', onKey, true);
  document.body.classList.add('has-modal');
  document.body.appendChild(backdrop);
  requestAnimationFrame(() => {
    const list = focusables().filter((n) => n !== closeBtn);
    const first = box.querySelector('input,select,textarea') || list[0] || closeBtn;
    first.focus();
  });
  return { close, el: box };
}

export function confirm({ title = 'Na pewno?', text = '', confirmLabel = 'Potwierdź', cancelLabel = 'Anuluj', danger = false } = {}) {
  return new Promise((resolve) => {
    let result = false;
    const m = modal({
      title,
      body: text ? h('p', null, text) : null,
      onClose: () => resolve(result),
      actions: [
        button({ label: cancelLabel, variant: 'secondary', onClick: () => m.close() }),
        button({ label: confirmLabel, variant: danger ? 'danger' : 'primary', onClick: () => { result = true; m.close(); } }),
      ],
    });
  });
}

/* ---------------------------------------------------------------- stany */
export function emptyState({ title, text, action, icon: iconName = 'inbox' } = {}) {
  const actions = action ? (Array.isArray(action) ? action : [action]).map((a) => (a instanceof Node ? a : button({ variant: 'primary', ...a }))) : [];
  return h('div', { class: 'empty' },
    icon(iconName, 28),
    title ? h('h3', null, title) : null,
    text ? h('p', null, text) : null,
    actions.length ? h('div', { class: 'actions' }, actions) : null,
  );
}
export function aiBadge(text = 'AI sugeruje') {
  return h('span', { class: 'ai-note' }, icon('spark', 12), text);
}
export function heroState({ title, text, action, secondary } = {}) {
  const actions = [action, secondary].filter(Boolean).map((a, i) => (a instanceof Node ? a : button({ variant: i === 0 ? 'primary' : 'secondary', ...a })));
  return h('div', { class: 'hero-state' },
    title ? h('h1', null, title) : null,
    text ? h('p', null, text) : null,
    actions.length ? h('div', { class: 'actions' }, actions) : null,
  );
}
export function formError(message) {
  return h('div', { class: 'form-error', role: 'alert' }, icon('alert'), h('span', null, message));
}
export function formSuccess(message) {
  return h('div', { class: 'form-success', role: 'status' }, icon('check'), h('span', null, message));
}
export function skeleton({ lines = 3, block = false } = {}) {
  const el = h('div', { class: 'skeleton', 'aria-busy': 'true', 'aria-label': 'Ładowanie' });
  if (block) { el.appendChild(h('i', { class: 'block' })); return el; }
  el.appendChild(h('i', { class: 'h' }));
  const widths = ['w80', 'w60', 'w40', 'w80', 'w60'];
  for (let i = 0; i < lines; i++) el.appendChild(h('i', { class: widths[i % widths.length] }));
  return el;
}

/* ---------------------------------------------------------------- loadCss() */
const loadedCss = new Map();
export function loadCss(url) {
  const href = String(url);
  if (loadedCss.has(href)) return loadedCss.get(href);
  const p = new Promise((resolve) => {
    const link = h('link', { rel: 'stylesheet', href });
    link.addEventListener('load', () => resolve(true));
    link.addEventListener('error', () => resolve(false));
    document.head.appendChild(link);
  });
  loadedCss.set(href, p);
  return p;
}

/* ---------------------------------------------------------------- formatowanie */
const MONTHS = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
export function formatDate(iso, { relative = false, time = false } = {}) {
  if (!iso) return '';
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  if (relative) {
    const now = new Date();
    const day = 24 * 3600 * 1000;
    const start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((start(now) - start(d)) / day);
    if (diff === 0) return 'dziś';
    if (diff === 1) return 'wczoraj';
    if (diff === -1) return 'jutro';
    if (diff > 1 && diff < 7) return `${diff} dni temu`;
    if (diff < -1 && diff > -7) return `za ${-diff} dni`;
  }
  let s = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  if (time) s += `, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return s;
}
export function fmtScore(n, digits = 1) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '–';
  return Number(n).toFixed(digits).replace('.', ',');
}
export function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (n === 1) return `${n} ${one}`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

export default { h, icon, iconNames, button, field, avatar, orgAvatar, initials, tag, toast, modal, confirm, emptyState, heroState, aiBadge, formError, formSuccess, skeleton, loadCss, formatDate, fmtScore, plural };
