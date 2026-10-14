const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Pharmacy = require('../models/Pharmacy');
test('favorites HTTP: customer ownership, atomic duplicates, persistence, validation and roles', async t => {
  const old = process.env.JWT_SECRET; process.env.JWT_SECRET = 'favorites-test-secret';
  t.after(() => { if (old === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = old; });
  const customer = new mongoose.Types.ObjectId(), other = new mongoose.Types.ObjectId(), owner = new mongoose.Types.ObjectId();
  const pharmacy = new Pharmacy({ name: 'Saved Test', address: 'Colombo', district: 'Colombo', phone: '0111234567', latitude: 6.9, longitude: 79.8, inventory: [{ name: 'Test medicine', quantity: 1 }], open24Hours: true });
  const accounts = new Map([customer, other, owner].map(id => [String(id), { _id: id, role: String(id) === String(owner) ? 'pharmacy_owner' : 'customer', favorites: [] }]));
  const populated = account => account && { ...account, favorites: account.favorites.map(id => String(id) === String(pharmacy._id) ? pharmacy : null) };
  t.mock.method(User, 'findById', id => ({ select: async () => accounts.get(String(id)), populate: async () => populated(accounts.get(String(id))) }));
  t.mock.method(User, 'findByIdAndUpdate', (id, update, options) => {
    const account = accounts.get(String(id)); assert.ok(account);
    if (update.$addToSet) { assert.equal(options.returnDocument, "after"); const value = update.$addToSet.favorites; if (!account.favorites.includes(value)) account.favorites.push(value); }
    else if (update.$pull) account.favorites = account.favorites.filter(value => value !== update.$pull.favorites);
    else account.favorites = update.favorites;
    return { populate: async () => populated(account), then: (resolve, reject) => Promise.resolve(account).then(resolve, reject) };
  });
  t.mock.method(Pharmacy, 'findById', async id => String(id) === String(pharmacy._id) ? pharmacy : null);
  const app = express(); app.use(express.json()); app.use('/users', require('../routes/userRoutes')); app.use('/pharmacies', require('../routes/pharmacyRoutes'));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  async function request(path, method = 'GET', user = customer, body) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${jwt.sign({ userId: user }, process.env.JWT_SECRET)}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
  }
  const path = `/users/favorites/${pharmacy._id}`;
  for (const [url, method] of [['/users/favorites', 'GET'], [path, 'POST'], [path, 'DELETE'], ['/users/favorites', 'DELETE']]) {
    assert.equal((await request(url, method, null)).status, 401);
    assert.equal((await request(url, method, owner)).status, 403);
  }
  for (const method of ['POST', 'DELETE']) {
    assert.equal((await request('/users/favorites/bad', method)).status, 400);
    assert.equal((await request(`/users/favorites/${new mongoose.Types.ObjectId()}`, method)).status, 404);
  }
  const saved = await request(path, 'POST', customer, { userId: other });
  assert.equal(saved.status, 200); assert.equal(saved.data.saved, true); assert.equal(saved.data.favorites[0].name, pharmacy.name);
  await Promise.all([request(path, 'POST'), request(path, 'POST')]);
  assert.equal(accounts.get(String(customer)).favorites.length, 1);
  const refreshed = await request('/users/favorites');
  assert.equal(refreshed.data.favorites.length, 1); assert.equal(refreshed.data.favorites[0]._id, String(pharmacy._id));
  assert.equal(refreshed.data.favorites[0].inventory, undefined); assert.equal(refreshed.data.favorites[0].owner, undefined);
  assert.equal((await request('/users/favorites', 'GET', other)).data.favorites.length, 0);
  assert.equal((await request(path, 'DELETE', other)).status, 200);
  assert.equal((await request('/users/favorites')).data.favorites.length, 1);
  assert.equal((await request(path, 'DELETE')).data.saved, false);
  assert.equal((await request('/users/favorites')).data.favorites.length, 0);
  assert.equal((await request(path, 'DELETE')).status, 200);
  const detail = await request(`/pharmacies/${pharmacy._id}`);
  assert.equal(detail.status, 200); assert.equal(detail.data.pharmacy.medicines[0].quantity, 1);
  await request(path, 'POST'); await request('/users/favorites', 'DELETE');
  assert.equal((await request('/users/favorites')).data.favorites.length, 0);
});
