/** The day view: what you ate, what it adds up to, and what's left. */

import { html, raw, macroBar, macroValue, macroSummary, qtyText, measureText, relativeDay, formatDate,
  openSheet, closeSheet, toast } from '../ui.js';
import {
  getState, getDay, todayKey, shiftDate, addRecipeToDay, addIngredientToDay,
  updateEntry, removeEntry, lookupIngredient, lookupRecipe, saveRecipe,
} from '../store.js';
import { dayTotals, entryMacros, energySplit, MACRO_KEYS } from '../nutrition.js';
import { openRecipePicker, openIngredientPicker } from '../components/pickers.js';
import { renderItemsEditor, applyItemsAction, refreshItemsDisplay } from '../components/itemsEditor.js';
import { CATEGORIES } from '../data/recipes.js';
import { navigate } from '../router.js';

const SECTIONS = [...CATEGORIES, { id: 'extra', label: 'Extras', hint: 'anything else' }];

export function renderToday(params) {
  const dayKey = params.date || todayKey();
  const day = getDay(dayKey);
  const targets = getState().settings.targets;
  const totals = dayTotals(day.entries, lookupIngredient);
  const split = energySplit(totals);
  const remaining = targets.cal - totals.cal;

  const grouped = SECTIONS.map((section) => ({
    section,
    entries: day.entries.filter((e) => (e.category || 'extra') === section.id),
  })).filter((g) => g.entries.length);

  return html`
    <section class="view view--today">
      <nav class="date-nav">
        <button class="icon-btn" data-action="day-prev" aria-label="Previous day">‹</button>
        <div class="date-nav__label">
          <strong>${raw(relativeDay(dayKey, todayKey()))}</strong>
          <span class="muted">${raw(formatDate(dayKey))}</span>
        </div>
        <button class="icon-btn" data-action="day-next" aria-label="Next day">›</button>
      </nav>

      <div class="card summary">
        <div class="summary__headline">
          <div class="summary__cal">
            <span class="summary__cal-value">${raw(macroValue('cal', totals.cal))}</span>
            <span class="summary__cal-unit">cal</span>
          </div>
          <div class="summary__remaining ${raw(remaining < 0 ? 'is-over' : '')}">
            ${raw(remaining >= 0
              ? `${macroValue('cal', remaining)} left of ${macroValue('cal', targets.cal)}`
              : `${macroValue('cal', Math.abs(remaining))} over ${macroValue('cal', targets.cal)}`)}
          </div>
        </div>

        <div class="split-bar" role="img"
             aria-label="Energy split: ${raw(Math.round(split.protein))}% protein, ${raw(Math.round(split.carbs))}% carbs, ${raw(Math.round(split.fat))}% fat">
          <i class="split-bar__protein" style="width:${raw(split.protein.toFixed(1))}%"></i>
          <i class="split-bar__carbs" style="width:${raw(split.carbs.toFixed(1))}%"></i>
          <i class="split-bar__fat" style="width:${raw(split.fat.toFixed(1))}%"></i>
        </div>

        <div class="macro-bars">
          ${raw(MACRO_KEYS.filter((k) => k !== 'cal').map((k) => macroBar(k, totals[k], targets[k])).join(''))}
        </div>
      </div>

      <div class="add-row">
        <button class="btn btn--primary" data-action="add-recipe">+ Add meal</button>
        <button class="btn btn--ghost" data-action="add-ingredient">+ Add ingredient</button>
      </div>

      ${raw(day.entries.length ? renderSections(grouped) : renderEmpty())}
    </section>`;
}

function renderEmpty() {
  return html`
    <div class="empty-state">
      <p class="empty-state__title">Nothing logged yet.</p>
      <p class="muted">Add a meal from your rotation, or drop in a single ingredient for anything off-plan.</p>
    </div>`;
}

function renderSections(grouped) {
  return grouped
    .map(({ section, entries }) => html`
      <section class="day-section">
        <h3 class="day-section__title">
          ${section.label}
          <span class="muted">${section.hint}</span>
        </h3>
        <ul class="entry-list">
          ${raw(entries.map(renderEntry).join(''))}
        </ul>
      </section>`)
    .join('');
}

function renderEntry(entry) {
  const macros = entryMacros(entry, lookupIngredient);
  const isIngredient = entry.kind === 'ingredient';
  const item = entry.items[0];
  const ingredient = isIngredient && item ? lookupIngredient(item.ing) : null;
  const measure = ingredient ? ingredient.measures.find((m) => m.id === item.measure) : null;
  const measureLabel = measure ? measureText(item.qty, measure.label) : 'g';

  const portionControl = isIngredient
    ? html`
        <div class="stepper" role="group" aria-label="Quantity">
          <button class="stepper__btn" data-action="qty-down" data-entry="${entry.id}" aria-label="Less">−</button>
          <span class="stepper__value">${raw(qtyText(item ? item.qty : 0))} ${measureLabel}</span>
          <button class="stepper__btn" data-action="qty-up" data-entry="${entry.id}" aria-label="More">+</button>
        </div>`
    : html`
        <div class="stepper" role="group" aria-label="Servings">
          <button class="stepper__btn" data-action="serv-down" data-entry="${entry.id}" aria-label="Fewer servings">−</button>
          <span class="stepper__value">${raw(qtyText(entry.servings))} ${raw(entry.servings === 1 ? 'serving' : 'servings')}</span>
          <button class="stepper__btn" data-action="serv-up" data-entry="${entry.id}" aria-label="More servings">+</button>
        </div>`;

  const tweaked = entry.tweaked ? '<em class="badge">tweaked</em>' : '';

  return html`
    <li class="entry">
      <div class="entry__top">
        <button class="entry__main" data-action="open-entry" data-entry="${entry.id}">
          <span class="entry__name">${entry.name} ${raw(tweaked)}</span>
          <span class="entry__macros">${raw(macroSummary(macros, ['cal', 'protein', 'carbs', 'fibre']))}</span>
        </button>
        <button class="icon-btn icon-btn--sm" data-action="remove-entry" data-entry="${entry.id}"
                aria-label="Remove ${entry.name}">✕</button>
      </div>
      <div class="entry__side">${raw(portionControl)}</div>
    </li>`;
}

// ─── Interaction ─────────────────────────────────────────────────────────────

export function todayActions(event, params, rerender) {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  const dayKey = params.date || todayKey();
  const entryId = target.dataset.entry;

  switch (action) {
    case 'day-prev':
      navigate(`#/day/${shiftDate(dayKey, -1)}`);
      return;
    case 'day-next':
      navigate(`#/day/${shiftDate(dayKey, 1)}`);
      return;
    case 'add-recipe':
      openRecipePicker({
        onPick: (recipeId) => {
          const recipe = lookupRecipe(recipeId);
          addRecipeToDay(dayKey, recipeId, 1);
          toast(`${recipe.name} added`);
        },
      });
      return;
    case 'add-ingredient':
      openIngredientPicker({
        onPick: (ingredientId) => {
          const ingredient = lookupIngredient(ingredientId);
          const defaultQty = ingredient.defaultMeasure === 'g' ? 100 : 1;
          addIngredientToDay(dayKey, ingredientId, defaultQty, ingredient.defaultMeasure);
          toast(`${ingredient.name} added`);
        },
      });
      return;
    case 'serv-up':
    case 'serv-down': {
      const delta = action === 'serv-up' ? 0.5 : -0.5;
      updateEntry(dayKey, entryId, (e) => {
        e.servings = Math.max(0, Math.round((e.servings + delta) * 100) / 100);
      });
      return;
    }
    case 'qty-up':
    case 'qty-down': {
      updateEntry(dayKey, entryId, (e) => {
        const item = e.items[0];
        if (!item) return;
        const ingredient = lookupIngredient(item.ing);
        const measure = ingredient && ingredient.measures.find((m) => m.id === item.measure);
        // Grams move in 25s; countable things (an egg, a tin) move in halves.
        const step = measure && measure.grams === 1 ? 25 : 0.5;
        const delta = action === 'qty-up' ? step : -step;
        item.qty = Math.max(0, Math.round((Number(item.qty) + delta) * 100) / 100);
      });
      return;
    }
    case 'remove-entry': {
      const day = getDay(dayKey);
      const entry = day.entries.find((e) => e.id === entryId);
      if (entry && confirm(`Remove ${entry.name} from ${relativeDay(dayKey, todayKey()).toLowerCase()}?`)) {
        removeEntry(dayKey, entryId);
      }
      return;
    }
    case 'open-entry':
      openEntryEditor(dayKey, entryId, rerender);
      return;
    default:
  }
}

// ─── Entry editor ────────────────────────────────────────────────────────────

/**
 * Tweak one logged meal. Edits here apply to this day only — the entry carries
 * its own copy of the ingredients — with an explicit button to push the change
 * back into the recipe for future use.
 */
function openEntryEditor(dayKey, entryId, rerender) {
  const entry = getDay(dayKey).entries.find((e) => e.id === entryId);
  if (!entry) return;
  const items = entry.items.map((i) => ({ ...i }));
  const isRecipe = entry.kind === 'recipe';

  const sheet = openSheet({
    title: entry.name,
    body: '<div data-role="editor"></div>',
    actions: html`
      ${raw(isRecipe ? '<button class="btn btn--ghost" data-action="save-to-recipe">Save to recipes</button>' : '')}
      <button class="btn btn--primary" data-sheet-close>Done</button>`,
  });
  const body = sheet.querySelector('[data-role="editor"]');

  function commit() {
    updateEntry(dayKey, entryId, (e) => {
      e.items = items.map((i) => ({ ...i }));
      e.tweaked = true;
    });
  }

  function draw() {
    const current = getDay(dayKey).entries.find((e) => e.id === entryId) || entry;
    const servings = Number(current.servings) || 0;
    const makes = Number(current.makes) || 1;
    const eaten = entryMacros({ ...current, items }, lookupIngredient);

    body.innerHTML = html`
      ${raw(isRecipe ? html`
        <div class="editor-servings">
          <span>Servings eaten</span>
          <div class="stepper">
            <button class="stepper__btn" data-action="ed-serv-down" aria-label="Fewer">−</button>
            <span class="stepper__value">${raw(qtyText(servings))}</span>
            <button class="stepper__btn" data-action="ed-serv-up" aria-label="More">+</button>
          </div>
          <span class="muted">recipe makes ${raw(qtyText(makes))}</span>
        </div>` : '')}

      <div class="editor-eaten" data-role="eaten">
        <span>On your plate</span>
        <strong>${raw(macroSummary(eaten, ['cal', 'protein', 'carbs', 'fat', 'fibre']))}</strong>
      </div>

      ${raw(renderItemsEditor(items, {
        scope: 'entry',
        perLabel: isRecipe ? `Whole batch (${qtyText(makes)} servings)` : 'This ingredient',
      }))}

      <p class="hint">
        ${raw(isRecipe
          ? 'Changes here affect this day only. Use <strong>Save to recipes</strong> to keep them for next time.'
          : 'Adjust the amount to match what you actually ate.')}
      </p>`;
  }

  function refreshEaten() {
    const current = getDay(dayKey).entries.find((e) => e.id === entryId) || entry;
    const eaten = entryMacros({ ...current, items }, lookupIngredient);
    const el = body.querySelector('[data-role="eaten"] strong');
    if (el) el.textContent = macroSummary(eaten, ['cal', 'protein', 'carbs', 'fat', 'fibre']);
    refreshItemsDisplay(body, items, {
      perLabel: isRecipe ? `Whole batch (${qtyText(Number(current.makes) || 1)} servings)` : 'This ingredient',
    });
  }

  function handle(event) {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;

    if (action === 'ed-serv-up' || action === 'ed-serv-down') {
      const delta = action === 'ed-serv-up' ? 0.5 : -0.5;
      updateEntry(dayKey, entryId, (e) => {
        e.servings = Math.max(0, Math.round((e.servings + delta) * 100) / 100);
      });
      draw();
      return;
    }

    if (action === 'save-to-recipe') {
      commit();
      saveEntryAsRecipe(entry, items);
      return;
    }

    const result = applyItemsAction(items, event, () => {
      commit();
      draw();
    });
    if (result === 'live') {
      commit();
      refreshEaten();
    } else if (result === 'structural') {
      commit();
      draw();
    }
  }

  sheet.addEventListener('click', handle);
  sheet.addEventListener('input', (e) => {
    if (e.target.matches('[data-action="item-qty"]')) handle(e);
  });
  sheet.addEventListener('change', (e) => {
    if (e.target.matches('[data-action="item-measure"]')) handle(e);
  });

  draw();
}

/** Push a day-level tweak back into the recipe library. */
function saveEntryAsRecipe(entry, items) {
  const source = lookupRecipe(entry.sourceId);
  if (!source) {
    toast('That meal is no longer in your recipes.');
    return;
  }
  const choice = confirm(
    `Update "${source.name}" with these ingredients?\n\nOK = update it.\nCancel = save as a new recipe instead.`
  );
  const draft = { ...source, items: items.map((i) => ({ ...i })) };
  if (choice) {
    const saved = saveRecipe(draft, 'overwrite');
    toast(`${saved.name} updated`);
  } else {
    const name = prompt('Name for the new recipe', `${source.name} (my version)`);
    if (!name) return;
    const saved = saveRecipe({ ...draft, name }, 'new');
    toast(`${saved.name} saved`);
  }
  closeSheet();
}
