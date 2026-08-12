/**
 * The saved-meal library.
 *
 * Tiles rather than a list: each meal gets a poster whose colours come from its
 * own macro split, so protein-heavy meals read green and carb-heavy ones blue
 * and you find things by shape rather than by reading every name.
 */

import {
  html, raw, esc, bigValue, macroValue, macroGradient, toast, openSheet, closeSheet,
} from '../ui.js';
import {
  allMeals, getMeal, lookupFood, quickLog, todayKey, touchMeal, toggleFavourite,
  deleteMeal, renameMeal, draftFromMeal,
} from '../store.js';
import { perServing, energySplit, findMeasure, itemMacros } from '../nutrition.js';
import { navigate } from '../router.js';

let query = '';

export function renderSaved() {
  const q = query.trim().toLowerCase();
  const meals = allMeals().filter((m) => !q || m.name.toLowerCase().includes(q));

  if (!allMeals().length) {
    return html`
      <section class="view view--saved">
        <div class="empty-state">
          <p class="empty-state__title">No saved meals yet.</p>
          <p class="muted">When a meal's numbers work, save it from the builder. It'll live here,
            one tap from being logged again.</p>
          <button class="btn btn--primary" data-action="go-build">+ Build a meal</button>
        </div>
      </section>`;
  }

  return html`
    <section class="view view--saved">
      <div class="build__search">
        <input class="input input--search" type="search" data-action="saved-search" data-fk="saved-search"
               placeholder="Search saved meals…" value="${query}" autocomplete="off" />
      </div>

      ${raw(meals.length ? html`
        <div class="tile-grid">
          ${raw(meals.map(renderTile).join(''))}
        </div>` : '<p class="empty">Nothing matches that.</p>')}
    </section>`;
}

function renderTile(meal) {
  const per = perServing(meal, lookupFood);
  const split = energySplit(per);
  return html`
    <article class="tile">
      <button class="tile__poster" data-action="open-meal" data-id="${meal.id}"
              style="background-image:${raw(macroGradient(split))}" aria-label="Open ${meal.name}">
        <span class="tile__cal">${raw(bigValue(per.cal))}<em>cal</em></span>
        ${raw(meal.favourite ? '<span class="tile__star" aria-label="Favourite">★</span>' : '')}
      </button>
      <div class="tile__body">
        <button class="tile__name" data-action="open-meal" data-id="${meal.id}">${meal.name}</button>
        <p class="tile__macros">
          ${raw(macroValue('protein', per.protein))}g P ·
          ${raw(macroValue('carbs', per.carbs))}g C ·
          ${raw(macroValue('fibre', per.fibre))}g fibre
        </p>
        <button class="btn btn--sm btn--primary tile__log" data-action="quick-log" data-id="${meal.id}">Log it</button>
      </div>
    </article>`;
}

// ─── Detail sheet ────────────────────────────────────────────────────────────

function openMealSheet(id) {
  const meal = getMeal(id);
  if (!meal) return;
  const per = perServing(meal, lookupFood);

  const lines = meal.items.map((item) => {
    const food = lookupFood(item.ing);
    if (!food) return html`<li class="muted">Unknown food</li>`;
    const measure = findMeasure(food, item.measure);
    const macros = itemMacros(item, lookupFood);
    const amount = measure.grams === 1
      ? `${item.qty}g`
      : `${item.qty} ${measure.label}`;
    return html`
      <li>
        <span class="readout__amount">${raw(amount)}</span>
        <span class="readout__name">${food.name}</span>
        <span class="readout__cal muted">${raw(bigValue(macros.cal))}</span>
      </li>`;
  });

  const sheet = openSheet({
    title: meal.name,
    body: html`
      <div class="meal-detail">
        <div class="macro-grid">
          ${raw(['cal', 'protein', 'carbs', 'fat', 'fibre'].map((k) => html`
            <div class="macro-cell" data-macro="${k}">
              <span class="macro-cell__value">${raw(k === 'cal' ? bigValue(per.cal) : macroValue(k, per[k]))}${raw(k === 'cal' ? '' : 'g')}</span>
              <span class="macro-cell__label">${raw(k === 'cal' ? 'calories' : k)}</span>
            </div>`).join(''))}
        </div>
        ${raw(meal.makes > 1 ? html`<p class="hint">Figures are per portion — this batch makes ${raw(meal.makes)}.</p>` : '')}

        <h4 class="section-title">Ingredients</h4>
        <ul class="readout">${raw(lines.join(''))}</ul>

        <div class="meal-detail__manage">
          <button class="btn btn--ghost btn--sm" data-role="favourite">
            ${raw(meal.favourite ? '★ Favourited' : '☆ Favourite')}
          </button>
          <button class="btn btn--ghost btn--sm" data-role="rename">Rename</button>
          <button class="btn btn--ghost btn--sm btn--danger" data-role="delete">Delete</button>
        </div>
      </div>`,
    actions: html`
      <button class="btn btn--ghost" data-role="tweak">Open in builder</button>
      <button class="btn btn--primary" data-role="log">Log it</button>`,
  });

  sheet.querySelector('[data-role="log"]').addEventListener('click', () => {
    quickLog(todayKey(), meal.id, 1);
    touchMeal(meal.id);
    closeSheet();
    toast(`${meal.name} logged`);
    navigate(`#/day/${todayKey()}`);
  });

  sheet.querySelector('[data-role="tweak"]').addEventListener('click', () => {
    draftFromMeal(meal.id);
    closeSheet();
    navigate('#/build');
  });

  sheet.querySelector('[data-role="favourite"]').addEventListener('click', () => {
    toggleFavourite(meal.id);
    closeSheet();
  });

  sheet.querySelector('[data-role="rename"]').addEventListener('click', () => {
    const name = prompt('Rename meal', meal.name);
    if (name && name.trim()) {
      renameMeal(meal.id, name);
      closeSheet();
      toast('Renamed');
    }
  });

  sheet.querySelector('[data-role="delete"]').addEventListener('click', () => {
    if (!confirm(`Delete "${meal.name}"? Days you've already logged keep their own copy.`)) return;
    deleteMeal(meal.id);
    closeSheet();
    toast('Deleted');
  });
}

// ─── Interaction ─────────────────────────────────────────────────────────────

export function savedActions(event) {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  const id = target.dataset.id;

  switch (action) {
    case 'go-build':
      navigate('#/build');
      return;
    case 'open-meal':
      openMealSheet(id);
      return;
    case 'quick-log': {
      const meal = getMeal(id);
      if (!meal) return;
      quickLog(todayKey(), id, 1);
      touchMeal(id);
      toast(`${meal.name} logged`);
      navigate(`#/day/${todayKey()}`);
      return;
    }
    default:
  }
}

export function savedInput(event, rerender) {
  const target = event.target.closest('[data-action="saved-search"]');
  if (!target) return;
  query = target.value;
  rerender();
}
