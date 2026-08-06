/** History: what you actually ate, and how the averages are trending. */

import { html, raw, macroValue, formatDate, relativeDay, toast } from '../ui.js';
import { getState, loggedDays, getDay, lookupIngredient, todayKey, shiftDate, copyDay } from '../store.js';
import { dayTotals, averageTotals, MACRO_KEYS } from '../nutrition.js';
import { navigate } from '../router.js';

export function renderHistory() {
  const keys = loggedDays();
  const targets = getState().settings.targets;

  if (!keys.length) {
    return html`
      <section class="view view--history">
        <div class="empty-state">
          <p class="empty-state__title">No history yet.</p>
          <p class="muted">Log a day or two and this fills up with totals, streaks and averages.</p>
        </div>
      </section>`;
  }

  const last7 = lastNDays(7);
  const last28 = lastNDays(28);
  const avg7 = averageTotals(last7, lookupIngredient);
  const avg28 = averageTotals(last28, lookupIngredient);

  const rows = keys.map((key) => {
    const totals = dayTotals(getDay(key).entries, lookupIngredient);
    const pct = targets.cal > 0 ? Math.min((totals.cal / targets.cal) * 100, 130) : 0;
    const proteinHit = totals.protein >= targets.protein * 0.9;
    return html`
      <li class="history-row">
        <button class="history-row__main" data-action="open-day" data-date="${key}">
          <span class="history-row__date">
            <strong>${raw(relativeDay(key, todayKey()))}</strong>
            <span class="muted">${raw(formatDate(key, { short: true }))}</span>
          </span>
          <span class="history-row__bar">
            <i style="width:${raw(pct.toFixed(1))}%" class="${raw(totals.cal > targets.cal ? 'is-over' : '')}"></i>
          </span>
          <span class="history-row__totals">
            <strong>${raw(macroValue('cal', totals.cal))}</strong>
            <span class="${raw(proteinHit ? 'is-hit' : 'muted')}">${raw(macroValue('protein', totals.protein))}g P</span>
          </span>
        </button>
        <button class="icon-btn icon-btn--sm" data-action="repeat-day" data-date="${key}"
                aria-label="Copy ${formatDate(key)} to today" title="Copy to today">⧉</button>
      </li>`;
  });

  return html`
    <section class="view view--history">
      <div class="card">
        <h3>Averages</h3>
        <div class="avg-grid">
          ${raw(renderAverage('Last 7 days', avg7, targets))}
          ${raw(renderAverage('Last 28 days', avg28, targets))}
        </div>
        <p class="hint">Days with nothing logged are left out of the average, so a missed day doesn't drag it down.</p>
      </div>

      <h3 class="day-section__title">Every logged day <span class="muted">${raw(keys.length)} total</span></h3>
      <ul class="history-list">${raw(rows.join(''))}</ul>
    </section>`;
}

function renderAverage(label, { average, days }, targets) {
  if (!days) {
    return html`<div class="avg-card"><h4>${label}</h4><p class="muted">Nothing logged.</p></div>`;
  }
  return html`
    <div class="avg-card">
      <h4>${label} <span class="muted">${raw(days)} logged</span></h4>
      <div class="avg-card__cal">
        <strong>${raw(macroValue('cal', average.cal))}</strong>
        <span class="muted">/ ${raw(macroValue('cal', targets.cal))} cal</span>
      </div>
      <ul class="avg-card__macros">
        ${raw(MACRO_KEYS.filter((k) => k !== 'cal').map((k) => {
          const hit = average[k] >= targets[k] * 0.9;
          return html`<li class="${raw(hit ? 'is-hit' : '')}">
            ${raw(macroValue(k, average[k]))}g <span class="muted">${k}</span>
          </li>`;
        }).join(''))}
      </ul>
    </div>`;
}

function lastNDays(n) {
  const out = [];
  let key = todayKey();
  for (let i = 0; i < n; i += 1) {
    out.push({ key, entries: getDay(key).entries });
    key = shiftDate(key, -1);
  }
  return out;
}

export function historyActions(event) {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const date = target.dataset.date;

  if (target.dataset.action === 'open-day') {
    navigate(`#/day/${date}`);
    return;
  }
  if (target.dataset.action === 'repeat-day') {
    const count = copyDay(date, todayKey());
    if (count) {
      toast(`${count} ${count === 1 ? 'meal' : 'meals'} copied to today`);
      navigate(`#/day/${todayKey()}`);
    }
  }
}
