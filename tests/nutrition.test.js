import test from 'node:test';
import assert from 'node:assert/strict';

import {
  itemGrams, macrosForGrams, itemsTotal, perServing, entryMacros, dayTotals,
  averageTotals, energySplit, scaleMacros, addMacros, zeroMacros, MACRO_KEYS,
} from '../js/nutrition.js';
import { INGREDIENTS, BUILTIN_INGREDIENTS_BY_ID } from '../js/data/ingredients.js';
import { RECIPES } from '../js/data/recipes.js';

const lookup = (id) => BUILTIN_INGREDIENTS_BY_ID[id] || null;
const close = (actual, expected, tolerance, message) =>
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${message}: expected ~${expected} (±${tolerance}), got ${actual.toFixed(2)}`);

// ─── Unit conversion ─────────────────────────────────────────────────────────

test('itemGrams multiplies quantity by the measure weight', () => {
  const egg = lookup('egg');
  assert.equal(itemGrams({ ing: 'egg', qty: 4, measure: 'egg' }, egg), 200);
  assert.equal(itemGrams({ ing: 'egg', qty: 150, measure: 'g' }, egg), 150);
});

test('itemGrams falls back to the default measure when one is missing', () => {
  const egg = lookup('egg');
  assert.equal(itemGrams({ ing: 'egg', qty: 2, measure: 'nonsense' }, egg), 100);
});

test('itemGrams treats junk quantities as zero rather than NaN', () => {
  const egg = lookup('egg');
  assert.equal(itemGrams({ ing: 'egg', qty: '', measure: 'egg' }, egg), 0);
  assert.equal(itemGrams({ ing: 'egg', qty: undefined, measure: 'egg' }, egg), 0);
});

test('macrosForGrams scales per-100g values', () => {
  const rice = lookup('rice-white-dry');
  const m = macrosForGrams(rice, 200);
  assert.equal(m.cal, 720);
  assert.equal(m.protein, 14);
  close(m.carbs, 158, 0.01, 'carbs');
});

test('a missing ingredient contributes nothing instead of throwing', () => {
  assert.deepEqual(macrosForGrams(null, 100), zeroMacros());
  assert.deepEqual(itemsTotal([{ ing: 'does-not-exist', qty: 5, measure: 'g' }], lookup), zeroMacros());
});

// ─── Recipe maths ────────────────────────────────────────────────────────────

test('perServing divides the batch by the number of portions', () => {
  const recipe = RECIPES.find((r) => r.id === 'thai-basil-mince');
  const batch = itemsTotal(recipe.items, lookup);
  const one = perServing(recipe, lookup);
  for (const key of MACRO_KEYS) close(one[key], batch[key] / 3, 0.001, key);
});

test('doubling an ingredient raises the recipe total by that ingredient', () => {
  const recipe = RECIPES.find((r) => r.id === 'thai-basil-mince');
  const before = perServing(recipe, lookup);
  const items = recipe.items.map((i) => (i.ing === 'green-beans' ? { ...i, qty: i.qty * 2 } : { ...i }));
  const after = perServing({ ...recipe, items }, lookup);
  const beans = macrosForGrams(lookup('green-beans'), 1.5 * 80);
  close(after.fibre - before.fibre, beans.fibre / 3, 0.001, 'extra fibre per serving');
});

test('every built-in recipe resolves all of its ingredients', () => {
  for (const recipe of RECIPES) {
    for (const item of recipe.items) {
      assert.ok(lookup(item.ing), `${recipe.id} references unknown ingredient "${item.ing}"`);
    }
  }
});

test('every recipe item uses a measure its ingredient actually defines', () => {
  for (const recipe of RECIPES) {
    for (const item of recipe.items) {
      const ingredient = lookup(item.ing);
      assert.ok(
        ingredient.measures.some((m) => m.id === item.measure),
        `${recipe.id}: "${item.ing}" has no measure "${item.measure}"`
      );
    }
  }
});

test('every built-in recipe produces a plausible per-serving calorie figure', () => {
  for (const recipe of RECIPES) {
    const per = perServing(recipe, lookup);
    assert.ok(per.cal > 50, `${recipe.id} computes only ${per.cal.toFixed(0)} cal per serving`);
    assert.ok(per.cal < 1600, `${recipe.id} computes ${per.cal.toFixed(0)} cal per serving`);
    assert.ok(per.protein >= 0 && per.fibre >= 0, `${recipe.id} has a negative macro`);
  }
});

test('computed calories agree with the Atwater sum of the macros', () => {
  for (const recipe of RECIPES) {
    const per = perServing(recipe, lookup);
    const atwater = per.protein * 4 + per.carbs * 4 + per.fat * 9;
    // Fibre, alcohol-free rounding and label conventions leave a gap; 25% is
    // generous but catches an ingredient row with wildly inconsistent values.
    const drift = Math.abs(atwater - per.cal) / per.cal;
    assert.ok(drift < 0.25, `${recipe.id}: ${per.cal.toFixed(0)} cal vs ${atwater.toFixed(0)} from macros`);
  }
});

// ─── Day logging ─────────────────────────────────────────────────────────────

const entry = (overrides = {}) => ({
  id: 'e1',
  kind: 'recipe',
  makes: 3,
  servings: 1,
  items: RECIPES.find((r) => r.id === 'thai-basil-mince').items.map((i) => ({ ...i })),
  ...overrides,
});

test('entryMacros scales by servings eaten', () => {
  const one = entryMacros(entry(), lookup);
  const two = entryMacros(entry({ servings: 2 }), lookup);
  const half = entryMacros(entry({ servings: 0.5 }), lookup);
  for (const key of MACRO_KEYS) {
    close(two[key], one[key] * 2, 0.001, `${key} doubled`);
    close(half[key], one[key] / 2, 0.001, `${key} halved`);
  }
});

test('zero servings contributes nothing', () => {
  const none = entryMacros(entry({ servings: 0 }), lookup);
  for (const key of MACRO_KEYS) assert.equal(none[key], 0);
});

test('a recipe that forgot its portion count is treated as a single serving', () => {
  const per = perServing({ items: [{ ing: 'egg', qty: 1, measure: 'egg' }], makes: 0 }, lookup);
  close(per.cal, 71.5, 0.01, 'single-serving fallback');
});

test('dayTotals sums every entry', () => {
  const entries = [entry(), entry({ id: 'e2', servings: 2 })];
  const totals = dayTotals(entries, lookup);
  const one = entryMacros(entry(), lookup);
  for (const key of MACRO_KEYS) close(totals[key], one[key] * 3, 0.001, key);
});

test('an empty day totals to zero', () => {
  assert.deepEqual(dayTotals([], lookup), zeroMacros());
  assert.deepEqual(dayTotals(undefined, lookup), zeroMacros());
});

test('averages ignore days with nothing logged', () => {
  const days = [
    { key: '2026-08-06', entries: [entry()] },
    { key: '2026-08-05', entries: [] },
    { key: '2026-08-04', entries: [entry({ servings: 3 })] },
  ];
  const { average, days: counted } = averageTotals(days, lookup);
  assert.equal(counted, 2);
  const one = entryMacros(entry(), lookup);
  close(average.cal, one.cal * 2, 0.001, 'mean of 1 and 3 servings');
});

test('averaging nothing is zero, not NaN', () => {
  const { average, days } = averageTotals([{ key: 'x', entries: [] }], lookup);
  assert.equal(days, 0);
  for (const key of MACRO_KEYS) assert.equal(average[key], 0);
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

test('energySplit apportions calories and sums to 100', () => {
  const split = energySplit({ cal: 400, protein: 25, carbs: 25, fat: 11.1 });
  close(split.protein + split.carbs + split.fat, 100, 0.001, 'split total');
  close(split.protein, 100 / 3, 1, 'protein share');
});

test('energySplit of an empty day is all zeros', () => {
  assert.deepEqual(energySplit(zeroMacros()), { protein: 0, carbs: 0, fat: 0 });
});

test('addMacros and scaleMacros cover every tracked key', () => {
  const sum = addMacros({ cal: 1, protein: 2, carbs: 3, fat: 4, fibre: 5 }, { cal: 1 });
  assert.equal(sum.cal, 2);
  assert.equal(sum.fibre, 5);
  const scaled = scaleMacros(sum, 2);
  for (const key of MACRO_KEYS) assert.equal(scaled[key], sum[key] * 2);
});

// ─── Catalogue integrity ─────────────────────────────────────────────────────

test('ingredient ids are unique', () => {
  const ids = INGREDIENTS.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate ingredient id');
});

test('recipe ids are unique', () => {
  const ids = RECIPES.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate recipe id');
});

test('every ingredient declares its default measure and sane values', () => {
  for (const ingredient of INGREDIENTS) {
    assert.ok(
      ingredient.measures.some((m) => m.id === ingredient.defaultMeasure),
      `${ingredient.id}: default measure "${ingredient.defaultMeasure}" is not in its measure list`
    );
    for (const measure of ingredient.measures) {
      assert.ok(measure.grams > 0, `${ingredient.id}: measure "${measure.id}" has no weight`);
    }
    for (const key of MACRO_KEYS) {
      const value = ingredient.per100[key];
      assert.ok(Number.isFinite(value) && value >= 0, `${ingredient.id}: bad ${key}`);
    }
    assert.ok(ingredient.per100.cal <= 900, `${ingredient.id}: more calories than pure fat`);
    assert.ok(ingredient.per100.protein <= 100, `${ingredient.id}: impossible protein`);
  }
});
