# Forma

*Eating as design, structure as wellness.*

Build a meal from ingredients, get the calories and macros. Set daily targets and
see exactly how far off you are — and, when you're short on protein or fibre, the
cheapest ways to close the gap.

Offline-first PWA. No accounts, no server, nothing uploaded.

---

## What it does

**Build a meal.** Search a food, add it, adjust the amount. One sweet potato, half a
bell pepper, an onion, a few cubes of chicken — the running total updates as you go.
Around 400 everyday foods are built in, each with sensible units (a breast, a slice, a
tbsp, a handful) as well as grams. Anything missing, add it once from the packet and
it's yours forever.

**Know where you stand.** Set a target for calories, protein, carbs, fat and fibre.
The day screen leads with how much room is left — or how far over you've gone — and
each macro shows the same. Before you log a meal, *Show day impact* tells you where
it would leave you.

**Close the gap.** Short on protein or fibre? Forma suggests specific foods and
amounts that would fix it, ranked by calories per gram gained, filtered to what still
fits in your day. Tap one to log it. Condiment-scale foods are excluded — cinnamon is
53g of fibre per 100g, but sixteen teaspoons of it is not advice.

**Save what works.** When a meal's numbers are good, save it. The library shows each
one as a tile whose colours come from its own macro split, so protein-heavy meals read
green and carb-heavy ones blue. Tap to log it again, or open it in the builder to
tweak first.

**History.** Every logged day with its totals, plus 7- and 28-day averages. Days you
didn't log are left out rather than counted as zero.

---

## Running it

No build step, no dependencies, no bundler. HTML, CSS and ES modules.

```sh
npm run serve      # http://localhost:8080
npm test           # 36 tests over the engine and the food data
npm run icons      # regenerate the PNG icons (pure-stdlib Python)
```

A server is needed only because service workers and ES modules require `http://`
rather than `file://`.

### Deploying

Any static host works — every path is relative, so it runs from a subpath
(`user.github.io/Forma/`) without configuration. Push, then either enable GitHub Pages
(Settings → Pages → deploy from `main`, root) or import the repo into Vercel with the
framework preset set to **Other** and no build command.

Then open it on your phone and **Add to Home Screen**.

> Data is stored per-origin. If you move the app to a different domain later, export a
> backup first and restore it on the new one — otherwise the new URL opens empty.

---

## How it's put together

```
index.html            shell: app bar, view container, tab bar
sw.js                 service worker — precaches everything, cache-first
manifest.webmanifest  install metadata
js/
  app.js              router wiring, event delegation, re-render
  router.js           hash routes (#/day/2026-08-12, #/build, #/saved …)
  store.js            state, localStorage persistence, day log, saved meals
  nutrition.js        all the arithmetic, including boost suggestions
  ui.js               escaping, formatting, sheets, toasts, focus preservation
  pwa.js              service worker registration, install prompt, update banner
  data/foods.js       ~400 foods, macros per 100g, with their handy measures
  views/              today, build, saved, history, settings
tests/                node:test suite for the engine and the data
```

**Why vanilla, no framework.** One user, one device, no server, no accounts. A build
step would add a toolchain to maintain and a `node_modules` to rot, and buys nothing
here. This way it deploys by copying files, and it will still run in five years with
no `npm install`.

**Why localStorage.** The dataset is small even after years of logging. Synchronous
reads mean no loading states anywhere, and the export is one `JSON.stringify`.

**Why logged meals snapshot their ingredients.** Logging a meal copies its ingredient
list into that day's entry. Editing a saved meal therefore never rewrites history, and
tweaking tonight's dinner never silently edits the saved version — the two only meet
when you press *Save*.

**Backups.** Data lives on the device, in one browser profile. Settings → *Export
backup* writes a JSON file; *Restore backup* reads it back. Worth doing occasionally,
since clearing browsing data would take the history with it.

---

## About the numbers

Nothing stores a macro figure. Every total is computed from per-100g values × the
weight you entered, which is what makes editing an amount update everything downstream.

- Weights are **raw / as-bought** unless the food says "cooked".
- **Carbs exclude fibre**, UK label style; fibre is counted separately.
- Values are typical UK supermarket figures, good to about ±5% — well inside the noise
  of home cooking.
- **Frying adds the oil you used**, not magic calories. Add the oil as its own line and
  you'll be close.
- Disagree with a value? Add your own version of the food from the packet and use that.

The test suite checks every food's calories against the energy in its macros (protein
and carbs at 4 cal/g, fat at 9, fibre at 2). That check found six genuine data errors
during development, so it stays.

---

## Not in v1

Barcode scanning, recipe import from the web, weight tracking, and syncing between
devices. Export/restore covers moving to a new phone.
