const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path'), { randomUUID } = require('node:crypto');
const mongoose = require('mongoose'), express = require('express'), jwt = require('jsonwebtoken');
const User = require('../../models/User'), Pharmacy = require('../../models/Pharmacy'), Hold = require('../../models/HoldRequest'), Notification = require('../../models/Notification');
const { expireHold, expireDueHolds, completeHold } = require('../../services/holds');
const { HOLD_DURATION_MS } = require('../../services/holdPolicy');
test('hold deadlines: real transactional restoration, collection, invalid data, permissions and expiration races', async t => {
  require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true }); require('../../scripts/seed').assertDevelopmentDatabase(process.env.MONGO_URI, process.env.NODE_ENV); process.env.JWT_SECRET ||= randomUUID();
  let server, pharmacy; const users = [];
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 }); await Hold.init();
    if (!await require('../../services/databaseCapabilities').supportsTransactions()) { t.skip('Expiry integration requires a replica set; standalone safety is covered by unit/hold integration tests.'); return; }
    for (const role of ['customer', 'customer', 'pharmacy_owner', 'pharmacy_owner']) users.push(await User.create({ name: 'Deadline Test', email: `${randomUUID()}@medinear.test`, password: await require('../../utils/hashPassword')('Deadline123'), role }));
    pharmacy = await Pharmacy.create({ owner: users[2]._id, name: 'Deadline Pharmacy', address: 'Test', district: 'Colombo', phone: '0771234567', latitude: 6.9, longitude: 79.8, inventory: [{ name: 'Panadol', quantity: 5 }] });
    const medicine = pharmacy.inventory[0]._id, base = `/pharmacies/${pharmacy._id}/hold-requests`;
    const app = express(); app.use(express.json()); app.use('/api', require('../../routes/holdRoutes')); server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    async function request(method, url, user, body) { const r = await fetch(`http://127.0.0.1:${server.address().port}/api${url}`, { method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${jwt.sign({ userId: user._id }, process.env.JWT_SECRET)}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: r.status, data: await r.json() }; }
    const stock = async () => (await Pharmacy.findById(pharmacy._id)).inventory[0].quantity;
    const create = async (quantity = 2) => { const result = await request('POST', base, users[0], { medicineId: medicine, quantity, acceptedAt: '2000-01-01', expiresAt: '2000-01-02' }); assert.equal(result.status, 201); return result.data.request; };
    const accept = async hold => { const result = await request('PATCH', `${base}/${hold._id}/accept`, users[2], { acceptedAt: '2000-01-01', expiresAt: '2000-01-02', status: 'expired' }); assert.equal(result.status, 200); return result.data.request; };
    const beforeAcceptance = Date.now();
    const hold = await accept(await create());
    assert.equal(await stock(), 3); assert.equal(Date.parse(hold.expiresAt) - Date.parse(hold.acceptedAt), HOLD_DURATION_MS); assert.ok(Date.parse(hold.acceptedAt) >= beforeAcceptance && Date.parse(hold.acceptedAt) <= Date.now());
    await expireHold(hold._id, { pharmacy: pharmacy._id }, new Date(Date.parse(hold.expiresAt) - 1)); assert.equal(await stock(), 3); assert.equal((await Hold.findById(hold._id)).status, 'accepted');
    const future = new Date(Date.parse(hold.expiresAt) + 1);
    await Promise.all([expireHold(hold._id, { pharmacy: pharmacy._id }, future), expireHold(hold._id, { pharmacy: pharmacy._id }, future)]);
    assert.equal(await stock(), 5); assert.equal((await Hold.findById(hold._id)).status, 'expired'); await expireDueHolds({ pharmacy: pharmacy._id }, future); assert.equal(await stock(), 5);
    const collected = await accept(await create());
    for (const user of [users[0], users[3]]) assert.notEqual((await request('PATCH', `${base}/${collected._id}/complete`, user)).status, 200);
    const complete = await request('PATCH', `${base}/${collected._id}/complete`, users[2]); assert.equal(complete.status, 200); assert.equal(complete.data.request.status, 'completed'); assert.equal(await stock(), 3);
    assert.equal((await request('PATCH', `${base}/${collected._id}/complete`, users[2])).status, 409);
    await expireDueHolds({ pharmacy: pharmacy._id }, new Date(Date.parse(collected.expiresAt) + 1)); assert.equal((await Hold.findById(collected._id)).status, 'completed'); assert.equal(await stock(), 3);
    // A collection just before the cutoff races with expiry just after it: either winner must be atomic.
    const racing = await accept(await create()); const deadline = Date.parse(racing.expiresAt);
    const outcomes = await Promise.allSettled([expireHold(racing._id, { pharmacy: pharmacy._id }, new Date(deadline + 1)), completeHold(racing._id, pharmacy._id, new Date(deadline - 1))]);
    assert.ok(outcomes.some(result => result.status === 'fulfilled'));
    const terminal = (await Hold.findById(racing._id)).status; assert.ok(['expired', 'completed'].includes(terminal)); assert.equal(await stock(), terminal === 'expired' ? 3 : 1);
    // Isolate subsequent concurrent expirations with known stock and no active historical holds.
    await Hold.deleteMany({ pharmacy: pharmacy._id }); await Pharmacy.updateOne({ _id: pharmacy._id }, { $set: { 'inventory.0.quantity': 2 } });
    const now = new Date(), acceptedAt = new Date(now.getTime() - HOLD_DURATION_MS - 1000), expiresAt = new Date(now.getTime() - 1000);
    const multiple = await Hold.create([{ customer: users[0]._id, pharmacy: pharmacy._id, medicine, quantity: 2, status: 'accepted', acceptedAt, expiresAt }, { customer: users[1]._id, pharmacy: pharmacy._id, medicine, quantity: 3, status: 'accepted', acceptedAt, expiresAt }]);
    await Promise.all(multiple.map(item => expireHold(item._id, { pharmacy: pharmacy._id }, now))); assert.equal(await stock(), 7);
    await expireDueHolds({ pharmacy: pharmacy._id }, now); assert.equal(await stock(), 7); assert.equal(await Notification.countDocuments({ pharmacy: pharmacy._id }), 0);
    const { getStockStatus } = await import('../../../medinear/src/utils/stockStatus.js'); assert.equal(getStockStatus(await stock()).label, 'Available');
    // Lazy customer fetch expires an overdue hold and returns only its own timestamps.
    await Hold.deleteMany({ pharmacy: pharmacy._id }); await Pharmacy.updateOne({ _id: pharmacy._id }, { $set: { 'inventory.0.quantity': 3 } });
    const due = await Hold.create({ customer: users[0]._id, pharmacy: pharmacy._id, medicine, quantity: 2, status: 'accepted', acceptedAt, expiresAt });
    const listing = await request('GET', '/users/hold-requests', users[0]); assert.equal(listing.status, 200); assert.equal(listing.data.requests[0].status, 'expired'); assert.ok(listing.data.requests[0].acceptedAt); assert.ok(listing.data.serverNow); assert.equal(await stock(), 5);
    assert.equal((await request('GET', '/users/hold-requests', users[1])).data.requests.length, 0); assert.equal((await request('GET', base, users[3])).status, 404);
    assert.equal((await request('PATCH', `${base}/${due._id}/complete`, users[2])).status, 409);
    // Broken and legacy accepted dates must not silently return stock or pretend expiration succeeded.
    await Hold.deleteMany({ pharmacy: pharmacy._id });
    for (const dates of [{}, { acceptedAt: new Date(0), expiresAt }, { acceptedAt: now, expiresAt: new Date(0) }, { acceptedAt: 'damaged', expiresAt }]) {
      const id = new mongoose.Types.ObjectId(); await Hold.collection.insertOne({ _id: id, customer: users[0]._id, pharmacy: pharmacy._id, medicine, quantity: 2, status: 'accepted', ...dates });
      const failed = await request('GET', base, users[2]); assert.equal(failed.status, 409); assert.equal(await stock(), 5); assert.equal((await Hold.collection.findOne({ _id: id })).status, 'accepted'); await Hold.deleteOne({ _id: id });
    }
    // Removed inventory aborts expiry with its status still accepted.
    const orphan = await Hold.create({ customer: users[0]._id, pharmacy: pharmacy._id, medicine: new mongoose.Types.ObjectId(), quantity: 2, status: 'accepted', acceptedAt, expiresAt });
    await assert.rejects(expireHold(orphan._id, { pharmacy: pharmacy._id }, now), e => e.status === 409); assert.equal((await Hold.findById(orphan._id)).status, 'accepted'); assert.equal(await stock(), 5); await Hold.deleteOne({ _id: orphan._id });
    for (const status of ['rejected', 'cancelled', 'completed']) await Hold.create({ customer: users[0]._id, pharmacy: pharmacy._id, medicine, quantity: 2, status, acceptedAt, expiresAt });
    await expireDueHolds({ pharmacy: pharmacy._id }, now); assert.equal(await stock(), 5);
    const allStock = await accept(await create(5)); assert.equal(await stock(), 0);
    await expireHold(allStock._id, { pharmacy: pharmacy._id }, new Date(Date.parse(allStock.expiresAt) + 1)); assert.equal(await stock(), 5); assert.equal(await Notification.countDocuments({ pharmacy: pharmacy._id }), 0);
  } finally { if (pharmacy) { await Hold.deleteMany({ pharmacy: pharmacy._id }); await Pharmacy.deleteOne({ _id: pharmacy._id }); } if (users.length) await User.deleteMany({ _id: { $in: users.map(u => u._id) } }); if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); }
});
