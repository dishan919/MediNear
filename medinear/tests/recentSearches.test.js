import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { RECENT_SEARCHES_KEY, getRecentSearches, addRecentSearch, clearRecentSearches, normalizeMedicineSearch, medicineSearchParams, createRecentSearchRecorder } from '../src/utils/recentSearches.js';
import { clearSession } from '../src/auth/session.js';
function memory(values = {}) {
  const data = new Map(Object.entries(values));
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}
test('history stores trimmed valid terms, deduplicates case-insensitively and moves repeats first', () => {
  const storage = memory();
  for (const term of ['', '   ', undefined, {}, 'x'.repeat(121)]) addRecentSearch(term, storage);
  assert.equal(storage.data.has(RECENT_SEARCHES_KEY), false);
  assert.deepEqual(addRecentSearch(' Panadol ', storage), ['Panadol']);
  assert.deepEqual(addRecentSearch('Vitamin C', storage), ['Vitamin C', 'Panadol']);
  assert.deepEqual(addRecentSearch(' panadol ', storage), ['panadol', 'Vitamin C']);
  assert.deepEqual(addRecentSearch('PANADOL', storage), ['PANADOL', 'Vitamin C']);
  assert.deepEqual([...storage.data.keys()], [RECENT_SEARCHES_KEY]);
  assert.equal(normalizeMedicineSearch(' Paracetamol '), 'Paracetamol');
});
test('history caps at five newest unique searches, removes oldest and persists on browser reload', () => {
  const storage = memory();
  for (const term of ['A', 'B', 'C', 'D', 'E', 'F']) addRecentSearch(term, storage);
  assert.deepEqual(getRecentSearches(storage), ['F', 'E', 'D', 'C', 'B']);
  assert.deepEqual(addRecentSearch('c', storage), ['c', 'F', 'E', 'D', 'B']);
  const refreshed = memory(Object.fromEntries(storage.data));
  assert.deepEqual(getRecentSearches(refreshed), ['c', 'F', 'E', 'D', 'B']);
});
test('corrupt, unexpected or inaccessible storage is safe and a valid search recovers', () => {
  for (const value of ['not json', '{}', 'null', '42']) {
    const storage = memory({ [RECENT_SEARCHES_KEY]: value });
    assert.deepEqual(getRecentSearches(storage), []);
    assert.deepEqual(addRecentSearch('Panadol', storage), ['Panadol']);
  }
  assert.deepEqual(getRecentSearches(memory({ [RECENT_SEARCHES_KEY]: JSON.stringify(['Panadol', ' panadol ', null, {}, '', 'Vitamin C']) })), ['Panadol', 'Vitamin C']);
  const denied = { getItem() { throw new Error('Denied'); }, setItem() { throw new Error('Quota'); }, removeItem() { throw new Error('Denied'); } };
  assert.deepEqual(getRecentSearches(denied), []); assert.deepEqual(addRecentSearch('Panadol', denied), ['Panadol']); assert.deepEqual(clearRecentSearches(denied), []);
});
test('explicit search is remembered only after success; empty, typing, failed and stale responses are excluded', () => {
  const storage = memory(), recorder = createRecentSearchRecorder(storage);
  assert.equal(recorder.complete(undefined, 'Panadol', true), null);
  assert.equal(recorder.begin('  '), undefined);
  const first = recorder.begin('Panadol');
  assert.equal(recorder.complete(first, 'Panadol', false), null); assert.deepEqual(getRecentSearches(storage), []);
  recorder.cancel(); assert.equal(recorder.complete(first, 'Panadol', true), null);
  const old = recorder.begin('Panadol'), latest = recorder.begin('Vitamin C');
  assert.equal(recorder.complete(old, 'Panadol', true), null);
  assert.equal(recorder.complete(latest, 'different', true), null);
  assert.deepEqual(recorder.complete(latest, 'Vitamin C', true), ['Vitamin C']);
  assert.equal(recorder.complete(latest, 'Vitamin C', true), null);
});
test('clear history removes only its key; logout removes history and existing session keys only', () => {
  const storage = memory({ token: 'session', user: 'profile', cart: 'items', orders: 'orders', [RECENT_SEARCHES_KEY]: '["Panadol"]' });
  assert.deepEqual(clearRecentSearches(storage), []);
  assert.deepEqual(Object.fromEntries(storage.data), { token: 'session', user: 'profile', cart: 'items', orders: 'orders' });
  addRecentSearch('Panadol', storage); clearSession(storage);
  assert.deepEqual(Object.fromEntries(storage.data), { cart: 'items', orders: 'orders' });
});
test('recent term updates existing medicine parameter while preserving every location/filter parameter', () => {
  const params = new URLSearchParams('medicine=Old&province=Western&district=Colombo&lat=6.9&lng=79.8&radius=5&sort=nearest&openNow=true&hour24=true&emergency=true&includeOutOfStock=true&pharmacy=City');
  const next = medicineSearchParams(params, ' Panadol ');
  assert.equal(next.get('medicine'), 'Panadol');
  for (const [key, value] of params) if (key !== 'medicine') assert.equal(next.get(key), value, key);
  assert.equal(params.get('medicine'), 'Old');
});
test('recent chips and Clear History are accessible buttons, callbacks reuse the search flow and empty history is hidden', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { default: Recent } = await vite.ssrLoadModule('/src/components/RecentSearches.jsx');
    assert.equal(renderToString(createElement(Recent, { searches: [] })), '');
    let params = new URLSearchParams('medicine=Old&province=Western&district=Colombo&sort=smart'), searches = 0, cleared = 0;
    const element = Recent({ searches: ['Panadol', 'Vitamin C'], onSearch: term => { params = medicineSearchParams(params, term); searches++; }, onClear: () => cleared++ });
    const html = renderToString(element);
    assert.match(html, /Recent Searches/); assert.match(html, /type="button"/); assert.match(html, /Clear History/);
    assert.ok(html.indexOf('Panadol') < html.indexOf('Vitamin C'));
    element.props.children[1].props.children[0].props.onClick();
    assert.equal(searches, 1); assert.equal(params.get('medicine'), 'Panadol'); assert.equal(params.get('district'), 'Colombo'); assert.equal(params.get('sort'), 'smart');
    element.props.children[0].props.children[1].props.onClick(); assert.equal(cleared, 1);
    const { default: Home } = await vite.ssrLoadModule('/src/pages/Home.jsx');
    const home = renderToString(createElement(MemoryRouter, {}, createElement(Home)));
    for (const text of ['Search medicine...', 'Use My Location', 'Smart Ranking', 'Nearest first', 'Province', 'District', '24 Hour', 'Emergency Mode', 'Available Only']) assert.ok(home.includes(text), text);
  } finally { await vite.close(); }
});
