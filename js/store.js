/**
 * State + persistence.
 *
 * One user, one device, no server: localStorage is the right call. The whole
 * dataset is small even after years of logging, it's synchronous (so no loading
 * states anywhere), and it exports to a JSON file in one click.
 */

import { FOODS, BUILTIN_FOODS_BY_ID, DEFAULT_TARGETS } from './data/foods.js';

const STORAGE_KEY = 'forma.v2';
const SCHEMA_VERSION = 2;

function emptyState() {
  return {
    version: SCHEMA_VERSION,
    settings: { targets: { ...DEFAULT_TARGETS } },
    /** Foods you added yourself, same shape as the built-in catalogue. */
    foods: {},
    /** Saved meals, ready to log again in one tap. */
    meals: {},
    /** 'YYYY-MM-DD' → { entries: [...] } */
    days: {},
    /** The meal currently being built, kept so a locked phone doesn't lose it. */
    draft: null,
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
  const merged = { ...base, ...saved, settings: { ...base.settings, ...(saved.settings || {}) } };
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

/** Change state without triggering a re-render — for high-frequency draft edits. */
export function updateQuiet(mutator) {
  mutator(state);
  persist();
}

// ─── Foods ───────────────────────────────────────────────────────────────────

export function lookupFood(id) {
  return state.foods[id] || BUILTIN_FOODS_BY_ID[id] || null;
}

export function allFoods() {
  const custom = Object.values(state.foods);
  const overridden = new Set(custom.map((f) => f.id));
  return [...FOODS.filter((f) => !overridden.has(f.id)), ...custom];
}

/**
 * Search foods by name. Ranks whole-word prefix matches above substring hits so
 * typing "chick" puts chicken breast above "chickpeas".
 */
export function searchFoods(query, { limit = 40 } = {}) {
  const q = query.trim().toLowerCase();
  const foods = allFoods();
  if (!q) return foods.slice().sort((a, b) => a.name.localeCompare(b.name)).slice(0, limit);

  const scored = [];
  for (const food of foods) {
    const name = food.name.toLowerCase();
    const index = name.indexOf(q);
    if (index === -1) continue;
    const startsWord = index === 0 || /[\s(,/]/.test(name[index - 1]);
    // Lower is better: exact < starts name < starts a word < anywhere.
    let score = 3;
    if (name === q) score = 0;
    else if (index === 0) score = 1;
    else if (startsWord) score = 2;
    scored.push({ food, score, length: name.length });
  }
  scored.sort((a, b) => a.score - b.score || a.length - b.length || a.food.name.localeCompare(b.food.name));
  return scored.slice(0, limit).map((s) => s.food);
}

export function saveFood(food) {
  update((s) => {
    s.foods[food.id] = food;
  });
  return food;
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

// ─── The draft meal ──────────────────────────────────────────────────────────

export function getDraft() {
  if (!state.draft) {
    state.draft = { name: '', items: [], makes: 1, servings: 1, savedId: null };
  }
  return state.draft;
}

export function setDraft(draft) {
  update((s) => {
    s.draft = draft;
  });
}

export function clearDraft() {
  update((s) => {
    s.draft = null;
  });
}

/** Load a saved meal into the builder so it can be tweaked before logging. */
export function draftFromMeal(mealId) {
  const meal = state.meals[mealId];
  if (!meal) return null;
  const draft = {
    name: meal.name,
    items: meal.items.map((i) => ({ ...i })),
    makes: meal.makes || 1,
    servings: 1,
    savedId: meal.id,
  };
  setDraft(draft);
  return draft;
}

/** Load a previously logged entry back into the builder. */
export function draftFromEntry(dayKey, entryId) {
  const entry = getDay(dayKey).entries.find((e) => e.id === entryId);
  if (!entry) return null;
  const draft = {
    name: entry.name,
    items: entry.items.map((i) => ({ ...i })),
    makes: entry.makes || 1,
    servings: entry.servings || 1,
    savedId: entry.savedId || null,
    editingEntry: { dayKey, entryId },
  };
  setDraft(draft);
  return draft;
}

// ─── Day log ─────────────────────────────────────────────────────────────────

export function getDay(key) {
  return state.days[key] || { entries: [] };
}

/**
 * Log a meal to a day. The entry takes its own copy of the ingredient list, so
 * editing a saved meal later never rewrites what you already ate.
 */
export function logMeal(dayKey, draft) {
  const entry = {
    id: uid('e'),
    name: draft.name.trim() || 'Meal',
    savedId: draft.savedId || null,
    items: draft.items.map((i) => ({ ...i })),
    makes: Number(draft.makes) > 0 ? Number(draft.makes) : 1,
    servings: Number(draft.servings) > 0 ? Number(draft.servings) : 1,
    at: Date.now(),
  };
  update((s) => {
    if (!s.days[dayKey]) s.days[dayKey] = { entries: [] };
    s.days[dayKey].entries.push(entry);
    s.draft = null;
  });
  return entry;
}

/** Write the builder's contents back over an entry that's already logged. */
export function updateLoggedEntry(dayKey, entryId, draft) {
  update((s) => {
    const day = s.days[dayKey];
    if (!day) return;
    const entry = day.entries.find((e) => e.id === entryId);
    if (!entry) return;
    entry.name = draft.name.trim() || 'Meal';
    entry.items = draft.items.map((i) => ({ ...i }));
    entry.makes = Number(draft.makes) > 0 ? Number(draft.makes) : 1;
    entry.servings = Number(draft.servings) > 0 ? Number(draft.servings) : 1;
    s.draft = null;
  });
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

/** Log a saved meal straight to a day without opening the builder. */
export function quickLog(dayKey, mealId, servings = 1) {
  const meal = state.meals[mealId];
  if (!meal) return null;
  return logMeal(dayKey, {
    name: meal.name,
    items: meal.items,
    makes: meal.makes || 1,
    servings,
    savedId: meal.id,
  });
}

export function loggedDays() {
  return Object.keys(state.days)
    .filter((k) => state.days[k].entries && state.days[k].entries.length)
    .sort((a, b) => b.localeCompare(a));
}

// ─── Saved meals ─────────────────────────────────────────────────────────────

export function allMeals() {
  return Object.values(state.meals).sort((a, b) => {
    if (a.favourite !== b.favourite) return a.favourite ? -1 : 1;
    return (b.lastUsedAt || b.createdAt || 0) - (a.lastUsedAt || a.createdAt || 0);
  });
}

export function getMeal(id) {
  return state.meals[id] || null;
}

/** Save the builder's contents as a reusable meal. */
export function saveMeal(draft, { overwrite = false } = {}) {
  let saved;
  update((s) => {
    const existing = overwrite && draft.savedId ? s.meals[draft.savedId] : null;
    saved = {
      id: existing ? existing.id : uid('m'),
      name: draft.name.trim() || 'Untitled meal',
      items: draft.items.map((i) => ({ ...i })),
      makes: Number(draft.makes) > 0 ? Number(draft.makes) : 1,
      favourite: existing ? existing.favourite : false,
      createdAt: existing ? existing.createdAt : Date.now(),
      updatedAt: Date.now(),
      lastUsedAt: existing ? existing.lastUsedAt : null,
    };
    s.meals[saved.id] = saved;
  });
  return saved;
}

export function touchMeal(id) {
  update((s) => {
    if (s.meals[id]) s.meals[id].lastUsedAt = Date.now();
  });
}

export function toggleFavourite(id) {
  update((s) => {
    if (s.meals[id]) s.meals[id].favourite = !s.meals[id].favourite;
  });
}

export function renameMeal(id, name) {
  update((s) => {
    if (s.meals[id]) s.meals[id].name = name.trim() || s.meals[id].name;
  });
}

export function deleteMeal(id) {
  update((s) => {
    delete s.meals[id];
  });
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
