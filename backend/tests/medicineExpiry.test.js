const test = require('node:test');
const assert = require('node:assert/strict');
const { parseExpiryDate, expiryDateKey, getMedicineExpiryStatus, formatExpiryDate, isMedicineAvailable, filterByExpiry, expirySummary, EXPIRING_SOON_DAYS } = require('../../shared/medicineExpiry.mjs');
const { validateMedicine, publicMedicine } = require('../services/inventory');
const { rankPharmacies } = require('../services/ranking');
const Pharmacy = require('../models/Pharmacy'), Hold = require('../models/HoldRequest');
const { create } = require('../controllers/holdController');
const now = new Date('2026-10-16T12:00:00Z');
test('expiry date parsing validates real calendar dates, optional clearing and canonical UTC storage', () => {
  assert.equal(parseExpiryDate('2026-10-25').toISOString(), '2026-10-25T00:00:00.000Z');
  assert.equal(expiryDateKey(parseExpiryDate('2024-02-29')), '2024-02-29');
  for (const input of [undefined, null, '']) assert.equal(parseExpiryDate(input), null);
  for (const input of ['2026-02-29', '2026-02-30', '2026-13-01', '25/10/2026', '2026-10-25T12:00:00Z', '0000-01-01', 'bad', 0, true, {}, [], new Date('invalid')]) assert.throws(() => parseExpiryDate(input));
  assert.equal(formatExpiryDate('2026-10-25'), '25 Oct 2026');
  assert.equal(validateMedicine({ name: 'Test', quantity: 5, expiryDate: '' }).expiryDate, null);
  assert.equal(validateMedicine({ name: 'Test', quantity: 5 }).expiryDate, undefined);
  assert.throws(() => validateMedicine({ name: 'Test', quantity: 5, expiryDate: 'bad' }), /Expiry Date/);
});
test('one policy handles yesterday/today/tomorrow/30/31 and Sri Lankan midnight boundaries', () => {
  assert.equal(EXPIRING_SOON_DAYS, 30);
  for (const [date, status] of [['2026-10-15', 'expired'], ['2026-10-16', 'expiring-soon'], ['2026-10-17', 'expiring-soon'], ['2026-11-15', 'expiring-soon'], ['2026-11-16', 'valid']]) assert.equal(getMedicineExpiryStatus(date, now).status, status, date);
  assert.equal(getMedicineExpiryStatus('2026-10-16', new Date('2026-10-16T18:29:59Z')).eligible, true);
  assert.equal(getMedicineExpiryStatus('2026-10-16', new Date('2026-10-16T18:30:00Z')).eligible, false);
  assert.equal(getMedicineExpiryStatus(null, now).label, 'Expiry not set'); assert.equal(getMedicineExpiryStatus('bad', now).eligible, false);
  assert.equal(isMedicineAvailable({ quantity: 10, expiryDate: '2026-10-15' }, now), false);
  assert.equal(isMedicineAvailable({ quantity: 3 }, now), true);
});
test('customer ranking excludes expired positive stock, preserves legacy/soon and existing sorting semantics', () => {
  const pharmacy = (id, expiryDate, quantity = 5) => ({ _id: id, name: id, address: 'Test', district: 'Colombo', latitude: 6.9, longitude: 79.8, isOpen: true, open24Hours: true, inventory: [{ _id: id, name: 'Match', quantity, expiryDate }] });
  const items = [pharmacy('expired', '2026-10-15', 10), pharmacy('future', '2027-01-01'), pharmacy('soon', '2026-10-17', 3), pharmacy('legacy', undefined)];
  const results = rankPharmacies(items, { medicine: 'Match' }, now);
  assert.deepEqual(results.map(p => p._id).sort(), ['future', 'legacy', 'soon']); assert.ok(results.every(p => p.availability === 'Available'));
  assert.deepEqual(rankPharmacies([items[0]], { medicine: 'Match', includeOutOfStock: true }, now), []);
  assert.equal(publicMedicine(items[0].inventory[0], now).availability, 'Expired');
  assert.equal(publicMedicine(items[2].inventory[0], now).availability, 'Available');
  const summary = expirySummary(items.map(p => p.inventory[0]), now); assert.deepEqual(summary, { 'expiring-soon': 1, expired: 1 }); assert.equal(filterByExpiry(items.map(p => p.inventory[0]), 'expired', now).length, 1);
});
test('expired medicine cannot create a hold even with positive quantity and no inventory is written', async t => {
  const p = new Pharmacy({ inventory: [{ name: 'Expired', quantity: 10, expiryDate: '2000-01-01' }] });
  t.mock.method(Pharmacy, 'findById', async () => p); t.mock.method(Hold, 'create', () => assert.fail('expired hold must not be saved'));
  const response = { status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
  await create({ params: { id: String(p._id) }, user: { _id: p._id }, body: { medicineId: String(p.inventory[0]._id), quantity: 2 } }, response);
  assert.equal(response.code, 409); assert.match(response.data.message, /expired/); assert.equal(p.inventory[0].quantity, 10);
});
test('expired positive inventory cannot fulfill availability subscriptions', async t => {
  const Subscription = require('../models/RestockSubscription'); t.mock.method(Subscription, 'find', () => assert.fail('expired inventory must not notify subscribers'));
  await require('../services/restock').fulfillRestock({ _id: 'pharmacy' }, { _id: 'medicine', quantity: 10, expiryDate: parseExpiryDate('2000-01-01') }, null);
});
