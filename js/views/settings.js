/** Settings: targets, hidden recipes, backup, and the honest note about numbers. */

import { html, raw, toast } from '../ui.js';
import { getState, setTargets, exportData, importData, clearAll, archiveRecipe,
  loggedDays, allRecipes } from '../store.js';
import { MACRO_KEYS, MACRO_META } from '../nutrition.js';
import { DEFAULT_TARGETS } from '../data/guide.js';
import { BUILTIN_RECIPES_BY_ID } from '../data/recipes.js';
import { APP_VERSION, canInstall, promptInstall } from '../pwa.js';

export function renderSettings() {
  const state = getState();
  const targets = state.settings.targets;
  const archived = (state.archived || []).map((id) => BUILTIN_RECIPES_BY_ID[id] || state.recipes[id]).filter(Boolean);
  const dayCount = loggedDays().length;
  const customRecipes = Object.keys(state.recipes).length;
  const customIngredients = Object.keys(state.ingredients).length;

  return html`
    <section class="view view--settings">
      <div class="card">
        <h3>Daily targets</h3>
        <div class="grid-2">
          ${raw(MACRO_KEYS.map((k) => html`
            <label class="field">
              <span>${raw(MACRO_META[k].label)}${raw(MACRO_META[k].unit ? ` (${MACRO_META[k].unit})` : '')}</span>
              <input class="input" type="number" min="0" step="1" inputmode="numeric"
                     data-action="target" data-macro="${k}" data-fk="target-${k}"
                     value="${raw(targets[k])}" />
            </label>`).join(''))}
        </div>
        <button class="btn btn--ghost btn--sm" data-action="reset-targets">Reset to the plan's targets</button>
        <p class="hint">Plan defaults: ${raw(DEFAULT_TARGETS.cal)} cal · ${raw(DEFAULT_TARGETS.protein)}g protein ·
          ${raw(DEFAULT_TARGETS.carbs)}g carbs · ${raw(DEFAULT_TARGETS.fat)}g fat · ${raw(DEFAULT_TARGETS.fibre)}g fibre.</p>
      </div>

      ${raw(canInstall() ? html`
        <div class="card card--accent">
          <h3>Install Forma</h3>
          <p>Add it to your home screen and it opens like any other app, online or not.</p>
          <button class="btn btn--primary" data-action="install">Install</button>
        </div>` : '')}

      <div class="card">
        <h3>Your data</h3>
        <dl class="stat-list">
          <div><dt>Days logged</dt><dd>${raw(dayCount)}</dd></div>
          <div><dt>Recipes</dt><dd>${raw(allRecipes().length)} <span class="muted">(${raw(customRecipes)} yours)</span></dd></div>
          <div><dt>Custom ingredients</dt><dd>${raw(customIngredients)}</dd></div>
        </dl>
        <p class="hint">Everything lives on this device only — nothing is uploaded anywhere. Export now and then so a
          cleared browser can't take your history with it.</p>
        <div class="button-row">
          <button class="btn btn--ghost" data-action="export">Export backup</button>
          <button class="btn btn--ghost" data-action="import">Restore backup</button>
        </div>
        <input type="file" accept="application/json,.json" data-role="import-file" hidden />
      </div>

      ${raw(archived.length ? html`
        <div class="card">
          <h3>Hidden recipes</h3>
          <ul class="simple-list">
            ${raw(archived.map((r) => html`
              <li>
                <span>${r.name}</span>
                <button class="btn btn--sm btn--ghost" data-action="unarchive" data-id="${r.id}">Restore</button>
              </li>`).join(''))}
          </ul>
        </div>` : '')}

      <div class="card">
        <h3>About the numbers</h3>
        <p>Forma computes every figure from the ingredient list — per-100g values × the weight you entered. Change a
          quantity and the totals move with it.</p>
        <p>That means the totals won't always match the round numbers printed in <em>The Kitchen · Two Meals</em>.
          Those were sensible estimates; these are the arithmetic. Where they disagree, the recipe page shows both.</p>
        <ul class="bullets">
          <li>Weights are raw / as-bought — dry rice, raw mince, raw chicken.</li>
          <li>Carbs exclude fibre, UK label style. Fibre is counted separately.</li>
          <li>Ingredient values are typical supermarket figures, good to about ±5%.</li>
          <li>Edit any ingredient's values by adding your own version from the packet.</li>
        </ul>
      </div>

      <div class="card">
        <h3 class="danger-title">Danger zone</h3>
        <button class="btn btn--ghost btn--danger" data-action="clear-all">Delete everything</button>
        <p class="hint">Wipes history, your recipes and your settings from this device. Export first.</p>
      </div>

      <p class="version">Forma v${raw(APP_VERSION)}</p>
    </section>`;
}

export function settingsActions(event, rerender) {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;

  switch (action) {
    case 'target': {
      // Ignore the empty field mid-edit, otherwise clearing it snaps the target to 0.
      if (target.value.trim() === '') return;
      const value = Number(target.value);
      if (Number.isFinite(value) && value >= 0) setTargets({ [target.dataset.macro]: value });
      return;
    }
    case 'reset-targets':
      setTargets({ ...DEFAULT_TARGETS });
      toast('Targets reset');
      return;
    case 'install':
      promptInstall();
      return;
    case 'export':
      downloadBackup();
      return;
    case 'import': {
      const input = document.querySelector('[data-role="import-file"]');
      input.value = '';
      input.click();
      return;
    }
    case 'unarchive':
      archiveRecipe(target.dataset.id, false);
      toast('Recipe restored');
      return;
    case 'clear-all':
      if (!confirm('Delete all Forma data on this device? This cannot be undone.')) return;
      if (!confirm('Really delete everything? Export a backup first if you might want it back.')) return;
      clearAll();
      toast('All data cleared');
      return;
    default:
  }
}

export function settingsChange(event) {
  const input = event.target.closest('[data-role="import-file"]');
  if (!input || !input.files || !input.files[0]) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      importData(String(reader.result));
      toast('Backup restored');
    } catch (err) {
      alert(`Could not restore that file.\n\n${err.message}`);
    }
  };
  reader.readAsText(input.files[0]);
}

function downloadBackup() {
  const blob = new Blob([exportData()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `forma-backup-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Backup downloaded');
}
