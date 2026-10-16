const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const Pharmacy = require('../../models/Pharmacy');
const Review = require('../../models/Review');

test('real review API enforces authorization, unique authorship, privacy, statistics, ordering and pagination', async () => {
  require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true });
  require('../../scripts/seed').assertDevelopmentDatabase(process.env.MONGO_URI, process.env.NODE_ENV);
  process.env.JWT_SECRET ||= randomUUID();
  let server, pharmacy; const accounts = [];
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 }); await Review.init();
    for (const role of ['customer', 'customer', 'pharmacy_owner']) accounts.push(await User.create({ name: 'Public Customer', email: `${randomUUID()}@medinear.test`, password: await require('../../utils/hashPassword')('ReviewPass123'), phone: '0771234567', address: 'private-address', role }));
    pharmacy = await Pharmacy.create({ owner: accounts[2]._id, name: 'Review Integration', address: 'Test', district: 'Colombo', phone: '0111234567', latitude: 6.9, longitude: 79.8 });
    const app = express(); app.use(express.json()); app.use('/api/pharmacies', require('../../routes/pharmacyRoutes'));
    server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
    const base = `/api/pharmacies/${pharmacy._id}/reviews`;
    async function request(method, url = base, account, body) {
      const r = await fetch(`http://127.0.0.1:${server.address().port}${url}`, { method, headers: { 'Content-Type': 'application/json', ...(account ? { Authorization: `Bearer ${jwt.sign({ userId: account._id }, process.env.JWT_SECRET)}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: r.status, data: await r.json() };
    }
    const [first, second, owner] = accounts;
    const empty = await request('GET'); assert.deepEqual(empty.data.summary, { averageRating: 0, reviewCount: 0 });
    assert.equal((await request('POST', base, null, { rating: 5 })).status, 401);
    assert.equal((await request('POST', base, owner, { rating: 5 })).status, 403);
    assert.equal((await request('GET', `${base}/mine`, owner)).status, 403);
    for (const rating of [0, 6, '5', 1.5]) assert.equal((await request('POST', base, first, { rating })).status, 400);
    assert.equal((await request('POST', base, first, { rating: 5, comment: 'x'.repeat(501) })).status, 400);
    assert.equal((await request('POST', '/api/pharmacies/bad/reviews', first, { rating: 5 })).status, 400);
    assert.equal((await request('POST', `/api/pharmacies/${new mongoose.Types.ObjectId()}/reviews`, first, { rating: 5 })).status, 404);
    const concurrent = await Promise.all([request('POST', base, first, { rating: 5, comment: ' Good service. ', customer: second._id }), request('POST', base, first, { rating: 5 })]);
    assert.deepEqual(concurrent.map(r => r.status).sort(), [201, 409]);
    const firstReview = concurrent.find(r => r.status === 201).data.review;
    assert.equal(String((await Review.findById(firstReview._id)).customer), String(first._id));
    const secondReview = (await request('POST', base, second, { rating: 1, comment: '<script>alert(1)</script>' })).data.review;
    const listing = await request('GET'); assert.equal(listing.data.summary.averageRating, 3); assert.equal(listing.data.summary.reviewCount, 2);
    assert.equal(listing.data.reviews[0]._id, secondReview._id);
    const serialized = JSON.stringify(listing.data);
    for (const privateValue of [first.email, first.phone, first.address, String(first._id), first.password, String(second._id)]) assert.ok(!serialized.includes(privateValue));
    assert.deepEqual(Object.keys(listing.data.reviews[0]).sort(), ['_id', 'authorName', 'comment', 'createdAt', 'rating', 'updatedAt'].sort());
    assert.equal((await request('GET', `${base}/mine`, first)).data.review._id, firstReview._id);
    for (const method of ['PATCH', 'DELETE']) {
      assert.equal((await request(method, `${base}/${firstReview._id}`, second, { rating: 4 })).status, 404);
      assert.equal((await request(method, `${base}/${firstReview._id}`, owner, { rating: 4 })).status, 403);
      assert.equal((await request(method, `${base}/${firstReview._id}`, null, { rating: 4 })).status, 401);
    }
    assert.equal((await request('PATCH', `${base}/bad`, first, { rating: 4 })).status, 400);
    const edit = await request('PATCH', `${base}/${firstReview._id}`, first, { rating: 4, comment: ' Better service ', customer: second._id, pharmacy: new mongoose.Types.ObjectId() });
    assert.equal(edit.status, 200); assert.equal(edit.data.review.comment, 'Better service'); assert.ok(new Date(edit.data.review.updatedAt) >= new Date(firstReview.updatedAt));
    assert.equal(String((await Review.findById(firstReview._id)).pharmacy), String(pharmacy._id));
    assert.equal((await request('GET')).data.summary.averageRating, 2.5);
    assert.equal((await request('DELETE', `${base}/${secondReview._id}`, second)).status, 200);
    assert.deepEqual((await request('GET')).data.summary, { averageRating: 4, reviewCount: 1 });
    await Review.insertMany(Array.from({ length: 11 }, () => ({ pharmacy: pharmacy._id, customer: new mongoose.Types.ObjectId(), rating: 4 })));
    const page1 = await request('GET'); const page2 = await request('GET', `${base}?page=2`);
    assert.equal(page1.data.reviews.length, 10); assert.equal(page1.data.hasMore, true); assert.equal(page2.data.reviews.length, 2); assert.equal(page2.data.hasMore, false);
    assert.equal(page1.data.summary.reviewCount, 12); assert.equal(new Set([...page1.data.reviews, ...page2.data.reviews].map(r => r._id)).size, 12);
    assert.equal((await request('GET', `${base}?page=-1`)).status, 400);
    await Review.deleteMany({ pharmacy: pharmacy._id }); assert.deepEqual((await request('GET')).data.summary, { averageRating: 0, reviewCount: 0 });
    await Pharmacy.deleteOne({ _id: pharmacy._id }); assert.equal((await request('GET')).status, 404);
  } finally {
    if (pharmacy) { await Review.deleteMany({ pharmacy: pharmacy._id }); await Pharmacy.deleteOne({ _id: pharmacy._id }); }
    if (accounts.length) await User.deleteMany({ _id: { $in: accounts.map(a => a._id) } });
    if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect();
  }
});
