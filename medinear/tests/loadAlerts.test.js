import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAlerts, alertLoadError } from '../src/auth/loadAlerts.js';
test('real subscription reads succeed independently of notification errors', async () => {
  const result = await loadAlerts({ subscriptions: async () => [], notifications: async () => { throw new Error('Database unavailable'); } });
  assert.equal(result.subscriptions.status, 'fulfilled');
  assert.deepEqual(result.subscriptions.value, []);
  assert.equal(alertLoadError(result.subscriptions, 'Failure'), '');
  assert.equal(alertLoadError(result.notifications, 'Cannot load notifications'), 'Cannot load notifications');
});
test('retry returns fresh database subscription state and clears a prior error', async () => {
  let failure = true;
  const api = { subscriptions: async () => { if (failure) throw { response: { data: { message: 'Unable to process alerts. Please try again.' } } }; return [{ _id: 'subscription-from-api' }]; }, notifications: async () => ({ notifications: [], unreadCount: 0 }) };
  const failed = await loadAlerts(api);
  assert.match(alertLoadError(failed.subscriptions, 'Failure'), /Unable to process alerts/);
  assert.equal(failed.notifications.status, 'fulfilled');
  failure = false;
  const retried = await loadAlerts(api);
  assert.equal(alertLoadError(retried.subscriptions, 'Failure'), '');
  assert.deepEqual(retried.subscriptions.value, [{ _id: 'subscription-from-api' }]);
});
