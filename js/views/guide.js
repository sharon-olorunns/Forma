/** Storage + preservation guide. Searchable, because you read it with cold hands. */

import { html, raw, esc } from '../ui.js';
import { allRecipes } from '../store.js';
import {
  REHEATING_RULES, FRESH_SHELF_LIFE, KEEPING_ALIVE, COOK_ONCE_SYSTEM,
  PORTIONS_BY_HAND, WEEK_SHAPE,
} from '../data/guide.js';

let query = '';

export function renderGuide() {
  const q = query.trim().toLowerCase();
  const match = (...parts) => !q || parts.join(' ').toLowerCase().includes(q);

  const meals = allRecipes()
    .filter((r) => r.storage && (r.storage.fridge || (r.storage.notes || []).length))
    .filter((r) => match(r.name, r.storage.fridge, r.storage.freezer, (r.storage.notes || []).join(' ')));

  const shelf = FRESH_SHELF_LIFE
    .map((group) => ({ ...group, items: group.items.filter(([name, note]) => match(group.window, name, note)) }))
    .filter((group) => group.items.length);

  const tricks = KEEPING_ALIVE.filter((t) => match(t.title, t.subtitle || '', t.steps.join(' ')));
  const rules = REHEATING_RULES.filter((r) => match(r));

  const nothing = !meals.length && !shelf.length && !tricks.length && !rules.length;

  return html`
    <section class="view view--guide">
      <input class="input" type="search" placeholder="Search the guide — “rice”, “avocado”, “freezer”…"
             value="${query}" data-action="guide-search" data-fk="guide-search" autocomplete="off" />

      ${raw(nothing ? html`<p class="empty">Nothing in the guide matches “${query}”.</p>` : '')}

      ${raw(meals.length ? html`
        <section class="card">
          <h3>Cooked meals</h3>
          <ul class="guide-meals">
            ${raw(meals.map((r) => html`
              <li>
                <div class="guide-meals__head">
                  <strong>${r.name}</strong>
                  <span class="storage-pills">
                    <span class="pill"><em>Fridge</em> ${(r.storage.fridge || '—')}</span>
                    <span class="pill"><em>Freezer</em> ${(r.storage.freezer || '—')}</span>
                  </span>
                </div>
                ${raw((r.storage.notes || []).length
                  ? `<ul class="bullets">${r.storage.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>`
                  : '')}
              </li>`).join(''))}
          </ul>
        </section>` : '')}

      ${raw(rules.length ? html`
        <section class="card card--accent">
          <h3>Reheating rules</h3>
          <ul class="bullets">${raw(rules.map((r) => html`<li>${r}</li>`).join(''))}</ul>
        </section>` : '')}

      ${raw(shelf.length ? html`
        <section class="card">
          <h3>Fresh ingredients</h3>
          ${raw(shelf.map((group) => html`
            <div class="shelf-group shelf-group--${group.tone}">
              <h4>${group.window}</h4>
              <dl class="shelf-list">
                ${raw(group.items.map(([name, note]) => html`
                  <div><dt>${name}</dt><dd class="muted">${note}</dd></div>`).join(''))}
              </dl>
            </div>`).join(''))}
        </section>` : '')}

      ${raw(tricks.length ? html`
        <section class="card">
          <h3>Keeping things alive longer</h3>
          ${raw(tricks.map((t) => html`
            <div class="trick">
              <h4>${t.title} ${raw(t.subtitle ? `<span class="muted">${esc(t.subtitle)}</span>` : '')}</h4>
              <ul class="bullets">${raw(t.steps.map((s) => html`<li>${s}</li>`).join(''))}</ul>
            </div>`).join(''))}
        </section>` : '')}

      ${raw(!q ? html`
        <section class="card card--accent">
          <h3>${COOK_ONCE_SYSTEM.title}</h3>
          <ol class="method">${raw(COOK_ONCE_SYSTEM.steps.map((s) => html`<li>${s}</li>`).join(''))}</ol>
          <p class="hint">${COOK_ONCE_SYSTEM.result}</p>
        </section>

        <section class="card">
          <h3>Portions without weighing</h3>
          <table class="table">
            <thead><tr><th>Use</th><th>For</th><th>Roughly</th></tr></thead>
            <tbody>
              ${raw(PORTIONS_BY_HAND.map(([a, b, c]) => html`
                <tr><td><strong>${a}</strong></td><td>${b}</td><td class="muted">${c}</td></tr>`).join(''))}
            </tbody>
          </table>
          <p class="hint">The two worth weighing: rice (dry) and oil. Both are easy to misjudge and both add up fast.</p>
        </section>

        <section class="card">
          <h3>A simple week</h3>
          <table class="table table--week">
            <thead><tr><th>Day</th><th>Meal 1</th><th>Hit</th><th>Meal 2</th></tr></thead>
            <tbody>
              ${raw(WEEK_SHAPE.map(([day, m1, hit, m2]) => html`
                <tr>
                  <td><strong>${day}</strong></td>
                  <td>${m1}</td>
                  <td class="muted">${hit}</td>
                  <td>${m2}</td>
                </tr>`).join(''))}
            </tbody>
          </table>
          <p class="hint">Two cook-ups. Everything else is reheating or a 5-minute salad.</p>
        </section>` : '')}
    </section>`;
}

export function guideInput(event, rerender) {
  const target = event.target.closest('[data-action="guide-search"]');
  if (!target) return;
  query = target.value;
  rerender();
}
