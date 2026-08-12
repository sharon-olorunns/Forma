/** App shell: wires the router, the store and the views together. */

import { load, subscribe, todayKey, getState } from './store.js';
import { parseRoute, onRoute, navigate, redirect } from './router.js';
import { captureFocus, restoreFocus, closeSheet, isSheetOpen } from './ui.js';
import { initPwa } from './pwa.js';

import { renderToday, todayActions } from './views/today.js';
import { renderBuild, buildActions, buildInput, resetBuildView } from './views/build.js';
import { renderSaved, savedActions, savedInput } from './views/saved.js';
import { renderHistory, historyActions } from './views/history.js';
import { renderSettings, settingsActions, settingsChange } from './views/settings.js';

const root = document.getElementById('app');

const TABS = [
  { id: 'day', label: 'Today', href: () => `#/day/${todayKey()}` },
  { id: 'build', label: 'Build', href: () => '#/build' },
  { id: 'saved', label: 'Saved', href: () => '#/saved' },
  { id: 'history', label: 'History', href: () => '#/history' },
];

const TITLES = {
  day: 'Today',
  build: 'Build a meal',
  saved: 'Saved meals',
  history: 'History',
  settings: 'Settings',
};

let current = parseRoute();

function viewMarkup(route) {
  switch (route.name) {
    case 'day': return renderToday(route.params);
    case 'build': return renderBuild();
    case 'saved': return renderSaved();
    case 'history': return renderHistory();
    case 'settings': return renderSettings();
    default: return renderToday({});
  }
}

function render() {
  const focus = captureFocus();
  root.innerHTML = viewMarkup(current);
  restoreFocus(focus, root);
  paintChrome();
}

function paintChrome() {
  document.querySelectorAll('[data-tab]').forEach((el) => {
    const active = el.dataset.tab === current.name;
    el.classList.toggle('is-active', active);
    if (active) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
  const title = document.getElementById('app-title');
  if (title) title.textContent = TITLES[current.name] || 'Forma';
  document.body.dataset.route = current.name;

  // The Build tab carries a dot when a meal is part-composed.
  const draft = getState().draft;
  const buildTab = document.querySelector('[data-tab="build"]');
  if (buildTab) buildTab.classList.toggle('has-draft', Boolean(draft && draft.items.length));
}

function rerender() {
  render();
}

function handleClick(event) {
  switch (current.name) {
    case 'day': todayActions(event, current.params); break;
    case 'build': buildActions(event, rerender); break;
    case 'saved': savedActions(event); break;
    case 'history': historyActions(event); break;
    case 'settings': settingsActions(event); break;
    default:
  }
}

function handleInput(event) {
  switch (current.name) {
    case 'build': buildInput(event, rerender); break;
    case 'saved': savedInput(event, rerender); break;
    case 'settings': settingsActions(event); break;
    default:
  }
}

function handleChange(event) {
  if (current.name === 'settings') settingsChange(event);
}

function start() {
  load();
  initPwa();

  // Land on today's date rather than a bare route, so the URL is bookmarkable.
  if (!window.location.hash || (current.name === 'day' && !current.params.date)) {
    redirect(`#/day/${todayKey()}`);
    current = parseRoute();
  }

  root.addEventListener('click', handleClick);
  root.addEventListener('input', handleInput);
  root.addEventListener('change', handleChange);

  document.querySelectorAll('[data-tab]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = TABS.find((t) => t.id === el.dataset.tab);
      if (!tab) return;
      // Re-entering Build from the tab bar clears the stale search box.
      if (tab.id === 'build' && current.name !== 'build') resetBuildView();
      navigate(tab.href());
    });
  });

  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) settingsBtn.addEventListener('click', () => navigate('#/settings'));

  onRoute(() => {
    current = parseRoute();
    closeSheet();
    render();
    window.scrollTo(0, 0);
  });

  subscribe(() => render());

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isSheetOpen()) closeSheet();
  });

  render();
}

start();
