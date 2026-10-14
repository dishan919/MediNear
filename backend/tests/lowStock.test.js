const test = require('node:test');
const assert = require('node:assert/strict');
const { rankPharmacies } = require('../services/ranking');
const { validateMedicine, publicMedicine } = require('../services/inventory');
const { isRestock } = require('../services/restock');
test('low positive stock is available for search and keeps smart/nearest priorities', () => {
  const hours = Array.from({ length: 7 }, (_, day) => ({ day, closed: false, allDay: true }));
  const base = { name: 'Test', latitude: 6.9, longitude: 79.8, openingHours: hours, inventory: [{ name: 'Panadol', quantity: 3 }] };
  const far = { ...base, _id: 'far', latitude: 7.1 };
  const closed = { ...base, _id: 'near-closed', openingHours: hours.map(h => ({ ...h, closed: true, allDay: false })) };
  const out = { ...base, _id: 'out', inventory: [{ name: 'Panadol', quantity: 0 }] };
  const options = { medicine: 'Panadol', lat: 6.9, lng: 79.8, includeOutOfStock: true };
  assert.equal(publicMedicine(base.inventory[0]).availability, 'Available');
  assert.equal(rankPharmacies([base], { medicine: 'Panadol' }).length, 1);
  assert.deepEqual(rankPharmacies([out, closed, far], options).map(p => p._id), ['far', 'near-closed', 'out']);
  assert.deepEqual(rankPharmacies([out, closed, far], { ...options, sort: 'nearest' }).map(p => p._id), ['near-closed', 'far', 'out']);
});
test('low-stock threshold does not restrict owner quantities or alter restock triggers', () => {
  for (const quantity of [20, 5, 1, 0, 10]) assert.equal(validateMedicine({ name: 'Panadol', quantity }).quantity, quantity);
  assert.equal(isRestock(0, 3), true);
  assert.equal(isRestock(3, 6), false); assert.equal(isRestock(3, 10), false);
});
