import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { quantityError, holdService, createHoldRunner, holdToast, HOLD_STATUSES } from '../src/utils/holds.js';
const requests = ['pending', 'accepted', 'rejected', 'cancelled'].map((status, i) => ({ _id: String(i), quantity: 2, status, medicineName: 'Panadol', pharmacyName: 'City Pharmacy', customerName: 'Dissa', createdAt: '2026-10-16T00:00:00Z' }));
const buttons = node => !node || typeof node !== 'object' ? [] : node.type === 'button' ? [node] : [node.props?.children].flat(Infinity).flatMap(buttons);
test('quantity validation and exact toast/status wording do not treat pending as reserved', () => {
  for (const value of ['', 'x', '0', '-1', '1.5', 6, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.ok(quantityError(value, 5));
  for (const value of ['1', '2', 5]) assert.equal(quantityError(value, 5), '');
  assert.ok(quantityError(1, 0)); assert.ok(quantityError(1, undefined));
  for (const [action, message] of [['create', 'Hold request sent.'], ['accept', 'Hold request accepted.'], ['reject', 'Hold request rejected.'], ['cancel', 'Hold request cancelled.']]) assert.deepEqual(holdToast(action), { type: 'success', message });
  assert.equal(HOLD_STATUSES.pending, 'Waiting for pharmacy confirmation.'); assert.equal(HOLD_STATUSES.accepted, 'Confirmed by pharmacy.');
});
test('hold service uses authorized paths, correct payload and safe list projection without customer identity', async () => {
  const calls = [];
  const api = { async post(...args) { calls.push(['post', ...args]); return { data: { request: requests[0] } }; }, async patch(...args) { calls.push(['patch', ...args]); return { data: { request: requests[1] } }; }, async get(...args) { calls.push(['get', ...args]); return { data: { success: true, requests: requests.map(item => ({ ...item, email: 'private', customerId: 'private' })), page: 1, hasMore: false } }; } };
  const service = holdService(api, () => 'test-token'); await service.create('pharmacy', 'medicine', 2); await service.action('pharmacy', 'request', 'accept'); await service.action('pharmacy', 'request', 'reject'); await service.action(null, 'request', 'cancel');
  assert.deepEqual(calls[0].slice(0, 3), ['post', '/pharmacies/pharmacy/hold-requests', { medicineId: 'medicine', quantity: 2 }]); assert.equal(calls[0][3].headers.Authorization, 'Bearer test-token');
  assert.equal(calls[1][1], '/pharmacies/pharmacy/hold-requests/request/accept'); assert.equal(calls[2][1], '/pharmacies/pharmacy/hold-requests/request/reject'); assert.equal(calls[3][1], '/users/hold-requests/request/cancel');
  const customer = await service.list(null, 1); assert.doesNotMatch(JSON.stringify(customer), /private|customerName/); await service.list('pharmacy', 1);
  assert.equal(calls[4][1], '/users/hold-requests'); assert.deepEqual(calls[5][2].params, { page: 1 });
  api.get = async () => ({ data: {} }); await assert.rejects(service.list(null, 1), /Invalid/);
});
test('hold runner disables duplicate actions and suppresses response callbacks on unmount', async () => {
  const runner = createHoldRunner(); let resolve, calls = 0, successes = 0, busy = false, failure;
  const action = () => { calls++; return new Promise(done => { resolve = done; }); };
  const callbacks = { busy(value) { busy = value; }, success() { successes++; }, error(value) { failure = value; } };
  const pending = runner.run(action, callbacks); assert.equal(busy, true); await runner.run(action, callbacks); assert.equal(calls, 1); resolve(); await pending; assert.equal(busy, false); assert.equal(successes, 1);
  await runner.run(async () => { throw new Error('Failed'); }, callbacks); assert.match(failure.message, /Failed/); assert.equal(busy, false);
  const aborted = runner.run(action, callbacks); runner.dispose(); resolve(); await aborted; assert.equal(successes, 1);
});
test('available customer medicine shows Request Hold; owner, guest and out-of-stock cannot request', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { default: RequestHold, HoldForm } = await vite.ssrLoadModule('/src/components/RequestHold.jsx');
    const { AuthContext } = await vite.ssrLoadModule('/src/auth/AuthContext.jsx');
    const render = (user, quantity) => renderToString(createElement(AuthContext.Provider, { value: { user } }, createElement(RequestHold, { pharmacyId: 'pharmacy', medicine: { _id: 'medicine', name: 'Panadol', quantity } })));
    assert.match(render({ id: 'customer', role: 'customer' }, 5), /Request Hold/);
    for (const user of [null, { role: 'pharmacy_owner' }]) assert.equal(render(user, 5), '');
    for (const quantity of [0, -1, undefined, '5']) assert.equal(render({ role: 'customer' }, quantity), '');
    let value, submitted = 0; const form = HoldForm({ id: 'quantity', medicineName: 'Panadol', quantity: '2', stock: 5, error: 'Invalid quantity', onChange(event) { value = event.target.value; }, onSubmit() { submitted++; } });
    form.props.children[1].props.onChange({ target: { value: '3' } }); assert.equal(value, '3'); form.props.onSubmit(); assert.equal(submitted, 1);
    const html = renderToString(form); assert.match(html, /Quantity to request for Panadol/); assert.match(html, /aria-describedby="quantity-help quantity-error"/); assert.match(html, /pending until the pharmacy confirms/); assert.doesNotMatch(html, /Medicine reserved/);
    assert.match(renderToString(createElement(HoldForm, { id: 'q', medicineName: 'Panadol', stock: 5, quantity: '2', busy: true })), /Sending/);
    const { default: Card } = await vite.ssrLoadModule('/src/components/MedicineCard.jsx');
    const card = renderToString(createElement(MemoryRouter, {}, createElement(AuthContext.Provider, { value: { user: { role: 'customer' } } }, createElement(Card, { pharmacyId: 'pharmacy', medicine: { _id: 'medicine', name: 'Panadol', quantity: 3 } }))));
    assert.match(card, /Low Stock/); assert.match(card, /Request Hold/);
  } finally { await vite.close(); }
});
test('customer and owner views display all statuses; only pending has appropriate controls, loading/empty/errors stay safe', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { HoldRequestsView } = await vite.ssrLoadModule('/src/components/HoldRequests.jsx');
    const base = { data: { requests, page: 1, hasMore: false } }; const render = props => renderToString(createElement(HoldRequestsView, { ...base, ...props }));
    const customer = render({}); for (const text of ['My Hold Requests', 'Pending', 'Accepted', 'Rejected', 'Cancelled', ...Object.values(HOLD_STATUSES)]) assert.ok(customer.includes(text), text);
    assert.equal((customer.match(/>Cancel Request</g) || []).length, 1); assert.doesNotMatch(customer, />Accept<|>Reject</);
    let performed; const owner = HoldRequestsView({ ...base, owner: true, pharmacyId: 'pharmacy', onAction(id, action) { performed = [id, action]; } });
    buttons(owner).find(button => button.props.children === 'Accept').props.onClick(); assert.deepEqual(performed, ['0', 'accept']); buttons(owner).find(button => button.props.children === 'Reject').props.onClick(); assert.deepEqual(performed, ['0', 'reject']);
    const ownerHtml = renderToString(owner); assert.match(ownerHtml, /Dissa/); assert.match(ownerHtml, /Medicine Hold Requests/); assert.equal((ownerHtml.match(/>Accept</g) || []).length, 1);
    assert.match(render({ owner: true, pharmacyId: 'p', active: { id: '0', action: 'accept' } }), /Accepting/); assert.match(render({ active: { id: '0', action: 'cancel' } }), /Cancelling/);
    assert.match(render({ loading: true }), /Loading hold requests/); assert.doesNotMatch(render({ loading: true }), /No hold requests yet/);
    assert.match(render({ data: { requests: [], page: 1 } }), /No hold requests yet/); assert.match(render({ owner: true, pharmacyId: 'p', data: { requests: [], page: 1 } }), /No medicine hold requests yet/);
    assert.match(render({ owner: true }), /Select or create/); assert.match(render({ error: 'Unavailable' }), /Retry hold requests/);
    const nav = HoldRequestsView({ ...base, data: { ...base.data, hasMore: true }, onPage(page) { performed = page; } }); buttons(nav).find(button => button.props.children === 'Next requests').props.onClick(); assert.equal(performed, 2);
    const source = readFileSync(new URL('../src/components/RequestHold.jsx', import.meta.url), 'utf8'); assert.match(source, /if \(problem\) return/); assert.match(source, /showToast\(holdToast\('create'\)\)/);
    const dashboard = readFileSync(new URL('../src/pages/PharmacyDashboard.jsx', import.meta.url), 'utf8'); for (const text of ['Hold Requests', 'Customer Reviews', 'Opening Hours', 'Medicine Inventory']) assert.ok(dashboard.includes(text));
    assert.match(readFileSync(new URL('../src/pages/Profile.jsx', import.meta.url), 'utf8'), /user.role === 'customer' && <HoldRequests/);
  } finally { await vite.close(); }
});
