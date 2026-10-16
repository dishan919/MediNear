const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path'), { randomUUID } = require('node:crypto');
const mongoose = require('mongoose'), express = require('express'), jwt = require('jsonwebtoken');
const User = require('../../models/User'), Pharmacy = require('../../models/Pharmacy'), Hold = require('../../models/HoldRequest'), Notification = require('../../models/Notification');
const { expiryCutoffDate } = require('../../../shared/medicineExpiry.mjs');
test('owner inventory analytics: secure exact fixture, no writes, bounded attention, live hold stock and expiry restoration', async t => {
  require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true }); require('../../scripts/seed').assertDevelopmentDatabase(process.env.MONGO_URI, process.env.NODE_ENV); process.env.JWT_SECRET ||= randomUUID();
  let server, pharmacy; const users = [];
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 }); await Hold.init();
    for (const role of ['customer', 'pharmacy_owner', 'pharmacy_owner']) users.push(await User.create({ name: 'Analytics Test', email: `${randomUUID()}@medinear.test`, password: await require('../../utils/hashPassword')('Analytics123'), phone: '0771234567', address: 'private-address', role }));
    pharmacy = await Pharmacy.create({ owner: users[1]._id, name: 'Analytics Pharmacy', address: 'Test', district: 'Colombo', phone: '0771234567', latitude: 6.9, longitude: 79.8 });
    const app = express(); app.use(express.json()); app.use('/api', require('../../routes/holdRoutes')); app.use('/api/pharmacies', require('../../routes/pharmacyRoutes')); server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    async function request(method, url, user, body) { const r = await fetch(`http://127.0.0.1:${server.address().port}/api${url}`, { method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${jwt.sign({ userId: user._id }, process.env.JWT_SECRET)}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: r.status, data: await r.json() }; }
    const base = `/pharmacies/${pharmacy._id}`, url = `${base}/inventory/analytics`, date = offset => new Date(expiryCutoffDate().getTime() + offset * 86400000);
    assert.equal((await request('GET', url)).status, 401); assert.equal((await request('GET', url, users[0])).status, 403); assert.equal((await request('GET', url, users[2])).status, 404); assert.equal((await request('GET', '/pharmacies/bad/inventory/analytics', users[1])).status, 400); assert.equal((await request('GET', `/pharmacies/${new mongoose.Types.ObjectId()}/inventory/analytics`, users[1])).status, 404);
    assert.deepEqual((await request('GET', url, users[1])).data.summary, { totalMedicines: 0, totalStockUnits: 0, lowStock: 0, outOfStock: 0, expiringSoon: 0, expired: 0 });
    pharmacy.inventory = [{ name: 'Panadol', quantity: 3, expiryDate: date(100) }, { name: 'Vitamin C', quantity: 10, expiryDate: date(7) }, { name: 'Medicine X', quantity: 0, expiryDate: date(100) }, { name: 'Medicine Y', quantity: 8, expiryDate: date(-1) }, { name: 'Medicine Z', quantity: 20 }]; await pharmacy.save();
    const before = await Pharmacy.findById(pharmacy._id).lean(), notifications = await Notification.countDocuments({ pharmacy: pharmacy._id });
    const report = await request('GET', url, users[1]); assert.equal(report.status, 200); assert.deepEqual(report.data.summary, { totalMedicines: 5, totalStockUnits: 41, lowStock: 1, outOfStock: 1, expiringSoon: 1, expired: 1 }); assert.deepEqual(report.data.needsAttention.map(m => m.name), ['Medicine Y', 'Medicine X', 'Vitamin C', 'Panadol']);
    assert.deepEqual(await Pharmacy.findById(pharmacy._id).lean(), before); assert.equal(await Notification.countDocuments({ pharmacy: pharmacy._id }), notifications);
    for (const user of users) for (const field of ['_id', 'email', 'phone', 'address', 'password']) assert.ok(!JSON.stringify(report.data).includes(String(user[field])));
    pharmacy.inventory.push({ name: 'Both issues', quantity: 3, expiryDate: date(7) }); await pharmacy.save(); const overlap = (await request('GET', url, users[1])).data; assert.equal(overlap.summary.lowStock, 2); assert.equal(overlap.summary.expiringSoon, 2); assert.equal(overlap.needsAttention.filter(item => item.name === 'Both issues').length, 1); assert.equal(overlap.needsAttention.find(item => item.name === 'Both issues').issues.length, 2);
    for (let i = 0; i < 12; i++) pharmacy.inventory.push({ name: `Expired ${i}`, quantity: 10, expiryDate: date(-1) }); await pharmacy.save(); const limited = (await request('GET', url, users[1])).data; assert.equal(limited.needsAttention.length, 10); assert.equal(limited.hasMore, true);
    // A pending hold leaves stock unchanged; successful acceptance/expiry are reflected only on refetch.
    pharmacy.inventory = [{ name: 'Hold item', quantity: 6 }]; await pharmacy.save(); const medicine = pharmacy.inventory[0]._id;
    assert.equal((await request('GET', url, users[1])).data.summary.lowStock, 0);
    const created = await request('POST', `${base}/hold-requests`, users[0], { medicineId: medicine, quantity: 2 }); assert.equal(created.status, 201); assert.equal((await request('GET', url, users[1])).data.summary.totalStockUnits, 6);
    const supported = await require('../../services/databaseCapabilities').supportsTransactions();
    await t.test('transactional hold acceptance and restoration naturally update derived analytics without analytics writes', { skip: !supported && 'Replica set required for hold accounting' }, async () => {
      assert.equal((await request('PATCH', `${base}/hold-requests/${created.data.request._id}/accept`, users[1])).status, 200); const accepted = (await request('GET', url, users[1])).data; assert.equal(accepted.summary.totalStockUnits, 4); assert.equal(accepted.summary.lowStock, 1);
      const hold = await Hold.findById(created.data.request._id); await require('../../services/holds').expireHold(hold._id, { pharmacy: pharmacy._id }, new Date(hold.expiresAt.getTime() + 1)); const restored = (await request('GET', url, users[1])).data; assert.equal(restored.summary.totalStockUnits, 6); assert.equal(restored.summary.lowStock, 0);
    });
  } finally { if (pharmacy) { await Hold.deleteMany({ pharmacy: pharmacy._id }); await Pharmacy.deleteOne({ _id: pharmacy._id }); } if (users.length) await User.deleteMany({ _id: { $in: users.map(u => u._id) } }); if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); }
});
