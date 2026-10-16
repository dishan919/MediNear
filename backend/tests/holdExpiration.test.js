const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
let supported = true;
require('../services/databaseCapabilities').supportsTransactions = async () => supported;
const Hold = require('../models/HoldRequest'), Pharmacy = require('../models/Pharmacy');
const { acceptHold, expireHold, expireDueHolds, completeHold } = require('../services/holds');
const { HOLD_DURATION_MS } = require('../services/holdPolicy');

test('acceptance assigns a server deadline from the single duration policy in the stock transaction', async t => {
  const now = new Date('2026-10-16T12:00:00Z');
  t.mock.method(mongoose.connection, 'transaction', async callback => callback('session'));
  t.mock.method(Hold, 'findOneAndUpdate', async (filter, update, options) => {
    assert.equal(filter.status, 'pending'); assert.equal(options.session, 'session'); assert.equal(update.$set.acceptedAt.getTime(), now.getTime()); assert.equal(update.$set.expiresAt - update.$set.acceptedAt, HOLD_DURATION_MS);
    return { _id: 'hold', quantity: 2, medicine: 'medicine', ...update.$set };
  });
  t.mock.method(Pharmacy, 'updateOne', async () => ({ modifiedCount: 1 }));
  const accepted = await acceptHold('hold', 'pharmacy', 'owner', () => now); assert.equal(accepted.status, 'accepted');
});
test('expiry rolls back the terminal status if stock restoration fails', async t => {
  let status = 'accepted'; const now = new Date();
  t.mock.method(mongoose.connection, 'transaction', async action => { const original = status; try { return await action('session'); } catch (e) { status = original; throw e; } });
  t.mock.method(Hold, 'findOneAndUpdate', async (filter, update, options) => {
    assert.equal(filter.status, 'accepted'); assert.equal(filter.expiresAt.$lte, now); assert.ok(filter.$expr); assert.equal(options.session, 'session'); status = update.$set.status;
    return { _id: 'hold', pharmacy: 'pharmacy', medicine: 'medicine', quantity: 2, status };
  });
  t.mock.method(Pharmacy, 'updateOne', async (filter, update) => { assert.equal(update.$inc['inventory.$.quantity'], 2); assert.equal(update.$inc.__v, 1); assert.equal(filter.inventory.$elemMatch.quantity.$lte, Number.MAX_SAFE_INTEGER - 2); return { modifiedCount: 0 }; });
  await assert.rejects(expireHold('hold', { customer: 'customer' }, now), e => e.status === 409); assert.equal(status, 'accepted');
});
test('standalone expiration fails before writing; missing/damaged dates fail without guessing expiry', async t => {
  supported = false; t.after(() => { supported = true; });
  t.mock.method(Hold, 'findOneAndUpdate', () => assert.fail('no write on standalone'));
  await assert.rejects(expireHold('hold', {}), e => e.status === 503);
  t.mock.method(Hold, 'exists', async filter => { assert.equal(filter.status, 'accepted'); assert.ok(filter.$nor[0].acceptedAt); return true; });
  await assert.rejects(expireDueHolds({ customer: 'customer' }), e => e.status === 409 && /invalid pickup/.test(e.message));
});
test('collection is a conditional single-document transition before deadline and never writes stock', async t => {
  t.mock.method(Pharmacy, 'updateOne', () => assert.fail('collection must not restore stock'));
  const now = new Date();
  t.mock.method(Hold, 'findOneAndUpdate', async (filter, update) => { assert.equal(filter.pharmacy, 'owned'); assert.equal(filter.status, 'accepted'); assert.equal(filter.expiresAt.$gt, now); assert.equal(update.$set.status, 'completed'); assert.equal(update.$set.completedAt, now); return { status: 'completed' }; });
  assert.equal((await completeHold('hold', 'owned', now)).status, 'completed');
  Hold.findOneAndUpdate.mock.mockImplementation(async () => null); await assert.rejects(completeHold('hold', 'owned'), e => e.status === 409);
});
