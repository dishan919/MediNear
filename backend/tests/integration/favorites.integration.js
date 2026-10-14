const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const Pharmacy = require('../../models/Pharmacy');
test('favorites HTTP persists in real development MongoDB across concurrent saves and fresh reads', async () => {
  require('dotenv').config({ path: require('node:path').join(__dirname, '../../.env'), quiet: true });
  require('../../scripts/seed').assertDevelopmentDatabase(process.env.MONGO_URI, process.env.NODE_ENV);
  process.env.JWT_SECRET ||= randomUUID();
  let server, customer, pharmacy;
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    customer = await User.create({ name: 'Favorites integration', email: `favorites-${randomUUID()}@medinear.test`, password: await require('../../utils/hashPassword')('IntegrationPass123!'), role: 'customer' });
    pharmacy = await Pharmacy.create({ name: 'Favorites integration', address: 'Test address', district: 'Colombo', phone: '0111234567', latitude: 6.9, longitude: 79.8 });
    const app = express(); app.use(express.json()); app.use('/users', require('../../routes/userRoutes'));
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    async function request(url, method = 'GET') {
      const r = await fetch(`http://127.0.0.1:${server.address().port}${url}`, { method, headers: { Authorization: `Bearer ${jwt.sign({ userId: customer._id }, process.env.JWT_SECRET)}` } });
      assert.equal(r.status, 200); return r.json();
    }
    const url = `/users/favorites/${pharmacy._id}`;
    await Promise.all(Array.from({ length: 5 }, () => request(url, 'POST')));
    assert.deepEqual((await User.findById(customer._id)).favorites.map(String), [String(pharmacy._id)]);
    assert.equal((await request('/users/favorites')).favorites[0]._id, String(pharmacy._id));
    assert.equal((await request(url, 'DELETE')).saved, false);
    assert.equal((await User.findById(customer._id)).favorites.length, 0);
    assert.equal((await request('/users/favorites')).favorites.length, 0);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (pharmacy) await Pharmacy.deleteOne({ _id: pharmacy._id });
    if (customer) await User.deleteOne({ _id: customer._id });
    await mongoose.disconnect();
  }
});
