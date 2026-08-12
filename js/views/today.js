/**
 * The day view: where you stand against your targets, what you've eaten, and —
 * when you're short on protein or fibre — the cheapest ways to close the gap.
 */

import {
  html, raw, bigValue, macroValue, shortAmount, relativeDay, formatDate, timeOfDay, toast,
} from '../ui.js';
import {
  getState, getDay, todayKey, shiftDate, lookupFood, allFoods, removeEntry,
  logMeal, draftFromEntry,
} from '../store.js';
import {
  dayTotals, entryMacros, against, suggestBoosts, MACRO_KEYS, MACRO_META,
} from '../nutrition.js';
import { navigate } from '../router.js';

/** Only nag about the two that are hard to hit. */
const BOOST_MACROS = ['protein', 'fibre'];

export function renderToday(params) {
  const dayKey = params.date || todayKey();
  const isToday = dayKey === todayKey();
  const day = getDay(dayKey);
  const targets = getState().settings.targets;
  const totals = dayTotals(day.entries, lookupFood);
  const status = against(totals, targets);

  return html`
    <section class="view view--today">
      <nav class="date-nav">
        <button class="icon-btn" data-action="day-prev" aria-label="Previous day">‹</button>
        <div class="date-nav__label">
          <strong>${raw(relativeDay(dayKey, todayKey()))}</strong>
          <span class="muted">${raw(formatDate(dayKey))}</span>
        </div>
        <button class="icon-btn ${raw(isToday ? 'is-disabled' : '')}" data-action="day-next"
                aria-label="Next day"${raw(isToday ? ' disabled' : '')}>›</button>
      </nav>

      ${raw(renderHero(status.cal))}
      ${raw(renderMacros(status))}
      ${raw(renderBoosts(status, totals))}
      ${raw(day.entries.length ? renderEntries(day.entries, dayKey) : renderEmpty())}

      <button class="btn btn--primary btn--lg btn--block" data-action="go-build">+ Build a meal</button>
    </section>`;
}

/** The headline: how much room is left today. */
function renderHero(cal) {
  const over = cal.over;
  const amount = over ? -cal.remaining : cal.remaining;
  const pct = Math.min(cal.pct, 100);
  return html`
    <div class="hero ${raw(over ? 'is-over' : '')}">
      <div class="hero__figure">
        <span class="hero__value">${raw(bigValue(amount))}</span>
        <span class="hero__unit">cal ${raw(over ? 'over' : 'left')}</span>
      </div>
      <div class="hero__meta">
        <span>${raw(bigValue(cal.value))} eaten</span>
        <span class="muted">target ${raw(bigValue(cal.target))}</span>
      </div>
      <div class="hero__track"><i style="width:${raw(pct.toFixed(1))}%"></i></div>
    </div>`;
}

function renderMacros(status) {
  return html`
    <div class="macro-row">
      ${raw(MACRO_KEYS.filter((k) => k !== 'cal').map((k) => {
        const s = status[k];
        const state = s.over ? 'is-over' : s.pct >= 90 ? 'is-hit' : '';
        return html`
          <div class="macro-card ${raw(state)}" data-macro="${k}">
            <span class="macro-card__label">${raw(MACRO_META[k].short)}</span>
            <span class="macro-card__value">${raw(macroValue(k, s.value))}<em>g</em></span>
            <span class="macro-card__track"><i style="width:${raw(Math.min(s.pct, 100).toFixed(1))}%"></i></span>
            <span class="macro-card__rest">
              ${raw(s.over ? `${macroValue(k, -s.remaining)}g over` : `${macroValue(k, s.remaining)}g to go`)}
            </span>
          </div>`;
      }).join(''))}
    </div>`;
}

/**
 * Concrete ways to close a protein or fibre gap, ranked by calorie cost.
 * Only shown once something is actually logged — a blank day doesn't need
 * telling that it's short on everything.
 */
function renderBoosts(status, totals) {
  if (!(totals.cal > 0)) return '';

  const foods = allFoods();
  const calorieBudget = status.cal.remaining;
  const blocks = [];

  for (const macro of BOOST_MACROS) {
    const gap = status[macro].remaining;
    if (gap <= 2) continue;
    const picks = suggestBoosts(macro, gap, calorieBudget, foods, { limit: 3 });
    if (!picks.length) continue;
    blocks.push(html`
      <div class="boost">
        <p class="boost__title">
          <span class="dot" data-macro="${macro}"></span>
          ${raw(macroValue(macro, gap))}g of ${raw(MACRO_META[macro].short.toLowerCase())} to go
        </p>
        <div class="boost__picks">
          ${raw(picks.map((p) => html`
            <button class="boost__pick" data-action="boost-add" data-id="${p.food.id}"
                    data-qty="${raw(p.qty)}" data-measure="${p.measure.id}">
              <span class="boost__pick-name">${raw(shortAmount(p.qty, p.measure))} ${p.food.name}</span>
              <span class="boost__pick-meta">+${raw(macroValue(macro, p.provides))}g · ${raw(bigValue(p.cal))} cal</span>
            </button>`).join(''))}
        </div>
      </div>`);
  }

  if (!blocks.length) return '';
  return html`
    <section class="boosts">
      <h3 class="section-title">Close the gap</h3>
      ${raw(blocks.join(''))}
      ${raw(status.cal.remaining <= 0
        ? '<p class="hint">You\'re at your calorie target, so these are the leanest options rather than free ones.</p>'
        : '<p class="hint">Ranked by calories per gram gained — cheapest way to hit the number.</p>')}
    </section>`;
}

function renderEntries(entries, dayKey) {
  return html`
    <section class="day-meals">
      <h3 class="section-title">Eaten <span class="muted">${raw(entries.length)}</span></h3>
      <ul class="meal-list">
        ${raw(entries.map((entry) => {
          const macros = entryMacros(entry, lookupFood);
          const count = entry.items.length;
          return html`
            <li class="meal-row">
              <button class="meal-row__body" data-action="open-entry" data-entry="${entry.id}">
                <span class="meal-row__top">
                  <span class="meal-row__name">${entry.name}</span>
                  <span class="meal-row__cal">${raw(bigValue(macros.cal))} cal</span>
                </span>
                <span class="meal-row__meta">
                  ${raw(timeOfDay(entry.at))} ·
                  ${raw(count)} ${raw(count === 1 ? 'ingredient' : 'ingredients')} ·
                  ${raw(macroValue('protein', macros.protein))}g P ·
                  ${raw(macroValue('carbs', macros.carbs))}g C ·
                  ${raw(macroValue('fibre', macros.fibre))}g fibre
                </span>
              </button>
              <button class="icon-btn icon-btn--sm" data-action="remove-entry" data-entry="${entry.id}"
                      aria-label="Remove ${entry.name}">✕</button>
            </li>`;
        }).join(''))}
      </ul>
    </section>`;
}

function renderEmpty() {
  return html`
    <div class="empty-state">
      <p class="empty-state__title">Nothing logged yet.</p>
      <p class="muted">Build a meal from ingredients, or log one straight from your saved library.</p>
    </div>`;
}

// ─── Interaction ─────────────────────────────────────────────────────────────

export function todayActions(event, params) {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  const dayKey = params.date || todayKey();
  const entryId = target.dataset.entry;

  switch (action) {
    case 'day-prev':
      navigate(`#/day/${shiftDate(dayKey, -1)}`);
      return;
    case 'day-next':
      if (dayKey === todayKey()) return;
      navigate(`#/day/${shiftDate(dayKey, 1)}`);
      return;
    case 'go-build':
      navigate('#/build');
      return;

    case 'open-entry':
      // Opening a logged meal loads it back into the builder, so editing what
      // you ate uses exactly the same screen as creating it.
      draftFromEntry(dayKey, entryId);
      navigate('#/build');
      return;

    case 'remove-entry': {
      const entry = getDay(dayKey).entries.find((e) => e.id === entryId);
      if (entry && confirm(`Remove ${entry.name}?`)) removeEntry(dayKey, entryId);
      return;
    }

    case 'boost-add': {
      // A boost is just a one-item meal, logged straight onto the day.
      const food = lookupFood(target.dataset.id);
      if (!food) return;
      logMeal(dayKey, {
        name: food.name,
        items: [{ ing: food.id, qty: Number(target.dataset.qty), measure: target.dataset.measure }],
        makes: 1,
        servings: 1,
        savedId: null,
      });
      toast(`${food.name} added`);
      return;
    }

    default:
  }
}
