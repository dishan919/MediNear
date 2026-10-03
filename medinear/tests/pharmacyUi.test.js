import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { formatPrice, imageSource, formatUpdated, coordinatesFromSearch, filterMedicines } from '../src/utils/medicineDisplay.js';
const sample = { _id: '507f1f77bcf86cd799439011', name: 'City Pharmacy', address: 'Colombo', district: 'Colombo', phone: '0111234567', timezone: 'Asia/Colombo', isOpen: true, openStatus: 'Open', hoursToday: '08:00–20:00', distance: .8, medicines: [{ _id: 'a', name: 'Panadol', genericName: 'Paracetamol', price: 120, quantity: 25, updatedAt: '2026-10-03T03:00:00Z' }, { _id: 'b', name: 'Vitamin C', genericName: 'Ascorbic Acid', price: 750, quantity: 0 }] };
test('legacy image fallback, safe image URLs, price and local timestamps', () => {
  assert.equal(imageSource(undefined), '/medicine-placeholder.svg');
  assert.equal(imageSource('javascript:alert(1)'), '/medicine-placeholder.svg');
  assert.equal(imageSource('https://example.test/a.png'), 'https://example.test/a.png');
  assert.equal(imageSource('', 'pharmacy'), '/pharmacy-placeholder.svg');
  assert.equal(formatPrice(120), 'LKR 120.00'); assert.equal(formatPrice(0), 'LKR 0.00');
  assert.equal(formatPrice(undefined), 'Price unavailable');
  assert.ok(formatUpdated('2026-10-03T03:00:00Z').includes('08:30'));
  assert.equal(formatUpdated(undefined), 'Update time unavailable');
});
test('details location and pharmacy medicine filtering use real query values', () => {
  assert.deepEqual(coordinatesFromSearch('?lat=6.9&lng=79.8'), { lat: 6.9, lng: 79.8 });
  assert.equal(coordinatesFromSearch('?lat=bad&lng=79.8'), null);
  assert.equal(coordinatesFromSearch('?lat=&lng=1'), null);
  assert.deepEqual(filterMedicines(sample.medicines, 'pArAc').map(m => m.name), ['Panadol']);
});
test('customer search, cards, details and owner forms render stock, price, image fallback and accessible controls', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  const render = element => renderToString(createElement(MemoryRouter, { initialEntries: ['/?medicine=Panadol&lat=6.9&lng=79.8'] }, element));
  try {
    const { default: Home } = await server.ssrLoadModule('/src/pages/Home.jsx');
    const home = render(createElement(Home));
    for (const text of ['Find Medicines', 'Search medicine...', 'Search', 'Emergency Mode', 'Use current location', 'Open Now', '24 Hour', 'Distance radius', 'Google pharmacy map']) assert.ok(home.includes(text), text);
    const { AuthContext } = await server.ssrLoadModule('/src/auth/AuthContext.jsx');
    const { default: Dashboard } = await server.ssrLoadModule('/src/pages/PharmacyDashboard.jsx');
    const dashboard = render(createElement(AuthContext.Provider, { value: { user: { name: 'Owner' } } }, createElement(Dashboard)));
    assert.ok(dashboard.includes('Create a pharmacy')); assert.ok(dashboard.includes('Loading your workspace'));
    const { default: Card } = await server.ssrLoadModule('/src/components/PharmacyCard.jsx');
    const markup = render(createElement(Card, { pharmacy: sample, onViewMap() {} }));
    for (const text of ['0.8 km', 'Panadol', 'LKR 120.00', '25 units', 'Out of Stock', '0 units', 'View Details', 'Directions', 'View on Map', '/medicine-placeholder.svg', `/pharmacy/${sample._id}?lat=6.9&amp;lng=79.8`]) assert.ok(markup.includes(text), text);
    assert.ok(!markup.includes('Available ?'));
    const { PharmacyDetailsView } = await server.ssrLoadModule('/src/pages/PharmacyDetails.jsx');
    const { default: PharmacyDetails } = await server.ssrLoadModule('/src/pages/PharmacyDetails.jsx');
    const { default: ProtectedRoute } = await server.ssrLoadModule('/src/components/ProtectedRoute.jsx');
    const routeMarkup = renderToString(createElement(MemoryRouter, { initialEntries: [`/pharmacy/${sample._id}`] }, createElement(AuthContext.Provider, { value: { user: { role: 'customer' }, logout() {} } }, createElement(Routes, {}, createElement(Route, { element: createElement(ProtectedRoute, { role: 'customer' }) }, createElement(Route, { path: '/pharmacy/:id', element: createElement(PharmacyDetails) }))))));
    assert.ok(routeMarkup.includes('Loading pharmacy...'));
    assert.ok(!routeMarkup.includes('City Pharmacy')); // No hardcoded pharmacy data before the API loads.
    const details = render(createElement(PharmacyDetailsView, { pharmacy: sample }));
    for (const text of ['Back to Search', 'Call Pharmacy', 'Available Medicines', 'Search medicines in this pharmacy...', 'About', 'Opening Hours', 'Location', 'LKR 750.00', '0 units', 'Out of Stock', 'Last Updated']) assert.ok(details.includes(text), text);
    const { default: Editor } = await server.ssrLoadModule('/src/components/MedicineEditor.jsx');
    const form = render(createElement(Editor, { medicine: sample.medicines[0] }));
    for (const text of ['Edit Medicine', 'Medicine image URL', 'Price (LKR)', 'Quantity / Stock', 'value="25"', 'value="120"', 'Save Changes', 'min="0"', '/medicine-placeholder.svg']) assert.ok(form.includes(text), text);
    assert.ok(render(createElement(Editor)).includes('Add Medicine'));
    const { default: Table } = await server.ssrLoadModule('/src/components/InventoryTable.jsx');
    const table = render(createElement(Table, { medicines: sample.medicines, timezone: sample.timezone }));
    for (const text of ['<table', 'Generic Name', 'Last Updated', 'Edit Panadol', 'Delete Panadol', 'LKR 120.00', 'Out of Stock']) assert.ok(table.includes(text), text);
  } finally { await server.close(); }
});
