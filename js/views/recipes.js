/** Recipe library: browse, read, and add to a day. */

import { html, raw, esc, macroValue, macroSummary, qtyText, amountText, toast } from '../ui.js';
import { allRecipes, lookupRecipe, lookupIngredient, addRecipeToDay, todayKey,
  archiveRecipe, deleteRecipe, revertRecipe, isUserRecipe } from '../store.js';
import { perServing, itemMacros, itemsTotal } from '../nutrition.js';
import { CATEGORIES } from '../data/recipes.js';
import { navigate } from '../router.js';

let activeFilter = 'all';
let query = '';

export function renderRecipes() {
  const q = query.trim().toLowerCase();
  const recipes = allRecipes().filter((r) => {
    if (activeFilter !== 'all' && r.category !== activeFilter) return false;
    if (!q) return true;
    return r.name.toLowerCase().includes(q) || (r.blurb || '').toLowerCase().includes(q);
  });

  const byCategory = CATEGORIES.map((c) => ({
    category: c,
    recipes: recipes.filter((r) => r.category === c.id),
  })).filter((g) => g.recipes.length);

  const orphans = recipes.filter((r) => !CATEGORIES.some((c) => c.id === r.category));
  if (orphans.length) byCategory.push({ category: { id: 'other', label: 'Other', hint: '' }, recipes: orphans });

  return html`
    <section class="view view--recipes">
      <div class="toolbar">
        <input class="input" type="search" placeholder="Search recipes…" value="${query}"
               data-action="recipe-search" data-fk="recipe-search" autocomplete="off" />
        <button class="btn btn--primary btn--sm" data-action="recipe-new">+ New</button>
      </div>

      <div class="chips">
        <button class="chip ${raw(activeFilter === 'all' ? 'is-active' : '')}" data-action="recipe-filter" data-filter="all">All</button>
        ${raw(CATEGORIES.map((c) => html`
          <button class="chip ${raw(activeFilter === c.id ? 'is-active' : '')}" data-action="recipe-filter" data-filter="${c.id}">${c.label}</button>`).join(''))}
      </div>

      ${raw(byCategory.length
        ? byCategory.map(renderGroup).join('')
        : '<p class="empty">No recipes match. Try a different search.</p>')}
    </section>`;
}

function renderGroup({ category, recipes }) {
  return html`
    <section class="recipe-group">
      <h3 class="day-section__title">${category.label} <span class="muted">${category.hint}</span></h3>
      <ul class="recipe-list">${raw(recipes.map(renderCard).join(''))}</ul>
    </section>`;
}

function renderCard(recipe) {
  const macros = perServing(recipe, lookupIngredient);
  const badge = recipe.basedOn ? 'edited' : recipe.userCreated ? 'mine' : '';
  return html`
    <li class="recipe-card">
      <button class="recipe-card__main" data-action="open-recipe" data-id="${recipe.id}">
        <span class="recipe-card__title">
          ${recipe.name}
          ${raw(badge ? `<em class="badge">${badge}</em>` : '')}
        </span>
        <span class="recipe-card__macros">${raw(macroSummary(macros, ['cal', 'protein', 'carbs', 'fibre']))}</span>
        <span class="recipe-card__meta">
          ${raw(recipe.makes > 1 ? `makes ${qtyText(recipe.makes)}` : 'single serving')}
          ${raw((recipe.tags || []).map((t) => `<em class="tag">${esc(t)}</em>`).join(''))}
        </span>
      </button>
      <button class="btn btn--sm btn--ghost recipe-card__add" data-action="quick-add" data-id="${recipe.id}">Add</button>
    </li>`;
}

// ─── Detail ──────────────────────────────────────────────────────────────────

export function renderRecipeDetail(params) {
  const recipe = lookupRecipe(params.id);
  if (!recipe) {
    return html`<section class="view"><p class="empty">That recipe no longer exists.</p></section>`;
  }
  const per = perServing(recipe, lookupIngredient);
  const batch = itemsTotal(recipe.items, lookupIngredient);
  const isUser = isUserRecipe(recipe.id);

  return html`
    <section class="view view--recipe">
      <header class="detail-head">
        <button class="link-btn" data-action="back-to-recipes">‹ Recipes</button>
        <h2>${recipe.name}</h2>
        ${raw(recipe.blurb ? html`<p class="muted">${recipe.blurb}</p>` : '')}
        <div class="detail-tags">
          ${raw((recipe.tags || []).map((t) => `<em class="tag">${esc(t)}</em>`).join(''))}
          ${raw(recipe.makes > 1 ? `<em class="tag">makes ${qtyText(recipe.makes)}</em>` : '')}
        </div>
      </header>

      <div class="card macro-panel">
        <h3>Per serving</h3>
        <div class="macro-grid">
          ${raw(['cal', 'protein', 'carbs', 'fat', 'fibre'].map((k) => html`
            <div class="macro-cell">
              <span class="macro-cell__value">${raw(macroValue(k, per[k]))}${raw(k === 'cal' ? '' : 'g')}</span>
              <span class="macro-cell__label">${raw(k === 'cal' ? 'calories' : k)}</span>
            </div>`).join(''))}
        </div>
        ${raw(recipe.makes > 1 ? html`
          <p class="hint">Whole batch: ${raw(macroSummary(batch, ['cal', 'protein', 'fibre']))}</p>` : '')}
        ${raw(recipe.guide ? html`
          <p class="hint hint--quiet">
            Printed guide says ~${raw(recipe.guide.cal)} cal${raw(recipe.guide.protein ? ` · ${recipe.guide.protein}g protein` : '')}.
            Forma computes from the ingredient list — see “About the numbers” in Settings.
          </p>` : '')}
      </div>

      <div class="detail-actions">
        <button class="btn btn--primary" data-action="add-today" data-id="${recipe.id}">Add to today</button>
        <button class="btn btn--ghost" data-action="edit-recipe" data-id="${recipe.id}">Edit</button>
        <button class="btn btn--ghost" data-action="duplicate-recipe" data-id="${recipe.id}">Duplicate</button>
      </div>

      <section class="card">
        <h3>Ingredients</h3>
        <ul class="ingredient-readout">
          ${raw(recipe.items.map((item) => {
            const ingredient = lookupIngredient(item.ing);
            if (!ingredient) return html`<li class="muted">Unknown ingredient</li>`;
            const measure = ingredient.measures.find((m) => m.id === item.measure) || ingredient.measures[0];
            const macros = itemMacros(item, lookupIngredient);
            const amount = amountText(item.qty, measure);
            return html`
              <li>
                <span class="ingredient-readout__amount">${raw(amount)}</span>
                <span class="ingredient-readout__name">
                  ${ingredient.name}${raw(item.note ? ` <em class="muted">— ${esc(item.note)}</em>` : '')}
                </span>
                <span class="ingredient-readout__macros muted">${raw(macroValue('cal', macros.cal))} cal</span>
              </li>`;
          }).join(''))}
        </ul>
      </section>

      ${raw(recipe.method && recipe.method.length ? html`
        <section class="card">
          <h3>Method</h3>
          <ol class="method">${raw(recipe.method.map((s) => html`<li>${s}</li>`).join(''))}</ol>
        </section>` : '')}

      ${raw(recipe.plate && recipe.plate.length ? html`
        <section class="card">
          <h3>On your plate <span class="muted">one serving</span></h3>
          <dl class="plate">
            ${raw(recipe.plate.map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`).join(''))}
          </dl>
        </section>` : '')}

      ${raw(recipe.storage ? html`
        <section class="card">
          <h3>Storage</h3>
          <div class="storage-pills">
            <span class="pill"><em>Fridge</em> ${recipe.storage.fridge || '—'}</span>
            <span class="pill"><em>Freezer</em> ${recipe.storage.freezer || '—'}</span>
          </div>
          ${raw((recipe.storage.notes || []).length
            ? `<ul class="bullets">${recipe.storage.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>`
            : '')}
        </section>` : '')}

      ${raw(recipe.boost ? html`
        <section class="card card--accent">
          <h3>Boost</h3>
          <p>${recipe.boost}</p>
        </section>` : '')}

      <div class="detail-footer">
        ${raw(recipe.basedOn ? '<button class="btn btn--ghost btn--danger" data-action="revert-recipe" data-id="' + esc(recipe.id) + '">Revert to original</button>' : '')}
        ${raw(isUser && !recipe.basedOn
          ? `<button class="btn btn--ghost btn--danger" data-action="delete-recipe" data-id="${esc(recipe.id)}">Delete recipe</button>`
          : '')}
        ${raw(!isUser
          ? `<button class="btn btn--ghost btn--danger" data-action="archive-recipe" data-id="${esc(recipe.id)}">Hide from list</button>`
          : '')}
      </div>
    </section>`;
}

// ─── Interaction ─────────────────────────────────────────────────────────────

export function recipeActions(event, params, rerender) {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  const id = target.dataset.id;

  switch (action) {
    case 'recipe-filter':
      activeFilter = target.dataset.filter;
      rerender();
      return;
    case 'recipe-new':
      navigate('#/recipes/new');
      return;
    case 'open-recipe':
      navigate(`#/recipes/${encodeURIComponent(id)}`);
      return;
    case 'back-to-recipes':
      navigate('#/recipes');
      return;
    case 'quick-add':
    case 'add-today': {
      const recipe = lookupRecipe(id);
      addRecipeToDay(todayKey(), id, 1);
      toast(`${recipe.name} added to today`);
      if (action === 'add-today') navigate(`#/day/${todayKey()}`);
      return;
    }
    case 'edit-recipe':
      navigate(`#/recipes/${encodeURIComponent(id)}/edit`);
      return;
    case 'duplicate-recipe':
      navigate(`#/recipes/${encodeURIComponent(id)}/copy`);
      return;
    case 'revert-recipe': {
      if (!confirm('Discard your changes and go back to the original recipe?')) return;
      const originalId = revertRecipe(id);
      toast('Reverted to the original');
      navigate(originalId ? `#/recipes/${encodeURIComponent(originalId)}` : '#/recipes');
      return;
    }
    case 'delete-recipe': {
      const recipe = lookupRecipe(id);
      if (!confirm(`Delete "${recipe.name}"? Days you've already logged keep their own copy.`)) return;
      deleteRecipe(id);
      toast('Recipe deleted');
      navigate('#/recipes');
      return;
    }
    case 'archive-recipe': {
      archiveRecipe(id, true);
      toast('Hidden — restore it in Settings');
      navigate('#/recipes');
      return;
    }
    default:
  }
}

export function recipeInput(event, rerender) {
  const target = event.target.closest('[data-action="recipe-search"]');
  if (!target) return;
  query = target.value;
  rerender();
}
