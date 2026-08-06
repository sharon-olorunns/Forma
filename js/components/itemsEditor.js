/**
 * The ingredient-list editor.
 *
 * Shared by the day-entry tweaker and the recipe editor, so "edit the
 * ingredients of tonight's dinner" and "edit the saved recipe" behave
 * identically. Callers own the array; this module renders it and applies
 * actions to it, then the caller re-renders.
 */

import { html, raw, esc, qtyText, macroValue } from '../ui.js';
import { lookupIngredient } from '../store.js';
import { itemMacros, itemsTotal, itemGrams } from '../nutrition.js';
import { openIngredientPicker } from './pickers.js';

/**
 * @param items  array of { ing, qty, measure, note? }
 * @param scope  unique string so focus keys don't collide between editors
 */
export function renderItemsEditor(items, { scope = 'items', perLabel = null, divisor = 1 } = {}) {
  const rows = items.map((item, index) => {
    const ingredient = lookupIngredient(item.ing);
    if (!ingredient) {
      return html`
        <li class="item-row item-row--missing">
          <span>Unknown ingredient (${item.ing})</span>
          <button class="icon-btn" data-action="item-remove" data-index="${index}" aria-label="Remove">✕</button>
        </li>`;
    }
    const macros = itemMacros(item, lookupIngredient);
    const grams = itemGrams(item, ingredient);
    const measures = ingredient.measures
      .map((m) => `<option value="${esc(m.id)}"${m.id === item.measure ? ' selected' : ''}>${esc(m.label)}</option>`)
      .join('');
    const gramsNote = ingredient.measures.length > 1 && item.measure !== 'g'
      ? html`<span class="item-row__grams">${raw(Math.round(grams))}g</span>` : '';
    return html`
      <li class="item-row">
        <div class="item-row__top">
          <span class="item-row__name">
            ${ingredient.name}
            ${raw(item.note ? `<em class="item-row__note">${esc(item.note)}</em>` : '')}
          </span>
          <button class="icon-btn" data-action="item-remove" data-index="${index}"
                  aria-label="Remove ${ingredient.name}">✕</button>
        </div>
        <div class="item-row__controls">
          <input class="input input--qty" type="number" step="0.25" min="0" inputmode="decimal"
                 value="${raw(qtyText(item.qty))}" data-action="item-qty" data-index="${index}"
                 data-fk="${scope}-qty-${index}" aria-label="Quantity of ${ingredient.name}" />
          <select class="input input--measure" data-action="item-measure" data-index="${index}"
                  data-fk="${scope}-measure-${index}" aria-label="Measure for ${ingredient.name}">
            ${raw(measures)}
          </select>
          ${raw(gramsNote)}
          <span class="item-row__macros">
            ${raw(macroValue('cal', macros.cal))} cal · ${raw(macroValue('protein', macros.protein))}g P
          </span>
        </div>
      </li>`;
  });

  const total = itemsTotal(items, lookupIngredient);

  return html`
    <div class="items-editor" data-scope="${scope}">
      <ul class="item-list">${raw(rows.join(''))}</ul>
      ${raw(items.length ? '' : '<p class="empty">No ingredients yet.</p>')}
      <button class="btn btn--ghost btn--block" data-action="item-add">+ Add ingredient</button>
      <div class="items-total">${raw(totalsMarkup(total, divisor > 0 ? divisor : 1, perLabel))}</div>
    </div>`;
}

/**
 * Update the numbers in an already-rendered editor without touching the inputs.
 * Typing in a quantity field must not blow away the field the user is typing in,
 * so quantity edits refresh in place instead of re-rendering.
 */
export function refreshItemsDisplay(root, items, { perLabel = null, divisor = 1 } = {}) {
  const container = root.querySelector('.items-editor');
  if (!container) return;
  container.querySelectorAll('.item-row').forEach((row, index) => {
    const item = items[index];
    if (!item) return;
    const ingredient = lookupIngredient(item.ing);
    const macros = itemMacros(item, lookupIngredient);
    const macroEl = row.querySelector('.item-row__macros');
    if (macroEl) {
      macroEl.textContent = `${macroValue('cal', macros.cal)} cal · ${macroValue('protein', macros.protein)}g P`;
    }
    const gramsEl = row.querySelector('.item-row__grams');
    if (gramsEl && ingredient) gramsEl.textContent = `${Math.round(itemGrams(item, ingredient))}g`;
  });
  const totalEl = container.querySelector('.items-total');
  if (totalEl) {
    const total = itemsTotal(items, lookupIngredient);
    const per = divisor > 0 ? divisor : 1;
    totalEl.innerHTML = totalsMarkup(total, per, perLabel);
  }
}

function totalsMarkup(total, divisor, perLabel) {
  const v = (key) => macroValue(key, total[key] / divisor);
  return html`
    <span>${raw(perLabel || 'Total')}</span>
    <span>
      <strong>${raw(v('cal'))}</strong> cal ·
      ${raw(v('protein'))}g P ·
      ${raw(v('carbs'))}g C ·
      ${raw(v('fat'))}g F ·
      ${raw(v('fibre'))}g fibre
    </span>`;
}

/**
 * Apply an interaction to the items array.
 * Returns 'live' (numbers only), 'structural' (host should re-render),
 * or null (not ours / handled asynchronously).
 */
export function applyItemsAction(items, event, onChange) {
  const target = event.target.closest('[data-action]');
  if (!target) return null;
  const action = target.dataset.action;
  const index = Number(target.dataset.index);

  switch (action) {
    case 'item-qty': {
      const value = Number(target.value);
      items[index].qty = Number.isFinite(value) && value >= 0 ? value : 0;
      return 'live';
    }
    case 'item-measure':
      items[index].measure = target.value;
      return 'live';
    case 'item-remove':
      items.splice(index, 1);
      return 'structural';
    case 'item-add':
      openIngredientPicker({
        onPick: (ingredientId) => {
          const ingredient = lookupIngredient(ingredientId);
          if (!ingredient) return;
          items.push({ ing: ingredientId, qty: 1, measure: ingredient.defaultMeasure });
          onChange();
        },
      });
      return null;
    default:
      return null;
  }
}

/** Actions this editor owns, so hosts can ignore them in their own handlers. */
export const ITEM_ACTIONS = new Set(['item-qty', 'item-measure', 'item-remove', 'item-add']);
