const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path'), { randomUUID } = require('node:crypto');
const express = require('express'), mongoose = require('mongoose'), jwt = require('jsonwebtoken');
const User = require('../../models/User'), Pharmacy = require('../../models/Pharmacy'), Hold = require('../../models/HoldRequest'), Notification = require('../../models/Notification');
test('hold HTTP workflow: ownership, validation, pending/cancel/reject, duplicate protection and transaction/concurrency safety', async t => {
  require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true }); require('../../scripts/seed').assertDevelopmentDatabase(process.env.MONGO_URI, process.env.NODE_ENV); process.env.JWT_SECRET ||= randomUUID();
  let server, pharmacy, otherPharmacy; const users = [];
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 }); await Hold.init();
    for (const role of ['customer', 'customer', 'pharmacy_owner', 'pharmacy_owner']) users.push(await User.create({ name: 'Hold Test', email: `${randomUUID()}@medinear.test`, password: await require('../../utils/hashPassword')('HoldPass123'), phone: '0771234567', address: 'private-address', role }));
    const fields = { name: 'Hold Pharmacy', address: 'Test', district: 'Colombo', phone: '0111234567', latitude: 6.9, longitude: 79.8, inventory: [{ name: 'Panadol', quantity: 5 }, { name: 'Empty', quantity: 0 }] };
    pharmacy = await Pharmacy.create({ ...fields, owner: users[2]._id }); otherPharmacy = await Pharmacy.create({ ...fields, owner: users[3]._id });
    const medicine = pharmacy.inventory[0]._id;
    const app = express(); app.use(express.json()); app.use('/api', require('../../routes/holdRoutes')); server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    async function request(method, url, user, body) { const r = await fetch(`http://127.0.0.1:${server.address().port}/api${url}`, { method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${jwt.sign({ userId: user._id }, process.env.JWT_SECRET)}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: r.status, data: await r.json() }; }
    const base = `/pharmacies/${pharmacy._id}/hold-requests`, mine = '/users/hold-requests';
    const create = (user, quantity = 2, medicineId = medicine, url = base) => request('POST', url, user, { quantity, medicineId, customerId: users[1]._id, status: 'accepted' });
    const stock = async () => (await Pharmacy.findById(pharmacy._id)).inventory[0].quantity;
    assert.equal((await create()).status, 401); assert.equal((await create(users[2])).status, 403);
    for (const quantity of [0, -1, 1.5, 'x', '2', 6]) assert.ok([400, 409].includes((await create(users[0], quantity)).status));
    assert.equal((await create(users[0], 1, 'bad')).status, 400); assert.equal((await create(users[0], 1, otherPharmacy.inventory[0]._id)).status, 404); assert.equal((await create(users[0], 1, pharmacy.inventory[1]._id)).status, 409);
    assert.equal((await create(users[0], 1, medicine, '/pharmacies/bad/hold-requests')).status, 400); assert.equal((await create(users[0], 1, medicine, `/pharmacies/${new mongoose.Types.ObjectId()}/hold-requests`)).status, 404);
    const duplicated = await Promise.all([create(users[0]), create(users[0])]); assert.deepEqual(duplicated.map(r => r.status).sort(), [201, 409]); const first = duplicated.find(r => r.status === 201).data.request;
    assert.equal(first.status, 'pending'); assert.equal(await stock(), 5); assert.equal(String((await Hold.findById(first._id)).customer), String(users[0]._id));
    assert.equal((await request('GET', mine, users[0])).data.requests.length, 1); assert.equal((await request('GET', mine, users[1])).data.requests.length, 0);
    assert.equal((await request('GET', base, users[3])).status, 404); assert.equal((await request('GET', base, users[0])).status, 403); assert.equal((await request('GET', base)).status, 401);
    const ownerData = (await request('GET', base, users[2])).data; assert.equal(ownerData.requests[0].customerName, 'Hold Test'); assert.equal(ownerData.requests[0].medicineName, 'Panadol');
    for (const user of users) for (const field of ['email', 'phone', 'address', 'password', '_id']) assert.ok(!JSON.stringify(ownerData).includes(String(user[field])));
    const cancelUrl = `${mine}/${first._id}/cancel`;
    assert.equal((await request('PATCH', cancelUrl, users[1])).status, 409); assert.equal((await request('PATCH', cancelUrl, users[0])).data.request.status, 'cancelled'); assert.equal(await stock(), 5);
    assert.equal((await request('PATCH', `${base}/${first._id}/accept`, users[2])).status === 200, false);
    const second = (await create(users[0])).data.request;
    assert.equal((await request('PATCH', `${base}/${second._id}/reject`, users[3])).status, 404);
    assert.equal((await request('PATCH', `${base}/${second._id}/reject`, users[2])).data.request.status, 'rejected'); assert.equal(await stock(), 5);
    assert.equal((await request('PATCH', `${base}/${second._id}/reject`, users[2])).status, 409); assert.equal((await request('PATCH', `${mine}/${second._id}/cancel`, users[0])).status, 409);
    const pending = (await create(users[0])).data.request;
    const supported = await require('../../services/databaseCapabilities').supportsTransactions();
    if (!supported) {
      const refused = await request('PATCH', `${base}/${pending._id}/accept`, users[2]); assert.equal(refused.status, 503); assert.equal(await stock(), 5); assert.equal((await Hold.findById(pending._id)).status, 'pending');
    }
    await t.test('replica-set accept commits both documents, rolls back insufficient stock and resolves stock race', { skip: !supported && 'Local MongoDB is standalone; production acceptance requires Atlas/replica set.' }, async () => {
      const staleInventory = await Pharmacy.findById(pharmacy._id);
      const accepted = await request('PATCH', `${base}/${pending._id}/accept`, users[2]); assert.equal(accepted.status, 200); assert.equal(accepted.data.request.status, 'accepted'); assert.equal(await stock(), 3);
      staleInventory.inventory[0].quantity = 50; await assert.rejects(staleInventory.save(), e => e.name === 'VersionError'); assert.equal(await stock(), 3);
      assert.equal((await request('PATCH', `${mine}/${pending._id}/cancel`, users[0])).status, 409);
      assert.equal((await request('PATCH', `${base}/${pending._id}/accept`, users[2])).status, 409); assert.equal(await stock(), 3);
      assert.equal((await request('GET', mine, users[0])).data.requests[0].status, 'accepted');
      const { getStockStatus } = await import('../../../medinear/src/utils/stockStatus.js'); assert.equal(getStockStatus(await stock()).label, 'Low Stock');
      const a = (await create(users[0])).data.request, b = (await create(users[1])).data.request;
      const race = await Promise.all([request('PATCH', `${base}/${a._id}/accept`, users[2]), request('PATCH', `${base}/${b._id}/accept`, users[2])]); assert.deepEqual(race.map(r => r.status).sort(), [200, 409]); assert.equal(await stock(), 1);
      const loser = race[0].status === 409 ? a : b; assert.equal((await Hold.findById(loser._id)).status, 'pending');
      assert.equal(await Notification.countDocuments({ pharmacy: pharmacy._id }), 0); assert.equal(require('../../services/restock').isRestock(3, 1), false);
    });
    await Hold.insertMany(Array.from({ length: 11 }, () => ({ customer: users[1]._id, pharmacy: pharmacy._id, medicine, quantity: 1, status: 'rejected' })));
    const page1 = (await request('GET', base, users[2])).data, page2 = (await request('GET', `${base}?page=2`, users[2])).data; assert.equal(page1.requests.length, 10); assert.equal(page1.hasMore, true); assert.ok(page2.requests.length > 0); assert.equal(new Set([...page1.requests, ...page2.requests].map(r => r._id)).size, page1.requests.length + page2.requests.length);
    assert.equal((await request('GET', `${mine}?page=0`, users[0])).status, 400);
  } finally { if (pharmacy) { await Hold.deleteMany({ pharmacy: pharmacy._id }); await Pharmacy.deleteOne({ _id: pharmacy._id }); } if (otherPharmacy) await Pharmacy.deleteOne({ _id: otherPharmacy._id }); if (users.length) await User.deleteMany({ _id: { $in: users.map(u => u._id) } }); if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); }
});
