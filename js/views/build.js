/**
 * The builder — the centre of the app.
 *
 * Search a food, add it, adjust the amount, watch the numbers move. The running
 * total is always visible, along with what the meal would do to the rest of
 * your day.
 */

import {
  html, raw, esc, bigValue, macroValue, qtyText, shortAmount, amountText,
  toast, openSheet, closeSheet,
} from '../ui.js';
import {
  getState, getDraft, setDraft, clearDraft, updateQuiet, searchFoods, lookupFood,
  saveFood, saveMeal, logMeal, updateLoggedEntry, getDay, todayKey, uid, getMeal,
} from '../store.js';
import {
  itemsTotal, itemMacros, itemGrams, findMeasure, dayTotals, scaleMacros,
  addMacros, against, MACRO_KEYS, MACRO_META,
} from '../nutrition.js';
import { navigate } from '../router.js';

/** Search text lives outside the store — it's UI state, not data. */
let query = '';
let showAllMacros = false;

export function renderBuild() {
  const draft = getDraft();
  const targets = getState().settings.targets;
  const batch = itemsTotal(draft.items, lookupFood);
  const makes = Number(draft.makes) > 0 ? Number(draft.makes) : 1;
  const perServing = scaleMacros(batch, 1 / makes);
  const eating = scaleMacros(perServing, Number(draft.servings) || 1);

  const dayKey = todayKey();
  const already = dayTotals(getDay(dayKey).entries, lookupFood);
  const projected = addMacros(already, eating);
  const status = against(projected, targets);

  const results = query.trim() ? searchFoods(query, { limit: 25 }) : [];
  const editing = Boolean(draft.editingEntry);

  return html`
    <section class="view view--build">
      <div class="build__search">
        <input class="input input--search" type="search" data-action="food-search" data-fk="food-search"
               placeholder="Add a food…"
               value="${query}" autocomplete="off" enterkeyhint="search" />
        ${raw(query.trim() ? '<button class="icon-btn input__clear" data-action="clear-search" aria-label="Clear">✕</button>' : '')}
      </div>

      ${raw(query.trim() ? renderResults(results) : renderMeal(draft, batch, perServing, eating, makes, status, editing))}
    </section>`;
}

function renderResults(results) {
  if (!results.length) {
    return html`
      <div class="empty-state">
        <p class="empty-state__title">Nothing found.</p>
        <p class="muted">Add it yourself and Forma will remember it.</p>
        <button class="btn btn--primary" data-action="new-food">+ Add a new food</button>
      </div>`;
  }
  return html`
    <ul class="result-list">
      ${raw(results.map((food) => {
        const measure = findMeasure(food, food.defaultMeasure);
        const per = measure.grams === 1 ? 100 : measure.grams;
        const cal = Math.round((food.per100.cal * per) / 100);
        const protein = macroValue('protein', (food.per100.protein * per) / 100);
        const unit = measure.grams === 1 ? '100g' : measure.label;
        return html`
          <li>
            <button class="result" data-action="add-food" data-id="${food.id}">
              <span class="result__main">
                <span class="result__name">${food.name}</span>
                <span class="result__meta">${raw(cal)} cal · ${raw(protein)}g protein <span class="muted">per ${unit}</span></span>
              </span>
              <span class="result__plus" aria-hidden="true">+</span>
            </button>
          </li>`;
      }).join(''))}
      <li class="result-list__foot">
        <button class="btn btn--ghost btn--block" data-action="new-food">Not here? Add it yourself</button>
      </li>
    </ul>`;
}

function renderMeal(draft, batch, perServing, eating, makes, status, editing) {
  if (!draft.items.length) {
    return html`
      <div class="empty-state empty-state--build">
        <p class="empty-state__title">Build a meal.</p>
        <p class="muted">Search above and add what's going on the plate. The numbers add up as you go.</p>
      </div>`;
  }

  const rows = draft.items.map((item, index) => {
    const food = lookupFood(item.ing);
    if (!food) {
      return html`
        <li class="line line--missing">
          <span>Unknown food</span>
          <button class="icon-btn" data-action="remove-item" data-index="${index}" aria-label="Remove">✕</button>
        </li>`;
    }
    const macros = itemMacros(item, lookupFood);
    const measure = findMeasure(food, item.measure);
    const step = measure.grams === 1 ? 10 : 0.5;
    return html`
      <li class="line">
        <button class="line__body" data-action="edit-item" data-index="${index}">
          <span class="line__name">${food.name}</span>
          <span class="line__amount">${raw(amountText(item.qty, measure))}</span>
        </button>
        <span class="line__cal">${raw(bigValue(macros.cal))}</span>
        <span class="line__steppers">
          <button class="step" data-action="dec-item" data-index="${index}" data-step="${raw(step)}" aria-label="Less ${food.name}">−</button>
          <button class="step" data-action="inc-item" data-index="${index}" data-step="${raw(step)}" aria-label="More ${food.name}">+</button>
        </span>
        <button class="icon-btn icon-btn--sm" data-action="remove-item" data-index="${index}" aria-label="Remove ${food.name}">✕</button>
      </li>`;
  });

  return html`
    <div class="meal">
      <label class="meal__name">
        <span>Meal name <em class="muted">optional</em></span>
        <input class="input input--title" data-action="meal-name" data-fk="meal-name"
               value="${draft.name}" placeholder="e.g. Sweet potato + chicken" />
      </label>

      <ul class="line-list">${raw(rows.join(''))}</ul>

      <div class="portions">
        <div class="portions__row">
          <span>Makes</span>
          <span class="stepper">
            <button class="step" data-action="makes-down" aria-label="Fewer portions">−</button>
            <b>${raw(qtyText(makes))}</b>
            <button class="step" data-action="makes-up" aria-label="More portions">+</button>
          </span>
          <span class="muted">${raw(makes === 1 ? 'just this plate' : 'portions from this batch')}</span>
        </div>
        ${raw(makes > 1 ? html`
          <div class="portions__row">
            <span>Eating</span>
            <span class="stepper">
              <button class="step" data-action="servings-down" aria-label="Fewer servings">−</button>
              <b>${raw(qtyText(draft.servings))}</b>
              <button class="step" data-action="servings-up" aria-label="More servings">+</button>
            </span>
            <span class="muted">of them now</span>
          </div>` : '')}
      </div>
    </div>

    ${raw(renderTotals(eating, status, showAllMacros))}

    <div class="build__actions">
      <button class="btn btn--primary btn--lg" data-action="log-meal">
        ${raw(editing ? 'Save changes' : 'Log this meal')}
      </button>
      <div class="build__actions-row">
        <button class="btn btn--ghost" data-action="save-meal">${raw(draft.savedId ? 'Update saved meal' : 'Save for later')}</button>
        <button class="btn btn--ghost" data-action="clear-meal">Clear</button>
      </div>
    </div>`;
}

/** The running total, plus what it does to the day. */
function renderTotals(eating, status, expanded) {
  return html`
    <div class="totals" data-role="totals">
      <div class="totals__head">
        <div class="totals__cal">
          <span class="totals__cal-value">${raw(bigValue(eating.cal))}</span>
          <span class="totals__cal-unit">cal</span>
        </div>
        <button class="link-btn" data-action="toggle-macros">
          ${raw(expanded ? 'Hide day impact' : 'Show day impact')}
        </button>
      </div>

      <div class="totals__macros">
        ${raw(['protein', 'carbs', 'fat', 'fibre'].map((k) => html`
          <div class="chip-macro" data-macro="${k}">
            <span class="chip-macro__value">${raw(macroValue(k, eating[k]))}g</span>
            <span class="chip-macro__label">${raw(MACRO_META[k].short)}</span>
          </div>`).join(''))}
      </div>

      ${raw(expanded ? html`
        <div class="totals__day">
          <p class="totals__day-title">After this meal, your day stands at</p>
          ${raw(MACRO_KEYS.map((k) => {
            const s = status[k];
            const label = MACRO_META[k].short;
            const unit = MACRO_META[k].unit;
            const state = s.over ? 'is-over' : s.pct >= 90 ? 'is-hit' : '';
            return html`
              <div class="day-line ${raw(state)}" data-macro="${k}">
                <span class="day-line__label">${label}</span>
                <span class="day-line__track"><i style="width:${raw(Math.min(s.pct, 100).toFixed(1))}%"></i></span>
                <span class="day-line__value">
                  ${raw(s.over
                    ? `${macroValue(k, -s.remaining)}${unit} over`
                    : `${macroValue(k, s.remaining)}${unit} left`)}
                </span>
              </div>`;
          }).join(''))}
        </div>` : '')}
    </div>`;
}

// ─── Interaction ─────────────────────────────────────────────────────────────

export function buildActions(event, rerender) {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  const draft = getDraft();
  const index = Number(target.dataset.index);

  switch (action) {
    case 'clear-search':
      query = '';
      rerender();
      return;

    case 'add-food': {
      const food = lookupFood(target.dataset.id);
      if (!food) return;
      const measure = findMeasure(food, food.defaultMeasure);
      draft.items.push({
        ing: food.id,
        qty: measure.grams === 1 ? 100 : 1,
        measure: measure.id,
      });
      query = '';
      setDraft(draft);
      toast(`${food.name} added`);
      return;
    }

    case 'new-food':
      openNewFoodForm(query, (foodId) => {
        const food = lookupFood(foodId);
        const measure = findMeasure(food, food.defaultMeasure);
        draft.items.push({ ing: foodId, qty: measure.grams === 1 ? 100 : 1, measure: measure.id });
        query = '';
        setDraft(draft);
      });
      return;

    case 'inc-item':
    case 'dec-item': {
      const item = draft.items[index];
      if (!item) return;
      const step = Number(target.dataset.step) || 1;
      const delta = action === 'inc-item' ? step : -step;
      item.qty = Math.max(0, Math.round((Number(item.qty) + delta) * 100) / 100);
      setDraft(draft);
      return;
    }

    case 'remove-item':
      draft.items.splice(index, 1);
      setDraft(draft);
      return;

    case 'edit-item':
      openAmountEditor(index, rerender);
      return;

    case 'makes-up':
    case 'makes-down': {
      const delta = action === 'makes-up' ? 1 : -1;
      draft.makes = Math.max(1, (Number(draft.makes) || 1) + delta);
      if (draft.servings > draft.makes) draft.servings = draft.makes;
      setDraft(draft);
      return;
    }

    case 'servings-up':
    case 'servings-down': {
      const delta = action === 'servings-up' ? 0.5 : -0.5;
      draft.servings = Math.max(0.5, Math.round(((Number(draft.servings) || 1) + delta) * 100) / 100);
      setDraft(draft);
      return;
    }

    case 'toggle-macros':
      showAllMacros = !showAllMacros;
      rerender();
      return;

    case 'log-meal': {
      if (!draft.items.length) {
        toast('Add something first.');
        return;
      }
      if (draft.editingEntry) {
        const { dayKey, entryId } = draft.editingEntry;
        updateLoggedEntry(dayKey, entryId, draft);
        toast('Meal updated');
        navigate(`#/day/${dayKey}`);
        return;
      }
      logMeal(todayKey(), draft);
      toast('Logged');
      navigate(`#/day/${todayKey()}`);
      return;
    }

    case 'save-meal': {
      if (!draft.items.length) {
        toast('Add something first.');
        return;
      }
      openSaveMealSheet(draft);
      return;
    }

    case 'clear-meal':
      if (!draft.items.length || confirm('Clear this meal?')) {
        query = '';
        clearDraft();
      }
      return;

    default:
  }
}

export function buildInput(event, rerender) {
  const target = event.target.closest('[data-action]');
  if (!target) return;

  if (target.dataset.action === 'food-search') {
    query = target.value;
    rerender();
    return;
  }

  if (target.dataset.action === 'meal-name') {
    // Quiet: renaming shouldn't re-render and steal the caret.
    updateQuiet((s) => {
      if (s.draft) s.draft.name = target.value;
    });
  }
}

/** Reset transient view state when the builder is opened fresh. */
export function resetBuildView() {
  query = '';
}

// ─── Amount editor ───────────────────────────────────────────────────────────

function openAmountEditor(index, rerender) {
  const draft = getDraft();
  const item = draft.items[index];
  if (!item) return;
  const food = lookupFood(item.ing);
  if (!food) return;

  const sheet = openSheet({
    title: food.name,
    body: html`
      <div class="amount-editor">
        <label class="field">
          <span>Amount</span>
          <div class="amount-editor__row">
            <input class="input input--qty" type="number" min="0" step="0.25" inputmode="decimal"
                   value="${raw(qtyText(item.qty))}" data-role="qty" data-fk="amount-qty" />
            <select class="input" data-role="measure">
              ${raw(food.measures.map((m) => html`
                <option value="${m.id}"${raw(m.id === item.measure ? ' selected' : '')}>${m.label}</option>`).join(''))}
            </select>
          </div>
        </label>
        <div class="amount-editor__preview" data-role="preview"></div>
        <p class="hint">Per 100g: ${raw(bigValue(food.per100.cal))} cal ·
          ${raw(macroValue('protein', food.per100.protein))}g protein ·
          ${raw(macroValue('carbs', food.per100.carbs))}g carbs ·
          ${raw(macroValue('fat', food.per100.fat))}g fat ·
          ${raw(macroValue('fibre', food.per100.fibre))}g fibre</p>
      </div>`,
    actions: html`
      <button class="btn btn--ghost" data-role="remove">Remove</button>
      <button class="btn btn--primary" data-role="done">Done</button>`,
  });

  const qtyEl = sheet.querySelector('[data-role="qty"]');
  const measureEl = sheet.querySelector('[data-role="measure"]');
  const previewEl = sheet.querySelector('[data-role="preview"]');

  function preview() {
    const probe = { ing: item.ing, qty: Number(qtyEl.value) || 0, measure: measureEl.value };
    const macros = itemMacros(probe, lookupFood);
    const grams = itemGrams(probe, food);
    previewEl.innerHTML = html`
      <strong>${raw(bigValue(macros.cal))}</strong> cal
      <span class="muted">· ${raw(macroValue('protein', macros.protein))}g P
        · ${raw(macroValue('carbs', macros.carbs))}g C
        · ${raw(macroValue('fat', macros.fat))}g F
        · ${raw(macroValue('fibre', macros.fibre))}g fibre
        · ${raw(Math.round(grams))}g</span>`;
  }

  function commit() {
    item.qty = Math.max(0, Number(qtyEl.value) || 0);
    item.measure = measureEl.value;
    setDraft(draft);
  }

  qtyEl.addEventListener('input', preview);
  measureEl.addEventListener('change', preview);
  sheet.querySelector('[data-role="done"]').addEventListener('click', () => {
    commit();
    closeSheet();
  });
  sheet.querySelector('[data-role="remove"]').addEventListener('click', () => {
    draft.items.splice(index, 1);
    setDraft(draft);
    closeSheet();
  });

  preview();
  qtyEl.focus();
  qtyEl.select();
}

// ─── Save meal ───────────────────────────────────────────────────────────────

function openSaveMealSheet(draft) {
  const existing = draft.savedId ? getMeal(draft.savedId) : null;
  const sheet = openSheet({
    title: 'Save this meal',
    body: html`
      <label class="field">
        <span>Name</span>
        <input class="input" data-role="name" data-fk="save-name"
               value="${draft.name}" placeholder="e.g. Sweet potato + chicken" />
      </label>
      <p class="hint">Saved meals live in your library. Tap one to log it again, or open it in the
        builder to tweak before logging.</p>`,
    actions: html`
      ${raw(existing ? '<button class="btn btn--ghost" data-role="save-new">Save as new</button>' : '')}
      <button class="btn btn--primary" data-role="save">${raw(existing ? 'Update' : 'Save')}</button>`,
  });

  const nameEl = sheet.querySelector('[data-role="name"]');

  function doSave(overwrite) {
    const name = nameEl.value.trim();
    if (!name) {
      toast('Give it a name first.');
      nameEl.focus();
      return;
    }
    draft.name = name;
    const saved = saveMeal(draft, { overwrite });
    draft.savedId = saved.id;
    setDraft(draft);
    closeSheet();
    toast(`${saved.name} saved`);
  }

  sheet.querySelector('[data-role="save"]').addEventListener('click', () => doSave(Boolean(existing)));
  const saveNew = sheet.querySelector('[data-role="save-new"]');
  if (saveNew) saveNew.addEventListener('click', () => doSave(false));

  nameEl.focus();
  if (!nameEl.value) nameEl.placeholder = 'e.g. Sweet potato + chicken';
}

// ─── New food ────────────────────────────────────────────────────────────────

export function openNewFoodForm(name = '', onCreated) {
  const fields = [
    ['cal', 'Calories'],
    ['protein', 'Protein (g)'],
    ['carbs', 'Carbs (g)'],
    ['fat', 'Fat (g)'],
    ['fibre', 'Fibre (g)'],
  ];
  const sheet = openSheet({
    title: 'Add a food',
    body: html`
      <form class="form" data-role="form">
        <label class="field">
          <span>Name</span>
          <input class="input" name="name" value="${name}" placeholder="e.g. Halloumi" required />
        </label>
        <p class="hint">Everything below is <strong>per 100g</strong> — copy it straight off the packet.</p>
        <div class="grid-2">
          ${raw(fields.map(([key, label]) => html`
            <label class="field">
              <span>${label}</span>
              <input class="input" name="${key}" type="number" step="0.1" min="0" value="0" inputmode="decimal" />
            </label>`).join(''))}
        </div>
        <label class="field">
          <span>Handy measure <em class="muted">(optional)</em></span>
          <div class="grid-2">
            <input class="input" name="measureLabel" placeholder="slice" />
            <input class="input" name="measureGrams" type="number" step="0.1" min="0" placeholder="grams" inputmode="decimal" />
          </div>
        </label>
      </form>`,
    actions: html`<button class="btn btn--primary btn--block" data-role="save">Save food</button>`,
  });

  const form = sheet.querySelector('[data-role="form"]');
  sheet.querySelector('[data-role="save"]').addEventListener('click', () => {
    const data = Object.fromEntries(new FormData(form).entries());
    if (!data.name.trim()) {
      toast('Give it a name first.');
      return;
    }
    const measures = [];
    if (data.measureLabel.trim() && Number(data.measureGrams) > 0) {
      measures.push({ id: 'unit', label: data.measureLabel.trim(), grams: Number(data.measureGrams) });
    }
    measures.push({ id: 'g', label: 'g', grams: 1 });

    const food = {
      id: uid('f'),
      name: data.name.trim(),
      group: 'My foods',
      per100: {
        cal: Number(data.cal) || 0,
        protein: Number(data.protein) || 0,
        carbs: Number(data.carbs) || 0,
        fat: Number(data.fat) || 0,
        fibre: Number(data.fibre) || 0,
      },
      measures,
      defaultMeasure: measures[0].id,
      userCreated: true,
    };
    saveFood(food);
    closeSheet();
    toast(`${food.name} added`);
    if (onCreated) onCreated(food.id);
  });
}
