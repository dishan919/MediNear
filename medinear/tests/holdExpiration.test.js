import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { pickupDates, remainingPickupTime, estimatedServerTime } from '../src/utils/holdDeadline.js';
import { createMinuteClock } from '../src/utils/pharmacyClock.js';
import { holdService, holdToast } from '../src/utils/holds.js';
const accepted = { _id: 'hold', status: 'accepted', quantity: 2, medicineName: 'Panadol', pharmacyName: 'City', customerName: 'Dissa', createdAt: '2026-10-16T00:00:00Z', acceptedAt: '2026-10-16T12:00:00Z', expiresAt: '2026-10-17T12:00:00Z' };
test('pickup countdown handles hours/minutes/cutoff/invalid dates without inferring expiration', () => {
  const now = Date.parse(accepted.acceptedAt);
  assert.equal(remainingPickupTime(now + 205 * 60000, now), '3 hr 25 min remaining');
  assert.equal(remainingPickupTime(now + 45 * 60000, now), '45 min remaining');
  assert.match(remainingPickupTime(now, now), /Refresh hold requests to confirm status/);
  assert.match(remainingPickupTime(NaN, now), /unavailable/);
  assert.ok(pickupDates(accepted));
  for (const dates of [{ acceptedAt: null }, { expiresAt: 'damaged' }, { acceptedAt: '1970-01-01T00:00:00Z' }, { expiresAt: accepted.acceptedAt }]) assert.equal(pickupDates({ ...accepted, ...dates }), null);
  assert.equal(estimatedServerTime(now, 100, 60100), now + 60000);
  assert.ok(Number.isNaN(estimatedServerTime(NaN, 100, 60100)));
});
test('existing minute-clock subscription uses one timer and clears it on final unmount', () => {
  let interval, active = 0, cleared = 0, now = 10;
  const clock = createMinuteClock({ setInterval(fn, delay) { assert.equal(delay, 60000); active++; interval = fn; return 1; }, clearInterval(id) { assert.equal(id, 1); active--; cleared++; } }, () => now);
  let notified = 0; const first = clock.subscribe(() => notified++), second = clock.subscribe(() => notified++);
  assert.equal(active, 1); now += 60000; interval(); assert.equal(notified, 2); assert.equal(clock.getSnapshot(), now); first(); assert.equal(active, 1); second(); assert.equal(active, 0); assert.equal(cleared, 1);
});
test('service preserves deadline/server anchor but never sends client deadline/status; collection toast exact', async () => {
  const calls = []; const api = { async patch(...args) { calls.push(args); return { data: { request: { ...accepted, status: 'completed' }, serverNow: accepted.acceptedAt } }; } };
  const result = await holdService(api, () => 'token').action('pharmacy', 'hold', 'complete'); assert.deepEqual(calls[0].slice(0, 2), ['/pharmacies/pharmacy/hold-requests/hold/complete', {}]); assert.equal(result.expiresAt, accepted.expiresAt); assert.equal(result.serverNow, Date.parse(accepted.acceptedAt));
  assert.equal(holdToast('complete').message, 'Hold marked as collected.');
});
test('accepted cards show deadline/countdown, expired and collected are terminal; no client expiry mutation', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { HoldDeadlineView } = await vite.ssrLoadModule('/src/components/HoldDeadline.jsx');
    const html = renderToString(createElement(HoldDeadlineView, { request: accepted, now: Date.parse(accepted.expiresAt) - 205 * 60000 }));
    assert.match(html, /Pickup by/); assert.match(html, /17 Oct 2026/); assert.match(html, /17:30/); assert.match(html, /3 hr 25 min remaining/);
    for (const status of ['pending', 'rejected', 'cancelled', 'expired', 'completed']) assert.equal(renderToString(createElement(HoldDeadlineView, { request: { ...accepted, status }, now: Date.now() })), '');
    assert.match(renderToString(createElement(HoldDeadlineView, { request: { ...accepted, expiresAt: null } })), /deadline unavailable/);
    const { HoldRequestsView } = await vite.ssrLoadModule('/src/components/HoldRequests.jsx');
    const base = { owner: true, pharmacyId: 'pharmacy', data: { requests: [accepted], page: 1, hasMore: false, serverNow: Date.parse(accepted.acceptedAt), receivedAt: performance.now() } };
    const owner = renderToString(createElement(HoldRequestsView, base)); assert.match(owner, /Mark as Collected/); assert.match(owner, /Pickup by/); assert.doesNotMatch(owner, />Accept<|>Reject</);
    for (const [status, label, explanation] of [['expired', 'Expired', 'Hold expired before pickup.'], ['completed', 'Collected', 'Picked up successfully.']]) {
      const terminal = renderToString(createElement(HoldRequestsView, { ...base, data: { ...base.data, requests: [{ ...accepted, status }] } }));
      assert.match(terminal, new RegExp(label)); assert.ok(terminal.includes(explanation)); assert.doesNotMatch(terminal, /Mark as Collected|Pickup by|>Accept<|>Reject</);
    }
    const afterDeadline = renderToString(createElement(HoldRequestsView, { ...base, data: { ...base.data, serverNow: Date.parse(accepted.expiresAt) + 1 } })); assert.doesNotMatch(afterDeadline, /Mark as Collected/); assert.match(afterDeadline, /Refresh hold requests to confirm status/);
    const customer = renderToString(createElement(HoldRequestsView, { ...base, owner: false })); assert.doesNotMatch(customer, /Mark as Collected|Cancel Request/);
    const source = readFileSync(new URL('../src/components/HoldDeadline.jsx', import.meta.url), 'utf8'); assert.match(source, /pharmacyClock.subscribe/); assert.doesNotMatch(source, /api\.|fetch\(|setTimeout|setInterval/);
  } finally { await vite.close(); }
});
