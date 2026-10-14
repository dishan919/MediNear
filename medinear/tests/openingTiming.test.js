import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createMinuteClock } from '../src/utils/pharmacyClock.js';
const hours = Array.from({ length: 7 }, (_, day) => ({ day, closed: false, allDay: false, open: '08:00', close: '20:00' }));

test('one shared minute timer serves all status subscribers and stops after final unmount', () => {
  let starts = 0, stops = 0, tick, timestamp = 1, first = 0, second = 0;
  const clock = createMinuteClock({ setInterval(fn, ms) { assert.equal(ms, 60000); starts++; tick = fn; return 99; }, clearInterval(id) { assert.equal(id, 99); stops++; } }, () => timestamp);
  const unsubscribe1 = clock.subscribe(() => first++), unsubscribe2 = clock.subscribe(() => second++);
  assert.equal(starts, 1); timestamp = 2; tick(); assert.equal(clock.getSnapshot(), 2); assert.equal(first, 1); assert.equal(second, 1);
  unsubscribe1(); assert.equal(stops, 0); unsubscribe2(); assert.equal(stops, 1);
});
test('status renders closing/opening text, no countdown for 24-hour and safe unknown state', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { PharmacyStatusView } = await vite.ssrLoadModule('/src/components/PharmacyStatus.jsx');
    const render = pharmacy => renderToString(createElement(PharmacyStatusView, { pharmacy, now: new Date('2026-10-03T13:45:00Z') }));
    const pharmacy = { openingHours: hours, timezone: 'Asia/Colombo' };
    assert.match(render(pharmacy), /Closes in 45 min/);
    assert.match(render({ ...pharmacy, openingHours: hours.map(h => ({ ...h, closed: true })) }), /Closed/);
    const full = render({ ...pharmacy, openingHours: hours.map(h => ({ ...h, allDay: true })) });
    assert.match(full, /Open 24 Hours/); assert.doesNotMatch(full, /Closes/);
    assert.match(render({}), /Hours unavailable/);
    const { default: Card } = await vite.ssrLoadModule('/src/components/PharmacyCard.jsx');
    const { PharmacyDetailsView } = await vite.ssrLoadModule('/src/pages/PharmacyDetails.jsx');
    const { pharmacyClock } = await vite.ssrLoadModule('/src/utils/pharmacyClock.js');
    const snapshot = pharmacyClock.getSnapshot;
    pharmacyClock.getSnapshot = () => new Date('2026-10-03T13:45:00Z').getTime();
    // A daily 24-hour schedule is deterministic at any test execution time.
    const sample = { ...pharmacy, _id: 'p', name: 'City Pharmacy', address: 'Colombo', phone: '0111234567', openingHours: hours.map(h => ({ ...h, allDay: true })) };
    const routerRender = component => renderToString(createElement(MemoryRouter, {}, component));
    assert.match(routerRender(createElement(Card, { pharmacy: sample })), /Open 24 Hours/);
    assert.match(routerRender(createElement(PharmacyDetailsView, { pharmacy: sample })), /Open 24 Hours/);
    const regular = { ...sample, openingHours: hours };
    assert.match(routerRender(createElement(Card, { pharmacy: regular })), /Closes in 45 min/);
    assert.match(routerRender(createElement(PharmacyDetailsView, { pharmacy: regular })), /Closes in 45 min/);
    pharmacyClock.getSnapshot = snapshot;
  } finally { await vite.close(); }
});
