/** Small rendering + formatting helpers shared by every view. */

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

/** Tagged template that escapes every interpolated value. Use html`` for markup. */
export function html(strings, ...values) {
  return strings.reduce((out, chunk, i) => {
    if (i === 0) return chunk;
    const value = values[i - 1];
    const rendered = Array.isArray(value) ? value.join('') : value;
    // `raw` marks pre-escaped markup built by another html`` call.
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

/** Format a macro value with its conventional precision. */
export function macroValue(key, value) {
  const meta = MACRO_META[key];
  const decimals = meta ? meta.decimals : 0;
  const n = round(value, decimals);
  return decimals === 0 ? n.toLocaleString('en-GB') : String(n);
}

export function macroText(key, value) {
  const meta = MACRO_META[key];
  return `${macroValue(key, value)}${meta ? meta.unit : ''}`;
}

/** "1", "1.5", "0.25" — quantities read better without trailing zeros. */
export function qtyText(value) {
  const n = Number(value) || 0;
  return String(round(n, 2));
}

/** Abbreviations and mass nouns that must not gain an "s". */
const NEVER_PLURAL = new Set(['g', 'ml', 'tbsp', 'tsp', 'heaped tbsp', 'to taste', 'splash', 'each']);

/** "2 eggs", "1 egg", "2 tbsp" — pluralise measure labels where it reads naturally. */
export function measureText(qty, label) {
  if (Number(qty) <= 1 || NEVER_PLURAL.has(label)) return label;
  if (label.endsWith('s') || label.endsWith('h')) return `${label}es`;
  if (label === 'half') return 'halves';
  return `${label}s`;
}

/** "4 eggs (200g)" / "200g" — the amount as you'd say it out loud. */
export function amountText(qty, measure) {
  if (!measure || measure.grams === 1) return `${qtyText(qty)}g`;
  const grams = Math.round(qty * measure.grams);
  return `${qtyText(qty)} ${measureText(qty, measure.label)} (${grams}g)`;
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

/** A labelled progress bar for one macro against its target. */
export function macroBar(key, value, target) {
  const meta = MACRO_META[key];
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0;
  const over = target > 0 && value > target * 1.05;
  return html`
    <div class="macro-bar ${raw(over ? 'is-over' : '')}" data-macro="${key}">
      <div class="macro-bar__head">
        <span class="macro-bar__label">${meta.short}</span>
        <span class="macro-bar__value">
          <strong>${raw(macroValue(key, value))}</strong>
          <span class="muted">/ ${raw(macroValue(key, target))}${meta.unit}</span>
        </span>
      </div>
      <div class="macro-bar__track"><i style="width:${raw(pct.toFixed(1))}%"></i></div>
    </div>`;
}

/** Compact macro line used on cards: "780 cal · 50g P · 9g fibre". */
export function macroSummary(macros, keys = ['cal', 'protein', 'fibre']) {
  return keys
    .map((k) => {
      if (k === 'cal') return `${macroValue('cal', macros.cal)} cal`;
      const initial = { protein: 'P', carbs: 'C', fat: 'F', fibre: 'fibre' }[k];
      return `${macroValue(k, macros[k])}g ${initial}`;
    })
    .join(' · ');
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

/**
 * Modal sheet. Returns the sheet element so callers can wire up their own
 * controls; resolves/removes on close.
 */
export function openSheet({ title, body, actions = '' }) {
  closeSheet();
  const wrap = document.createElement('div');
  wrap.className = 'sheet-backdrop';
  wrap.id = 'sheet';
  wrap.innerHTML = html`
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${title}">
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
 * without this, typing in a quantity field would lose focus on every keystroke.
 */
export function captureFocus() {
  const active = document.activeElement;
  if (!active || !active.dataset || !active.dataset.fk) return null;
  return {
    key: active.dataset.fk,
    start: active.selectionStart,
    end: active.selectionEnd,
  };
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
