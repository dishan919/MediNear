import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { RECENT_PHARMACIES_KEY, getRecentlyViewedPharmacies, addRecentlyViewedPharmacy, removeRecentlyViewedPharmacy, clearRecentlyViewedPharmacies, recordPharmacyDetailsView, resolveRecentPharmacies } from '../src/utils/recentPharmacies.js';
import { clearSession } from '../src/auth/session.js';
const ids = Array.from({ length: 6 }, (_, index) => String(index + 1).padStart(24, '0'));
function storage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}
test('successful customer detail views persist only IDs; anonymous/owner/failed/invalid views do not', () => {
  const saved = storage(), customer = { id: 'customer', role: 'customer' };
  const response = { success: true, pharmacy: { _id: ids[0], name: 'Test', inventory: ['private'], latitude: 6.9, distance: 4 } };
  for (const user of [undefined, { role: 'customer' }, { id: 'owner', role: 'pharmacy_owner' }]) assert.equal(recordPharmacyDetailsView(user, response, ids[0], saved), null);
  assert.equal(recordPharmacyDetailsView(customer, { success: false }, ids[0], saved), null);
  assert.equal(recordPharmacyDetailsView(customer, response, ids[1], saved), null);
  assert.equal(recordPharmacyDetailsView(customer, { success: true, pharmacy: { _id: 'bad' } }, 'bad', saved), null);
  assert.deepEqual([...saved.data.keys()], []);
  assert.deepEqual(recordPharmacyDetailsView(customer, response, ids[0], saved), [ids[0]]);
  assert.deepEqual(JSON.parse(saved.getItem(RECENT_PHARMACIES_KEY)), [ids[0]]);
});
test('recency is newest first, duplicates move first, max five evicts oldest and refresh reads IDs', () => {
  const saved = storage(); ids.forEach(id => addRecentlyViewedPharmacy(id, saved));
  assert.deepEqual(getRecentlyViewedPharmacies(saved), [...ids].reverse().slice(0, 5));
  assert.deepEqual(addRecentlyViewedPharmacy(ids[2], saved), [ids[2], ids[5], ids[4], ids[3], ids[1]]);
  assert.deepEqual(getRecentlyViewedPharmacies(storage(Object.fromEntries(saved.data))), [ids[2], ids[5], ids[4], ids[3], ids[1]]);
});
test('individual removal/clear affect only local pharmacy history; logout clears both histories', () => {
  const saved = storage({ token: 'session', user: 'profile', cart: 'items', favorites: 'saved', medinear_recent_searches: '["Panadol"]' });
  addRecentlyViewedPharmacy(ids[0], saved); addRecentlyViewedPharmacy(ids[1], saved);
  assert.deepEqual(removeRecentlyViewedPharmacy(ids[0], saved), [ids[1]]);
  clearRecentlyViewedPharmacies(saved); assert.equal(saved.getItem('favorites'), 'saved'); assert.equal(saved.getItem('token'), 'session'); assert.equal(saved.getItem('medinear_recent_searches'), '["Panadol"]');
  addRecentlyViewedPharmacy(ids[0], saved); clearSession(saved);
  assert.equal(saved.getItem(RECENT_PHARMACIES_KEY), null); assert.equal(saved.getItem('medinear_recent_searches'), null); assert.equal(saved.getItem('favorites'), 'saved'); assert.equal(saved.getItem('cart'), 'items');
});
test('corrupted/invalid/unavailable storage is safe and invalid entries are cleaned', () => {
  for (const value of ['not-json', '{}', 'null']) assert.deepEqual(getRecentlyViewedPharmacies(storage({ [RECENT_PHARMACIES_KEY]: value })), []);
  const saved = storage({ [RECENT_PHARMACIES_KEY]: JSON.stringify(['invalid', ids[0], {}, ids[0], ids[1]]) });
  assert.deepEqual(getRecentlyViewedPharmacies(saved), [ids[0], ids[1]]);
  assert.deepEqual(JSON.parse(saved.getItem(RECENT_PHARMACIES_KEY)), [ids[0], ids[1]]);
  const unavailable = { getItem() { throw new Error('Denied'); }, setItem() { throw new Error('Denied'); }, removeItem() { throw new Error('Denied'); } };
  assert.deepEqual(getRecentlyViewedPharmacies(unavailable), []); assert.deepEqual(addRecentlyViewedPharmacy(ids[0], unavailable), [ids[0]]); assert.deepEqual(clearRecentlyViewedPharmacies(unavailable), []);
});
test('current details are resolved in recency order, 404s are pruned and transient failures remain retryable', async () => {
  const calls = [];
  const api = { async get(path) {
    calls.push(path);
    if (path.endsWith(ids[1])) throw { response: { status: 404 } };
    if (path.endsWith(ids[2])) throw new Error('Offline');
    return { data: { success: true, pharmacy: { _id: path.split('/').at(-1), name: 'Fresh name', district: 'Colombo', inventory: [{ quantity: 1 }], distance: 2, isOpen: true } } };
  } };
  const result = await resolveRecentPharmacies(api, ids.slice(0, 4));
  assert.deepEqual(result.pharmacies.map(p => p._id), [ids[0], ids[3]]); assert.deepEqual(result.missing, [ids[1]]); assert.equal(result.failed, true);
  assert.equal(result.pharmacies[0].name, 'Fresh name'); assert.equal(result.pharmacies[0].inventory, undefined); assert.equal(result.pharmacies[0].distance, undefined);
  assert.deepEqual(calls, ids.slice(0, 4).map(id => `/pharmacies/${id}`));
});
test('compact section uses existing routes, hides empty history, accessible removal and cards never record', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { RecentlyViewedView } = await vite.ssrLoadModule('/src/components/RecentlyViewedPharmacies.jsx');
    const { default: Card } = await vite.ssrLoadModule('/src/components/PharmacyCard.jsx');
    const saved = storage(); let removed, clears = 0;
    const pharmacy = { _id: ids[0], name: 'City', district: 'Colombo', province: 'Western' };
    const render = element => renderToString(createElement(MemoryRouter, {}, element));
    assert.equal(render(createElement(RecentlyViewedView, { pharmacies: [] })), '');
    const html = render(createElement(RecentlyViewedView, { pharmacies: [pharmacy], onRemove() {}, onClear() {} }));
    for (const value of ['Recently Viewed Pharmacies', 'View Pharmacy', `/pharmacy/${ids[0]}`, 'Clear Recently Viewed', 'Colombo', 'Western', 'Remove City from recently viewed pharmacies']) assert.ok(html.includes(value), value);
    assert.doesNotMatch(html, /Save Pharmacy|Remove from saved pharmacies/);
    render(createElement(Card, { pharmacy })); assert.deepEqual(getRecentlyViewedPharmacies(saved), []);
    const card = Card; assert.equal(typeof card, 'function');
    const view = RecentlyViewedView({ pharmacies: [pharmacy], onRemove: id => { removed = id; }, onClear: () => { clears++; } });
    view.props.children[0].props.children[1].props.onClick(); assert.equal(clears, 1);
    view.props.children[3].props.children[0].props.onRemoveRecentlyViewed(ids[0]); assert.equal(removed, ids[0]);
  } finally { await vite.close(); }
});
