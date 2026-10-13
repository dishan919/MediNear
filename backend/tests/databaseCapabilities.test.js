const test = require('node:test');
const assert = require('node:assert/strict');
const { supportsTransactions } = require('../services/databaseCapabilities');
const connection = hello => ({ db: { admin: () => ({ command: async () => hello }) } });
test('topology selection preserves replica-set/mongos transactions and permits standalone subscription', async () => {
  assert.equal(await supportsTransactions(connection({ setName: 'test-replica-set' })), true);
  assert.equal(await supportsTransactions(connection({ msg: 'isdbgrid' })), true);
  assert.equal(await supportsTransactions(connection({ isWritablePrimary: true })), false);
});
test('topology inspection failures never silently select a weaker database path', async () => {
  const failure = new Error('Topology unavailable');
  const unavailable = { db: { admin: () => ({ command: async () => { throw failure; } }) } };
  await assert.rejects(supportsTransactions(unavailable), failure);
});
