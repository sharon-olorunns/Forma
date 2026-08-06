/**
 * Ingredient catalogue.
 *
 * Every ingredient stores macros per 100g. Everything else in the app — recipe
 * totals, per-serving figures, day totals — is derived from this table, so
 * editing a quantity anywhere recomputes correctly.
 *
 * Conventions:
 *  - Weights are RAW / AS-BOUGHT (dry rice, raw mince, raw chicken). That is how
 *    the recipes are written, and it avoids guessing at cooked yields.
 *  - `carbs` is available carbohydrate, UK label style. Fibre is listed
 *    separately and is NOT included in the carb figure.
 *  - Values are typical UK supermarket / composition-table figures. They are
 *    good to about ±5%, which is well inside the noise of home cooking.
 */

const G = [{ id: 'g', label: 'g', grams: 1 }];

/** Compact constructor so the table below stays readable. */
function ing(id, name, group, [cal, protein, carbs, fat, fibre], measures = G, defaultMeasure = null) {
  return {
    id,
    name,
    group,
    per100: { cal, protein, carbs, fat, fibre },
    measures,
    defaultMeasure: defaultMeasure || measures[0].id,
  };
}

/** Build a measure list: unit measures first, always with grams as a fallback. */
function units(...defs) {
  return [...defs.map(([id, label, grams]) => ({ id, label, grams })), ...G];
}

export const INGREDIENTS = [
  // ─── Meat, fish, protein ────────────────────────────────────────────────
  ing('chicken-mince', 'Chicken mince', 'Meat & fish', [143, 21.7, 0, 6.0, 0]),
  ing('turkey-mince', 'Turkey mince (5% fat)', 'Meat & fish', [137, 22.0, 0, 5.0, 0]),
  ing('beef-mince-5', 'Beef mince (5% fat)', 'Meat & fish', [136, 21.5, 0, 5.0, 0]),
  ing('chicken-thigh', 'Chicken thigh, boneless skin-on', 'Meat & fish', [211, 17.5, 0, 15.5, 0],
    units(['thigh', 'thigh', 95]), 'thigh'),
  ing('chicken-thigh-skinless', 'Chicken thigh, boneless skinless', 'Meat & fish', [121, 19.7, 0, 4.7, 0],
    units(['thigh', 'thigh', 85]), 'thigh'),
  ing('chicken-sausage', 'Chicken sausage', 'Meat & fish', [172, 14.0, 4.0, 11.0, 0.5],
    units(['sausage', 'sausage', 57]), 'sausage'),
  ing('sardines-hot-pepper', 'Hot pepper sardines (drained)', 'Meat & fish', [208, 24.6, 0.5, 12.0, 0],
    units(['tin', 'tin', 95]), 'tin'),
  ing('tuna-tin', 'Tuna in spring water (drained)', 'Meat & fish', [108, 25.5, 0, 0.6, 0],
    units(['tin', 'tin', 112]), 'tin'),
  ing('biltong', 'Biltong', 'Meat & fish', [300, 50.0, 2.0, 9.0, 0]),
  ing('beef-jerky', 'Beef jerky', 'Meat & fish', [280, 33.0, 17.0, 6.0, 1.0]),

  // ─── Eggs & dairy ───────────────────────────────────────────────────────
  ing('egg', 'Egg (medium/large)', 'Eggs & dairy', [143, 12.6, 0.7, 9.5, 0],
    units(['egg', 'egg', 50]), 'egg'),
  ing('greek-yogurt-0', 'Greek yogurt, 0% fat', 'Eggs & dairy', [57, 10.0, 4.0, 0.2, 0],
    units(['tbsp', 'tbsp', 15]), 'g'),
  ing('greek-yogurt-5', 'Greek yogurt, 5% fat', 'Eggs & dairy', [97, 9.0, 3.6, 5.0, 0],
    units(['tbsp', 'tbsp', 15]), 'g'),
  ing('mozzarella-light', 'Light mozzarella', 'Eggs & dairy', [190, 25.0, 1.5, 9.0, 0],
    units(['ball', 'ball', 100]), 'g'),

  // ─── Carbs & grains ─────────────────────────────────────────────────────
  ing('rice-white-dry', 'White rice (dry)', 'Carbs & grains', [360, 7.0, 79.0, 1.0, 1.3]),
  ing('lentils-dry', 'Green/brown lentils (dry)', 'Carbs & grains', [318, 24.5, 45.0, 1.5, 15.0]),
  ing('bagel', 'Bagel, plain', 'Carbs & grains', [250, 10.0, 47.0, 1.4, 2.1],
    units(['bagel', 'bagel', 85]), 'bagel'),
  ing('bagel-seeded', 'Bagel, seeded', 'Carbs & grains', [265, 11.0, 44.0, 4.0, 5.5],
    units(['bagel', 'bagel', 85]), 'bagel'),
  ing('sourdough', 'Sourdough bread', 'Carbs & grains', [250, 9.5, 47.0, 1.5, 2.9],
    units(['slice', 'slice', 42]), 'slice'),
  ing('crackers', 'Crackers', 'Carbs & grains', [430, 9.0, 70.0, 13.0, 3.0],
    units(['cracker', 'cracker', 8]), 'cracker'),
  ing('oats', 'Oats', 'Carbs & grains', [379, 13.5, 58.0, 8.0, 10.0],
    units(['cup', 'cup', 90]), 'g'),

  // ─── Veg ────────────────────────────────────────────────────────────────
  ing('sweet-potato', 'Sweet potato', 'Veg', [86, 1.6, 18.0, 0.1, 2.5],
    units(['potato', 'potato', 200]), 'potato'),
  ing('onion', 'White onion', 'Veg', [40, 1.1, 8.0, 0.1, 1.7],
    units(['onion', 'onion', 110]), 'onion'),
  ing('red-onion', 'Red onion', 'Veg', [40, 1.1, 8.0, 0.1, 1.7],
    units(['onion', 'onion', 110]), 'onion'),
  ing('garlic', 'Garlic', 'Veg', [149, 6.4, 30.0, 0.5, 2.1],
    units(['clove', 'clove', 3], ['bulb', 'bulb', 40]), 'clove'),
  ing('red-pepper', 'Red pepper', 'Veg', [31, 1.0, 6.0, 0.3, 2.1],
    units(['pepper', 'pepper', 150]), 'pepper'),
  ing('jalapeno', 'Jalapeño', 'Veg', [29, 0.9, 4.0, 0.4, 2.8],
    units(['each', 'jalapeño', 14]), 'each'),
  ing('thai-chilli', 'Thai chilli', 'Veg', [40, 1.9, 8.8, 0.4, 1.5],
    units(['each', 'chilli', 2]), 'each'),
  ing('fresno-chilli', 'Fresno chilli', 'Veg', [40, 1.9, 8.8, 0.4, 1.5],
    units(['each', 'chilli', 15]), 'each'),
  ing('spinach', 'Spinach', 'Veg', [23, 2.9, 1.4, 0.4, 2.2],
    units(['handful', 'handful', 30]), 'handful'),
  ing('tomato', 'Tomato', 'Veg', [18, 0.9, 3.1, 0.2, 1.2],
    units(['tomato', 'tomato', 120]), 'tomato'),
  ing('cherry-tomato', 'Cherry tomatoes', 'Veg', [18, 0.9, 3.1, 0.2, 1.2],
    units(['each', 'tomato', 15], ['punnet', 'punnet', 250]), 'each'),
  ing('cucumber', 'Cucumber', 'Veg', [15, 0.7, 3.0, 0.1, 0.5],
    units(['whole', 'whole', 300], ['third', 'third', 100]), 'g'),
  ing('avocado', 'Avocado', 'Veg', [160, 2.0, 1.8, 14.7, 6.7],
    units(['half', 'half', 100], ['whole', 'whole', 200]), 'half'),
  ing('red-cabbage', 'Red cabbage', 'Veg', [31, 1.4, 5.0, 0.2, 2.1],
    units(['quarter', 'quarter head', 200], ['head', 'head', 800]), 'quarter'),
  ing('carrot', 'Carrot', 'Veg', [41, 0.9, 8.0, 0.2, 2.8],
    units(['carrot', 'carrot', 80]), 'carrot'),
  ing('green-beans', 'Green beans', 'Veg', [31, 1.8, 5.0, 0.2, 3.4],
    units(['handful', 'handful', 80]), 'handful'),
  ing('broccoli', 'Broccoli', 'Veg', [34, 2.8, 4.0, 0.4, 2.6],
    units(['handful', 'handful', 80]), 'handful'),

  // ─── Tins & pulses ──────────────────────────────────────────────────────
  ing('black-beans', 'Black beans, tinned (drained)', 'Tins & pulses', [91, 6.0, 12.0, 0.5, 7.0],
    units(['tin', 'tin', 240], ['half-tin', 'half tin', 120], ['tbsp', 'heaped tbsp', 25]), 'half-tin'),
  ing('chickpeas', 'Chickpeas, tinned (drained)', 'Tins & pulses', [119, 7.2, 13.0, 2.6, 6.5],
    units(['tin', 'tin', 240], ['half-tin', 'half tin', 120], ['tbsp', 'heaped tbsp', 25]), 'half-tin'),

  // ─── Herbs & aromatics ──────────────────────────────────────────────────
  ing('thai-basil', 'Thai / sweet basil', 'Herbs & aromatics', [23, 3.2, 1.0, 0.6, 1.6],
    units(['handful', 'handful', 10]), 'handful'),
  ing('dill', 'Fresh dill', 'Herbs & aromatics', [43, 3.5, 2.0, 1.1, 2.1],
    units(['handful', 'handful', 5]), 'handful'),
  ing('parsley', 'Fresh parsley', 'Herbs & aromatics', [36, 3.0, 2.4, 0.8, 3.3],
    units(['handful', 'handful', 5]), 'handful'),
  ing('coriander', 'Fresh coriander', 'Herbs & aromatics', [23, 2.1, 0.9, 0.5, 2.8],
    units(['handful', 'handful', 5]), 'handful'),
  ing('capers', 'Capers', 'Herbs & aromatics', [23, 2.4, 1.7, 0.9, 3.2],
    units(['tbsp', 'tbsp', 9]), 'tbsp'),
  ing('lemon-juice', 'Lemon juice', 'Herbs & aromatics', [22, 0.4, 6.5, 0.2, 0.3],
    units(['squeeze', 'squeeze', 10], ['lemon', 'whole lemon', 45]), 'squeeze'),
  ing('lime-juice', 'Lime juice', 'Herbs & aromatics', [25, 0.4, 8.4, 0.1, 0.4],
    units(['squeeze', 'squeeze', 10], ['lime', 'whole lime', 40]), 'squeeze'),
  ing('salt-pepper', 'Salt + pepper', 'Herbs & aromatics', [0, 0, 0, 0, 0],
    units(['pinch', 'to taste', 1]), 'pinch'),

  // ─── Fruit ──────────────────────────────────────────────────────────────
  ing('kiwi', 'Kiwi', 'Fruit', [61, 1.1, 12.0, 0.5, 3.0],
    units(['each', 'kiwi', 75]), 'each'),
  ing('orange', 'Orange', 'Fruit', [47, 0.9, 9.0, 0.1, 2.4],
    units(['each', 'orange', 130], ['half', 'half', 65]), 'each'),
  ing('berries', 'Berries (fresh or frozen)', 'Fruit', [43, 0.9, 8.0, 0.4, 3.5],
    units(['handful', 'handful', 40]), 'handful'),
  ing('banana', 'Banana', 'Fruit', [89, 1.1, 21.0, 0.3, 2.6],
    units(['each', 'banana', 118]), 'each'),

  // ─── Oils, sauces & pantry ──────────────────────────────────────────────
  ing('olive-oil', 'Olive oil', 'Oils & sauces', [884, 0, 0, 100, 0],
    units(['tbsp', 'tbsp', 13.5], ['tsp', 'tsp', 4.5], ['drizzle', 'drizzle', 7]), 'tbsp'),
  ing('rapeseed-oil', 'Rapeseed oil', 'Oils & sauces', [884, 0, 0, 100, 0],
    units(['tbsp', 'tbsp', 14], ['tsp', 'tsp', 4.7]), 'tbsp'),
  ing('oyster-sauce', 'Oyster sauce', 'Oils & sauces', [130, 2.0, 28.0, 0.3, 0.3],
    units(['tsp', 'tsp', 6], ['tbsp', 'tbsp', 18]), 'tsp'),
  ing('light-soy', 'Light soy sauce', 'Oils & sauces', [53, 5.0, 5.0, 0.1, 0.5],
    units(['tsp', 'tsp', 6], ['tbsp', 'tbsp', 18], ['splash', 'splash', 5]), 'tsp'),
  ing('dark-soy', 'Dark soy sauce', 'Oils & sauces', [80, 3.5, 15.0, 0.1, 0.5],
    units(['splash', 'splash', 5], ['tsp', 'tsp', 6]), 'splash'),
  ing('jerk-sauce', 'Levi Roots Reggae Jerk BBQ Sauce', 'Oils & sauces', [180, 1.0, 40.0, 0.5, 0.8],
    units(['tbsp', 'tbsp', 18]), 'tbsp'),
  ing('tomato-paste', 'Tomato paste', 'Oils & sauces', [82, 4.3, 12.0, 0.5, 2.8],
    units(['tbsp', 'tbsp', 16]), 'tbsp'),
  ing('harissa', 'Harissa', 'Oils & sauces', [130, 3.0, 8.0, 9.0, 4.0],
    units(['tsp', 'tsp', 6], ['tbsp', 'tbsp', 18]), 'tsp'),

  // ─── Spices & sweet ─────────────────────────────────────────────────────
  ing('taco-seasoning', 'Taco seasoning', 'Spices & baking', [300, 8.0, 50.0, 5.0, 12.0],
    units(['tbsp', 'tbsp', 8], ['tsp', 'tsp', 2.7]), 'tbsp'),
  ing('zaatar', "Za'atar", 'Spices & baking', [350, 12.0, 25.0, 20.0, 20.0],
    units(['tsp', 'tsp', 2.5], ['tbsp', 'tbsp', 7.5]), 'tsp'),
  ing('paprika', 'Paprika', 'Spices & baking', [282, 14.0, 34.0, 13.0, 35.0],
    units(['tsp', 'tsp', 2.3]), 'tsp'),
  ing('garlic-powder', 'Garlic powder', 'Spices & baking', [331, 17.0, 60.0, 0.7, 9.0],
    units(['tsp', 'tsp', 3]), 'tsp'),
  ing('sugar', 'Sugar', 'Spices & baking', [400, 0, 100, 0, 0],
    units(['tsp', 'tsp', 4], ['tbsp', 'tbsp', 12]), 'tsp'),
  ing('almond-flour', 'Blanched almond flour', 'Spices & baking', [590, 21.0, 7.0, 52.0, 11.0],
    units(['cup', 'cup', 96], ['half-cup', 'half cup', 48]), 'cup'),
  ing('cashew-butter', 'Cashew / almond butter (natural)', 'Spices & baking', [580, 18.0, 28.0, 46.0, 3.0],
    units(['cup', 'cup', 256], ['tbsp', 'tbsp', 16]), 'tbsp'),
  ing('peanut-butter', 'Peanut butter (natural)', 'Spices & baking', [588, 25.0, 12.0, 50.0, 6.0],
    units(['cup', 'cup', 258], ['tbsp', 'tbsp', 16]), 'tbsp'),
  ing('maple-syrup', 'Maple syrup', 'Spices & baking', [260, 0, 67.0, 0, 0],
    units(['cup', 'cup', 320], ['third-cup', 'third cup', 107], ['tbsp', 'tbsp', 20]), 'tbsp'),
  ing('honey', 'Honey', 'Spices & baking', [304, 0.3, 82.0, 0, 0],
    units(['tbsp', 'tbsp', 21], ['tsp', 'tsp', 7]), 'tbsp'),
  ing('choc-chips', 'Dark chocolate chips', 'Spices & baking', [480, 4.2, 60.0, 28.0, 7.0],
    units(['cup', 'cup', 170], ['half-cup', 'half cup', 85]), 'half-cup'),
  ing('vanilla', 'Vanilla extract', 'Spices & baking', [288, 0.1, 12.7, 0.1, 0],
    units(['tsp', 'tsp', 4.2]), 'tsp'),
  ing('protein-powder', 'Protein powder (unflavoured/vanilla)', 'Spices & baking', [380, 78.0, 8.0, 4.0, 2.0],
    units(['cup', 'cup', 90], ['half-cup', 'half cup', 45], ['scoop', 'scoop', 30]), 'scoop'),
  ing('nuts-mixed', 'Mixed nuts', 'Spices & baking', [607, 20.0, 12.0, 54.0, 7.0],
    units(['handful', 'handful', 25]), 'handful'),

  // ─── Drinks ─────────────────────────────────────────────────────────────
  ing('coffee-black', 'Black coffee / tea', 'Drinks', [1, 0.1, 0, 0, 0],
    units(['cup', 'cup', 240]), 'cup'),
];

export const INGREDIENT_GROUPS = [...new Set(INGREDIENTS.map((i) => i.group))];

/** id → ingredient, for the built-in catalogue only. */
export const BUILTIN_INGREDIENTS_BY_ID = Object.fromEntries(INGREDIENTS.map((i) => [i.id, i]));
