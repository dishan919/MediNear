import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { parseOwnerReviews, ratingPercentage, loadOwnerReviews } from '../src/utils/ownerReviews.js';
const fixture = () => ({ success: true, summary: { averageRating: 4, reviewCount: 2 }, breakdown: { 1: 0, 2: 0, 3: 1, 4: 0, 5: 1 }, reviews: [{ _id: 'recent', rating: 3, comment: 'Service was slow.', authorName: 'Alex', createdAt: '2026-10-16T00:00:00Z' }, { _id: 'older', rating: 5, comment: 'Good service.', authorName: 'Dissa', createdAt: '2026-10-14T00:00:00Z' }], page: 1, hasMore: false });
const buttons = node => !node || typeof node !== 'object' ? [] : node.type === 'button' ? [node] : [node.props?.children].flat(Infinity).flatMap(buttons);
test('owner response parsing keeps only public review fields and preserves backend order', () => {
  const input = fixture(); input.reviews[0].email = 'private@example.test'; input.reviews[0].customer = 'private-user';
  const data = parseOwnerReviews(input); assert.deepEqual(data.reviews.map(r => r._id), ['recent', 'older']); assert.doesNotMatch(JSON.stringify(data), /private/);
  for (const broken of [null, {}, { ...fixture(), summary: { averageRating: NaN, reviewCount: 2 } }, { ...fixture(), breakdown: { 1: -1 } }, { ...fixture(), summary: { averageRating: Infinity, reviewCount: 2 } }, { ...fixture(), reviews: [{}] }, { ...fixture(), page: 0 }, { ...fixture(), hasMore: 'true' }]) assert.throws(() => parseOwnerReviews(broken));
  assert.equal(ratingPercentage(1, 2), 50); assert.equal(ratingPercentage(0, 0), 0);
});
test('owner service uses one authenticated paginated GET and supports abort/errors/malformed response', async () => {
  const controller = new AbortController(); let calls = 0;
  const api = { async get(path, config) { calls++; assert.equal(path, '/pharmacies/own/reviews/owner-dashboard'); assert.equal(config.params.page, 2); assert.equal(config.signal, controller.signal); assert.equal(config.headers.Authorization, 'Bearer test-token'); return { data: { ...fixture(), page: 2 } }; } };
  assert.equal((await loadOwnerReviews(api, 'own', 2, controller.signal, 'test-token')).page, 2); assert.equal(calls, 1);
  api.get = async () => ({ data: {} }); await assert.rejects(loadOwnerReviews(api, 'own', 1, null, 'token'), /Invalid/);
  api.get = async () => { throw new Error('Network failure'); }; await assert.rejects(loadOwnerReviews(api, 'own', 1, null, 'token'), /Network/);
});
test('owner summary, rating breakdown, accessible meters and read-only reviews render safely', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { OwnerReviewsView } = await vite.ssrLoadModule('/src/components/OwnerReviews.jsx');
    const props = { pharmacyId: 'own', data: parseOwnerReviews(fixture()) };
    const html = renderToString(createElement(OwnerReviewsView, props));
    for (const text of ['Average Rating', '4.0', 'Total Reviews', '>2<', 'Rating Breakdown', 'Recent Reviews', 'Alex', 'Dissa', 'Oct 16, 2026']) assert.ok(html.includes(text), text);
    assert.equal((html.match(/role="meter"/g) || []).length, 5); assert.match(html, /5 stars: 1 review \(50%\)/); assert.match(html, /width:50%/); assert.match(html, /aria-valuenow="50"/); assert.match(html, /3 out of 5 stars/);
    assert.ok(html.indexOf('Alex') < html.indexOf('Dissa')); assert.doesNotMatch(html, /Edit Review|Delete Review|Submit Review|<form|private/);
    const empty = { ...fixture(), summary: { averageRating: 0, reviewCount: 0 }, breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, reviews: [] };
    const zero = renderToString(createElement(OwnerReviewsView, { ...props, data: parseOwnerReviews(empty) }));
    assert.match(zero, /No ratings yet/); assert.match(zero, /No customer reviews yet/); assert.doesNotMatch(zero, /NaN|Infinity|undefined/); assert.match(zero, /width:0%/);
    const loading = renderToString(createElement(OwnerReviewsView, { ...props, loading: true })); assert.match(loading, /Loading reviews/); assert.doesNotMatch(loading, /Total Reviews/);
    const noPharmacy = renderToString(createElement(OwnerReviewsView, {})); assert.match(noPharmacy, /Select or create a pharmacy/); assert.doesNotMatch(noPharmacy, /Total Reviews/);
    let retries = 0; const error = OwnerReviewsView({ ...props, error: 'Unavailable', onRetry() { retries++; } }); buttons(error)[0].props.onClick(); assert.equal(retries, 1); assert.match(renderToString(error), /role="alert"/);
    let page; const navigation = OwnerReviewsView({ ...props, data: { ...props.data, hasMore: true }, onPage(value) { page = value; } });
    const next = buttons(navigation).find(button => button.props.children === 'Next reviews'); next.props.onClick(); assert.equal(page, 2); assert.equal(buttons(navigation)[0].props.disabled, true);
    const previous = OwnerReviewsView({ ...props, data: { ...props.data, page: 2 }, onPage(value) { page = value; } }); buttons(previous)[0].props.onClick(); assert.equal(page, 1);
  } finally { await vite.close(); }
});
test('owner dashboard mounts reviews for selected pharmacy and guards nonexistent pharmacy requests', () => {
  const source = readFileSync(new URL('../src/pages/PharmacyDashboard.jsx', import.meta.url), 'utf8');
  assert.match(source, /\['reviews', 'Customer Reviews'\]/); assert.match(source, /tab === 'reviews' && <OwnerReviews pharmacyId=\{current._id\}/);
  for (const existing of ['Medicine Inventory', 'Pharmacy Profile', 'Opening Hours', 'MedicineEditor', 'InventoryTable']) assert.ok(source.includes(existing));
  const component = readFileSync(new URL('../src/components/OwnerReviews.jsx', import.meta.url), 'utf8'); assert.match(component, /if \(!pharmacyId\) return/); assert.match(component, /controller.abort\(\)/); assert.match(component, /!controller.signal.aborted/); assert.match(component, /key=\{pharmacyId/);
  const css = readFileSync(new URL('../src/styles/OwnerReviews.css', import.meta.url), 'utf8'); assert.match(css, /@media\(max-width: 600px\)/); assert.match(css, /minmax\(0, 1fr\)/);
});
