import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { locations, changeProvince, geolocationMessage, requestLocation } from '../src/utils/locationDiscovery.js';
test('province changes reset incompatible district and preserve unrelated search filters', () => {
  const params = new URLSearchParams('province=Western&district=Colombo&medicine=Panadol&lat=6.9&lng=79.8');
  const changed = changeProvince(params, 'Central');
  assert.equal(changed.get('district'), null); assert.equal(changed.get('province'), 'Central'); assert.equal(changed.get('medicine'), 'Panadol');
  assert.equal(changeProvince(params, '').get('district'), null);
  assert.equal(changeProvince(params, 'Western').get('district'), 'Colombo');
  assert.equal(params.get('district'), 'Colombo'); assert.equal(Object.keys(locations).length, 9);
});
test('explicit geolocation handles denied, unavailable, timeout, unsupported and success without tracking', () => {
  let calls = 0, message = '', success;
  const geo = { getCurrentPosition(ok, fail, options) { calls++; assert.equal(options.timeout, 10000); fail({ code: 1 }); } };
  assert.equal(calls, 0);
  requestLocation(geo, () => {}, error => { message = geolocationMessage(error); });
  assert.equal(calls, 1); assert.match(message, /access was denied/); assert.match(message, /province and district/);
  assert.match(geolocationMessage({ code: 2 }), /unavailable/); assert.match(geolocationMessage({ code: 3 }), /timed out/);
  requestLocation(undefined, () => {}, error => { assert.equal(error.unsupported, true); });
  requestLocation({ getCurrentPosition(ok) { ok({ coords: { latitude: 6.9, longitude: 79.8 } }); } }, position => { success = position.coords; }, () => {});
  assert.deepEqual(success, { latitude: 6.9, longitude: 79.8 });
});
test('dependent customer and owner dropdowns and discovery controls render accessible responsive UI', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const render = element => renderToString(createElement(MemoryRouter, {}, element));
    const { default: Areas } = await vite.ssrLoadModule('/src/components/AreaSelects.jsx');
    const western = render(createElement(Areas, { province: 'Western', district: 'Colombo' }));
    assert.match(western, /value="Colombo"/); assert.match(western, /value="Gampaha"/); assert.doesNotMatch(western, /value="Kandy"/);
    const empty = render(createElement(Areas, {})); assert.match(empty, /All Provinces/); assert.match(empty, /All Districts/); assert.match(empty, /disabled/);
    const owner = render(createElement(Areas, { required: true, province: 'Central', district: 'Kandy' })); assert.match(owner, /required/); assert.match(owner, /value="Kandy"/); assert.doesNotMatch(owner, /value="Colombo"/);
    const { default: Home } = await vite.ssrLoadModule('/src/pages/Home.jsx');
    const home = render(createElement(Home)).replace(/<!--.*?-->/g, '');
    for (const text of ['Province', 'District', 'Use My Location', 'Available Only', 'Reset Filters', 'Nearest first', 'Smart Ranking', 'Within 2 km', '24 Hour', 'Emergency Mode']) assert.ok(home.includes(text), text);
    const { default: Card } = await vite.ssrLoadModule('/src/components/PharmacyCard.jsx');
    const card = render(createElement(Card, { pharmacy: { _id: 'p', name: 'Test', province: 'Western', district: 'Colombo', address: 'Road', latitude: 6.9, longitude: 79.8, distance: 1.8, openStatus: 'Open', isOpen: true } }));
    for (const text of ['Western', 'Colombo', '1.8 km away', 'Directions']) assert.ok(card.includes(text));
  } finally { await vite.close(); }
});
