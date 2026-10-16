import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { createReviewRunner, emptyReview, reviewDraft, ratingText, reviewsService, reviewToast, validateReview } from '../src/utils/reviews.js';
const own = { _id: 'review-own', rating: 5, comment: 'Good service.', createdAt: '2026-10-16T00:00:00Z' };
const data = { reviews: [{ ...own, authorName: 'Dissa' }, { _id: 'other', rating: 3, comment: '<script>alert(1)</script>', authorName: 'Alex', createdAt: '2026-10-14T00:00:00Z' }], summary: { averageRating: 4, reviewCount: 2 }, page: 1, hasMore: false };
function buttons(node) {
  if (!node || typeof node !== 'object') return [];
  return node.type === 'button' ? [node] : [node.props?.children].flat(Infinity).flatMap(buttons);
}
test('rating summary uses one decimal and zero-review state has no NaN', () => {
  assert.equal(ratingText(data.summary), '4.0 out of 5 (2 reviews)');
  assert.equal(ratingText({ averageRating: 4.25, reviewCount: 4 }), '4.3 out of 5 (4 reviews)');
  assert.equal(ratingText({ averageRating: 0, reviewCount: 0 }), 'No reviews yet.');
});
test('review validation blocks missing/noninteger/out-of-range rating and long comments', () => {
  for (const rating of [0, 6, 2.5, '5', undefined]) assert.ok(validateReview({ rating, comment: '' }).rating);
  assert.ok(validateReview({ rating: 5, comment: 'x'.repeat(501) }).comment);
  assert.deepEqual(validateReview({ rating: 1, comment: '' }), {});
  assert.deepEqual(emptyReview(), { rating: 0, comment: '' }); assert.deepEqual(reviewDraft(own), { rating: 5, comment: 'Good service.' });
});
test('service sends only rating/comment, derives resource paths and preserves API failures', async () => {
  const calls = [];
  const api = Object.fromEntries(['get', 'post', 'patch', 'delete'].map(method => [method, async (...args) => { calls.push([method, ...args]); return { data: { review: own } }; }]));
  const service = reviewsService(api, 'pharmacy', () => 'test-token');
  const values = { rating: 5, comment: ' Good service. ', customerId: 'spoofed', pharmacy: 'spoofed' };
  await service.save(null, values); await service.save('review-own', values); await service.remove('review-own'); await service.list(2); await service.mine();
  assert.deepEqual(calls[0].slice(0, 3), ['post', '/pharmacies/pharmacy/reviews', { rating: 5, comment: 'Good service.' }]);
  assert.equal(calls[1][1], '/pharmacies/pharmacy/reviews/review-own'); assert.equal(calls[2][0], 'delete');
  assert.equal(calls[0][3].headers.Authorization, 'Bearer test-token');
  assert.deepEqual(calls[3][2].params, { page: 2 }); assert.equal(calls[4][1], '/pharmacies/pharmacy/reviews/mine');
  api.post = async () => { throw new Error('Network failure'); }; await assert.rejects(service.save(null, values), /Network failure/);
});
test('mutation runner blocks double submission, restores busy state and suppresses unmounted callbacks', async () => {
  const runner = createReviewRunner(); let resolve, requests = 0, successes = 0, busy = false, failure;
  const action = () => { requests++; return new Promise(done => { resolve = done; }); };
  const callbacks = { busy(value) { busy = value; }, success() { successes++; }, error(error) { failure = error; } };
  const pending = runner.run(action, callbacks); assert.equal(busy, true);
  await runner.run(action, callbacks); assert.equal(requests, 1); resolve(own); await pending; assert.equal(successes, 1); assert.equal(busy, false);
  await runner.run(async () => { throw new Error('Save failed'); }, callbacks); assert.match(failure.message, /Save failed/); assert.equal(busy, false);
  const unmounted = runner.run(action, callbacks); runner.dispose(); resolve(own); await unmounted; assert.equal(successes, 1);
});
test('create, edit and delete use the existing exact success toast messages', () => {
  for (const [action, message] of [['create', 'Review submitted.'], ['edit', 'Review updated.'], ['delete', 'Review deleted.']]) assert.deepEqual(reviewToast(action), { type: 'success', message });
});
test('controlled review form supports native radio selection, comment changes, validation, loading and cancel', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { ReviewForm } = await vite.ssrLoadModule('/src/components/PharmacyReviews.jsx');
    let values = emptyReview(), submissions = 0, cancels = 0;
    const props = { values, errors: { rating: 'Choose a rating from 1 to 5.' }, onChange(field, value) { values = { ...values, [field]: value }; }, onSubmit() { submissions++; }, onCancel() { cancels++; } };
    const form = ReviewForm(props);
    const labels = form.props.children[0].props.children[1].props.children;
    labels[4].props.children[0].props.onChange(); assert.equal(values.rating, 5);
    form.props.children[3].props.onChange({ target: { value: 'Helpful staff' } }); assert.equal(values.comment, 'Helpful staff');
    form.props.onSubmit(); assert.equal(submissions, 1);
    const html = renderToString(form); assert.equal((html.match(/type="radio"/g) || []).length, 5); assert.match(html, /1 star/); assert.match(html, /5 stars/);
    assert.match(html, /role="alert"/); assert.match(html, /maxLength="500"/); assert.match(html, /personal medical information/);
    const editing = ReviewForm({ ...props, values: reviewDraft(own), editing: true });
    assert.match(renderToString(editing), /Good service\./); buttons(editing).find(button => button.props.children === 'Cancel').props.onClick(); assert.equal(cancels, 1);
    const busy = renderToString(createElement(ReviewForm, { ...props, busy: true, editing: true }));
    assert.match(busy, /aria-busy="true"/); assert.match(busy, /Saving Review/); assert.match(busy, /disabled/);
  } finally { await vite.close(); }
});
test('reviews view renders list, own controls, edit/delete states, safe empty/loading/errors and owner read-only view', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { ReviewsView } = await vite.ssrLoadModule('/src/components/PharmacyReviews.jsx');
    const base = { data, own: null, customer: true, values: emptyReview(), errors: {} };
    const render = props => renderToString(createElement(ReviewsView, { ...base, ...props }));
    const create = render({}); assert.match(create, /Submit Review/); assert.match(create, /Dissa/); assert.match(create, /Alex/); assert.match(create, /Oct 16, 2026/);
    assert.match(create, /&lt;script&gt;/); assert.doesNotMatch(create, /<script>/);
    const existing = render({ own }); assert.match(existing, /Edit Review/); assert.match(existing, /Delete Review/); assert.doesNotMatch(existing, /Submit Review/);
    assert.equal((existing.match(/>Edit Review</g) || []).length, 1);
    assert.match(render({ own, editing: true, values: reviewDraft(own) }), /Save Changes/);
    let requests = 0, confirming = true;
    const confirmed = ReviewsView({ ...base, own, confirming, onDeleteConfirm() { requests++; }, onDeleteCancel() { confirming = false; } });
    buttons(confirmed).find(button => button.props.children === 'Cancel').props.onClick(); assert.equal(confirming, false); assert.equal(requests, 0);
    buttons(confirmed).find(button => button.props.children === 'Delete').props.onClick(); assert.equal(requests, 1);
    const owner = render({ customer: false }); assert.doesNotMatch(owner, /Submit Review|Edit Review|Delete Review|Be the first/);
    assert.match(owner, /Dissa/); assert.match(render({ loading: true }), /Loading reviews/); assert.doesNotMatch(render({ loading: true }), /Submit Review/);
    assert.match(render({ error: 'Unable to load reviews.' }), /Retry reviews/);
    const empty = render({ data: { ...data, reviews: [], summary: { averageRating: 0, reviewCount: 0 } } }); assert.match(empty, /No reviews yet/); assert.match(empty, /Be the first/); assert.doesNotMatch(empty, /NaN|undefined/);
    assert.match(render({ data: { ...data, hasMore: true } }), /Next reviews/);
    const { PharmacyDetailsView } = await vite.ssrLoadModule('/src/pages/PharmacyDetails.jsx');
    const pharmacy = { _id: '507f1f77bcf86cd799439011', name: 'City', phone: '0771234567', address: 'Main Street', latitude: 6.9, longitude: 79.8, medicines: [] };
    const details = renderToString(createElement(MemoryRouter, {}, createElement(PharmacyDetailsView, { pharmacy })));
    for (const text of ['Customer Reviews', 'Call Pharmacy', 'WhatsApp Pharmacy', 'Directions', 'Save Pharmacy', 'Share City', 'Copy Address']) assert.ok(details.includes(text), text);
    const source = readFileSync(new URL('../src/components/PharmacyReviews.jsx', import.meta.url), 'utf8');
    assert.match(source, /if \(!Object.keys\(next\).length\) perform/); assert.match(source, /setValues\(reviewDraft\(own\)\)/); assert.match(source, /onCancel=\{reset\}/); assert.match(source, /showToast\(reviewToast\(action\)\)/);
  } finally { await vite.close(); }
});
