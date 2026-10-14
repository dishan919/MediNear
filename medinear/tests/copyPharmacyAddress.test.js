import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { displayedPharmacyAddress, copyPharmacyAddress } from '../src/utils/copyPharmacyAddress.js';
import { copyText, copyPharmacyLink } from '../src/utils/sharePharmacy.js';
test('address copy uses exactly displayed street/district text and no unrelated pharmacy data', async () => {
  const pharmacy = { address: '123 Main Street', district: 'Colombo', _id: 'private-id', latitude: 6.9, longitude: 79.8, token: 'private-token' };
  const address = displayedPharmacyAddress(pharmacy); assert.equal(address, '123 Main Street, Colombo');
  let copied;
  const result = await copyPharmacyAddress(address, { navigator: { clipboard: { writeText: async text => { copied = text; } } } });
  assert.equal(copied, address); assert.deepEqual(result, { status: 'copied', message: 'Address copied.' });
  assert.doesNotMatch(copied, /private|lat|lng|http|6\.9|79\.8/);
  assert.equal(displayedPharmacyAddress({ address: '123 Main Street' }), '123 Main Street');
});
test('missing/placeholder addresses do not reach clipboard', async () => {
  for (const address of [undefined, null, '', '   ', 'undefined', 'null', 'Address unavailable', 'Not added', 'N/A']) assert.equal(displayedPharmacyAddress({ address, district: 'Colombo' }), '');
  const result = await copyPharmacyAddress('', { navigator: { clipboard: { writeText() { assert.fail('No invalid copy'); } } } });
  assert.equal(result.status, 'error');
});
test('address reuses the exact Share clipboard implementation and legacy fallback', async () => {
  assert.equal(copyText, copyPharmacyLink);
  let copied, removed = false;
  const area = { style: {}, select() {}, remove() { removed = true; } };
  const document = { body: { appendChild() {} }, createElement: () => area, execCommand(command) { assert.equal(command, 'copy'); copied = area.value; return true; } };
  assert.equal((await copyPharmacyAddress('123 Main Street, Colombo', { navigator: {}, document })).status, 'copied');
  assert.equal(copied, '123 Main Street, Colombo'); assert.equal(removed, true);
});
test('clipboard failures produce useful non-blocking feedback', async () => {
  const result = await copyPharmacyAddress('123 Main Street', { navigator: { clipboard: { writeText: async () => { throw new Error('Denied'); } } }, document: {} });
  assert.equal(result.status, 'error'); assert.match(result.message, /Unable to copy the address/);
});
test('Copy Address is semantic/keyboard accessible, success renders and details actions remain', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { CopyAddressControl, default: Button } = await vite.ssrLoadModule('/src/components/CopyAddressButton.jsx');
    assert.equal(renderToString(createElement(Button, { address: '' })), '');
    const html = renderToString(createElement(CopyAddressControl, { address: '123 Main Street', result: { status: 'copied', message: 'Address copied.' } }));
    assert.match(html, /type="button"/); assert.match(html, /aria-label="Copy pharmacy address"/); assert.match(html, /role="status"/); assert.match(html, /Address copied\./);
    let copied = 0; const view = CopyAddressControl({ address: '123 Main Street', onCopy: () => { copied++; } }); view.props.children[0].props.onClick(); assert.equal(copied, 1);
    const busy = renderToString(createElement(CopyAddressControl, { address: '123 Main Street', busy: true })); assert.match(busy, /disabled/); assert.match(busy, /Copying/);
    const { PharmacyDetailsView } = await vite.ssrLoadModule('/src/pages/PharmacyDetails.jsx');
    const pharmacy = { _id: '507f1f77bcf86cd799439011', name: 'City', address: '123 Main Street', district: 'Colombo', phone: '0111234567', latitude: 6.9, longitude: 79.8, medicines: [] };
    const render = data => renderToString(createElement(MemoryRouter, {}, createElement(PharmacyDetailsView, { pharmacy: data })));
    const details = render(pharmacy);
    for (const value of ['Copy Address', '123 Main Street', 'Share City', 'Directions', 'Call Pharmacy', 'Save Pharmacy', 'google.com/maps/search/']) assert.ok(details.includes(value), value);
    assert.doesNotMatch(render({ ...pharmacy, address: undefined }), /Copy Address/);
  } finally { await vite.close(); }
});
