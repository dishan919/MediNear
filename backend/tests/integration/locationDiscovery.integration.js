const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const User = require('../../models/User');
const Pharmacy = require('../../models/Pharmacy');
test('MongoDB owner area persistence -> combined discovery, distance, legacy fallback and radius', async () => {
  require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true });
  require('../../scripts/seed').assertDevelopmentDatabase(process.env.MONGO_URI, process.env.NODE_ENV);
  process.env.JWT_SECRET ||= randomUUID();
  let server, owner; const ids = [];
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    owner = await User.create({ name: 'Discovery integration', email: `${randomUUID()}@medinear.test`, password: await require('../../utils/hashPassword')('IntegrationPass123!'), role: 'pharmacy_owner' });
    const app = express(); app.use(express.json()); app.use('/pharmacies', require('../../routes/pharmacyRoutes'));
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    async function request(url, method = 'GET', body) {
      const r = await fetch(`http://127.0.0.1:${server.address().port}/pharmacies${url}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt.sign({ userId: owner._id }, process.env.JWT_SECRET)}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: r.status, data: await r.json() };
    }
    const medicine = `Discovery ${randomUUID()}`;
    for (const area of [{ province: 'Western', district: 'Colombo', latitude: 6.9 }, { province: 'Western', district: 'Gampaha', latitude: 7.1 }, { province: 'Central', district: 'Kandy', latitude: 7.3 }]) {
      const created = await request('/', 'POST', { ...area, longitude: 79.8, name: medicine, address: 'Test', phone: '0111234567' });
      assert.equal(created.status, 201); const id = created.data.pharmacy._id; ids.push(id);
      assert.equal((await request(`/${id}/inventory`, 'POST', { name: medicine, quantity: 1 })).status, 201);
    }
    assert.equal((await request(`/${ids[0]}`, 'PUT', { province: 'Western', district: 'Kalutara' })).status, 200);
    assert.equal((await Pharmacy.findById(ids[0])).district, 'Kalutara');
    assert.equal((await request(`/${ids[0]}`, 'PUT', { province: 'Central', district: 'Kalutara' })).status, 400);
    // Simulate a legacy database record: no province or coordinates.
    const legacyId = new mongoose.Types.ObjectId(); ids.push(String(legacyId));
    await Pharmacy.collection.insertOne({ _id: legacyId, owner: owner._id, name: medicine, address: 'Legacy', district: 'Colombo', phone: '0111234567', inventory: [{ _id: new mongoose.Types.ObjectId(), name: medicine, quantity: 1 }] });
    const query = `/search?medicine=${encodeURIComponent(medicine)}&province=Western&lat=6.9&lng=79.8&sort=nearest`;
    const discovered = await request(query); assert.equal(discovered.status, 200);
    assert.deepEqual(discovered.data.pharmacies.map(p => p._id), [ids[0], ids[1], String(legacyId)]);
    assert.equal(discovered.data.pharmacies[2].distance, null); assert.equal(discovered.data.pharmacies[2].province, 'Western');
    assert.deepEqual((await request(query + '&radius=2')).data.pharmacies.map(p => p._id), [ids[0]]);
    assert.deepEqual((await request(query + '&district=Colombo')).data.pharmacies.map(p => p._id), [String(legacyId)]);
    assert.equal((await request('/search?lat=91&lng=79')).status, 400);
    assert.equal((await User.findById(owner._id)).latitude, undefined);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (ids.length) await Pharmacy.deleteMany({ _id: { $in: ids } });
    if (owner) await User.deleteOne({ _id: owner._id });
    await mongoose.disconnect();
  }
});
