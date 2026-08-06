/**
 * State + persistence.
 *
 * Single user, single device-ish: localStorage is the right call here. The whole
 * dataset is a few hundred KB even after years of logging, it's synchronous
 * (so no loading states anywhere), and it exports to a JSON file in one click.
 */

import { INGREDIENTS, BUILTIN_INGREDIENTS_BY_ID } from './data/ingredients.js';
import { RECIPES, BUILTIN_RECIPES_BY_ID } from './data/recipes.js';
import { DEFAULT_TARGETS } from './data/guide.js';

const STORAGE_KEY = 'forma.v1';
const SCHEMA_VERSION = 1;

function emptyState() {
  return {
    version: SCHEMA_VERSION,
    settings: { targets: { ...DEFAULT_TARGETS } },
    /** User recipes. Either brand new, or an edited copy of a built-in (`basedOn`). */
    recipes: {},
    /** User-added ingredients, same shape as the built-in catalogue. */
    ingredients: {},
    /** Built-in recipe ids the user has archived out of the list. */
    archived: [],
    /** 'YYYY-MM-DD' → { entries: [...] } */
    days: {},
  };
}

let state = emptyState();
const listeners = new Set();

// ─── Persistence ─────────────────────────────────────────────────────────────

export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = migrate(JSON.parse(raw));
  } catch (err) {
    console.error('Could not read saved data, starting fresh.', err);
    state = emptyState();
  }
  return state;
}

function migrate(saved) {
  const base = emptyState();
  const merged = {
    ...base,
    ...saved,
    settings: { ...base.settings, ...(saved.settings || {}) },
  };
  merged.settings.targets = { ...base.settings.targets, ...((saved.settings || {}).targets || {}) };
  merged.version = SCHEMA_VERSION;
  return merged;
}

let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error('Could not save.', err);
      alert('Forma could not save — device storage may be full.');
    }
  }, 0);
}

export function getState() {
  return state;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Mutate state through here so saving and re-rendering always happen. */
export function update(mutator) {
  mutator(state);
  persist();
  for (const fn of listeners) fn(state);
}

// ─── Lookups ─────────────────────────────────────────────────────────────────

/** id → ingredient, user catalogue shadowing built-ins. */
export function lookupIngredient(id) {
  return state.ingredients[id] || BUILTIN_INGREDIENTS_BY_ID[id] || null;
}

export function allIngredients() {
  const custom = Object.values(state.ingredients);
  const overridden = new Set(custom.map((i) => i.id));
  return [...INGREDIENTS.filter((i) => !overridden.has(i.id)), ...custom]
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function lookupRecipe(id) {
  return state.recipes[id] || BUILTIN_RECIPES_BY_ID[id] || null;
}

/**
 * The recipe list as shown in the app: user edits shadow the built-in they were
 * based on, archived built-ins drop out, brand-new user recipes are appended.
 */
export function allRecipes() {
  const userRecipes = Object.values(state.recipes);
  const shadowed = new Set(userRecipes.map((r) => r.basedOn).filter(Boolean));
  const archived = new Set(state.archived || []);
  const builtins = RECIPES.filter((r) => !shadowed.has(r.id) && !archived.has(r.id));
  return [...builtins, ...userRecipes.filter((r) => !archived.has(r.id))];
}

export function isUserRecipe(id) {
  return Boolean(state.recipes[id]);
}

// ─── Ids + dates ─────────────────────────────────────────────────────────────

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Local-time YYYY-MM-DD. Never use toISOString here — it shifts by timezone. */
export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function shiftDate(key, days) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return todayKey(date);
}

// ─── Day log ─────────────────────────────────────────────────────────────────

export function getDay(key) {
  return state.days[key] || { entries: [] };
}

/**
 * Add a recipe to a day. The entry takes a deep copy of the recipe's ingredient
 * list, so editing the recipe later never rewrites history, and tweaking this
 * entry never touches the saved recipe.
 */
export function addRecipeToDay(dayKey, recipeId, servings = 1) {
  const recipe = lookupRecipe(recipeId);
  if (!recipe) return null;
  const entry = {
    id: uid('e'),
    kind: 'recipe',
    sourceId: recipe.id,
    name: recipe.name,
    category: recipe.category,
    makes: recipe.makes,
    servings,
    items: recipe.items.map((i) => ({ ...i })),
    addedAt: Date.now(),
  };
  update((s) => {
    if (!s.days[dayKey]) s.days[dayKey] = { entries: [] };
    s.days[dayKey].entries.push(entry);
  });
  return entry;
}

/** Add a single ingredient as its own line — for free days and ad-hoc eating. */
export function addIngredientToDay(dayKey, ingredientId, qty, measure) {
  const ingredient = lookupIngredient(ingredientId);
  if (!ingredient) return null;
  const entry = {
    id: uid('e'),
    kind: 'ingredient',
    sourceId: ingredient.id,
    name: ingredient.name,
    category: 'extra',
    makes: 1,
    servings: 1,
    items: [{ ing: ingredient.id, qty, measure: measure || ingredient.defaultMeasure }],
    addedAt: Date.now(),
  };
  update((s) => {
    if (!s.days[dayKey]) s.days[dayKey] = { entries: [] };
    s.days[dayKey].entries.push(entry);
  });
  return entry;
}

export function updateEntry(dayKey, entryId, mutator) {
  update((s) => {
    const day = s.days[dayKey];
    if (!day) return;
    const entry = day.entries.find((e) => e.id === entryId);
    if (entry) mutator(entry);
  });
}

export function removeEntry(dayKey, entryId) {
  update((s) => {
    const day = s.days[dayKey];
    if (!day) return;
    day.entries = day.entries.filter((e) => e.id !== entryId);
    if (!day.entries.length) delete s.days[dayKey];
  });
}

/** Copy every entry from one day onto another. Used by "repeat this day". */
export function copyDay(fromKey, toKey) {
  const from = getDay(fromKey);
  if (!from.entries.length) return 0;
  update((s) => {
    if (!s.days[toKey]) s.days[toKey] = { entries: [] };
    for (const e of from.entries) {
      s.days[toKey].entries.push({
        ...e,
        id: uid('e'),
        items: e.items.map((i) => ({ ...i })),
        addedAt: Date.now(),
      });
    }
  });
  return from.entries.length;
}

/** Every logged day, newest first. */
export function loggedDays() {
  return Object.keys(state.days)
    .filter((k) => state.days[k].entries && state.days[k].entries.length)
    .sort((a, b) => b.localeCompare(a));
}

// ─── Recipes ─────────────────────────────────────────────────────────────────

/**
 * Save an edited recipe.
 *  - mode 'overwrite': keep it in the same slot. Editing a built-in creates a
 *    user copy that shadows it; editing a user recipe updates in place.
 *  - mode 'new': always creates a separate recipe.
 */
export function saveRecipe(draft, mode = 'overwrite') {
  const isBuiltin = Boolean(BUILTIN_RECIPES_BY_ID[draft.id]) && !state.recipes[draft.id];
  let saved;
  update((s) => {
    if (mode === 'new') {
      saved = { ...draft, id: uid('r'), userCreated: true, basedOn: null, updatedAt: Date.now() };
    } else if (isBuiltin) {
      saved = { ...draft, id: uid('r'), basedOn: draft.id, edited: true, updatedAt: Date.now() };
    } else {
      saved = { ...draft, updatedAt: Date.now() };
    }
    saved.items = draft.items.map((i) => ({ ...i }));
    s.recipes[saved.id] = saved;
  });
  return saved;
}

export function deleteRecipe(id) {
  update((s) => {
    delete s.recipes[id];
  });
}

/** Drop a user edit and go back to the original built-in recipe. */
export function revertRecipe(id) {
  const recipe = state.recipes[id];
  if (!recipe || !recipe.basedOn) return null;
  const originalId = recipe.basedOn;
  update((s) => {
    delete s.recipes[id];
  });
  return originalId;
}

export function archiveRecipe(id, archived = true) {
  update((s) => {
    const set = new Set(s.archived || []);
    if (archived) set.add(id);
    else set.delete(id);
    s.archived = [...set];
  });
}

export function blankRecipe() {
  return {
    id: uid('r'),
    name: '',
    category: 'meal2',
    makes: 1,
    blurb: '',
    tags: [],
    items: [],
    method: [],
    plate: [],
    storage: { fridge: '', freezer: '', notes: [] },
    boost: '',
    userCreated: true,
  };
}

// ─── Settings + data management ──────────────────────────────────────────────

export function setTargets(targets) {
  update((s) => {
    s.settings.targets = { ...s.settings.targets, ...targets };
  });
}

export function exportData() {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
}

export function importData(json) {
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== 'object' || !parsed.days) {
    throw new Error('That does not look like a Forma backup.');
  }
  update((s) => {
    const next = migrate(parsed);
    for (const key of Object.keys(s)) delete s[key];
    Object.assign(s, next);
  });
}

export function clearAll() {
  update((s) => {
    const next = emptyState();
    for (const key of Object.keys(s)) delete s[key];
    Object.assign(s, next);
  });
}
