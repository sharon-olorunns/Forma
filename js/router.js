/**
 * Hash routing. Hash rather than History API so the app works from any path —
 * GitHub Pages project sites, a file:// copy, wherever it ends up — with no
 * server rewrite rules.
 */

const ROUTES = [
  { name: 'day', pattern: /^#\/day\/(\d{4}-\d{2}-\d{2})$/, keys: ['date'] },
  { name: 'recipes', pattern: /^#\/recipes$/, keys: [] },
  { name: 'recipe-new', pattern: /^#\/recipes\/new$/, keys: [] },
  { name: 'recipe-edit', pattern: /^#\/recipes\/([^/]+)\/edit$/, keys: ['id'] },
  { name: 'recipe-copy', pattern: /^#\/recipes\/([^/]+)\/copy$/, keys: ['id'] },
  { name: 'recipe', pattern: /^#\/recipes\/([^/]+)$/, keys: ['id'] },
  { name: 'history', pattern: /^#\/history$/, keys: [] },
  { name: 'guide', pattern: /^#\/guide$/, keys: [] },
  { name: 'settings', pattern: /^#\/settings$/, keys: [] },
];

export function parseRoute(hash = window.location.hash) {
  for (const route of ROUTES) {
    const match = hash.match(route.pattern);
    if (match) {
      const params = {};
      route.keys.forEach((key, i) => {
        params[key] = decodeURIComponent(match[i + 1]);
      });
      return { name: route.name, params };
    }
  }
  return { name: 'day', params: {} };
}

export function navigate(hash) {
  if (window.location.hash === hash) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }
  window.location.hash = hash;
}

/** Replace rather than push — used for redirects that shouldn't stack up. */
export function redirect(hash) {
  const url = `${window.location.pathname}${window.location.search}${hash}`;
  window.history.replaceState(null, '', url);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function onRoute(handler) {
  window.addEventListener('hashchange', handler);
}
