/** Settings: targets, your own foods, backup, and the note about the numbers. */

import { html, raw, bigValue, toast } from '../ui.js';
import {
  getState, setTargets, exportData, importData, clearAll, loggedDays, allMeals,
} from '../store.js';
import { MACRO_KEYS, MACRO_META } from '../nutrition.js';
import { DEFAULT_TARGETS, FOODS } from '../data/foods.js';
import { APP_VERSION, canInstall, promptInstall } from '../pwa.js';

export function renderSettings() {
  const state = getState();
  const targets = state.settings.targets;
  const customFoods = Object.keys(state.foods).length;

  return html`
    <section class="view view--settings">
      <div class="card">
        <h3>Daily targets</h3>
        <p class="hint">Everything on the day screen is measured against these.</p>
        <div class="grid-2">
          ${raw(MACRO_KEYS.map((k) => html`
            <label class="field">
              <span>${raw(MACRO_META[k].label)}${raw(MACRO_META[k].unit ? ` (${MACRO_META[k].unit})` : '')}</span>
              <input class="input" type="number" min="0" step="1" inputmode="numeric"
                     data-action="target" data-macro="${k}" data-fk="target-${k}"
                     value="${raw(targets[k])}" />
            </label>`).join(''))}
        </div>
        <button class="btn btn--ghost btn--sm" data-action="reset-targets">Reset to defaults</button>
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
          <div><dt>Days logged</dt><dd>${raw(loggedDays().length)}</dd></div>
          <div><dt>Saved meals</dt><dd>${raw(allMeals().length)}</dd></div>
          <div><dt>Foods</dt><dd>${raw(FOODS.length + customFoods)} <span class="muted">(${raw(customFoods)} yours)</span></dd></div>
        </dl>
        <p class="hint">Everything lives on this device only — nothing is uploaded anywhere. Export now and
          then, so a cleared browser can't take your history with it.</p>
        <div class="button-row">
          <button class="btn btn--ghost" data-action="export">Export backup</button>
          <button class="btn btn--ghost" data-action="import">Restore backup</button>
        </div>
        <input type="file" accept="application/json,.json" data-role="import-file" hidden />
      </div>

      <div class="card">
        <h3>About the numbers</h3>
        <p>Forma computes every figure from the ingredient list — per-100g values × the weight you
          entered. Change an amount and the totals move with it.</p>
        <ul class="bullets">
          <li>Weights are raw / as-bought unless a food says “cooked”.</li>
          <li>Carbs exclude fibre, UK label style. Fibre is counted separately.</li>
          <li>Values are typical UK supermarket figures, good to about ±5%.</li>
          <li>Frying adds the oil you used — add it as its own line and you'll be close.</li>
          <li>Disagree with a value? Add your own version from the packet and use that instead.</li>
        </ul>
      </div>

      <div class="card">
        <h3 class="danger-title">Danger zone</h3>
        <button class="btn btn--ghost btn--danger" data-action="clear-all">Delete everything</button>
        <p class="hint">Wipes your history, saved meals and settings from this device. Export first.</p>
      </div>

      <p class="version">Forma v${raw(APP_VERSION)}</p>
    </section>`;
}

export function settingsActions(event) {
  const target = event.target.closest('[data-action]');
  if (!target) return;

  switch (target.dataset.action) {
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
  link.href = url;
  link.download = `forma-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Backup downloaded');
}
