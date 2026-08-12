/** History: how the days have actually gone. */

import { html, raw, bigValue, macroValue, formatDate, relativeDay } from '../ui.js';
import { getState, loggedDays, getDay, lookupFood, todayKey, shiftDate } from '../store.js';
import { dayTotals, averageTotals, MACRO_KEYS, MACRO_META } from '../nutrition.js';
import { navigate } from '../router.js';

export function renderHistory() {
  const keys = loggedDays();
  const targets = getState().settings.targets;

  if (!keys.length) {
    return html`
      <section class="view view--history">
        <div class="empty-state">
          <p class="empty-state__title">No history yet.</p>
          <p class="muted">Log a couple of days and this fills up with totals and averages.</p>
        </div>
      </section>`;
  }

  const avg7 = averageTotals(lastNDays(7), lookupFood);
  const avg28 = averageTotals(lastNDays(28), lookupFood);

  return html`
    <section class="view view--history">
      <div class="avg-row">
        ${raw(renderAverage('7-day average', avg7, targets))}
        ${raw(renderAverage('28-day average', avg28, targets))}
      </div>
      <p class="hint">Days with nothing logged are left out, so a missed day doesn't drag the average down.</p>

      <h3 class="section-title">Every logged day <span class="muted">${raw(keys.length)}</span></h3>
      <ul class="history-list">
        ${raw(keys.map((key) => {
          const totals = dayTotals(getDay(key).entries, lookupFood);
          const pct = targets.cal > 0 ? Math.min((totals.cal / targets.cal) * 100, 130) : 0;
          const over = totals.cal > targets.cal;
          const proteinHit = totals.protein >= targets.protein * 0.9;
          const count = getDay(key).entries.length;
          return html`
            <li>
              <button class="history-row" data-action="open-day" data-date="${key}">
                <span class="history-row__date">
                  <strong>${raw(relativeDay(key, todayKey()))}</strong>
                  <span class="muted">${raw(formatDate(key, { short: true }))} · ${raw(count)} ${raw(count === 1 ? 'meal' : 'meals')}</span>
                </span>
                <span class="history-row__bar">
                  <i class="${raw(over ? 'is-over' : '')}" style="width:${raw(pct.toFixed(1))}%"></i>
                </span>
                <span class="history-row__totals">
                  <strong class="${raw(over ? 'is-over' : '')}">${raw(bigValue(totals.cal))}</strong>
                  <span class="${raw(proteinHit ? 'is-hit' : 'muted')}">${raw(macroValue('protein', totals.protein))}g P</span>
                </span>
              </button>
            </li>`;
        }).join(''))}
      </ul>
    </section>`;
}

function renderAverage(label, { average, days }, targets) {
  if (!days) {
    return html`<div class="avg-card"><h4>${label}</h4><p class="muted">Nothing logged.</p></div>`;
  }
  return html`
    <div class="avg-card">
      <h4>${label} <span class="muted">${raw(days)} ${raw(days === 1 ? 'day' : 'days')}</span></h4>
      <div class="avg-card__cal">
        <strong>${raw(bigValue(average.cal))}</strong>
        <span class="muted">/ ${raw(bigValue(targets.cal))}</span>
      </div>
      <ul class="avg-card__macros">
        ${raw(MACRO_KEYS.filter((k) => k !== 'cal').map((k) => {
          const hit = average[k] >= targets[k] * 0.9;
          return html`
            <li class="${raw(hit ? 'is-hit' : '')}" data-macro="${k}">
              ${raw(macroValue(k, average[k]))}g
              <span class="muted">${raw(MACRO_META[k].short.toLowerCase())}</span>
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
  const target = event.target.closest('[data-action="open-day"]');
  if (!target) return;
  navigate(`#/day/${target.dataset.date}`);
}
