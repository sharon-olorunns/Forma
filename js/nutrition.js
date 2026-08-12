/**
 * The calculation engine.
 *
 * Nothing in Forma stores a macro figure. Everything is derived from
 * (food per-100g values) × (quantity in grams), which is what lets you change a
 * quantity or swap an ingredient and see the numbers move immediately.
 */

export const MACRO_KEYS = ['cal', 'protein', 'carbs', 'fat', 'fibre'];

export const MACRO_META = {
  cal: { label: 'Calories', short: 'Cal', unit: '', decimals: 0 },
  protein: { label: 'Protein', short: 'Protein', unit: 'g', decimals: 1 },
  carbs: { label: 'Carbs', short: 'Carbs', unit: 'g', decimals: 1 },
  fat: { label: 'Fat', short: 'Fat', unit: 'g', decimals: 1 },
  fibre: { label: 'Fibre', short: 'Fibre', unit: 'g', decimals: 1 },
};

export function zeroMacros() {
  return { cal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 };
}

export function addMacros(a, b) {
  const out = {};
  for (const k of MACRO_KEYS) out[k] = (a[k] || 0) + (b[k] || 0);
  return out;
}

export function scaleMacros(m, factor) {
  const out = {};
  for (const k of MACRO_KEYS) out[k] = (m[k] || 0) * factor;
  return out;
}

/** Resolve how many grams an item represents, given its food. */
export function itemGrams(item, food) {
  if (!food) return 0;
  const qty = Number(item.qty);
  if (!Number.isFinite(qty)) return 0;
  const measure = food.measures.find((m) => m.id === item.measure)
    || food.measures.find((m) => m.id === food.defaultMeasure)
    || food.measures[0];
  return qty * (measure ? measure.grams : 1);
}

export function findMeasure(food, measureId) {
  if (!food) return null;
  return food.measures.find((m) => m.id === measureId)
    || food.measures.find((m) => m.id === food.defaultMeasure)
    || food.measures[0];
}

/** Macros contributed by `grams` of a food. */
export function macrosForGrams(food, grams) {
  if (!food) return zeroMacros();
  const f = grams / 100;
  const out = {};
  for (const k of MACRO_KEYS) out[k] = (food.per100[k] || 0) * f;
  return out;
}

/** Macros for a single line item. */
export function itemMacros(item, lookup) {
  const food = lookup(item.ing);
  return macrosForGrams(food, itemGrams(item, food));
}

/** Total macros for a whole ingredient list. */
export function itemsTotal(items, lookup) {
  return (items || []).reduce((acc, item) => addMacros(acc, itemMacros(item, lookup)), zeroMacros());
}

/**
 * Macros for one portion of a meal.
 * `makes` is how many portions the ingredient list produces — usually 1, but
 * more when you've batch-cooked.
 */
export function perServing(meal, lookup) {
  const makes = Number(meal.makes) > 0 ? Number(meal.makes) : 1;
  return scaleMacros(itemsTotal(meal.items, lookup), 1 / makes);
}

/** Macros for a logged entry: one portion × however many portions you ate. */
export function entryMacros(entry, lookup) {
  const makes = Number(entry.makes) > 0 ? Number(entry.makes) : 1;
  const servings = Number(entry.servings);
  const eaten = Number.isFinite(servings) ? servings : 0;
  return scaleMacros(itemsTotal(entry.items, lookup), eaten / makes);
}

/** Macros for every entry on a day, summed. */
export function dayTotals(entries, lookup) {
  return (entries || []).reduce((acc, e) => addMacros(acc, entryMacros(e, lookup)), zeroMacros());
}

/** Mean macros per day across a set of days. Days with nothing logged are skipped. */
export function averageTotals(days, lookup) {
  const logged = days.filter((d) => d.entries && d.entries.length);
  if (!logged.length) return { average: zeroMacros(), days: 0 };
  const sum = logged.reduce((acc, d) => addMacros(acc, dayTotals(d.entries, lookup)), zeroMacros());
  return { average: scaleMacros(sum, 1 / logged.length), days: logged.length };
}

/**
 * How each macro stands against its target.
 * `remaining` is positive when you have room left, negative when you're over.
 */
export function against(totals, targets) {
  const out = {};
  for (const k of MACRO_KEYS) {
    const target = Number(targets[k]) || 0;
    const value = totals[k] || 0;
    out[k] = {
      value,
      target,
      remaining: target - value,
      over: target > 0 && value > target,
      pct: target > 0 ? Math.min((value / target) * 100, 999) : 0,
    };
  }
  return out;
}

/**
 * Share of calories coming from each macro, as percentages summing to 100.
 * Uses Atwater factors against the computed calorie figure.
 */
export function energySplit(macros) {
  const fromProtein = (macros.protein || 0) * 4;
  const fromCarbs = (macros.carbs || 0) * 4;
  const fromFat = (macros.fat || 0) * 9;
  const total = fromProtein + fromCarbs + fromFat;
  if (total <= 0) return { protein: 0, carbs: 0, fat: 0 };
  return {
    protein: (fromProtein / total) * 100,
    carbs: (fromCarbs / total) * 100,
    fat: (fromFat / total) * 100,
  };
}

// ─── Boost suggestions ───────────────────────────────────────────────────────

/** A food has to be genuinely dense in a macro before it's worth suggesting. */
const MIN_DENSITY = { protein: 8, fibre: 4, carbs: 15, fat: 10 };

/**
 * Condiment-scale foods are dense on paper but nobody eats them by the portion.
 * Cinnamon is 53g fibre per 100g; suggesting 16 teaspoons of it is not advice.
 */
const EXCLUDED_GROUPS = new Set(['Herbs & spices', 'Oils & fats', 'Sauces & condiments']);

/** Ceilings on what counts as one sitting. */
const MAX_PORTION_G = 250;
const MAX_UNITS = 3;

/** Round a portion count to something you'd actually serve. */
function tidyQty(qty, measureGrams) {
  if (measureGrams === 1) return Math.round(qty / 5) * 5; // grams → nearest 5g
  if (qty < 1) return Math.round(qty * 4) / 4; // quarters
  if (qty < 3) return Math.round(qty * 2) / 2; // halves
  return Math.round(qty);
}

/** Same steps, but never rounding up past a cap. */
function tidyDown(qty, measureGrams) {
  if (measureGrams === 1) return Math.floor(qty / 5) * 5;
  if (qty < 1) return Math.floor(qty * 4) / 4;
  if (qty < 3) return Math.floor(qty * 2) / 2;
  return Math.floor(qty);
}

/**
 * Suggest foods that would close a macro gap, cheapest in calories first.
 *
 * @param macro          'protein' | 'fibre' | …
 * @param gap            grams still needed
 * @param calorieBudget  calories left in the day; 0 or less means "no room, but
 *                       show the leanest options anyway"
 * @param foods          candidate food list
 */
export function suggestBoosts(macro, gap, calorieBudget, foods, { limit = 4 } = {}) {
  if (!(gap > 0)) return [];
  const minDensity = MIN_DENSITY[macro] || 5;
  const budget = calorieBudget > 0 ? calorieBudget : Infinity;

  const candidates = [];
  for (const food of foods) {
    const per100 = food.per100[macro] || 0;
    if (per100 < minDensity) continue;
    if (!(food.per100.cal > 0)) continue;
    if (EXCLUDED_GROUPS.has(food.group)) continue;

    const measure = findMeasure(food, food.defaultMeasure);
    const measureGrams = measure ? measure.grams : 1;
    const perMeasure = (per100 * measureGrams) / 100;
    if (!(perMeasure > 0)) continue;

    // Aim to close the gap, but never suggest an absurd pile of one food.
    const idealQty = gap / perMeasure;
    const maxQty = Math.min(
      MAX_PORTION_G / measureGrams,
      measureGrams === 1 ? Infinity : MAX_UNITS
    );
    let qty = tidyQty(Math.min(idealQty, maxQty), measureGrams);
    // Rounding can push a portion past the ceiling — step down rather than drop it.
    if (qty * measureGrams > MAX_PORTION_G) qty = tidyDown(maxQty, measureGrams);
    if (!(qty > 0)) continue;

    const grams = qty * measureGrams;
    const provides = (per100 * grams) / 100;
    const cal = (food.per100.cal * grams) / 100;

    // Must make a real dent, and must fit what's left of the day.
    if (provides < gap * 0.25) continue;
    if (cal > budget) continue;

    candidates.push({
      food,
      qty,
      measure,
      grams,
      provides,
      cal,
      /** Calories paid per gram of the macro gained — the ranking that matters. */
      costPerGram: cal / provides,
    });
  }

  candidates.sort((a, b) => a.costPerGram - b.costPerGram);

  // One suggestion per food group, so you get variety rather than five cheeses.
  const seen = new Set();
  const picked = [];
  for (const c of candidates) {
    if (seen.has(c.food.group)) continue;
    seen.add(c.food.group);
    picked.push(c);
    if (picked.length >= limit) break;
  }
  return picked;
}
