# Forma

*Eating as design, structure as wellness.*

A personal, offline-first calorie and macro tracker built around a fixed rotation of
meals. Pick what you ate, adjust the portion, tweak an ingredient — calories, protein,
carbs, fat and fibre recompute as you go.

Built from *The Kitchen · Two Meals*, the recipe sheet and the storage guide.

---

## What it does

**Today** — pick meals for any date and watch the totals build against your targets.
Bump servings up or down with the stepper; a half portion counts as half. Anything
off-plan goes in as a single ingredient, so a free day still tracks.

**Tweak a meal** — tap a logged meal to open its ingredient list. Change a quantity,
swap an ingredient, drop one entirely, and the macros move immediately. Edits apply to
*that day only* until you press **Save to recipes**, which either updates the recipe or
saves it as a new one.

**Recipes** — the full rotation, each with computed macros, method, plate breakdown and
storage notes. Edit any of them. Editing a built-in recipe never destroys it: your
version takes its place in the list, and *Revert to original* brings the original back.
Duplicate, create from scratch, or hide the ones you never cook.

**History** — every logged day with its totals, plus rolling 7- and 28-day averages.
Days you didn't log are left out of the average rather than counted as zero. Copy any
past day onto today with one tap.

**Storage** — the preservation guide, searchable: how long each cooked meal keeps, the
reheating rules, shelf life for fresh ingredients, the tricks for making herbs and
salad last, portions by hand, and the cook-once-eat-3× system.

Everything works offline and installs to your home screen.

---

## Running it

No build step, no dependencies, no bundler. It is HTML, CSS and ES modules.

```sh
npm run serve      # http://localhost:8080
npm test           # 24 tests over the calculation engine and data integrity
npm run icons      # regenerate the PNG icons (pure-stdlib Python)
```

A server is needed only because service workers and ES modules require `http://`
rather than `file://`.

### Deploying

Any static host works. For GitHub Pages: push, then Settings → Pages → deploy from
branch, root. Every path in the app is relative, so it works from a project subpath
(`user.github.io/Forma/`) without configuration.

Then open it on your phone and **Add to Home Screen**. It runs full-screen, offline,
and keeps its data across restarts.

---

## How it's put together

```
index.html            shell: app bar, view container, tab bar
sw.js                 service worker — precaches everything, cache-first
manifest.webmanifest  install metadata
js/
  app.js              router wiring, event delegation, re-render
  router.js           hash routes (#/day/2026-08-06, #/recipes/:id/edit …)
  store.js            state, localStorage persistence, day log, recipe CRUD
  nutrition.js        all the arithmetic — the only place macros are computed
  ui.js               escaping, formatting, sheets, toasts, focus preservation
  pwa.js              service worker registration, install prompt, update banner
  data/               ingredients, recipes, storage guide
  components/         ingredient list editor, pickers
  views/              today, recipes, recipeEdit, history, guide, settings
tests/                node:test suite for the engine and the data
```

**Why vanilla, no framework.** One user, one device, no server, no accounts. A build
step would add a toolchain to maintain and a `node_modules` to rot, and buys nothing
here — the app is a few thousand lines of DOM and arithmetic. This way it deploys by
copying files, and it will still run in five years with no `npm install`.

**Why localStorage.** The whole dataset is a few hundred KB even after years of
logging. Synchronous reads mean no loading states anywhere, and the export is one
`JSON.stringify`. IndexedDB would buy capacity that will never be needed.

**Why entries snapshot their ingredients.** Adding a meal to a day copies its
ingredient list into the entry. Editing a recipe therefore never rewrites history, and
tweaking tonight's dinner never silently changes the saved recipe — the two are only
connected when you press *Save to recipes*.

**Backups.** Data lives on the device, in one browser profile. Nothing is uploaded
anywhere. Settings → *Export backup* writes a JSON file; *Restore backup* reads it
back. Worth doing occasionally, since clearing browsing data would take the history
with it.

---

## About the numbers

Forma computes every figure from the ingredient list — per-100g values × the weight you
entered — rather than storing a fixed number per recipe. That is what makes editing an
ingredient update the macros, and it means the totals sometimes differ from the round
numbers printed in the original guide. Where they do, each recipe page shows both.

The differences are mostly honest arithmetic catching optimistic estimates:

| Recipe | Computed | Printed guide |
|---|---|---|
| Loaded Sardine Salad | ~1,030 cal | ~700 cal |
| Big Omelette + Fruit | ~875 cal | ~720 cal |
| Crispy Chicken, Lentil Rice | ~915 cal | ~800 cal |
| Thai Basil Mince | ~740 cal | ~760 cal |
| Jerk Chicken + Sweet Potato | ~695 cal | ~780 cal |
| Taco Sweet Potato Boats | ~580 cal | ~790 cal |
| All five protein hits | within ~15 cal | — |

They largely cancel out across a day: a plan day of sardine salad + biltong + Thai basil
mince computes to **1,917 cal and 139g protein**, against targets of 1,950 and 145g.

Conventions:

- Weights are **raw / as-bought** — dry rice, raw mince, raw chicken. That's how the
  recipes are written and it avoids guessing at cooked yields.
- **Carbs exclude fibre**, UK label style; fibre is counted separately.
- Ingredient values are typical UK supermarket figures, good to about ±5% — well inside
  the noise of home cooking.
- Disagree with a value? Add your own version of the ingredient from the packet
  (ingredient picker → *New ingredient*) and use that instead.

Default targets come from the plan: 1,950 cal · 145g protein · 190g carbs · 62g fat ·
32g fibre. All editable in Settings.

---

## Not in v1

Shopping list generation, a cook-up planner, weight tracking, and syncing between
devices. The export/restore pair covers moving to a new phone.
