import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { getMedicineExpiryStatus, filterByExpiry, expirySummary, expiryDateKey, expiryCutoffDate } from '../../shared/medicineExpiry.mjs';
import { getStockStatus } from '../src/utils/stockStatus.js';
const now = new Date('2026-10-16T12:00:00Z');
const fixtures = [{ _id: 'soon', name: 'Soon', quantity: 3, expiryDate: '2026-10-25' }, { _id: 'expired', name: 'Expired', quantity: 10, expiryDate: '2026-10-10' }, { _id: 'valid', name: 'Valid', quantity: 20, expiryDate: '2027-12-15' }, { _id: 'legacy', name: 'Legacy', quantity: 4 }];
test('owner expiry filtering and summary share the backend policy, independent of physical Low Stock', () => {
  assert.deepEqual(expirySummary(fixtures, now), { 'expiring-soon': 1, expired: 1 });
  assert.deepEqual(filterByExpiry(fixtures, 'expired', now).map(m => m._id), ['expired']); assert.deepEqual(filterByExpiry(fixtures, 'expiring-soon', now).map(m => m._id), ['soon']); assert.equal(filterByExpiry(fixtures, 'all', now).length, 4);
  assert.equal(getStockStatus(fixtures[0].quantity).label, 'Low Stock'); assert.equal(getMedicineExpiryStatus(fixtures[0].expiryDate, now).label, 'Expiring Soon');
});
test('owner date field is optional, labelled and supports changing/clearing; existing edit value is loaded', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { MedicineExpiryField } = await vite.ssrLoadModule('/src/components/MedicineExpiry.jsx');
    let value; const field = MedicineExpiryField({ value: '2026-10-25', onChange(next) { value = next; } });
    field.props.children[1].props.onChange({ target: { value: '2027-01-01' } }); assert.equal(value, '2027-01-01'); field.props.children[1].props.onChange({ target: { value: '' } }); assert.equal(value, '');
    const html = renderToString(field); assert.match(html, /Expiry Date \(optional\)/); assert.match(html, /type="date"/); assert.doesNotMatch(html, /required/);
    const { default: Editor } = await vite.ssrLoadModule('/src/components/MedicineEditor.jsx');
    const edit = renderToString(createElement(Editor, { medicine: { name: 'Panadol', quantity: 3, price: 120, expiryDate: '2026-10-25T00:00:00.000Z' } })); assert.match(edit, /value="2026-10-25"/); assert.match(edit, /Low Stock/); assert.match(edit, /Save Changes/);
    assert.equal(expiryDateKey('2026-10-25T00:00:00.000Z'), '2026-10-25');
    const source = readFileSync(new URL('../src/components/MedicineEditor.jsx', import.meta.url), 'utf8'); assert.match(source, /expiryDate: draft.expiryDate \|\| null/);
  } finally { await vite.close(); }
});
test('expiry labels/date display and owner table keep all inventory while customers never see expired availability', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { MedicineExpiryView } = await vite.ssrLoadModule('/src/components/MedicineExpiry.jsx');
    for (const [expiryDate, label] of [[undefined, 'Expiry not set'], ['2026-10-25', 'Expiring Soon'], ['2026-10-10', 'Expired'], ['2027-12-15', 'Valid']]) assert.ok(renderToString(createElement(MedicineExpiryView, { expiryDate, now })).includes(label));
    assert.match(renderToString(createElement(MedicineExpiryView, { expiryDate: '2026-10-25', now })), /25 Oct 2026/);
    const { default: Table } = await vite.ssrLoadModule('/src/components/InventoryTable.jsx'); const table = renderToString(createElement(Table, { medicines: fixtures })); assert.match(table, /data-label="Expiry"/); assert.match(table, /Expiry not set/); assert.match(table, /Low Stock/); assert.match(table, /Expired/);
    const { default: Card } = await vite.ssrLoadModule('/src/components/MedicineCard.jsx'); const { AuthContext } = await vite.ssrLoadModule('/src/auth/AuthContext.jsx');
    const render = medicine => renderToString(createElement(MemoryRouter, {}, createElement(AuthContext.Provider, { value: { user: { role: 'customer' } } }, createElement(Card, { pharmacyId: 'pharmacy', medicine }))));
    const expired = render({ _id: 'expired', name: 'Expired', quantity: 10, expiryDate: '2000-01-01T00:00:00.000Z' }); assert.match(expired, /Expired/); assert.match(expired, /Unavailable/); assert.doesNotMatch(expired, />Available<|10 units|Request Hold|Notify Me/);
    const soonDate = new Date(expiryCutoffDate().getTime() + 7 * 86400000).toISOString(); const soon = render({ _id: 'soon', name: 'Soon', quantity: 3, expiryDate: soonDate }); assert.match(soon, /Expiring Soon/); assert.match(soon, /Low Stock/); assert.match(soon, /Request Hold/);
    assert.match(render({ _id: 'old', name: 'Legacy', quantity: 3 }), /Request Hold/);
  } finally { await vite.close(); }
});
test('owner dashboard uses a labelled expiry filter/summary without changing existing tab or empty/loading structure', () => {
  const source = readFileSync(new URL('../src/pages/PharmacyDashboard.jsx', import.meta.url), 'utf8'); assert.match(source, /Expiry filter/); assert.match(source, /setExpiryFilter\(event.target.value\)/); assert.match(source, /filterByExpiry\(filterMedicines/); assert.match(source, /expirySummary\(current\?\.inventory/);
  for (const text of ['Expiring Soon', 'Expired', 'Loading your workspace', 'No matching medicines', 'Hold Requests', 'Customer Reviews', 'Opening Hours']) assert.ok(source.includes(text));
  assert.match(readFileSync(new URL('../src/styles/MedicineExpiry.css', import.meta.url), 'utf8'), /@media\(max-width: 680px\)/);
});
