/** App shell: wires the router, the store and the views together. */

import { load, subscribe, todayKey } from './store.js';
import { parseRoute, onRoute, navigate, redirect } from './router.js';
import { captureFocus, restoreFocus, closeSheet, isSheetOpen } from './ui.js';
import { initPwa } from './pwa.js';

import { renderToday, todayActions } from './views/today.js';
import { renderRecipes, renderRecipeDetail, recipeActions, recipeInput } from './views/recipes.js';
import { renderRecipeEdit, recipeEditActions, recipeEditInput, clearDraft } from './views/recipeEdit.js';
import { renderHistory, historyActions } from './views/history.js';
import { renderGuide, guideInput } from './views/guide.js';
import { renderSettings, settingsActions, settingsChange } from './views/settings.js';

const root = document.getElementById('app');
const TABS = [
  { id: 'day', label: 'Today', href: () => `#/day/${todayKey()}`, icon: '◐' },
  { id: 'recipes', label: 'Recipes', href: () => '#/recipes', icon: '◍' },
  { id: 'history', label: 'History', href: () => '#/history', icon: '◫' },
  { id: 'guide', label: 'Storage', href: () => '#/guide', icon: '❄' },
];

const TAB_FOR_ROUTE = {
  day: 'day',
  recipes: 'recipes',
  recipe: 'recipes',
  'recipe-edit': 'recipes',
  'recipe-copy': 'recipes',
  'recipe-new': 'recipes',
  history: 'history',
  guide: 'guide',
  settings: null,
};

const TITLES = {
  day: 'Today',
  recipes: 'Recipes',
  recipe: 'Recipe',
  'recipe-edit': 'Edit recipe',
  'recipe-copy': 'Duplicate recipe',
  'recipe-new': 'New recipe',
  history: 'History',
  guide: 'Storage guide',
  settings: 'Settings',
};

let current = parseRoute();

function viewMarkup(route) {
  switch (route.name) {
    case 'day':
      return renderToday(route.params);
    case 'recipes':
      return renderRecipes();
    case 'recipe':
      return renderRecipeDetail(route.params);
    case 'recipe-new':
      return renderRecipeEdit(route.params, 'new');
    case 'recipe-edit':
      return renderRecipeEdit(route.params, 'edit');
    case 'recipe-copy':
      return renderRecipeEdit(route.params, 'copy');
    case 'history':
      return renderHistory();
    case 'guide':
      return renderGuide();
    case 'settings':
      return renderSettings();
    default:
      return renderToday({});
  }
}

function render() {
  const focus = captureFocus();
  root.innerHTML = viewMarkup(current);
  restoreFocus(focus, root);
  paintChrome();
}

function paintChrome() {
  const activeTab = TAB_FOR_ROUTE[current.name];
  document.querySelectorAll('[data-tab]').forEach((el) => {
    el.classList.toggle('is-active', el.dataset.tab === activeTab);
    if (el.dataset.tab === activeTab) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
  const title = document.getElementById('app-title');
  if (title) title.textContent = TITLES[current.name] || 'Forma';
  document.body.dataset.route = current.name;
}

// ─── Event wiring ────────────────────────────────────────────────────────────

function rerender() {
  render();
}

function handleEvent(event) {
  switch (current.name) {
    case 'day':
      todayActions(event, current.params, rerender);
      break;
    case 'recipes':
    case 'recipe':
      recipeActions(event, current.params, rerender);
      break;
    case 'recipe-new':
      recipeEditActions(event, current.params, 'new', rerender);
      break;
    case 'recipe-edit':
      recipeEditActions(event, current.params, 'edit', rerender);
      break;
    case 'recipe-copy':
      recipeEditActions(event, current.params, 'copy', rerender);
      break;
    case 'history':
      historyActions(event);
      break;
    case 'settings':
      settingsActions(event, rerender);
      break;
    default:
  }
}

function handleInput(event) {
  switch (current.name) {
    case 'recipes':
      recipeInput(event, rerender);
      break;
    case 'guide':
      guideInput(event, rerender);
      break;
    case 'recipe-new':
    case 'recipe-edit':
    case 'recipe-copy':
      recipeEditInput(event);
      break;
    case 'settings':
      settingsActions(event, rerender);
      break;
    default:
  }
}

function handleChange(event) {
  if (current.name === 'settings') settingsChange(event);
  if (event.target.matches('[data-action="item-measure"]')) handleEvent(event);
  if (event.target.matches('select[data-action="field"]')) handleEvent(event);
}

function start() {
  load();
  initPwa();

  // Land on today's date rather than a bare route, so the URL is shareable/bookmarkable.
  if (!window.location.hash || current.name === 'day' && !current.params.date) {
    redirect(`#/day/${todayKey()}`);
    current = parseRoute();
  }

  root.addEventListener('click', handleEvent);
  root.addEventListener('input', handleInput);
  root.addEventListener('change', handleChange);

  document.querySelectorAll('[data-tab]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = TABS.find((t) => t.id === el.dataset.tab);
      if (tab) navigate(tab.href());
    });
  });

  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => navigate('#/settings'));
  }

  onRoute(() => {
    const next = parseRoute();
    const leavingEditor = current.name.startsWith('recipe-') && !next.name.startsWith('recipe-');
    if (leavingEditor) clearDraft();
    current = next;
    closeSheet();
    render();
    window.scrollTo(0, 0);
  });

  // A store change means the numbers moved — repaint whatever is on screen.
  subscribe(() => render());

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isSheetOpen()) closeSheet();
  });

  render();
}

start();
