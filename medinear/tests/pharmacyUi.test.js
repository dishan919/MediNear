import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
test('customer search, emergency and map UI render; owner dashboard provides profile creation', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { default: Home } = await server.ssrLoadModule('/src/pages/Home.jsx');
    const home = renderToString(createElement(MemoryRouter, {}, createElement(Home)));
    for (const text of ['Search medicine...', 'Emergency / 24-Hour', 'Use current location', 'Open now', 'Open 24 hours', 'Google pharmacy map']) assert.ok(home.includes(text));
    const { AuthContext } = await server.ssrLoadModule('/src/auth/AuthContext.jsx');
    const { default: Dashboard } = await server.ssrLoadModule('/src/pages/PharmacyDashboard.jsx');
    const dashboard = renderToString(createElement(AuthContext.Provider, { value: { user: { name: 'Owner' } } }, createElement(Dashboard)));
    assert.ok(dashboard.includes('Save pharmacy')); assert.ok(dashboard.includes('Create a pharmacy'));
    const { default: Card } = await server.ssrLoadModule('/src/components/PharmacyCard.jsx');
    const markup = renderToString(createElement(MemoryRouter, {}, createElement(Card, { pharmacy: { _id: 'a', name: 'City', isOpen: null, openStatus: 'Hours unavailable', distance: .8, medicines: [{ _id: 'm', name: 'Panadol', availability: 'Available' }] }, onViewMap() {} })));
    for (const text of ['Hours unavailable', '0.8 km', 'Panadol', 'Available', 'View on Map', 'Directions']) assert.ok(markup.includes(text));
  } finally { await server.close(); }
});
