import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { buildPharmacyShareUrl, sharePharmacy, copyPharmacyLink } from '../src/utils/sharePharmacy.js';
const pharmacy = { _id: '507f1f77bcf86cd799439011', name: 'City Pharmacy', latitude: 6.9, longitude: 79.8, inventory: ['private'], token: 'private-token', customer: 'private-user' };
const url = 'https://medinear.test/pharmacy/' + pharmacy._id;
test('canonical share URL uses current origin and existing route without query/hash/private fields', () => {
  assert.equal(buildPharmacyShareUrl(pharmacy._id, 'https://medinear.test'), url);
  assert.equal(buildPharmacyShareUrl(pharmacy._id, 'http://localhost:5173'), `http://localhost:5173/pharmacy/${pharmacy._id}`);
  assert.equal(buildPharmacyShareUrl(pharmacy._id, 'https://medinear.test/?lat=6.9&lng=79.8#private'), url);
  assert.throws(() => buildPharmacyShareUrl('../secret', 'https://medinear.test'));
});
test('native Web Share receives only pharmacy name, title, text and canonical URL', async () => {
  let payload;
  const result = await sharePharmacy(pharmacy, { origin: 'https://medinear.test', navigator: { share: async data => { payload = data; }, clipboard: { writeText() { assert.fail('Native sharing must not copy separately'); } } } });
  assert.deepEqual(payload, { title: 'City Pharmacy - MediNear', text: 'View City Pharmacy on MediNear.', url });
  assert.equal(result.status, 'shared');
  assert.doesNotMatch(JSON.stringify(payload), /private-token|private-user|latitude|longitude|inventory|lat=|lng=/);
});
test('native cancellation produces no error or fallback, while real share failure offers retry', async () => {
  const environment = { origin: 'https://medinear.test', navigator: { share: async () => { throw Object.assign(new Error('Cancelled'), { name: 'AbortError' }); }, clipboard: { writeText() { assert.fail('Cancellation should not copy'); } } } };
  assert.deepEqual(await sharePharmacy(pharmacy, environment), { status: 'cancelled', message: '' });
  environment.navigator.share = async () => { throw new Error('Share failed'); };
  const failed = await sharePharmacy(pharmacy, environment);
  assert.equal(failed.status, 'error'); assert.equal(failed.message, 'Unable to share this pharmacy. Please try again.');
});
test('unsupported native sharing copies exact URL and returns inline success feedback', async () => {
  let copied;
  const result = await sharePharmacy(pharmacy, { origin: 'https://medinear.test', navigator: { clipboard: { writeText: async text => { copied = text; } } } });
  assert.equal(copied, url); assert.equal(result.status, 'copied'); assert.equal(result.message, 'Pharmacy link copied.');
});
test('legacy copy fallback handles clipboard failure and cleans up/focuses the original control', async () => {
  let removed = false, focused = false, selected = false, copied;
  const textarea = { style: {}, select() { selected = true; }, remove() { removed = true; } };
  const document = { body: { appendChild() {} }, createElement: () => textarea, activeElement: { focus() { focused = true; } }, execCommand(command) { assert.equal(command, 'copy'); copied = textarea.value; return true; } };
  const navigator = { clipboard: { writeText: async () => { throw new Error('Permission denied'); } } };
  assert.equal(await copyPharmacyLink(url, navigator, document), true);
  assert.equal(copied, url); assert.equal(selected, true); assert.equal(removed, true); assert.equal(focused, true);
});
test('all clipboard failures return a useful message and clean manual URL without crashing', async () => {
  const result = await sharePharmacy(pharmacy, { origin: 'https://medinear.test', navigator: { clipboard: { writeText: async () => { throw new Error('Denied'); } } }, document: {} });
  assert.equal(result.status, 'error'); assert.equal(result.message, 'Unable to copy the pharmacy link. Please copy it from the address bar.'); assert.equal(result.url, url);
});
test('Share renders semantic keyboard button with inline feedback and existing details actions remain', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { default: ShareButton, ShareFeedback } = await vite.ssrLoadModule('/src/components/SharePharmacyButton.jsx');
    const button = renderToString(createElement(ShareButton, { pharmacy }));
    assert.match(button, /type="button"/); assert.match(button, /aria-label="Share City Pharmacy"/); assert.match(button, />Share<\/button>/);
    assert.equal(renderToString(createElement(ShareFeedback, { result: { status: 'cancelled', message: '' } })), '');
    assert.match(renderToString(createElement(ShareFeedback, { result: { status: 'copied', message: 'Pharmacy link copied.' } })), /role="status"/);
    const failed = renderToString(createElement(ShareFeedback, { inputId: 'link', result: { status: 'error', message: 'Unable to copy', url } }));
    assert.match(failed, /role="alert"/); assert.match(failed, /readonly/i); assert.match(failed, /for="link"/);
    const { PharmacyDetailsView } = await vite.ssrLoadModule('/src/pages/PharmacyDetails.jsx');
    const details = renderToString(createElement(MemoryRouter, {}, createElement(PharmacyDetailsView, { pharmacy: { ...pharmacy, address: 'Colombo', phone: '0111234567', medicines: [] } })));
    for (const text of ['Share City Pharmacy', 'Save Pharmacy', 'Directions', 'Call Pharmacy', 'tel:0111234567', 'Available Medicines', 'google.com/maps/search/']) assert.ok(details.includes(text), text);
  } finally { await vite.close(); }
});

