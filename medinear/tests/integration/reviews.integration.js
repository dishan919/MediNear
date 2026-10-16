import { loadOwnerReviews } from '../../src/utils/ownerReviews.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { reviewsService, createReviewRunner, reviewToast } from '../../src/utils/reviews.js';
const require = createRequire(new URL('../../../backend/package.json', import.meta.url));
const mongoose = require('mongoose'), express = require('express'), jwt = require('jsonwebtoken');
const User = require('./models/User'), Pharmacy = require('./models/Pharmacy'), Review = require('./models/Review');

test('customer review service -> real HTTP/database -> React summary/list across create, edit and delete', async () => {
  require('dotenv').config({ path: fileURLToPath(new URL('../../../backend/.env', import.meta.url)), quiet: true });
  require('./scripts/seed').assertDevelopmentDatabase(process.env.MONGO_URI, process.env.NODE_ENV);
  process.env.JWT_SECRET ||= randomUUID();
  let server, vite, customer, pharmacy, owner;
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 }); await Review.init();
    customer = await User.create({ name: 'Review UI Test', email: `${randomUUID()}@medinear.test`, password: await require('./utils/hashPassword')('ReviewUi123'), role: 'customer' });
    owner = await User.create({ name: 'Owner Review UI Test', email: `${randomUUID()}@medinear.test`, password: await require('./utils/hashPassword')('OwnerReview123'), role: 'pharmacy_owner' });
    pharmacy = await Pharmacy.create({ owner: owner._id, name: 'Review UI Pharmacy', address: 'Test', district: 'Colombo', phone: '0771234567', latitude: 6.9, longitude: 79.8 });
    const token = jwt.sign({ userId: customer._id }, process.env.JWT_SECRET);
    const app = express(); app.use(express.json()); app.use('/api/pharmacies', require('./routes/pharmacyRoutes'));
    server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
    const origin = `http://127.0.0.1:${server.address().port}/api`;
    async function request(method, path, body, config = {}) {
      const url = new URL(origin + path); for (const [key, value] of Object.entries(config.params || {})) url.searchParams.set(key, value);
      const response = await fetch(url, { method, signal: config.signal, headers: { 'Content-Type': 'application/json', ...config.headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
      const data = await response.json(); if (!response.ok) throw { response: { status: response.status, data } }; return { data };
    }
    const api = { get: (path, config) => request('GET', path, null, config), post: (path, body, config) => request('POST', path, body, config), patch: (path, body, config) => request('PATCH', path, body, config), delete: (path, config) => request('DELETE', path, null, config) };
    const service = reviewsService(api, String(pharmacy._id), () => token);
    vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
    const { ReviewsView } = await vite.ssrLoadModule('/src/components/PharmacyReviews.jsx');
    const { OwnerReviewsView } = await vite.ssrLoadModule('/src/components/OwnerReviews.jsx');
    const ownerToken = jwt.sign({ userId: owner._id }, process.env.JWT_SECRET);
    async function ownerView() { return renderToString(createElement(OwnerReviewsView, { pharmacyId: String(pharmacy._id), data: await loadOwnerReviews(api, String(pharmacy._id), 1, undefined, ownerToken) })); }
    const render = async () => renderToString(createElement(ReviewsView, { data: await service.list(1), own: await service.mine(), customer: true, values: { rating: 0, comment: '' }, errors: {} }));
    assert.match(await render(), /No reviews yet/);
    const runner = createReviewRunner(); const toasts = [];
    async function mutate(action, operation) {
      await runner.run(operation, { busy() {}, error(error) { throw error; }, success() { toasts.push(reviewToast(action).message); } });
    }
    await mutate('create', signal => service.save(null, { rating: 5, comment: 'Good service.' }, signal));
    let html = await render(); assert.match(html, /5.0 out of 5 \(1 review\)/); assert.match(html, /Good service\./); assert.match(html, /Edit Review/); assert.doesNotMatch(html, /Submit Review/);
    const ownerMarkup = await ownerView(); assert.match(ownerMarkup, /5.0/); assert.match(ownerMarkup, /5 stars: 1 review/); assert.match(ownerMarkup, /Good service/); assert.doesNotMatch(ownerMarkup, /Edit Review|Delete Review|Submit Review/);
    const own = await service.mine();
    await mutate('edit', signal => service.save(own._id, { rating: 4, comment: 'Friendly service.' }, signal));
    html = await render(); assert.match(html, /4.0 out of 5/); assert.match(html, /Friendly service\./); assert.doesNotMatch(html, /Good service\./);
    assert.match(await ownerView(), /4.0/);
    await mutate('delete', signal => service.remove(own._id, signal));
    html = await render(); assert.match(html, /No reviews yet/); assert.match(html, /Submit Review/); assert.doesNotMatch(html, /Friendly service\./);
    assert.match(await ownerView(), /No customer reviews yet/);
    assert.deepEqual(toasts, ['Review submitted.', 'Review updated.', 'Review deleted.']);
  } finally {
    if (vite) await vite.close();
    if (pharmacy) { await Review.deleteMany({ pharmacy: pharmacy._id }); await Pharmacy.deleteOne({ _id: pharmacy._id }); }
    if (owner) await User.deleteOne({ _id: owner._id });
    if (customer) await User.deleteOne({ _id: customer._id });
    if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect();
  }
});
