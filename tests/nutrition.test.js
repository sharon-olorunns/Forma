import test from 'node:test';
import assert from 'node:assert/strict';

import {
  itemGrams, macrosForGrams, itemsTotal, perServing, entryMacros, dayTotals,
  averageTotals, energySplit, against, suggestBoosts, scaleMacros, addMacros,
  zeroMacros, findMeasure, MACRO_KEYS,
} from '../js/nutrition.js';
import { FOODS, BUILTIN_FOODS_BY_ID, DEFAULT_TARGETS } from '../js/data/foods.js';

const lookup = (id) => BUILTIN_FOODS_BY_ID[id] || null;
const close = (actual, expected, tolerance, message) =>
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${message}: expected ~${expected} (±${tolerance}), got ${Number(actual).toFixed(2)}`);

/** The meal from the brief: a sweet potato, half a pepper, onion, chicken cubes. */
const SAMPLE_MEAL = {
  makes: 1,
  items: [
    { ing: 'sweet-potato', qty: 1, measure: 'potato' },
    { ing: 'red-pepper', qty: 1, measure: 'half' },
    { ing: 'onion', qty: 1, measure: 'half' },
    { ing: 'chicken-breast', qty: 4, measure: 'cube' },
    { ing: 'olive-oil', qty: 1, measure: 'tbsp' },
  ],
};

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
  const m = macrosForGrams(lookup('rice-white-dry'), 200);
  assert.equal(m.cal, 720);
  assert.equal(m.protein, 14);
  close(m.carbs, 158, 0.01, 'carbs');
});

test('a missing food contributes nothing instead of throwing', () => {
  assert.deepEqual(macrosForGrams(null, 100), zeroMacros());
  assert.deepEqual(itemsTotal([{ ing: 'does-not-exist', qty: 5, measure: 'g' }], lookup), zeroMacros());
});

test('findMeasure falls back sensibly', () => {
  const potato = lookup('sweet-potato');
  assert.equal(findMeasure(potato, 'potato').grams, 200);
  assert.equal(findMeasure(potato, 'nope').id, potato.defaultMeasure);
  assert.equal(findMeasure(null, 'x'), null);
});

// ─── Meal maths ──────────────────────────────────────────────────────────────

test('the sample meal totals to a sensible plate', () => {
  const total = itemsTotal(SAMPLE_MEAL.items, lookup);
  // 200g sweet potato + 75g pepper + 55g onion + 100g chicken + 1 tbsp oil.
  close(total.cal, 172 + 23 + 22 + 106 + 119, 2, 'calories');
  close(total.protein, 3.2 + 0.75 + 0.6 + 24, 1, 'protein');
  assert.ok(total.fibre > 6, 'sweet potato and veg should carry real fibre');
});

test('changing one ingredient changes only that contribution', () => {
  const before = itemsTotal(SAMPLE_MEAL.items, lookup);
  const items = SAMPLE_MEAL.items.map((i) => (i.ing === 'chicken-breast' ? { ...i, qty: 8 } : i));
  const after = itemsTotal(items, lookup);
  const extra = macrosForGrams(lookup('chicken-breast'), 100);
  for (const key of MACRO_KEYS) close(after[key] - before[key], extra[key], 0.001, key);
});

test('perServing divides the batch by the number of portions', () => {
  const batch = itemsTotal(SAMPLE_MEAL.items, lookup);
  const one = perServing({ ...SAMPLE_MEAL, makes: 3 }, lookup);
  for (const key of MACRO_KEYS) close(one[key], batch[key] / 3, 0.001, key);
});

test('a meal that forgot its portion count is treated as a single serving', () => {
  const per = perServing({ items: [{ ing: 'egg', qty: 1, measure: 'egg' }], makes: 0 }, lookup);
  close(per.cal, 71.5, 0.01, 'single-serving fallback');
});

// ─── Day logging ─────────────────────────────────────────────────────────────

const entry = (overrides = {}) => ({
  id: 'e1', name: 'Sample', makes: 1, servings: 1,
  items: SAMPLE_MEAL.items.map((i) => ({ ...i })),
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

test('eating one of three portions gives a third of the batch', () => {
  const third = entryMacros(entry({ makes: 3, servings: 1 }), lookup);
  const whole = itemsTotal(SAMPLE_MEAL.items, lookup);
  for (const key of MACRO_KEYS) close(third[key], whole[key] / 3, 0.001, key);
});

test('zero servings contributes nothing', () => {
  const none = entryMacros(entry({ servings: 0 }), lookup);
  for (const key of MACRO_KEYS) assert.equal(none[key], 0);
});

test('dayTotals sums every entry', () => {
  const totals = dayTotals([entry(), entry({ id: 'e2', servings: 2 })], lookup);
  const one = entryMacros(entry(), lookup);
  for (const key of MACRO_KEYS) close(totals[key], one[key] * 3, 0.001, key);
});

test('an empty day totals to zero', () => {
  assert.deepEqual(dayTotals([], lookup), zeroMacros());
  assert.deepEqual(dayTotals(undefined, lookup), zeroMacros());
});

// ─── Targets ─────────────────────────────────────────────────────────────────

test('against reports what is left when under target', () => {
  const status = against({ cal: 1200, protein: 80, carbs: 100, fat: 40, fibre: 20 }, DEFAULT_TARGETS);
  assert.equal(status.cal.remaining, DEFAULT_TARGETS.cal - 1200);
  assert.equal(status.cal.over, false);
  close(status.cal.pct, (1200 / DEFAULT_TARGETS.cal) * 100, 0.01, 'percent');
});

test('against reports the overshoot as a negative remainder', () => {
  const status = against({ cal: 2400, protein: 200, carbs: 0, fat: 0, fibre: 0 }, DEFAULT_TARGETS);
  assert.equal(status.cal.over, true);
  assert.equal(status.cal.remaining, DEFAULT_TARGETS.cal - 2400);
  assert.ok(status.cal.remaining < 0);
  assert.equal(status.protein.over, true);
});

test('a zero target never divides by zero', () => {
  const status = against({ cal: 500 }, { cal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 });
  assert.equal(status.cal.pct, 0);
  assert.equal(status.cal.over, false);
});

// ─── Boost suggestions ───────────────────────────────────────────────────────

test('protein boosts are dense in protein and fit the calorie budget', () => {
  const picks = suggestBoosts('protein', 40, 600, FOODS);
  assert.ok(picks.length > 0, 'should find something');
  for (const p of picks) {
    assert.ok(p.food.per100.protein >= 8, `${p.food.id} is not protein-dense`);
    assert.ok(p.cal <= 600, `${p.food.id} costs ${p.cal.toFixed(0)} cal, over budget`);
    assert.ok(p.provides >= 40 * 0.25, `${p.food.id} barely dents the gap`);
  }
});

test('boosts are ranked cheapest-per-gram first', () => {
  const picks = suggestBoosts('protein', 40, 800, FOODS);
  for (let i = 1; i < picks.length; i += 1) {
    assert.ok(picks[i - 1].costPerGram <= picks[i].costPerGram, 'ranking is not monotonic');
  }
});

test('boosts do not suggest five things from the same aisle', () => {
  const picks = suggestBoosts('protein', 40, 900, FOODS, { limit: 4 });
  const groups = picks.map((p) => p.food.group);
  assert.equal(new Set(groups).size, groups.length, 'duplicate food groups in suggestions');
});

test('fibre boosts are fibre-dense', () => {
  const picks = suggestBoosts('fibre', 12, 400, FOODS);
  assert.ok(picks.length > 0);
  for (const p of picks) assert.ok(p.food.per100.fibre >= 4, `${p.food.id} is not fibre-dense`);
});

test('a tight calorie budget still returns only affordable options', () => {
  const picks = suggestBoosts('protein', 30, 150, FOODS);
  for (const p of picks) assert.ok(p.cal <= 150, `${p.food.id} costs too much`);
});

test('no gap means no suggestions', () => {
  assert.deepEqual(suggestBoosts('protein', 0, 500, FOODS), []);
  assert.deepEqual(suggestBoosts('protein', -10, 500, FOODS), []);
});

test('suggested portions are realistic, not a bucket of one food', () => {
  for (const macro of ['protein', 'fibre']) {
    for (const p of suggestBoosts(macro, 60, 2000, FOODS, { limit: 6 })) {
      assert.ok(p.grams <= 400, `${p.food.id}: ${p.grams}g is not a portion`);
    }
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

test('energySplit apportions calories and sums to 100', () => {
  const split = energySplit({ cal: 400, protein: 25, carbs: 25, fat: 11.1 });
  close(split.protein + split.carbs + split.fat, 100, 0.001, 'split total');
  close(split.protein, 100 / 3, 1, 'protein share');
});

test('energySplit of an empty meal is all zeros', () => {
  assert.deepEqual(energySplit(zeroMacros()), { protein: 0, carbs: 0, fat: 0 });
});

test('averages ignore days with nothing logged', () => {
  const days = [
    { key: '2026-08-06', entries: [entry()] },
    { key: '2026-08-05', entries: [] },
    { key: '2026-08-04', entries: [entry({ servings: 3 })] },
  ];
  const { average, days: counted } = averageTotals(days, lookup);
  assert.equal(counted, 2);
  close(average.cal, entryMacros(entry(), lookup).cal * 2, 0.001, 'mean of 1 and 3 servings');
});

test('averaging nothing is zero, not NaN', () => {
  const { average, days } = averageTotals([{ key: 'x', entries: [] }], lookup);
  assert.equal(days, 0);
  for (const key of MACRO_KEYS) assert.equal(average[key], 0);
});

test('addMacros and scaleMacros cover every tracked key', () => {
  const sum = addMacros({ cal: 1, protein: 2, carbs: 3, fat: 4, fibre: 5 }, { cal: 1 });
  assert.equal(sum.cal, 2);
  assert.equal(sum.fibre, 5);
  const scaled = scaleMacros(sum, 2);
  for (const key of MACRO_KEYS) assert.equal(scaled[key], sum[key] * 2);
});

// ─── Catalogue integrity ─────────────────────────────────────────────────────

test('the catalogue is big enough to cover everyday cooking', () => {
  assert.ok(FOODS.length >= 400, `only ${FOODS.length} foods`);
});

test('food ids are unique', () => {
  const ids = FOODS.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate food id');
});

test('every food declares its default measure and sane values', () => {
  for (const f of FOODS) {
    assert.ok(f.name && f.group, `${f.id} is missing a name or group`);
    assert.ok(
      f.measures.some((m) => m.id === f.defaultMeasure),
      `${f.id}: default measure "${f.defaultMeasure}" is not in its measure list`
    );
    for (const m of f.measures) {
      assert.ok(m.grams > 0, `${f.id}: measure "${m.id}" has no weight`);
      assert.ok(m.label, `${f.id}: measure "${m.id}" has no label`);
    }
    for (const key of MACRO_KEYS) {
      const value = f.per100[key];
      assert.ok(Number.isFinite(value) && value >= 0, `${f.id}: bad ${key}`);
    }
    assert.ok(f.per100.cal <= 910, `${f.id}: more calories than pure fat`);
    assert.ok(f.per100.protein <= 100, `${f.id}: impossible protein`);
  }
});

test('every food has a gram measure so anything can be weighed', () => {
  for (const f of FOODS) {
    assert.ok(
      f.measures.some((m) => m.grams === 1),
      `${f.id} cannot be entered in grams or ml`
    );
  }
});

/**
 * Calories should roughly match the energy in the macros — a blunt but effective
 * check that no row has a typo in it. Fibre is counted at 2 cal/g, which is why
 * high-fibre foods don't look short.
 *
 * Exempt: anything whose calories come from alcohol (7 cal/g, not a tracked
 * macro), and baking powder, whose carbohydrate is leavening acid you don't
 * metabolise.
 */
const ATWATER_EXEMPT = new Set([
  'beer', 'wine-red', 'wine-white', 'prosecco', 'spirits', 'vanilla', 'baking-powder',
]);

test('calories agree with the energy in the macros', () => {
  for (const f of FOODS) {
    if (ATWATER_EXEMPT.has(f.id) || f.per100.cal < 30) continue;
    const { protein, carbs, fat, fibre, cal } = f.per100;
    const energy = protein * 4 + carbs * 4 + fat * 9 + fibre * 2;
    const drift = Math.abs(energy - cal) / cal;
    assert.ok(drift < 0.25, `${f.id}: ${cal} cal vs ${energy.toFixed(0)} from macros`);
  }
});

test('default targets are complete and positive', () => {
  for (const key of MACRO_KEYS) {
    assert.ok(DEFAULT_TARGETS[key] > 0, `missing default target for ${key}`);
  }
});
