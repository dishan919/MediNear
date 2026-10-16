const test = require('node:test');
const assert = require('node:assert/strict');
const Pharmacy = require('../models/Pharmacy');
const { inventoryAnalytics, ATTENTION_LIMIT } = require('../services/inventoryAnalytics');
const { getInventoryAnalytics } = require('../controllers/inventoryAnalyticsController');
const { getMedicineExpiryStatus } = require('../../shared/medicineExpiry.mjs');
const { getStockStatus } = require('../../shared/stockStatus.mjs');
const now = new Date('2026-10-16T12:00:00Z');
const inventory = () => [
  { _id: 'panadol', name: 'Panadol', quantity: 3, expiryDate: '2027-12-15' },
  { _id: 'vitamin', name: 'Vitamin C', quantity: 10, expiryDate: '2026-10-25' },
  { _id: 'x', name: 'Medicine X', quantity: 0, expiryDate: '2027-12-15' },
  { _id: 'y', name: 'Medicine Y', quantity: 8, expiryDate: '2026-10-10' },
  { _id: 'z', name: 'Medicine Z', quantity: 20 },
];
test('five-item fixture produces exact metrics and recommended attention priority without healthy items', () => {
  const result = inventoryAnalytics(inventory(), now);
  assert.deepEqual(result.summary, { totalMedicines: 5, totalStockUnits: 41, lowStock: 1, outOfStock: 1, expiringSoon: 1, expired: 1 });
  assert.deepEqual(result.needsAttention.map(m => m._id), ['y', 'x', 'vitamin', 'panadol']); assert.equal(result.attentionTotal, 4); assert.equal(result.hasMore, false);
});
test('overlapping issues contribute to both metrics but a medicine appears only once', () => {
  const result = inventoryAnalytics([{ _id: 'overlap', name: 'Medicine A', quantity: 3, expiryDate: '2026-10-25' }, { _id: 'zero', quantity: 0, expiryDate: '2026-10-15' }], now);
  assert.equal(result.summary.lowStock, 1); assert.equal(result.summary.expiringSoon, 1); assert.equal(result.summary.outOfStock, 1); assert.equal(result.summary.expired, 1);
  assert.equal(result.needsAttention.length, 2); assert.deepEqual(result.needsAttention[1].issues.map(issue => issue.code), ['expiring-soon', 'low-stock']); assert.deepEqual(result.needsAttention[0].issues.map(issue => issue.code), ['expired', 'out-of-stock']);
});
test('legacy quantities follow existing stock status, invalid units are excluded and exact-sum overflow fails safely', () => {
  const values = [undefined, '3', NaN, -2, 1.5, 0, 4];
  const result = inventoryAnalytics(values.map((quantity, i) => ({ _id: String(i), quantity })), now);
  assert.equal(result.summary.totalMedicines, 7); assert.equal(result.summary.totalStockUnits, 4); assert.equal(result.summary.lowStock, 1); assert.equal(result.summary.outOfStock, 2);
  for (const item of result.needsAttention) assert.equal(item.stockStatus, getStockStatus(values[Number(item._id)]).status);
  assert.equal(result.needsAttention.find(item => item._id === '3').quantity, null); assert.doesNotMatch(JSON.stringify(result), /NaN|Infinity/);
  assert.throws(() => inventoryAnalytics([{ quantity: Number.MAX_SAFE_INTEGER }, { quantity: 1 }], now), /exact numeric range/);
});
test('empty/missing inventory is zero; missing expiry alone is not an attention issue', () => {
  for (const value of [[], undefined, null]) assert.deepEqual(inventoryAnalytics(value, now).summary, { totalMedicines: 0, totalStockUnits: 0, lowStock: 0, outOfStock: 0, expiringSoon: 0, expired: 0 });
  const healthy = inventoryAnalytics([{ quantity: 20 }], now); assert.deepEqual(healthy.needsAttention, []);
});
test('expiry boundaries match the existing shared Sri Lankan date-only rules exactly', () => {
  for (const date of ['2026-10-15', '2026-10-16', '2026-10-17', '2026-11-15', '2026-11-16']) {
    const expected = getMedicineExpiryStatus(date, now); const result = inventoryAnalytics([{ _id: 'm', quantity: 20, expiryDate: date }], now);
    assert.equal(result.summary.expired, Number(expected.status === 'expired')); assert.equal(result.summary.expiringSoon, Number(expected.status === 'expiring-soon'));
  }
  assert.equal(inventoryAnalytics([{ expiryDate: '2026-10-16' }], new Date('2026-10-16T18:29:59Z')).summary.expired, 0);
  assert.equal(inventoryAnalytics([{ expiryDate: '2026-10-16' }], new Date('2026-10-16T18:30:00Z')).summary.expired, 1);
});
test('attention is deterministic, limited and safe; calculation does not mutate source data', () => {
  const items = Array.from({ length: 25 }, (_, i) => Object.freeze({ _id: String(i).padStart(2, '0'), name: i < 2 ? 'A' : 'B', quantity: 2, expiryDate: '2026-10-10', owner: 'private', email: 'secret', price: 100 })); Object.freeze(items);
  const before = JSON.stringify(items), result = inventoryAnalytics(items, now);
  assert.equal(result.needsAttention.length, ATTENTION_LIMIT); assert.equal(result.attentionTotal, 25); assert.equal(result.hasMore, true); assert.deepEqual(result.needsAttention.slice(0, 2).map(m => m._id), ['00', '01']); assert.equal(JSON.stringify(items), before); assert.doesNotMatch(JSON.stringify(result), /private|secret|price|owner/);
});
test('controller queries only authenticated owned pharmacy and required fields; safe missing/invalid/error responses', async t => {
  const req = { params: { id: '507f1f77bcf86cd799439011' }, user: { _id: 'authenticated-owner' }, query: { ownerId: 'attacker' } };
  const response = () => ({ status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } });
  t.mock.method(Pharmacy, 'findOne', filter => { assert.deepEqual(filter, { _id: req.params.id, owner: 'authenticated-owner' }); return { select(fields) { assert.equal(fields, 'inventory._id inventory.name inventory.quantity inventory.expiryDate -_id'); return { lean: async () => null }; } }; });
  const missing = response(); await getInventoryAnalytics(req, missing); assert.equal(missing.code, 404);
  const invalid = response(); await getInventoryAnalytics({ ...req, params: { id: 'bad' } }, invalid); assert.equal(invalid.code, 400);
  Pharmacy.findOne.mock.mockImplementation(() => { throw new Error('private database stack'); }); const failed = response(); await getInventoryAnalytics(req, failed); assert.equal(failed.code, 500); assert.doesNotMatch(JSON.stringify(failed.data), /private|stack/);
});
