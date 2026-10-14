import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { scrollBackToTop } from '../../src/utils/backToTop.js';

function browser() {
  const listeners = new Map();
  return {
    scrollY: 0, calls: [], reduced: false,
    addEventListener(event, callback, options) {
      if (event === 'scroll') assert.equal(options.passive, true);
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(callback);
    },
    removeEventListener(event, callback) { listeners.get(event).delete(callback); },
    emit(event) { for (const callback of listeners.get(event) || []) callback(); },
    count(event) { return listeners.get(event)?.size || 0; },
    matchMedia(query) { assert.equal(query, '(prefers-reduced-motion: reduce)'); return { matches: this.reduced }; },
    scrollTo(options) { this.calls.push(options); },
  };
}

test('view is hidden initially and exposes a named native keyboard button whose click only scrolls', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { default: Button, BackToTopView } = await vite.ssrLoadModule('/src/components/BackToTop.jsx');
    assert.equal(renderToString(createElement(Button)), '');
    assert.equal(renderToString(createElement(BackToTopView, { visible: false })), '');
    const target = browser();
    const view = BackToTopView({ visible: true, onClick: () => scrollBackToTop(target) });
    const markup = renderToString(view);
    assert.equal(view.type, 'button');
    assert.equal(view.props.type, 'button');
    assert.equal(view.props.tabIndex, undefined); // Native Enter/Space and tab order.
    assert.match(markup, /aria-label="Back to top"/);
    assert.match(markup, /aria-hidden="true"/);
    view.props.onClick();
    assert.deepEqual(target.calls, [{ top: 0, behavior: 'smooth' }]);
    const { default: Home } = await vite.ssrLoadModule('/src/pages/Home.jsx');
    const { default: Suggestions } = await vite.ssrLoadModule('/src/components/NoResultsSuggestions.jsx');
    const { default: Count } = await vite.ssrLoadModule('/src/components/SearchResultCount.jsx');
    const { default: Card } = await vite.ssrLoadModule('/src/components/PharmacyCard.jsx');
    const { AuthContext } = await vite.ssrLoadModule('/src/auth/AuthContext.jsx');
    const query = 'medicine=Panadol&province=Western&district=Colombo&openNow=true&hour24=true&sort=nearest&lat=6.9&lng=79.8&radius=5';
    const params = new URLSearchParams(query);
    const results = [{ _id: 'p1', name: 'Test pharmacy', district: 'Colombo', address: 'Test address', medicines: [{ _id: 'm1', name: 'Panadol', quantity: 20 }] }];
    const render = element => renderToString(createElement(MemoryRouter, { initialEntries: [`/?${query}`] }, createElement(AuthContext.Provider, { value: { user: { role: 'customer' } } }, element)));
    // Actual Home markup plus loaded-result and empty-state presentations, using
    // the project's SSR harness (Home effects/API requests do not run in SSR).
    const snapshot = () => [render(createElement(Home)), render(createElement(Count, { results })), render(createElement(Card, { pharmacy: results[0] })), render(createElement(Suggestions, { params, results: [] }))];
    const before = snapshot();
    assert.match(before[0], /value="Panadol"/);
    assert.match(before[0], /Frequently Asked Questions/);
    assert.match(before[0], /<footer/);
    assert.match(before[2], /Test pharmacy/);
    assert.match(before[3], /Try these suggestions/);
    view.props.onClick();
    assert.deepEqual(snapshot(), before);
    assert.equal(params.toString(), query);
  } finally { await vite.close(); }
});
