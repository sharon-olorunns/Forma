/** Modal pickers: choose a recipe, choose an ingredient, create an ingredient. */

import { html, raw, esc, macroSummary, openSheet, closeSheet, toast } from '../ui.js';
import { allRecipes, allIngredients, lookupIngredient, update, uid } from '../store.js';
import { perServing, macrosForGrams } from '../nutrition.js';
import { CATEGORIES } from '../data/recipes.js';

const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));

// ─── Recipe picker ───────────────────────────────────────────────────────────

export function openRecipePicker({ onPick, title = 'Add a meal' }) {
  const sheet = openSheet({
    title,
    body: html`
      <div class="picker">
        <input class="input picker__search" type="search" placeholder="Search meals…"
               data-role="search" autocomplete="off" />
        <div class="chips" data-role="filters">
          <button class="chip is-active" data-filter="all">All</button>
          ${raw(CATEGORIES.map((c) => `<button class="chip" data-filter="${esc(c.id)}">${esc(c.label)}</button>`).join(''))}
        </div>
        <div class="picker__list" data-role="list"></div>
      </div>`,
  });

  const listEl = sheet.querySelector('[data-role="list"]');
  const searchEl = sheet.querySelector('[data-role="search"]');
  let filter = 'all';
  let query = '';

  function draw() {
    const q = query.trim().toLowerCase();
    const recipes = allRecipes().filter((r) => {
      if (filter !== 'all' && r.category !== filter) return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || (r.blurb || '').toLowerCase().includes(q);
    });
    if (!recipes.length) {
      listEl.innerHTML = html`<p class="empty">No meals match “${query}”.</p>`;
      return;
    }
    listEl.innerHTML = recipes
      .map((r) => {
        const macros = perServing(r, lookupIngredient);
        const badge = r.basedOn ? 'edited' : r.userCreated ? 'mine' : '';
        return html`
          <button class="picker__row" data-pick="${r.id}">
            <span class="picker__row-main">
              <span class="picker__row-title">
                ${r.name}
                ${raw(badge ? `<em class="badge">${badge}</em>` : '')}
              </span>
              <span class="picker__row-sub">${CATEGORY_LABEL[r.category] || 'Extra'} · ${raw(macroSummary(macros))}</span>
            </span>
            <span class="picker__row-add" aria-hidden="true">+</span>
          </button>`;
      })
      .join('');
  }

  searchEl.addEventListener('input', (e) => {
    query = e.target.value;
    draw();
  });
  sheet.querySelector('[data-role="filters"]').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    filter = btn.dataset.filter;
    sheet.querySelectorAll('[data-filter]').forEach((b) => b.classList.toggle('is-active', b === btn));
    draw();
  });
  listEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pick]');
    if (!btn) return;
    closeSheet();
    onPick(btn.dataset.pick);
  });

  draw();
  return sheet;
}

// ─── Ingredient picker ───────────────────────────────────────────────────────

export function openIngredientPicker({ onPick, title = 'Add an ingredient' }) {
  const sheet = openSheet({
    title,
    body: html`
      <div class="picker">
        <input class="input picker__search" type="search" placeholder="Search ingredients…"
               data-role="search" autocomplete="off" />
        <div class="picker__list" data-role="list"></div>
        <button class="btn btn--ghost btn--block" data-role="new">+ New ingredient</button>
      </div>`,
  });

  const listEl = sheet.querySelector('[data-role="list"]');
  const searchEl = sheet.querySelector('[data-role="search"]');
  let query = '';

  function draw() {
    const q = query.trim().toLowerCase();
    const matches = allIngredients().filter((i) => !q || i.name.toLowerCase().includes(q));
    if (!matches.length) {
      listEl.innerHTML = html`<p class="empty">Nothing matches “${query}”. Add it as a new ingredient below.</p>`;
      return;
    }
    const groups = new Map();
    for (const item of matches) {
      if (!groups.has(item.group)) groups.set(item.group, []);
      groups.get(item.group).push(item);
    }
    listEl.innerHTML = [...groups.entries()]
      .map(
        ([group, items]) => html`
          <div class="picker__group">
            <h4>${group}</h4>
            ${raw(items.map((i) => html`
              <button class="picker__row" data-pick="${i.id}">
                <span class="picker__row-main">
                  <span class="picker__row-title">${i.name}</span>
                  <span class="picker__row-sub">per 100g · ${raw(macroSummary(macrosForGrams(i, 100), ['cal', 'protein', 'carbs', 'fat']))}</span>
                </span>
                <span class="picker__row-add" aria-hidden="true">+</span>
              </button>`).join(''))}
          </div>`
      )
      .join('');
  }

  searchEl.addEventListener('input', (e) => {
    query = e.target.value;
    draw();
  });
  listEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pick]');
    if (!btn) return;
    closeSheet();
    onPick(btn.dataset.pick);
  });
  sheet.querySelector('[data-role="new"]').addEventListener('click', () => {
    openNewIngredientForm({ name: searchEl.value, onCreated: onPick });
  });

  draw();
  searchEl.focus();
  return sheet;
}

// ─── New ingredient form ─────────────────────────────────────────────────────

export function openNewIngredientForm({ name = '', onCreated }) {
  const fields = [
    ['cal', 'Calories', '0'],
    ['protein', 'Protein (g)', '0'],
    ['carbs', 'Carbs (g)', '0'],
    ['fat', 'Fat (g)', '0'],
    ['fibre', 'Fibre (g)', '0'],
  ];
  const sheet = openSheet({
    title: 'New ingredient',
    body: html`
      <form class="form" data-role="form">
        <label class="field">
          <span>Name</span>
          <input class="input" name="name" value="${name}" required placeholder="e.g. Halloumi" />
        </label>
        <p class="hint">Everything below is <strong>per 100g</strong> — copy it straight off the packet.</p>
        <div class="grid-2">
          ${raw(fields.map(([key, label, def]) => html`
            <label class="field">
              <span>${label}</span>
              <input class="input" name="${key}" type="number" step="0.1" min="0" value="${def}" inputmode="decimal" />
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
    actions: html`<button class="btn btn--primary btn--block" data-role="save">Save ingredient</button>`,
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
    const ingredient = {
      id: uid('ing'),
      name: data.name.trim(),
      group: 'My ingredients',
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
    update((s) => {
      s.ingredients[ingredient.id] = ingredient;
    });
    closeSheet();
    toast(`${ingredient.name} added`);
    if (onCreated) onCreated(ingredient.id);
  });
  return sheet;
}
