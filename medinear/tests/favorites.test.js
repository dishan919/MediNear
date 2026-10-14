import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { favoritesService } from '../src/api/favorites.js';
test('favorites service uses account token, real routes, server saved state and propagates errors', async () => {
  const calls = [];
  const api = { get: async (...args) => { calls.push(args); return { data: { favorites: [{ _id: 'pharmacy' }] } }; }, post: async (...args) => { calls.push(args); return { data: { saved: true } }; }, delete: async (...args) => { calls.push(args); return { data: { saved: false } }; } };
  const service = favoritesService(api, { getItem: () => 'session-token' });
  assert.deepEqual(await service.list(), [{ _id: 'pharmacy' }]);
  assert.equal((await service.setSaved('pharmacy', true)).saved, true);
  assert.equal((await service.setSaved('pharmacy', false)).saved, false);
  assert.equal(calls[0][0], '/users/favorites'); assert.equal(calls[1][0], '/users/favorites/pharmacy');
  assert.deepEqual(calls[1][1], {}); assert.equal(calls[1][2].headers.Authorization, 'Bearer session-token');
  api.post = async () => { throw new Error('Network failed'); };
  await assert.rejects(service.setSaved('pharmacy', true), /Network failed/);
});
test('saved pharmacy controls and list render accessible saved, loading, failure and empty states', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { default: Button } = await vite.ssrLoadModule('/src/components/FavoriteButton.jsx');
    const { FavoritesView } = await vite.ssrLoadModule('/src/pages/Favorites.jsx');
    const { PharmacyDetailsView } = await vite.ssrLoadModule('/src/pages/PharmacyDetails.jsx');
    const render = element => renderToString(createElement(MemoryRouter, {}, element));
    const saved = render(createElement(Button, { pharmacyId: 'pharmacy', initiallyFavorite: true, showLabel: true }));
    assert.match(saved, /aria-pressed="true"/); assert.match(saved, /Saved/); assert.match(saved, /Remove from saved pharmacies/);
    const unsaved = render(createElement(Button, { pharmacyId: 'pharmacy', showLabel: true, disabled: true }));
    assert.match(unsaved, /Save Pharmacy/); assert.match(unsaved, /disabled/); assert.match(unsaved, /aria-pressed="false"/);
    const pharmacy = { _id: 'pharmacy', name: 'Saved Pharmacy', address: 'Colombo', phone: '0111234567', openStatus: 'Open', isOpen: true, open24Hours: true };
    const list = render(createElement(FavoritesView, { favorites: [pharmacy] }));
    for (const text of ['Saved Pharmacies', 'Saved Pharmacy', 'Colombo', '0111234567', 'Open', '24 Hours', 'View Pharmacy', '/pharmacy/pharmacy']) assert.ok(list.includes(text), text);
    assert.match(render(createElement(FavoritesView, { favorites: [] })), /No saved pharmacies yet\./);
    assert.match(render(createElement(FavoritesView, { favorites: [], loading: true })), /Loading saved pharmacies/);
    const error = render(createElement(FavoritesView, { favorites: [], error: 'Network error' }));
    assert.match(error, /role="alert"/); assert.match(error, /Try again/); assert.doesNotMatch(error, /No saved pharmacies yet/);
    const detail = render(createElement(PharmacyDetailsView, { pharmacy, favoriteLoading: true }));
    assert.match(detail, /Checking saved status/); assert.match(detail, /disabled/);
    const failed = render(createElement(PharmacyDetailsView, { pharmacy, favoriteError: 'Unable to check saved status.' }));
    assert.match(failed, /Retry saved status/); assert.match(failed, /disabled/);
  } finally { await vite.close(); }
});
