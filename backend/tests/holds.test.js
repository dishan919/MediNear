const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
let supported = true;
require('../services/databaseCapabilities').supportsTransactions = async () => supported;
const Pharmacy = require('../models/Pharmacy'), HoldRequest = require('../models/HoldRequest');
const { acceptHold, validQuantity } = require('../services/holds');
const { create } = require('../controllers/holdController');
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } });
test('hold schema uses references and unique pending-only duplicate constraint; quantity must be positive integer', () => {
  for (const quantity of [0, -1, 1.5, '2', 'x', NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.equal(validQuantity(quantity), false);
  assert.equal(validQuantity(2), true);
  assert.ok(new HoldRequest({}).validateSync());
  assert.ok(HoldRequest.schema.indexes().some(([fields, options]) => fields.customer && fields.pharmacy && fields.medicine && options.unique && options.partialFilterExpression.status === 'pending'));
  assert.ok(new HoldRequest({ customer: new mongoose.Types.ObjectId(), pharmacy: new mongoose.Types.ObjectId(), medicine: new mongoose.Types.ObjectId(), quantity: 1, status: 'invalid' }).validateSync());
});
test('create derives customer and pending status; stock is not written; invalid quantity/stock/medicine are rejected', async t => {
  const pharmacy = new Pharmacy({ inventory: [{ name: 'Test', quantity: 5 }] }); const customer = new mongoose.Types.ObjectId();
  t.mock.method(Pharmacy, 'findById', async () => pharmacy);
  t.mock.method(Pharmacy, 'updateOne', () => assert.fail('pending must not reduce stock'));
  t.mock.method(HoldRequest, 'create', async data => { assert.equal(data.customer, customer); assert.equal(data.status, 'pending'); return { ...data, _id: new mongoose.Types.ObjectId() }; });
  const req = quantity => ({ params: { id: String(pharmacy._id) }, user: { _id: customer }, body: { medicineId: String(pharmacy.inventory[0]._id), quantity, customerId: 'attacker', status: 'accepted' } });
  const good = response(); await create(req(2), good); assert.equal(good.code, 201); assert.equal(good.data.request.status, 'pending'); assert.equal(good.data.request.customer, undefined); assert.equal(pharmacy.inventory[0].quantity, 5);
  for (const quantity of [0, -1, 1.5, '2', 6]) { const bad = response(); await create(req(quantity), bad); assert.ok([400, 409].includes(bad.code)); }
  const absent = response(); await create({ ...req(1), body: { quantity: 1, medicineId: String(new mongoose.Types.ObjectId()) } }, absent); assert.equal(absent.code, 404);
  pharmacy.inventory[0].quantity = 0; const zero = response(); await create(req(1), zero); assert.equal(zero.code, 409);
});
test('atomic acceptance consumes stock once, rejects competing holds and rolls back status when stock write fails', async t => {
  const requests = new Map([['a', { _id: 'a', quantity: 2, medicine: 'medicine', status: 'pending' }], ['b', { _id: 'b', quantity: 2, medicine: 'medicine', status: 'pending' }]]);
  let stock = 3, tail = Promise.resolve(), failStock = false;
  // Transaction harness serializes commits and restores both documents on abort.
  t.mock.method(mongoose.connection, 'transaction', action => {
    const run = tail.then(async () => { const snapshot = [...requests.values()].map(value => ({ ...value })), originalStock = stock;
      try { return await action('session'); } catch (e) { stock = originalStock; snapshot.forEach(value => requests.set(value._id, value)); throw e; }
    }); tail = run.catch(() => {}); return run;
  });
  t.mock.method(HoldRequest, 'findOneAndUpdate', async (filter, update, options) => {
    assert.equal(filter.status, 'pending'); assert.equal(options.session, 'session'); assert.equal(filter.pharmacy, 'pharmacy');
    const value = requests.get(filter._id); if (!value || value.status !== filter.status) return null;
    value.status = update.$set.status; return { ...value };
  });
  t.mock.method(Pharmacy, 'updateOne', async (filter, update, options) => {
    assert.equal(filter.owner, 'owner'); assert.equal(options.session, 'session'); assert.equal(filter.inventory.$elemMatch._id, 'medicine'); assert.equal(update.$inc.__v, 1);
    if (failStock) throw new Error('simulated write failure');
    const required = filter.inventory.$elemMatch.quantity.$gte;
    if (stock < required) return { modifiedCount: 0 };
    stock += update.$inc['inventory.$.quantity']; return { modifiedCount: 1 };
  });
  const result = await Promise.allSettled([acceptHold('a', 'pharmacy', 'owner'), acceptHold('b', 'pharmacy', 'owner')]);
  assert.equal(result.filter(r => r.status === 'fulfilled').length, 1); assert.equal(stock, 1); assert.equal(requests.get('b').status, 'pending');
  await assert.rejects(acceptHold('a', 'pharmacy', 'owner'), e => e.status === 409); assert.equal(stock, 1);
  stock = 5; failStock = true; await assert.rejects(acceptHold('b', 'pharmacy', 'owner'), /write failure/); assert.equal(stock, 5); assert.equal(requests.get('b').status, 'pending');
  failStock = false; const accepted = await acceptHold('b', 'pharmacy', 'owner'); assert.equal(accepted.status, 'accepted'); assert.equal(stock, 3);
});
test('standalone MongoDB refuses acceptance before any writes', async t => {
  supported = false; t.after(() => { supported = true; });
  t.mock.method(HoldRequest, 'findOneAndUpdate', () => assert.fail('no status write'));
  t.mock.method(Pharmacy, 'updateOne', () => assert.fail('no stock write'));
  await assert.rejects(acceptHold('a', 'pharmacy', 'owner'), e => e.status === 503 && /replica set/.test(e.message));
});
