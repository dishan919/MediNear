import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { noResultsSuggestions, hasRestrictiveFilters, clearNoResultsFilters } from '../src/utils/noResultsSuggestions.js';
import { medicineSearchParams } from '../src/utils/recentSearches.js';
const params = query => new URLSearchParams(query);
test('suggestions reflect active filters only, never sorting, and remain limited to four', () => {
  for (const [query, text] of [['medicine=Panadol', 'Check the medicine'], ['province=Western', 'another district'], ['district=Colombo', 'another district'], ['lat=6.9&lng=79.8&radius=5', 'Increase the search radius'], ['openNow=true', 'currently closed'], ['hour24=true', '24-hour filter'], ['medicine=Panadol', 'currently out of stock'], ['emergency=true', 'Emergency Mode']]) assert.ok(noResultsSuggestions(params(query)).some(value => value.includes(text)), query);
  const inactive = noResultsSuggestions(params('sort=nearest&openNow=false&hour24=false&includeOutOfStock=true'));
  assert.doesNotMatch(inactive.join(' '), /radius|district|closed|24-hour|out of stock|sort/i);
  const many = noResultsSuggestions(params('medicine=Panadol&province=Western&district=Colombo&lat=6.9&lng=79.8&radius=5&openNow=true&hour24=true'));
  assert.equal(many.length, 4);
});
test('Clear Filters preserves medicine, coordinates and ordering while removing restrictive filters', () => {
  const original = params('medicine=Panadol&province=Western&district=Colombo&lat=6.9&lng=79.8&radius=5&sort=nearest&openNow=true&hour24=true&emergency=true&pharmacy=City');
  assert.equal(hasRestrictiveFilters(original), true);
  const cleared = clearNoResultsFilters(original);
  for (const key of ['medicine', 'lat', 'lng', 'sort']) assert.equal(cleared.get(key), original.get(key));
  for (const key of ['province', 'district', 'radius', 'openNow', 'hour24', 'emergency', 'pharmacy']) assert.equal(cleared.has(key), false);
  assert.equal(cleared.get('includeOutOfStock'), 'true'); assert.equal(hasRestrictiveFilters(cleared), false);
  assert.equal(original.get('district'), 'Colombo'); assert.equal(hasRestrictiveFilters(params('')), false);
});
test('successful empty state renders safe contextual list; loading/errors/results suppress suggestions', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { default: Suggestions } = await vite.ssrLoadModule('/src/components/NoResultsSuggestions.jsx');
    const { default: Count } = await vite.ssrLoadModule('/src/components/SearchResultCount.jsx');
    const render = options => renderToString(createElement(Suggestions, { params: params('medicine=Panadol'), ...options }));
    const html = render({}); assert.match(html, /Try these suggestions/); assert.match(html, /Panadol/); assert.match(html, /<ul>/); assert.match(html, /Clear Filters/); assert.doesNotMatch(html, /aria-live/);
    for (const options of [{ loading: true }, { error: 'Offline' }, { results: [{ _id: 'p' }] }]) assert.equal(render(options), '');
    const unsafe = params(''); unsafe.set('medicine', '<script>alert(1)</script>');
    assert.doesNotMatch(render({ params: unsafe }), /<script>/); assert.match(render({ params: unsafe }), /&lt;script&gt;/);
    assert.doesNotMatch(render({ params: params('medicine=%20%20%20') }), /No matches for|Clear Filters/);
    assert.doesNotMatch(render({ params: params('') }), /undefined|null|for ""/);
    const chip = medicineSearchParams(params('province=Western'), 'MedicineThatDoesNotExist');
    assert.match(render({ params: chip }), /MedicineThatDoesNotExist/);
    const combined = renderToString(createElement('div', {}, createElement(Count, { results: [] }), createElement(Suggestions, { params: chip })));
    assert.equal((combined.match(/No pharmacies found/g) || []).length, 1);
    let clicked = false; const view = Suggestions({ params: chip, onClearFilters: () => { clicked = true; } });
    view.props.children[3].props.onClick(); assert.equal(clicked, true);
  } finally { await vite.close(); }
});
