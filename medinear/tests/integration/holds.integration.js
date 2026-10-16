import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { holdService } from '../../src/utils/holds.js';
const require = createRequire(new URL('../../../backend/package.json', import.meta.url));
const mongoose = require('mongoose'), express = require('express'), jwt = require('jsonwebtoken');
const User = require('./models/User'), Pharmacy = require('./models/Pharmacy'), Hold = require('./models/HoldRequest');
test('hold UI service -> real API/database -> customer/owner views and existing Low Stock rendering', async () => {
  require('dotenv').config({ path: fileURLToPath(new URL('../../../backend/.env', import.meta.url)), quiet: true }); require('./scripts/seed').assertDevelopmentDatabase(process.env.MONGO_URI, process.env.NODE_ENV); process.env.JWT_SECRET ||= randomUUID();
  let server, vite, pharmacy; const users = [];
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 }); await Hold.init();
    for (const role of ['customer', 'pharmacy_owner']) users.push(await User.create({ name: 'Hold UI Test', email: `${randomUUID()}@medinear.test`, password: await require('./utils/hashPassword')('HoldUi123'), role }));
    pharmacy = await Pharmacy.create({ owner: users[1]._id, name: 'Hold UI Pharmacy', address: 'Test', district: 'Colombo', phone: '0771234567', latitude: 6.9, longitude: 79.8, inventory: [{ name: 'Panadol', quantity: 5 }] });
    const app = express(); app.use(express.json()); app.use('/api', require('./routes/holdRoutes')); server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    async function request(method, path, body, config) {
      const url = new URL(`http://127.0.0.1:${server.address().port}/api${path}`); for (const [key, value] of Object.entries(config.params || {})) url.searchParams.set(key, value);
      const response = await fetch(url, { method, signal: config.signal, headers: { 'Content-Type': 'application/json', ...config.headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
      const data = await response.json(); if (!response.ok) throw { response: { status: response.status, data } }; return { data };
    }
    const api = { get: (path, config) => request('GET', path, null, config), post: (path, body, config) => request('POST', path, body, config), patch: (path, body, config) => request('PATCH', path, body, config) };
    const customer = holdService(api, () => jwt.sign({ userId: users[0]._id }, process.env.JWT_SECRET)), owner = holdService(api, () => jwt.sign({ userId: users[1]._id }, process.env.JWT_SECRET));
    vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
    const { HoldRequestsView } = await vite.ssrLoadModule('/src/components/HoldRequests.jsx');
    const { default: Card } = await vite.ssrLoadModule('/src/components/MedicineCard.jsx');
    const render = (data, ownerMode = false) => renderToString(createElement(HoldRequestsView, { data, owner: ownerMode, pharmacyId: ownerMode ? String(pharmacy._id) : null }));
    const hold = await customer.create(String(pharmacy._id), String(pharmacy.inventory[0]._id), 2); assert.equal(hold.status, 'pending'); assert.equal((await Pharmacy.findById(pharmacy._id)).inventory[0].quantity, 5);
    const pending = render(await customer.list(null, 1)); assert.match(pending, /Pending/); assert.match(pending, /Waiting for pharmacy confirmation/); assert.doesNotMatch(pending, /Medicine reserved/);
    assert.match(render(await owner.list(String(pharmacy._id), 1), true), />Accept</);
    if (await require('./services/databaseCapabilities').supportsTransactions()) {
      await owner.action(String(pharmacy._id), hold._id, 'accept'); const stock = (await Pharmacy.findById(pharmacy._id)).inventory[0]; assert.equal(stock.quantity, 3);
      const confirmed = render(await customer.list(null, 1)); assert.match(confirmed, /Accepted/); assert.match(confirmed, /Confirmed by pharmacy/); assert.doesNotMatch(confirmed, /Cancel Request/);
      const card = renderToString(createElement(MemoryRouter, {}, createElement(Card, { medicine: stock, pharmacyId: String(pharmacy._id) }))); assert.match(card, /Low Stock/); assert.match(card, /Only 3 remaining/);
    } else {
      await assert.rejects(owner.action(String(pharmacy._id), hold._id, 'accept'), e => e.response.status === 503); assert.equal((await Pharmacy.findById(pharmacy._id)).inventory[0].quantity, 5);
      await customer.action(null, hold._id, 'cancel'); assert.match(render(await customer.list(null, 1)), /Cancelled/);
    }
    const next = await customer.create(String(pharmacy._id), String(pharmacy.inventory[0]._id), 1); await owner.action(String(pharmacy._id), next._id, 'reject'); assert.match(render(await customer.list(null, 1)), /Rejected/);
  } finally { if (vite) await vite.close(); if (pharmacy) { await Hold.deleteMany({ pharmacy: pharmacy._id }); await Pharmacy.deleteOne({ _id: pharmacy._id }); } if (users.length) await User.deleteMany({ _id: { $in: users.map(u => u._id) } }); if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); }
});
