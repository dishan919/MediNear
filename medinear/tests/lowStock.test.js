import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { LOW_STOCK_THRESHOLD, getStockStatus, formatStockQuantity } from '../src/utils/stockStatus.js';
test('stock status handles zero, threshold, normal and invalid/legacy values safely', () => {
  assert.equal(getStockStatus(0).label, 'Out of Stock'); assert.equal(getStockStatus(1).label, 'Low Stock');
  assert.equal(getStockStatus(LOW_STOCK_THRESHOLD).label, 'Low Stock'); assert.equal(getStockStatus(LOW_STOCK_THRESHOLD + 1).label, 'Available');
  assert.equal(formatStockQuantity(3), 'Only 3 remaining'); assert.equal(formatStockQuantity(0), '0 units'); assert.equal(formatStockQuantity(10), '10 units');
  for (const quantity of [null, undefined, NaN, Infinity, '3', 1.5, -3, {}]) assert.equal(formatStockQuantity(quantity), 'Stock unavailable');
  assert.equal(getStockStatus(-3).label, 'Out of Stock');
});
test('customer search/detail cards and owner badges show low stock without changing restock subscription conditions', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { default: Medicine } = await vite.ssrLoadModule('/src/components/MedicineCard.jsx');
    const { default: Card } = await vite.ssrLoadModule('/src/components/PharmacyCard.jsx');
    const { PharmacyDetailsView } = await vite.ssrLoadModule('/src/pages/PharmacyDetails.jsx');
    const { default: Table } = await vite.ssrLoadModule('/src/components/InventoryTable.jsx');
    const medicine = { _id: 'm', name: 'Panadol', quantity: 3, price: 120 };
    const pharmacy = { _id: '507f1f77bcf86cd799439011', name: 'City', phone: '123', address: 'Colombo', medicines: [medicine] };
    const { AlertsContext } = await vite.ssrLoadModule('/src/auth/AlertsContext.jsx');
    const render = element => renderToString(createElement(MemoryRouter, {}, createElement(AlertsContext.Provider, { value: { subscriptions: [], loading: false, error: '' } }, element))).replace(/<!--.*?-->/g, '');
    for (const element of [createElement(Card, { pharmacy }), createElement(PharmacyDetailsView, { pharmacy }), createElement(Table, { medicines: [medicine] })]) assert.match(render(element), /Low Stock/);
    const low = render(createElement(Medicine, { medicine, pharmacyId: pharmacy._id }));
    assert.match(low, /Only 3 remaining/); assert.match(low, /mn-warning/); assert.doesNotMatch(low, /Notify Me When Available/);
    assert.match(render(createElement(Medicine, { medicine: { ...medicine, quantity: 10 } })), /Available/);
    const zero = render(createElement(Medicine, { medicine: { ...medicine, quantity: 0 }, pharmacyId: pharmacy._id }));
    assert.match(zero, /Out of Stock/); assert.match(zero, /Notify Me When Available/);
    const invalid = render(createElement(Medicine, { medicine: { ...medicine, quantity: NaN } }));
    assert.match(invalid, /Stock unavailable/); assert.doesNotMatch(invalid, /NaN units|NaN remaining/);
  } finally { await vite.close(); }
});
