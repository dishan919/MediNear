import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { renderToString } from 'react-dom/server';
import { createToastStore, TOAST_DURATION, MAX_TOASTS } from '../src/utils/toastStore.js';
function harness() {
  let items = [], counter = 0, updates = 0;
  const timers = new Map();
  const clock = { setTimeout(fn, duration) { assert.equal(duration, TOAST_DURATION); timers.set(++counter, fn); return counter; }, clearTimeout(id) { timers.delete(id); } };
  const store = createToastStore(value => { items = value; updates++; }, clock);
  return { store, timers, get items() { return items; }, get updates() { return updates; } };
}
test('auto-dismiss removes notification and timer', () => {
  const h = harness(); h.store.showToast({ message: 'Saved', type: 'success' });
  assert.equal(h.items.length, 1); [...h.timers.values()][0]();
  assert.equal(h.items.length, 0); assert.equal(h.timers.size, 0);
});
test('manual dismiss clears timer and duplicate callbacks are harmless', () => {
  const h = harness(); const id = h.store.showToast({ message: 'Saved' }); const callback = [...h.timers.values()][0];
  h.store.dismiss(id); const updates = h.updates; callback(); h.store.dismiss(id);
  assert.equal(h.items.length, 0); assert.equal(h.timers.size, 0); assert.equal(h.updates, updates);
});
test('rapid actions cap stack and timers; unmount cleanup clears all without notifying React', () => {
  const h = harness(); for (let i = 0; i < 20; i++) h.store.showToast({ message: `${i}` });
  assert.equal(h.items.length, MAX_TOASTS); assert.equal(h.timers.size, MAX_TOASTS);
  const callbacks = [...h.timers.values()], updates = h.updates;
  h.store.clear(); callbacks.forEach(fn => fn());
  assert.equal(h.timers.size, 0); assert.equal(h.updates, updates);
  h.store.showToast({ message: 'StrictMode remount' }); assert.equal(h.items.length, 1);
});
test('success, error and info render polite live regions, icons and keyboard dismiss controls', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { ToastContainer } = await vite.ssrLoadModule('/src/components/ToastProvider.jsx');
    let dismissed;
    for (const type of ['success', 'error', 'info']) {
      const view = ToastContainer({ toasts: [{ id: 1, message: 'Action complete', type }], onDismiss: id => { dismissed = id; } });
      const html = renderToString(view);
      assert.match(html, /role="status"/); assert.match(html, /aria-live="polite"/); assert.match(html, /aria-atomic="true"/);
      assert.match(html, /Dismiss notification/); assert.match(html, new RegExp(type + ': '));
      view.props.children[0].props.children[1].props.onClick(); assert.equal(dismissed, 1);
    }
  } finally { await vite.close(); }
});

import { copyAddressFeedback, shareFeedback, favoriteFeedback, photoFeedback } from '../src/utils/toastFeedback.js';
import { copyPharmacyAddress } from '../src/utils/copyPharmacyAddress.js';
import { sharePharmacy } from '../src/utils/sharePharmacy.js';
import { readFileSync } from 'node:fs';
test('copy action results select success and useful failure toasts', async () => {
  const copied = await copyPharmacyAddress('Main Street', { navigator: { clipboard: { writeText: async () => {} } } });
  assert.deepEqual(copyAddressFeedback(copied), { message: 'Address copied.', type: 'success' });
  const failed = await copyPharmacyAddress('Main Street', { navigator: {}, document: {} });
  assert.deepEqual(copyAddressFeedback(failed), { message: 'Could not copy address.', type: 'error' });
});
test('share clipboard fallback toasts and native cancellation remains quiet', async () => {
  const pharmacy = { _id: '507f1f77bcf86cd799439011', name: 'Test' }, origin = 'https://example.test';
  const copied = await sharePharmacy(pharmacy, { origin, navigator: { clipboard: { writeText: async () => {} } } });
  assert.equal(shareFeedback(copied).message, 'Pharmacy link copied.');
  const cancelled = await sharePharmacy(pharmacy, { origin, navigator: { share: async () => { throw Object.assign(new Error(), { name: 'AbortError' }); } } });
  assert.equal(shareFeedback(cancelled), null); assert.equal(shareFeedback({ status: 'shared' }), null);
  const failed = await sharePharmacy(pharmacy, { origin, navigator: {}, document: {} });
  assert.ok(failed.url); assert.match(failed.message, /copy/); assert.equal(shareFeedback(failed), null);
});
test('favorite add/remove and photo update/remove feedback', () => {
  assert.equal(favoriteFeedback(true).message, 'Pharmacy saved.'); assert.equal(favoriteFeedback(false).message, 'Pharmacy removed.');
  assert.equal(photoFeedback().message, 'Profile photo updated.'); assert.equal(photoFeedback(true).message, 'Profile photo removed.');
});
test('action wiring preserves persistent API errors, validation and provider cleanup', () => {
  const source = name => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  assert.match(source('components/CopyAddressButton.jsx'), /showToast\(copyAddressFeedback\(response\)\)/);
  assert.match(source('components/SharePharmacyButton.jsx'), /shareFeedback\(response\)/);
  assert.match(source('components/FavoriteButton.jsx'), /showToast\(favoriteFeedback\(result.saved\)\)/);
  assert.match(source('components/FavoriteButton.jsx'), /role="alert"/);
  assert.match(source('components/ProfilePhoto.jsx'), /showToast\(photoFeedback\(\)\)/);
  assert.match(source('components/ProfilePhoto.jsx'), /showToast\(photoFeedback\(true\)\)/);
  assert.match(source('components/ProfilePhoto.jsx'), /role="alert"/);
  assert.match(source('pages/Profile.jsx'), /Name is required\./);
  assert.match(source('pages/Profile.jsx'), /role="alert"/);
  assert.match(source('components/ToastProvider.jsx'), /useEffect\(\(\) => \(\) => store.clear\(\), \[store\]\)/);
});
