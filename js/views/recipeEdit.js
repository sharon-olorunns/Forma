/**
 * Recipe editor.
 *
 * Editing a built-in recipe never destroys the original: saving creates your own
 * copy that takes its place in the list, and "Revert to original" on the detail
 * page brings the built-in back.
 */

import { html, raw, esc, macroSummary, toast } from '../ui.js';
import { lookupRecipe, lookupIngredient, saveRecipe, blankRecipe, isUserRecipe } from '../store.js';
import { itemsTotal, scaleMacros } from '../nutrition.js';
import { renderItemsEditor, applyItemsAction, refreshItemsDisplay } from '../components/itemsEditor.js';
import { CATEGORIES } from '../data/recipes.js';
import { navigate } from '../router.js';

/** The in-progress draft. Kept in module scope so re-renders don't lose edits. */
let draft = null;
let draftKey = null;

function startDraft(mode, id) {
  if (mode === 'new') return { ...blankRecipe(), items: [] };
  const source = lookupRecipe(id);
  if (!source) return null;
  const copy = {
    ...source,
    items: source.items.map((i) => ({ ...i })),
    method: [...(source.method || [])],
    tags: [...(source.tags || [])],
    plate: (source.plate || []).map((p) => [...p]),
    storage: { ...(source.storage || { fridge: '', freezer: '', notes: [] }) },
  };
  copy.storage.notes = [...(copy.storage.notes || [])];
  if (mode === 'copy') {
    copy.name = `${source.name} (copy)`;
    copy.userCreated = true;
    copy.basedOn = null;
    copy.edited = false;
    delete copy.guide;
  }
  return copy;
}

export function renderRecipeEdit(params, mode) {
  const key = `${mode}:${params.id || 'new'}`;
  if (draftKey !== key || !draft) {
    draft = startDraft(mode, params.id);
    draftKey = key;
  }
  if (!draft) {
    return html`<section class="view"><p class="empty">That recipe no longer exists.</p></section>`;
  }

  const makes = Number(draft.makes) > 0 ? Number(draft.makes) : 1;
  const per = scaleMacros(itemsTotal(draft.items, lookupIngredient), 1 / makes);
  const editingBuiltin = mode === 'edit' && !isUserRecipe(draft.id);

  return html`
    <section class="view view--edit">
      <header class="detail-head">
        <button class="link-btn" data-action="cancel-edit">‹ Cancel</button>
        <h2>${raw(mode === 'new' ? 'New recipe' : mode === 'copy' ? 'Duplicate recipe' : 'Edit recipe')}</h2>
        ${raw(editingBuiltin ? html`
          <p class="hint">Saving keeps your version in the list. The original stays available to revert to.</p>` : '')}
      </header>

      <div class="card">
        <label class="field">
          <span>Name</span>
          <input class="input" data-action="field" data-field="name" data-fk="edit-name"
                 value="${draft.name}" placeholder="Recipe name" />
        </label>

        <div class="grid-2">
          <label class="field">
            <span>Slot</span>
            <select class="input" data-action="field" data-field="category" data-fk="edit-category">
              ${raw(CATEGORIES.map((c) => html`
                <option value="${c.id}"${raw(draft.category === c.id ? ' selected' : '')}>${c.label}</option>`).join(''))}
            </select>
          </label>
          <label class="field">
            <span>Makes (servings)</span>
            <input class="input" type="number" min="0.5" step="0.5" inputmode="decimal"
                   data-action="field" data-field="makes" data-fk="edit-makes" value="${raw(makes)}" />
          </label>
        </div>

        <label class="field">
          <span>Note <em class="muted">(optional)</em></span>
          <input class="input" data-action="field" data-field="blurb" data-fk="edit-blurb"
                 value="${draft.blurb || ''}" placeholder="One line about it" />
        </label>
      </div>

      <div class="card">
        <h3>Ingredients</h3>
        <p class="hint">Weights are raw / as-bought — dry rice, raw mince. That's how the recipes are written.</p>
        ${raw(renderItemsEditor(draft.items, {
          scope: 'edit',
          perLabel: `Per serving (÷ ${makes})`,
          divisor: makes,
        }))}
      </div>

      <div class="card">
        <h3>Method <span class="muted">one step per line</span></h3>
        <textarea class="input input--area" rows="7" data-action="field" data-field="method" data-fk="edit-method"
                  placeholder="Rinse rice + lentils, cook together…">${raw(esc((draft.method || []).join('\n')))}</textarea>
      </div>

      <div class="card">
        <h3>Storage</h3>
        <div class="grid-2">
          <label class="field">
            <span>Fridge</span>
            <input class="input" data-action="field" data-field="storage.fridge" data-fk="edit-fridge"
                   value="${(draft.storage || {}).fridge || ''}" placeholder="4 days" />
          </label>
          <label class="field">
            <span>Freezer</span>
            <input class="input" data-action="field" data-field="storage.freezer" data-fk="edit-freezer"
                   value="${(draft.storage || {}).freezer || ''}" placeholder="3 months" />
          </label>
        </div>
        <label class="field">
          <span>Notes <em class="muted">one per line</em></span>
          <textarea class="input input--area" rows="4" data-action="field" data-field="storage.notes" data-fk="edit-storage-notes"
                    placeholder="Fry the egg fresh each time">${raw(esc(((draft.storage || {}).notes || []).join('\n')))}</textarea>
        </label>
      </div>

      <div class="edit-summary">
        <span>Per serving</span>
        <strong data-role="edit-total">${raw(macroSummary(per, ['cal', 'protein', 'carbs', 'fat', 'fibre']))}</strong>
      </div>

      <div class="detail-actions detail-actions--sticky">
        <button class="btn btn--primary btn--block" data-action="save-recipe">
          ${raw(mode === 'edit' && !editingBuiltin ? 'Save changes' : 'Save recipe')}
        </button>
        ${raw(mode === 'edit' ? html`
          <button class="btn btn--ghost btn--block" data-action="save-recipe-as-new">Save as a separate recipe</button>` : '')}
      </div>
    </section>`;
}

export function recipeEditActions(event, params, mode, rerender) {
  const target = event.target.closest('[data-action]');
  if (!target || !draft) return;
  const action = target.dataset.action;

  if (action === 'field') {
    applyField(target);
    refreshTotals();
    return;
  }

  if (action === 'cancel-edit') {
    const back = mode === 'new' ? '#/recipes' : `#/recipes/${encodeURIComponent(params.id)}`;
    draft = null;
    draftKey = null;
    navigate(back);
    return;
  }

  if (action === 'save-recipe' || action === 'save-recipe-as-new') {
    if (!draft.name.trim()) {
      toast('Give the recipe a name first.');
      return;
    }
    if (!draft.items.length) {
      toast('Add at least one ingredient.');
      return;
    }
    const saveMode = action === 'save-recipe-as-new' || mode === 'copy' || mode === 'new' ? 'new' : 'overwrite';
    const saved = saveRecipe(draft, saveMode);
    draft = null;
    draftKey = null;
    toast(`${saved.name} saved`);
    navigate(`#/recipes/${encodeURIComponent(saved.id)}`);
    return;
  }

  const result = applyItemsAction(draft.items, event, rerender);
  if (result === 'live') refreshTotals();
  else if (result === 'structural') rerender();
}

export function recipeEditInput(event) {
  const target = event.target.closest('[data-action]');
  if (!target || !draft) return;
  if (target.dataset.action === 'field') {
    applyField(target);
    refreshTotals();
    return;
  }
  if (target.dataset.action === 'item-qty') {
    const result = applyItemsAction(draft.items, event, () => {});
    if (result === 'live') refreshTotals();
  }
}

function applyField(target) {
  const field = target.dataset.field;
  const value = target.value;
  switch (field) {
    case 'makes':
      draft.makes = Math.max(0.5, Number(value) || 1);
      break;
    case 'method':
      draft.method = value.split('\n').map((l) => l.trim()).filter(Boolean);
      break;
    case 'storage.fridge':
      draft.storage = { ...(draft.storage || {}), fridge: value };
      break;
    case 'storage.freezer':
      draft.storage = { ...(draft.storage || {}), freezer: value };
      break;
    case 'storage.notes':
      draft.storage = { ...(draft.storage || {}), notes: value.split('\n').map((l) => l.trim()).filter(Boolean) };
      break;
    default:
      draft[field] = value;
  }
}

/** Update the derived numbers in place so typing never loses the caret. */
function refreshTotals() {
  const makes = Number(draft.makes) > 0 ? Number(draft.makes) : 1;
  const per = scaleMacros(itemsTotal(draft.items, lookupIngredient), 1 / makes);
  const el = document.querySelector('[data-role="edit-total"]');
  if (el) el.textContent = macroSummary(per, ['cal', 'protein', 'carbs', 'fat', 'fibre']);
  const view = document.querySelector('.view--edit');
  if (view) refreshItemsDisplay(view, draft.items, { perLabel: `Per serving (÷ ${makes})`, divisor: makes });
}

/** Called by the router when leaving the editor. */
export function clearDraft() {
  draft = null;
  draftKey = null;
}
