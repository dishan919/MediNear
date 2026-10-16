import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { loadInventoryAnalytics } from '../../src/utils/inventoryAnalytics.js';
import { expiryCutoffDate } from '../../../shared/medicineExpiry.mjs';
const require = createRequire(new URL('../../../backend/package.json', import.meta.url));
const mongoose = require('mongoose'), express = require('express'), jwt = require('jsonwebtoken');
const User = require('./models/User'), Pharmacy = require('./models/Pharmacy');

test('inventory analytics real database/API -> frontend loader -> six cards and attention view', async () => {
  require('dotenv').config({ path: fileURLToPath(new URL('../../../backend/.env', import.meta.url)), quiet: true });
  require('./scripts/seed').assertDevelopmentDatabase(process.env.MONGO_URI, process.env.NODE_ENV);
  process.env.JWT_SECRET ||= randomUUID();
  let server, vite, owner, pharmacy;
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    owner = await User.create({ name: 'Analytics UI', email: `${randomUUID()}@medinear.test`, password: await require('./utils/hashPassword')('AnalyticsUi123'), role: 'pharmacy_owner' });
    const date = days => new Date(expiryCutoffDate().getTime() + days * 86400000);
    pharmacy = await Pharmacy.create({ owner: owner._id, name: 'Analytics UI Pharmacy', address: 'Test', district: 'Colombo', phone: '0771234567', latitude: 6.9, longitude: 79.8, inventory: [
      { name: 'Panadol', quantity: 3, expiryDate: date(100) }, { name: 'Vitamin C', quantity: 10, expiryDate: date(7) },
      { name: 'Medicine X', quantity: 0, expiryDate: date(100) }, { name: 'Medicine Y', quantity: 8, expiryDate: date(-1) }, { name: 'Medicine Z', quantity: 20 },
    ] });
    const app = express(); app.use('/api/pharmacies', require('./routes/pharmacyRoutes'));
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const api = { get: async (path, config) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, config);
      assert.equal(response.status, 200); return { data: await response.json() };
    } };
    const load = () => loadInventoryAnalytics(api, String(pharmacy._id), undefined, jwt.sign({ userId: owner._id }, process.env.JWT_SECRET));
    const before = await Pharmacy.findById(pharmacy._id).lean();
    const data = await load();
    assert.deepEqual(data.summary, { totalMedicines: 5, totalStockUnits: 41, lowStock: 1, outOfStock: 1, expiringSoon: 1, expired: 1 });
    assert.deepEqual(data.needsAttention.map(item => item.name), ['Medicine Y', 'Medicine X', 'Vitamin C', 'Panadol']);
    assert.deepEqual(await Pharmacy.findById(pharmacy._id).lean(), before);
    vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
    const { InventoryAnalyticsView } = await vite.ssrLoadModule('/src/components/InventoryAnalytics.jsx');
    const html = renderToString(createElement(InventoryAnalyticsView, { pharmacyId: String(pharmacy._id), data }));
    for (const label of ['Total Medicines', 'Total Stock Units', 'Low Stock', 'Out of Stock', 'Expiring Soon', 'Expired', 'Needs Attention', 'View Inventory']) assert.ok(html.includes(label));
    assert.match(html, />41</); assert.doesNotMatch(html, /Medicine Z|type="password"|<form/);
    pharmacy.inventory[0].quantity = 9; pharmacy.inventory[0].expiryDate = date(7); await pharmacy.save();
    const changed = await load(); assert.equal(changed.summary.totalStockUnits, 47); assert.equal(changed.summary.lowStock, 0); assert.equal(changed.summary.expiringSoon, 2);
  } finally {
    if (vite) await vite.close();
    if (pharmacy) await Pharmacy.deleteOne({ _id: pharmacy._id });
    if (owner) await User.deleteOne({ _id: owner._id });
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
  }
});
