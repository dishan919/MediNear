import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { visiblePharmacyResults, searchResultCountText } from '../src/utils/searchResults.js';
import { medicineSearchParams } from '../src/utils/recentSearches.js';
const samples = [{ _id: 'a', name: 'City', address: 'Road', district: 'Colombo' }, { _id: 'b', name: 'Other', district: 'Kandy' }];
test('zero, singular and plural describe the final list; frontend filtering and duplicates match visible cards', () => {
  assert.equal(searchResultCountText([]), 'No pharmacies found');
  assert.equal(searchResultCountText([samples[0]]), '1 pharmacy found');
  assert.equal(searchResultCountText(samples), '2 pharmacies found');
  assert.deepEqual(visiblePharmacyResults([...samples, samples[0]], ''), samples);
  assert.equal(searchResultCountText(visiblePharmacyResults(samples, 'colombo')), '1 pharmacy found');
  assert.equal(searchResultCountText(visiblePharmacyResults(samples, 'missing')), 'No pharmacies found');
  assert.equal(searchResultCountText([...samples].reverse()), searchResultCountText(samples));
  const params = medicineSearchParams(new URLSearchParams('province=Western&sort=nearest'), 'Panadol');
  assert.equal(params.get('medicine'), 'Panadol'); assert.equal(params.get('sort'), 'nearest');
});
test('count renders completed results with polite announcements and no misleading loading/error/initial count', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { default: Count } = await vite.ssrLoadModule('/src/components/SearchResultCount.jsx');
    const render = props => renderToString(createElement(Count, props));
    assert.match(render({ results: samples }), /2 pharmacies found/);
    assert.match(render({ results: [samples[0]] }), /1 pharmacy found/);
    assert.match(render({ results: [] }), /No pharmacies found/);
    for (const props of [{ results: samples, loading: true }, { results: [], loading: true }, { results: [], error: 'Offline' }]) assert.doesNotMatch(render(props), /pharmac(y|ies) found/);
    assert.match(render({ results: samples }), /aria-live="polite"/); assert.match(render({ results: samples }), /aria-atomic="true"/);
    const { default: Card } = await vite.ssrLoadModule('/src/components/PharmacyCard.jsx');
    const results = visiblePharmacyResults([...samples, samples[0]], 'Colombo');
    const markup = renderToString(createElement(MemoryRouter, {}, createElement('div', {}, createElement(Count, { results }), results.map(pharmacy => createElement(Card, { key: pharmacy._id, pharmacy })))));
    assert.equal((markup.match(/<article/g) || []).length, results.length); assert.match(markup, /1 pharmacy found/);
    const { default: Home } = await vite.ssrLoadModule('/src/pages/Home.jsx');
    const initial = renderToString(createElement(MemoryRouter, {}, createElement(Home)));
    assert.doesNotMatch(initial, /No pharmacies found|0 pharmacies found/); assert.match(initial, /Finding your pharmacies/);
  } finally { await vite.close(); }
});
