/** Rendering + formatting helpers shared by every view. */

import { MACRO_META } from './nutrition.js';

/** Escape text destined for innerHTML. Every user-supplied string goes through this. */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Tagged template that escapes every interpolated value. */
export function html(strings, ...values) {
  return strings.reduce((out, chunk, i) => {
    if (i === 0) return chunk;
    const value = values[i - 1];
    const rendered = Array.isArray(value) ? value.join('') : value;
    const safe = rendered && rendered.__raw ? rendered.value : esc(rendered);
    return out + safe + chunk;
  }, '');
}

/** Mark a string as already-safe markup. */
export function raw(value) {
  return { __raw: true, value: String(value) };
}

export function round(value, decimals = 0) {
  const f = 10 ** decimals;
  return Math.round((Number(value) || 0) * f) / f;
}

export function macroValue(key, value) {
  const meta = MACRO_META[key];
  const decimals = meta ? meta.decimals : 0;
  const n = round(value, decimals);
  return decimals === 0 ? n.toLocaleString('en-GB') : String(n);
}

/** Whole numbers for headline figures — nobody needs 0.3 of a gram at a glance. */
export function bigValue(value) {
  return Math.round(Number(value) || 0).toLocaleString('en-GB');
}

export function qtyText(value) {
  return String(round(Number(value) || 0, 2));
}

/** Abbreviations and mass nouns that must not gain an "s". */
const NEVER_PLURAL = new Set([
  'g', 'ml', 'tbsp', 'tsp', 'heaped tbsp', 'to taste', 'each',
  'small', 'regular', 'large', 'single', 'double', 'whole',
]);

/** Plurals the regular rules get wrong. */
const IRREGULAR_PLURAL = { half: 'halves', leaf: 'leaves' };

export function measureText(qty, label) {
  if (Number(qty) <= 1 || NEVER_PLURAL.has(label)) return label;
  if (IRREGULAR_PLURAL[label]) return IRREGULAR_PLURAL[label];
  // Compound measures pluralise on the last word: "half tin" → "half tins".
  const space = label.lastIndexOf(' ');
  if (space > -1) {
    const head = label.slice(0, space);
    const tail = label.slice(space + 1);
    return `${head} ${measureText(qty, tail)}`;
  }
  if (/[sxz]$|[cs]h$/.test(label)) return `${label}es`;
  if (label.endsWith('o')) return `${label}es`; // potato → potatoes
  return `${label}s`;
}

/** "4 eggs (200g)" / "150g" — the amount as you'd say it out loud. */
export function amountText(qty, measure) {
  if (!measure) return `${qtyText(qty)}g`;
  if (measure.grams === 1) return `${qtyText(qty)}${measure.label}`;
  const grams = Math.round(qty * measure.grams);
  return `${qtyText(qty)} ${measureText(qty, measure.label)} · ${grams}g`;
}

/** Short form for dense rows: "4 eggs" or "150g". */
export function shortAmount(qty, measure) {
  if (!measure) return `${qtyText(qty)}g`;
  if (measure.grams === 1) return `${qtyText(qty)}${measure.label}`;
  return `${qtyText(qty)} ${measureText(qty, measure.label)}`;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDate(key, { short = false } = {}) {
  const date = parseKey(key);
  if (short) return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
  return `${DAY_NAMES[date.getDay()]} ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
}

export function relativeDay(key, todayKey) {
  if (key === todayKey) return 'Today';
  const diff = Math.round((parseKey(key) - parseKey(todayKey)) / 86400000);
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  return formatDate(key);
}

export function timeOfDay(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * A macro-split gradient, used as the "poster" on saved-meal tiles.
 * Each meal ends up with its own colour signature — protein-heavy meals read
 * green, carb-heavy ones blue — so the library is scannable at a glance.
 */
export function macroGradient(split) {
  const p = Math.max(split.protein, 0);
  const c = Math.max(split.carbs, 0);
  const f = Math.max(split.fat, 0);
  const total = p + c + f || 1;
  const pEnd = (p / total) * 100;
  const cEnd = pEnd + (c / total) * 100;
  return `linear-gradient(115deg,
    var(--protein) 0%, var(--protein) ${pEnd.toFixed(1)}%,
    var(--carbs) ${pEnd.toFixed(1)}%, var(--carbs) ${cEnd.toFixed(1)}%,
    var(--fat) ${cEnd.toFixed(1)}%, var(--fat) 100%)`;
}

/** Toast notifications — confirmation without a modal. */
let toastTimer = null;
export function toast(message) {
  let node = document.getElementById('toast');
  if (!node) {
    node = document.createElement('div');
    node.id = 'toast';
    node.className = 'toast';
    node.setAttribute('role', 'status');
    node.setAttribute('aria-live', 'polite');
    document.body.appendChild(node);
  }
  node.textContent = message;
  node.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('is-visible'), 2400);
}

/** Modal sheet. */
export function openSheet({ title, body, actions = '', size = '' }) {
  closeSheet();
  const wrap = document.createElement('div');
  wrap.className = 'sheet-backdrop';
  wrap.id = 'sheet';
  wrap.innerHTML = html`
    <div class="sheet ${raw(size)}" role="dialog" aria-modal="true" aria-label="${title}">
      <header class="sheet__head">
        <h2>${title}</h2>
        <button class="icon-btn" data-sheet-close aria-label="Close">✕</button>
      </header>
      <div class="sheet__body">${raw(body)}</div>
      ${raw(actions ? `<footer class="sheet__foot">${actions}</footer>` : '')}
    </div>`;
  document.body.appendChild(wrap);
  document.body.classList.add('has-sheet');
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap || e.target.closest('[data-sheet-close]')) closeSheet();
  });
  return wrap;
}

export function closeSheet() {
  const existing = document.getElementById('sheet');
  if (existing) existing.remove();
  document.body.classList.remove('has-sheet');
}

export function isSheetOpen() {
  return Boolean(document.getElementById('sheet'));
}

/**
 * Preserve keyboard focus across a re-render. Elements opt in with data-fk="…";
 * without this, typing in a search box would lose focus on every keystroke.
 */
export function captureFocus() {
  const active = document.activeElement;
  if (!active || !active.dataset || !active.dataset.fk) return null;
  return { key: active.dataset.fk, start: active.selectionStart, end: active.selectionEnd };
}

export function restoreFocus(snapshot, root = document) {
  if (!snapshot) return;
  const node = root.querySelector(`[data-fk="${CSS.escape(snapshot.key)}"]`);
  if (!node) return;
  node.focus();
  if (snapshot.start != null && node.setSelectionRange) {
    try {
      node.setSelectionRange(snapshot.start, snapshot.end);
    } catch {
      /* not all input types support selection */
    }
  }
}
