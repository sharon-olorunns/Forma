/**
 * Storage + preservation guide, and the plan reference material.
 * Content from Storage_Guide.txt and The Kitchen · Two Meals.
 */

export const REHEATING_RULES = [
  'Microwave until steaming hot all the way through, not just warm.',
  'Stir halfway so the middle heats.',
  "Only reheat a portion ONCE — don't reheat leftovers of leftovers.",
  'If in doubt after 4 days, bin it.',
];

export const FRESH_SHELF_LIFE = [
  {
    window: 'Lasts 1–2 weeks',
    tone: 'good',
    items: [
      ['Sweet potatoes', 'Cool dark cupboard, not the fridge'],
      ['Onions + garlic', 'Cupboard, not the fridge'],
      ['Carrots, red cabbage', 'Fridge drawer'],
      ['Lemons, oranges, kiwi', 'Fridge or counter'],
      ['Eggs', 'Fridge'],
    ],
  },
  {
    window: 'Lasts 4–6 days',
    tone: 'mid',
    items: [
      ['Chicken thighs, mince', 'Fridge — or freeze on day 1'],
      ['Peppers, cucumber, tomatoes', 'Tomatoes on the counter'],
      ['Bagels', 'Or freeze and toast from frozen'],
    ],
  },
  {
    window: 'Lasts 2–3 days',
    tone: 'warn',
    items: [
      ['Spinach, salad leaves', 'Kitchen roll in the bag'],
      ['Fresh herbs', 'See the trick below'],
      ['Avocado once ripe', 'Fridge slows it down'],
      ['Berries', 'Or buy frozen'],
    ],
  },
];

export const KEEPING_ALIVE = [
  {
    title: 'Fresh herbs',
    subtitle: 'basil, dill, parsley, coriander',
    steps: [
      'Trim stems, stand in a glass of water like flowers.',
      'Cover loosely with a bag, keep in the fridge (basil: room temp).',
      'Doubles their life to about a week.',
      'Or: chop + freeze in an ice cube tray with olive oil.',
    ],
  },
  {
    title: 'Spinach + salad leaves',
    steps: [
      'Put a sheet of kitchen roll in the bag or tub.',
      'It absorbs moisture, which is what makes leaves go slimy.',
    ],
  },
  {
    title: 'Avocado',
    steps: [
      "Buy 2 at different ripeness so they don't both go at once.",
      'Slow a ripe one down by putting it in the fridge.',
      'Cut half: leave the stone in, lemon juice on the surface, wrap tight.',
    ],
  },
  {
    title: 'Tomatoes',
    steps: ['Keep on the counter, NOT the fridge — the fridge kills the flavour.'],
  },
  {
    title: 'Bread + bagels',
    steps: ['Freeze on day 1, toast straight from frozen.', 'Stops the whole pack going stale.'],
  },
  {
    title: 'Mince + chicken',
    steps: [
      "If you won't cook it within 2 days, freeze it the day you buy it.",
      'Portion mince into 500g bags before freezing.',
      'Defrost overnight in the fridge, never on the counter.',
    ],
  },
];

export const COOK_ONCE_SYSTEM = {
  title: 'The cook-once-eat-3× system',
  steps: [
    'Cook a batch (makes 3 portions).',
    'Eat one that night.',
    'Fridge two in separate tubs — grab and go.',
    "If you won't eat the third within 4 days, freeze it on day 1 (not day 4 — freeze it while it's still fresh).",
  ],
  result: '2 cook-ups a week = 6 dinners + 2 lunches.',
};

export const PORTIONS_BY_HAND = [
  ['Palm and a half', 'Protein (meat, fish, eggs)', '~40–50g protein'],
  ['Cupped handful', 'Carbs (rice, potato, lentils)', '~30–40g carbs'],
  ['Fist', 'Veg + salad', 'As much as you like'],
  ['Thumb', 'Fats (oil, cheese, avocado)', '~10–12g fat'],
];

export const WEEK_SHAPE = [
  ['Sun', 'Sardine salad', 'Yogurt', 'COOK: Jerk chicken (×3)'],
  ['Mon', 'Omelette', 'Biltong', 'Jerk chicken'],
  ['Tue', 'Jerk chicken (leftover)', 'Eggs', 'COOK: Thai basil mince (×3)'],
  ['Wed', 'Thai mince (leftover)', 'Yogurt', 'Thai basil mince'],
  ['Thu', 'Sardine salad', 'Biltong', 'Thai basil mince'],
  ['Fri', 'Omelette', 'Eggs', 'FREE'],
  ['Sat', 'FREE', '—', 'FREE'],
];

/** Default daily targets from the plan. Editable in Settings. */
export const DEFAULT_TARGETS = {
  cal: 1950,
  protein: 145,
  carbs: 190,
  fat: 62,
  fibre: 32,
};
