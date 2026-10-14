const test = require('node:test');
const assert = require('node:assert/strict');
const { openingStatus } = require('../services/openingHours');
const { rankPharmacies } = require('../services/ranking');
const weekly = (open = '08:00', close = '20:00') => Array.from({ length: 7 }, (_, day) => ({ day, closed: false, allDay: false, open, close }));
const pharmacy = hours => ({ timezone: 'Asia/Colombo', openingHours: hours });
const at = time => new Date(`2026-10-03T${time}Z`); // Saturday, Colombo = UTC + 05:30

test('open timing uses less-than-two-hour countdown and a clock time at two hours or more', () => {
  const p = pharmacy(weekly());
  assert.equal(openingStatus(p, at('13:45:00')).timingText, 'Closes in 45 min');
  assert.equal(openingStatus(p, at('13:10:00')).timingText, 'Closes in 1 hr 20 min');
  assert.equal(openingStatus(p, at('13:30:00')).timingText, 'Closes in 1 hr');
  assert.equal(openingStatus(p, at('12:30:00')).timingText, 'Closes at 8:00 PM');
  assert.equal(openingStatus(p, at('14:29:59')).timingText, 'Closes in 1 min');
});
test('closed timing finds same-day, tomorrow, later weekday and next-week opening', () => {
  const p = pharmacy(weekly());
  assert.equal(openingStatus(p, at('01:30:00')).timingText, 'Opens at 8:00 AM');
  assert.equal(openingStatus(p, at('14:30:00')).timingText, 'Opens tomorrow at 8:00 AM');
  const hours = weekly().map(h => ({ ...h, closed: h.day !== 1 }));
  assert.equal(openingStatus(pharmacy(hours), at('01:30:00')).timingText, 'Opens Monday at 8:00 AM');
  hours.forEach(h => { h.closed = h.day !== 6; });
  assert.equal(openingStatus(pharmacy(hours), at('14:30:00')).timingText, 'Opens Saturday at 8:00 AM');
});
test('24-hour, overnight, exact boundaries and contiguous opening periods stay consistent', () => {
  const full = pharmacy(weekly().map(h => ({ ...h, allDay: true })));
  assert.equal(openingStatus(full, at('12:00:00')).open24Hours, true);
  assert.equal(openingStatus(full, at('12:00:00')).timingText, '');
  const overnight = pharmacy(weekly('18:00', '02:00'));
  assert.equal(openingStatus(overnight, at('17:30:00')).timingText, 'Closes at 2:00 AM'); // 23:00
  assert.equal(openingStatus(overnight, at('19:30:00')).timingText, 'Closes in 1 hr'); // Sunday 01:00
  assert.equal(openingStatus(overnight, at('20:30:00')).isOpen, false);
  const p = pharmacy(weekly());
  assert.equal(openingStatus(p, at('02:30:00')).isOpen, true);
  assert.equal(openingStatus(p, at('14:30:00')).isOpen, false);
  const hours = weekly(); hours[6] = { day: 6, closed: false, allDay: true }; hours[0] = { day: 0, closed: false, allDay: false, open: '00:00', close: '02:00' };
  assert.equal(openingStatus(pharmacy(hours), at('17:30:00')).timingText, 'Closes at 2:00 AM');
});
test('missing, malformed, invalid timezone and all-closed schedules fail safely', () => {
  for (const p of [{}, pharmacy([]), pharmacy([null]), { ...pharmacy(weekly()), timezone: 'Invalid' }]) {
    assert.equal(openingStatus(p, at('06:30:00')).isOpen, null);
    assert.equal(openingStatus(p, at('06:30:00')).timingText, '');
  }
  assert.equal(openingStatus({ openingHours: weekly() }, at('06:30:00')).isOpen, true);
  const closed = openingStatus(pharmacy(weekly().map(h => ({ ...h, closed: true }))), at('06:30:00'));
  assert.equal(closed.isOpen, false); assert.equal(closed.timingText, '');
  assert.equal(openingStatus(pharmacy(weekly()), new Date('invalid')).timingText, '');
});
test('explicit timezone overrides device timezone and smart/nearest priorities are unchanged', () => {
  const same = { ...pharmacy(weekly()), timezone: 'UTC' };
  assert.equal(openingStatus(same, at('06:30:00')).timingText, 'Opens at 8:00 AM');
  const base = { ...pharmacy(weekly()), name: 'Test', latitude: 6.9, longitude: 79.8, inventory: [{ name: 'Panadol', quantity: 2 }] };
  const nearClosed = { ...base, _id: 'closed', openingHours: weekly('20:00', '06:00') };
  const farOpen = { ...base, _id: 'open', latitude: 7.1 };
  const out = { ...base, _id: 'out', inventory: [{ name: 'Panadol', quantity: 0 }] };
  const options = { medicine: 'Panadol', lat: 6.9, lng: 79.8, includeOutOfStock: true };
  assert.deepEqual(rankPharmacies([out, nearClosed, farOpen], options, at('06:30:00')).map(p => p._id), ['open', 'closed', 'out']);
  assert.deepEqual(rankPharmacies([out, nearClosed, farOpen], { ...options, sort: 'nearest' }, at('06:30:00')).map(p => p._id), ['closed', 'open', 'out']);
});
