const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Pharmacy = require('../models/Pharmacy');
const User = require('../models/User');
const { rankPharmacies } = require('../services/ranking');
const { distanceKm } = require('../services/distance');
const { locations, validateArea } = require('../services/locations');
const now = new Date('2026-10-03T06:30:00Z');
const hours = Array.from({ length: 7 }, (_, day) => ({ day, closed: false, allDay: true }));
const base = { _id: 'near', name: 'Near', district: 'Colombo', latitude: 6.9, longitude: 79.8, openingHours: hours, inventory: [{ name: 'Panadol', quantity: 1 }] };
test('shared Sri Lanka mapping contains nine provinces and 25 unique districts', () => {
  assert.equal(Object.keys(locations).length, 9); assert.equal(new Set(Object.values(locations).flat()).size, 25);
  assert.throws(() => validateArea('Western', 'Kandy'), /does not belong/);
});
test('province/district filtering includes legacy districts without a province', () => {
  const data = [base, { ...base, _id: 'gampaha', district: 'Gampaha' }, { ...base, _id: 'kandy', district: 'Kandy' }];
  assert.deepEqual(rankPharmacies(data, { province: 'Western' }, now).map(p => p._id), ['gampaha', 'near']);
  assert.deepEqual(rankPharmacies(data, { district: 'Colombo' }, now).map(p => p._id), ['near']);
  assert.equal(rankPharmacies(data, { province: 'Central', district: 'Kandy' }, now)[0].province, 'Central');
});
test('Haversine, nearest sorting, radius and missing coordinates are handled explicitly', () => {
  assert.equal(distanceKm(0, 0, 0, 0), 0);
  assert.ok(Math.abs(distanceKm(0, 0, 0, 1) - 111.195) < .01);
  assert.ok(Math.abs(distanceKm(0, 0, 0, 180) - 20015.087) < .01);
  for (const bad of [null, undefined, NaN, Infinity, 91, '6.9']) assert.equal(distanceKm(bad, 0, 0, 0), null);
  const far = { ...base, _id: 'far', latitude: 7.1 }, missing = { ...base, _id: 'missing', latitude: undefined };
  const options = { lat: 6.9, lng: 79.8, sort: 'nearest' };
  assert.deepEqual(rankPharmacies([missing, far, base], options, now).map(p => p._id), ['near', 'far', 'missing']);
  assert.equal(rankPharmacies([missing], options, now)[0].distance, null);
  assert.deepEqual(rankPharmacies([missing, far, base], { ...options, radius: 2 }, now).map(p => p._id), ['near']);
});
test('availability remains first in both orders, smart preserves opening status before distance', () => {
  const far = { ...base, _id: 'far', latitude: 7.1 };
  const out = { ...base, _id: 'out', inventory: [{ name: 'Panadol', quantity: 0 }] };
  const closed = { ...base, _id: 'closed', openingHours: hours.map(h => ({ ...h, allDay: false, closed: true })) };
  const opts = { medicine: 'pAnA', includeOutOfStock: true, lat: 6.9, lng: 79.8 };
  for (const sort of ['smart', 'nearest']) assert.deepEqual(rankPharmacies([out, far], { ...opts, sort }, now).map(p => p._id), ['far', 'out']);
  assert.deepEqual(rankPharmacies([closed, far], opts, now).map(p => p._id), ['far', 'closed']);
  assert.deepEqual(rankPharmacies([closed, far], { ...opts, sort: 'nearest' }, now).map(p => p._id), ['closed', 'far']);
  assert.equal(rankPharmacies([out, far], { medicine: 'Panadol' }, now).length, 1);
  assert.deepEqual(rankPharmacies([closed, far], { emergency: true, hour24: true }, now).map(p => p._id), ['far']);
});
test('location search HTTP validation and owner profile writes preserve authentication and area consistency', async t => {
  const old = process.env.JWT_SECRET; process.env.JWT_SECRET = 'location-test';
  t.after(() => { if (old === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = old; });
  const owner = new mongoose.Types.ObjectId(), customer = new mongoose.Types.ObjectId();
  const p = new Pharmacy({ ...base, _id: undefined, owner, address: 'Colombo', phone: '0111234567' });
  t.mock.method(User, 'findById', id => ({ select: async () => ({ _id: id, role: String(id) === String(owner) ? 'pharmacy_owner' : 'customer' }) }));
  t.mock.method(Pharmacy, 'find', () => ({ lean: async () => [p.toObject()] }));
  t.mock.method(Pharmacy, 'findById', async () => p);
  t.mock.method(p, 'save', async () => { await p.validate(); return p; });
  t.mock.method(Pharmacy, 'create', async body => { const result = new Pharmacy(body); await result.validate(); return result; });
  const app = express(); app.use(express.json()); app.use('/pharmacies', require('../routes/pharmacyRoutes'));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  async function request(path, method = 'GET', body, user = owner) {
    const r = await fetch(`http://127.0.0.1:${server.address().port}/pharmacies${path}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt.sign({ userId: user }, process.env.JWT_SECRET)}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: r.status, data: await r.json() };
  }
  for (const query of ['province=Unknown', 'district=Unknown', 'province=Western&district=Kandy', 'province[]=Western', 'lat=91&lng=79', 'lat=6&lng=181', 'lat=6', 'radius=-1&lat=6&lng=79', 'radius=501&lat=6&lng=79', 'radius=5', 'sort=nearest', 'sort=bad', 'lat=NaN&lng=79']) assert.equal((await request(`/search?${query}`)).status, 400, query);
  const result = await request('/search?province=Western&district=Colombo&medicine=Panadol&lat=6.9&lng=79.8&sort=nearest&radius=2&hour24=true');
  assert.equal(result.status, 200); assert.equal(result.data.pharmacies.length, 1); assert.equal(result.data.pharmacies[0].distance, 0);
  assert.equal((await request('/search?province=Central')).data.pharmacies.length, 0);
  const path = `/${p._id}`;
  assert.equal((await request(path, 'PUT', { province: 'Western', district: 'Colombo' }, customer)).status, 403);
  assert.equal((await request(path, 'PUT', { province: 'Western', district: 'Colombo' })).status, 200);
  assert.equal(p.province, 'Western');
  assert.equal((await request(path, 'PUT', { province: 'Central' })).status, 400);
  assert.equal((await request(path, 'PUT', { district: 'Kandy', province: 'Western' })).status, 400);
  for (const body of [{ latitude: 91 }, { longitude: -181 }, { latitude: '6.9' }]) assert.equal((await request(path, 'PUT', body)).status, 400);
  const body = { name: 'Create', address: 'Kandy', phone: '0111234567', latitude: 7, longitude: 80, province: 'Central', district: 'Kandy' };
  assert.equal((await request('/', 'POST', body)).status, 201);
  assert.equal((await request('/', 'POST', { ...body, district: 'Colombo' })).status, 400);
});
