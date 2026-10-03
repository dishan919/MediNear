const test = require('node:test');
const assert = require('node:assert/strict');
const { openingStatus, validateHours } = require('../services/openingHours');
const { distanceKm } = require('../services/distance');
const { rankPharmacies } = require('../services/ranking');
const { validateMedicine } = require('../services/inventory');
const { seedPharmacies } = require('../scripts/seedPharmacies');
const schedule = (open = '08:00', close = '20:00') => Array.from({ length: 7 }, (_, day) => ({ day, closed: false, allDay: false, open, close }));
const now = new Date('2026-10-03T06:30:00Z'); // noon in Colombo
const base = { _id: 'a', name: 'City', latitude: 6.9271, longitude: 79.8612, timezone: 'Asia/Colombo', openingHours: schedule(), inventory: [{ name: 'Panadol', genericName: 'Paracetamol', quantity: 25 }] };
test('hours use timezone, inclusive opening and exclusive closing, and missing data is unknown', () => {
  assert.equal(openingStatus(base, now).isOpen, true);
  assert.equal(openingStatus(base, new Date('2026-10-03T02:30:00Z')).isOpen, true);
  assert.equal(openingStatus(base, new Date('2026-10-03T14:30:00Z')).isOpen, false);
  assert.equal(openingStatus({ isOpen: true, open24Hours: true }, now).isOpen, null);
  assert.throws(() => validateHours(schedule(), 'invalid'));
  assert.throws(() => validateHours(schedule().slice(1), 'Asia/Colombo'));
});
test('overnight hours span previous day and week boundary; closed today can still have previous shift', () => {
  const hours = schedule('20:00', '06:00'); hours[0] = { day: 0, closed: true, allDay: false };
  const p = { ...base, openingHours: hours };
  assert.equal(openingStatus(p, new Date('2026-10-03T23:30:00Z')).isOpen, true); // Sunday 05:00
  assert.equal(openingStatus(p, new Date('2026-10-04T00:30:00Z')).isOpen, false); // Sunday 06:00
  assert.equal(openingStatus(p, now).isOpen, false);
});
test('24 hour label requires all seven days stored as all day', () => {
  const openingHours = schedule().map(h => ({ ...h, allDay: true }));
  assert.equal(openingStatus({ ...base, openingHours }, now).open24Hours, true);
  openingHours[1].allDay = false;
  assert.equal(openingStatus({ ...base, openingHours }, now).open24Hours, false);
});
test('Haversine distance matches known geographic distance and handles missing coordinates', () => {
  assert.equal(distanceKm(0, 0, 0, 0), 0);
  assert.ok(Math.abs(distanceKm(0, 0, 0, 1) - 111.195) < .01);
  assert.equal(distanceKm(undefined, 0, 0, 0), null);
  assert.equal(distanceKm(91, 0, 0, 0), null);
});
test('inventory rejects invalid stock and price and derives matches safely', () => {
  for (const quantity of [-1, 1.5, '1', null, Infinity]) assert.throws(() => validateMedicine({ name: 'Panadol', quantity }));
  assert.throws(() => validateMedicine({ name: ' ', quantity: 0 }));
  assert.throws(() => validateMedicine({ name: 'Panadol', quantity: 1, price: -1 }));
  assert.equal(validateMedicine({ name: ' Panadol ', quantity: 0 }).name, 'Panadol');
});
test('medicine search is case-insensitive partial and excludes zero stock; open outranks closer closed', () => {
  const closed = { ...base, _id: 'b', name: 'Closer closed', openingHours: schedule('20:00', '06:00') };
  const openFar = { ...base, _id: 'c', name: 'Open far', latitude: 7 };
  const zero = { ...base, _id: 'd', inventory: [{ name: 'Panadol', quantity: 0 }] };
  const ranked = rankPharmacies([closed, openFar, zero], { medicine: 'pAnA', lat: base.latitude, lng: base.longitude }, now);
  assert.deepEqual(ranked.map(p => p._id), ['c', 'b']);
  assert.equal(rankPharmacies([base], { medicine: 'PARAC' }, now).length, 1);
  assert.equal(rankPharmacies([base], { medicine: '.*' }, now).length, 0);
  assert.equal(ranked[0].owner, undefined);
  assert.equal(ranked[0].medicines[0].quantity, 25);
});
test('ranking sorts distance within open group and emergency excludes unknown and closed', () => {
  const far = { ...base, _id: 'b', latitude: 7 };
  const unknown = { ...base, _id: 'c', openingHours: undefined };
  const closed = { ...base, _id: 'd', openingHours: schedule('20:00', '06:00') };
  assert.deepEqual(rankPharmacies([far, base], { lat: base.latitude, lng: base.longitude }, now).map(p => p._id), ['a', 'b']);
  assert.deepEqual(rankPharmacies([unknown, closed, base], { emergency: true }, now).map(p => p._id), ['a']);
  assert.equal(rankPharmacies([base], { hour24: true }, now).length, 0);
  assert.equal(rankPharmacies([far], { lat: base.latitude, lng: base.longitude, radius: 1 }, now).length, 0);
});
test('development pharmacy seed inserts pharmacies and only missing medicines; repeat runs preserve values', async () => {
  const entries = new Map();
  const model = { async updateOne(filter, update, options) {
    if (update.$setOnInsert) {
      assert.equal(options.upsert, true);
      if (!entries.has(filter.name)) entries.set(filter.name, structuredClone(update.$setOnInsert));
    } else {
      assert.deepEqual(Object.keys(update), ['$push']);
      const p = entries.get(filter.name);
      if (!p.inventory.some(m => m.name === filter['inventory.name'].$ne)) p.inventory.push(structuredClone(update.$push.inventory));
    }
  } };
  await seedPharmacies(model, 'owner'); const before = JSON.stringify([...entries]);
  await seedPharmacies(model, 'owner'); assert.equal(JSON.stringify([...entries]), before); assert.equal(entries.size, 3);
});
