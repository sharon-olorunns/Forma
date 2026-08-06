/**
 * The calculation engine.
 *
 * Nothing in Forma stores a macro figure. Everything is derived from
 * (ingredient per-100g values) × (quantity in grams), which is what lets you
 * change a quantity or swap an ingredient and see totals move immediately.
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

/** Resolve how many grams an item represents, given its ingredient. */
export function itemGrams(item, ingredient) {
  if (!ingredient) return 0;
  const qty = Number(item.qty);
  if (!Number.isFinite(qty)) return 0;
  const measure = ingredient.measures.find((m) => m.id === item.measure)
    || ingredient.measures.find((m) => m.id === ingredient.defaultMeasure)
    || ingredient.measures[0];
  return qty * (measure ? measure.grams : 1);
}

/** Macros contributed by `grams` of an ingredient. */
export function macrosForGrams(ingredient, grams) {
  if (!ingredient) return zeroMacros();
  const f = grams / 100;
  const out = {};
  for (const k of MACRO_KEYS) out[k] = (ingredient.per100[k] || 0) * f;
  return out;
}

/** Macros for a single recipe/entry line item. */
export function itemMacros(item, lookup) {
  const ingredient = lookup(item.ing);
  return macrosForGrams(ingredient, itemGrams(item, ingredient));
}

/** Total macros for a whole ingredient list (the full batch, not one portion). */
export function itemsTotal(items, lookup) {
  return (items || []).reduce((acc, item) => addMacros(acc, itemMacros(item, lookup)), zeroMacros());
}

/** Macros for ONE portion of a recipe. */
export function perServing(recipe, lookup) {
  const makes = Number(recipe.makes) > 0 ? Number(recipe.makes) : 1;
  return scaleMacros(itemsTotal(recipe.items, lookup), 1 / makes);
}

/**
 * Macros for a logged day entry.
 * An entry carries its own `items` + `makes` snapshot, so historical days stay
 * accurate even after the underlying recipe is edited.
 */
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

/** Mean macros per day across a set of days. Days with no entries are skipped. */
export function averageTotals(days, lookup) {
  const logged = days.filter((d) => d.entries && d.entries.length);
  if (!logged.length) return { average: zeroMacros(), days: 0 };
  const sum = logged.reduce((acc, d) => addMacros(acc, dayTotals(d.entries, lookup)), zeroMacros());
  return { average: scaleMacros(sum, 1 / logged.length), days: logged.length };
}

/**
 * Share of calories coming from each macro, as percentages that sum to 100.
 * Uses Atwater factors against the *computed* calorie figure.
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
