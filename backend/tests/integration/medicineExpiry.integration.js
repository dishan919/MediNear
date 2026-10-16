const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path'), { randomUUID } = require('node:crypto');
const mongoose = require('mongoose'), express = require('express'), jwt = require('jsonwebtoken');
const User = require('../../models/User'), Pharmacy = require('../../models/Pharmacy'), Hold = require('../../models/HoldRequest'), Notification = require('../../models/Notification');
const Subscription = require('../../models/RestockSubscription');
const { expiryCutoffDate } = require('../../../shared/medicineExpiry.mjs');
test('medicine expiry HTTP: owner fields/authorization, search/counts, legacy data, hold checks and restock suppression', async t => {
  require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true }); require('../../scripts/seed').assertDevelopmentDatabase(process.env.MONGO_URI, process.env.NODE_ENV); process.env.JWT_SECRET ||= randomUUID();
  let server, pharmacy; const users = [];
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 }); await Hold.init();
    for (const role of ['customer', 'pharmacy_owner', 'pharmacy_owner']) users.push(await User.create({ name: 'Expiry Test', email: `${randomUUID()}@medinear.test`, password: await require('../../utils/hashPassword')('MedicineExpiry123'), role }));
    pharmacy = await Pharmacy.create({ owner: users[1]._id, name: `Expiry Pharmacy ${randomUUID()}`, address: 'Test', district: 'Colombo', phone: '0771234567', latitude: 6.9, longitude: 79.8 });
    const app = express(); app.use(express.json()); app.use('/api', require('../../routes/holdRoutes')); app.use('/api/pharmacies', require('../../routes/pharmacyRoutes')); app.use('/api', require('../../routes/alertRoutes')); server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    async function request(method, url, user, body) { const r = await fetch(`http://127.0.0.1:${server.address().port}/api${url}`, { method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${jwt.sign({ userId: user._id }, process.env.JWT_SECRET)}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: r.status, data: await r.json() }; }
    const inventory = `/pharmacies/${pharmacy._id}/inventory`, suffix = randomUUID();
    const key = offset => new Date(expiryCutoffDate().getTime() + offset * 86400000).toISOString().slice(0, 10);
    const created = [];
    for (const [type, expiryDate, quantity] of [['future', key(31), 10], ['soon', key(7), 5], ['expired', key(-1), 10], ['legacy', undefined, 8]]) {
      const result = await request('POST', inventory, users[1], { name: `${type}-${suffix}`, quantity, price: 120, ...(expiryDate ? { expiryDate } : {}) }); assert.equal(result.status, 201);
      created.push(result.data.inventory.at(-1));
    }
    assert.equal(created[0].expiryDate, key(31) + 'T00:00:00.000Z');
    for (const user of [users[0], users[2]]) assert.ok([403, 404].includes((await request('PATCH', `${inventory}/${created[0]._id}`, user, { expiryDate: key(-1) })).status));
    for (const expiryDate of ['bad', '2026-02-30', 123, {}, '2026-10-25T08:00:00Z']) assert.equal((await request('PATCH', `${inventory}/${created[0]._id}`, users[1], { expiryDate })).status, 400);
    const query = item => `/pharmacies/search?medicine=${encodeURIComponent(item.name)}`;
    for (const item of [created[0], created[1], created[3]]) { const result = await request('GET', query(item)); assert.equal(result.data.count, 1); assert.equal(result.data.pharmacies[0].availability, 'Available'); }
    const hidden = await request('GET', query(created[2])); assert.equal(hidden.data.count, 0); assert.deepEqual(hidden.data.pharmacies, []);
    assert.equal((await request('GET', `${query(created[2])}&includeOutOfStock=true`)).data.count, 0);
    const details = (await request('GET', `/pharmacies/${pharmacy._id}`)).data.pharmacy; assert.ok(!details.medicines.some(m => m._id === created[2]._id)); assert.equal(details.medicines.length, 3);
    const alertAttempt = await request('POST', '/restock-subscriptions', users[0], { pharmacy: pharmacy._id, medicine: created[2]._id }); assert.equal(alertAttempt.status, 409); assert.match(alertAttempt.data.message, /expired/);
    const holds = `/pharmacies/${pharmacy._id}/hold-requests`;
    assert.equal((await request('POST', holds, users[0], { medicineId: created[2]._id, quantity: 1 })).status, 409);
    const pending = await request('POST', holds, users[0], { medicineId: created[1]._id, quantity: 2 }); assert.equal(pending.status, 201);
    assert.equal((await request('PATCH', `${inventory}/${created[1]._id}`, users[1], { expiryDate: key(-1) })).status, 200);
    const topology = await require('../../services/databaseCapabilities').supportsTransactions();
    await t.test('transactional accept rechecks changed expiry with no partial status/stock; accepted holds remain unchanged by expiry edits', { skip: !topology && 'Replica set required for transaction checks' }, async () => {
      const failed = await request('PATCH', `${holds}/${pending.data.request._id}/accept`, users[1]); assert.equal(failed.status, 409); assert.match(failed.data.message, /expired/);
      assert.equal((await Hold.findById(pending.data.request._id)).status, 'pending'); assert.equal((await Pharmacy.findById(pharmacy._id)).inventory.id(created[1]._id).quantity, 5);
      await request('PATCH', `${inventory}/${created[1]._id}`, users[1], { expiryDate: key(7) });
      assert.equal((await request('PATCH', `${holds}/${pending.data.request._id}/accept`, users[1])).status, 200);
      await request('PATCH', `${inventory}/${created[1]._id}`, users[1], { expiryDate: key(-1) });
      assert.equal((await Hold.findById(pending.data.request._id)).status, 'accepted'); assert.equal((await Pharmacy.findById(pharmacy._id)).inventory.id(created[1]._id).quantity, 3);
    });
    const clear = await request('PATCH', `${inventory}/${created[0]._id}`, users[1], { expiryDate: null }); assert.equal(clear.status, 200); assert.equal(clear.data.inventory[0].expiryDate, null);
    await request('PATCH', `${inventory}/${created[0]._id}`, users[1], { expiryDate: key(-1), quantity: 0 });
    const subscription = await Subscription.create({ customer: users[0]._id, pharmacy: pharmacy._id, medicine: created[0]._id });
    const expiredRestock = await request('PATCH', `${inventory}/${created[0]._id}`, users[1], { quantity: 5 }); assert.equal(expiredRestock.status, 200); assert.equal(await Notification.countDocuments({ pharmacy: pharmacy._id }), 0);
    assert.equal((await Subscription.findById(subscription._id)).active, true);
    assert.equal((await request('GET', query(created[0]))).data.count, 0);
    await request('PATCH', `${inventory}/${created[0]._id}`, users[1], { expiryDate: '' }); assert.equal(await Notification.countDocuments({ pharmacy: pharmacy._id }), 0); assert.equal((await request('GET', query(created[0]))).data.count, 1);
    if (topology) {
      await request('PATCH', `${inventory}/${created[0]._id}`, users[1], { quantity: 0 });
      const realRestock = await request('PATCH', `${inventory}/${created[0]._id}`, users[1], { quantity: 5 }); assert.equal(realRestock.status, 200);
      assert.equal(await Notification.countDocuments({ pharmacy: pharmacy._id }), 1); assert.equal((await Subscription.findById(subscription._id)).active, false);
    }
  } finally { if (pharmacy) { await Hold.deleteMany({ pharmacy: pharmacy._id }); await Subscription.deleteMany({ pharmacy: pharmacy._id }); await Notification.deleteMany({ pharmacy: pharmacy._id }); await Pharmacy.deleteOne({ _id: pharmacy._id }); } if (users.length) await User.deleteMany({ _id: { $in: users.map(u => u._id) } }); if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); }
});
