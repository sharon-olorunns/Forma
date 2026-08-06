/** Service worker registration, install prompt, and update handling. */

import { toast } from './ui.js';

export const APP_VERSION = '1.0.0';

let deferredPrompt = null;

export function initPwa() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register(new URL('../sw.js', import.meta.url), { scope: './' })
        .then(watchForUpdates)
        .catch((err) => console.warn('Service worker registration failed:', err));
    });
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    document.body.classList.add('can-install');
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    document.body.classList.remove('can-install');
    toast('Forma installed');
  });
}

/**
 * Tell the user when a new version is sitting in the wings rather than swapping
 * it underneath them mid-edit.
 */
function watchForUpdates(registration) {
  if (!registration) return;
  registration.addEventListener('updatefound', () => {
    const installing = registration.installing;
    if (!installing) return;
    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed' && navigator.serviceWorker.controller) {
        showUpdateBanner(registration);
      }
    });
  });
}

function showUpdateBanner(registration) {
  if (document.getElementById('update-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'update-banner';
  banner.className = 'update-banner';
  banner.innerHTML = `
    <span>A new version of Forma is ready.</span>
    <button class="btn btn--sm btn--primary" type="button">Reload</button>`;
  banner.querySelector('button').addEventListener('click', () => {
    const waiting = registration.waiting;
    if (waiting) {
      waiting.postMessage({ type: 'SKIP_WAITING' });
      navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
    } else {
      window.location.reload();
    }
  });
  document.body.appendChild(banner);
}

export function canInstall() {
  return Boolean(deferredPrompt);
}

export async function promptInstall() {
  if (!deferredPrompt) {
    toast('Use your browser menu → “Add to Home Screen”.');
    return;
  }
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
}
