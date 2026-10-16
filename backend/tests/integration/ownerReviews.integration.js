const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const express = require('express'), mongoose = require('mongoose'), jwt = require('jsonwebtoken');
const User = require('../../models/User'), Pharmacy = require('../../models/Pharmacy'), Review = require('../../models/Review');
test('owner dashboard: two customer reviews, ownership isolation, distribution, pagination, privacy and read-only security', async () => {
  require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true }); require('../../scripts/seed').assertDevelopmentDatabase(process.env.MONGO_URI, process.env.NODE_ENV); process.env.JWT_SECRET ||= randomUUID();
  let server, pharmacy; const users = [];
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 }); await Review.init();
    for (const role of ['customer', 'customer', 'pharmacy_owner', 'pharmacy_owner']) users.push(await User.create({ name: 'Public Reviewer', email: `${randomUUID()}@medinear.test`, password: await require('../../utils/hashPassword')('OwnerReviews123'), phone: '0771234567', address: 'private-address', role }));
    pharmacy = await Pharmacy.create({ owner: users[2]._id, name: 'Owner Review Test', address: 'Test', district: 'Colombo', phone: '0771234567', latitude: 6.9, longitude: 79.8 });
    const app = express(); app.use(express.json()); app.use('/api/pharmacies', require('../../routes/pharmacyRoutes')); server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const base = `/api/pharmacies/${pharmacy._id}/reviews`;
    async function request(method, url, user, body) { const r = await fetch(`http://127.0.0.1:${server.address().port}${url}`, { method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${jwt.sign({ userId: user._id }, process.env.JWT_SECRET)}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: r.status, data: await r.json() }; }
    const dashboard = `${base}/owner-dashboard`;
    assert.equal((await request('GET', dashboard)).status, 401); assert.equal((await request('GET', dashboard, users[0])).status, 403); assert.equal((await request('GET', dashboard, users[3])).status, 404);
    assert.equal((await request('GET', '/api/pharmacies/bad/reviews/owner-dashboard', users[2])).status, 400);
    assert.equal((await request('GET', `/api/pharmacies/${new mongoose.Types.ObjectId()}/reviews/owner-dashboard`, users[2])).status, 404);
    const empty = await request('GET', dashboard, users[2]); assert.equal(empty.status, 200); assert.deepEqual(empty.data.summary, { averageRating: 0, reviewCount: 0 }); assert.deepEqual(empty.data.breakdown, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
    const first = await request('POST', base, users[0], { rating: 5, comment: 'Friendly and quick service.' }); const second = await request('POST', base, users[1], { rating: 3, comment: 'Service was slow.' }); assert.equal(first.status, 201); assert.equal(second.status, 201);
    const actual = (await request('GET', dashboard, users[2])).data;
    assert.deepEqual(actual.summary, { averageRating: 4, reviewCount: 2 }); assert.deepEqual(actual.breakdown, { 1: 0, 2: 0, 3: 1, 4: 0, 5: 1 }); assert.equal(actual.reviews[0]._id, second.data.review._id);
    assert.deepEqual(actual.summary, (await request('GET', base)).data.summary);
    for (const user of users) for (const field of ['email', 'phone', 'address', 'password', '_id']) assert.ok(!JSON.stringify(actual).includes(String(user[field])));
    for (const method of ['PATCH', 'DELETE']) assert.equal((await request(method, `${base}/${second.data.review._id}`, users[2], { rating: 5 })).status, 403);
    assert.equal((await request('POST', base, users[2], { rating: 5 })).status, 403);
    for (const rating of [1, 2, 4, 5, 5, 4, 3, 2, 1]) await Review.create({ pharmacy: pharmacy._id, customer: new mongoose.Types.ObjectId(), rating });
    const full = (await request('GET', dashboard, users[2])).data; assert.deepEqual(full.breakdown, { 1: 2, 2: 2, 3: 2, 4: 2, 5: 3 }); assert.equal(full.summary.reviewCount, 11); assert.equal(full.summary.averageRating, 35 / 11); assert.equal(full.reviews.length, 10); assert.equal(full.hasMore, true);
    const next = (await request('GET', `${dashboard}?page=2`, users[2])).data; assert.equal(next.reviews.length, 1); assert.equal(next.hasMore, false); assert.deepEqual(next.summary, full.summary);
    assert.equal(Object.values(full.breakdown).reduce((a, b) => a + b), full.summary.reviewCount);
    await Pharmacy.deleteOne({ _id: pharmacy._id }); assert.equal((await request('GET', dashboard, users[2])).status, 404);
  } finally { if (pharmacy) { await Review.deleteMany({ pharmacy: pharmacy._id }); await Pharmacy.deleteOne({ _id: pharmacy._id }); } if (users.length) await User.deleteMany({ _id: { $in: users.map(u => u._id) } }); if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); }
});
