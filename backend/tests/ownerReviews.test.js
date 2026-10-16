const test = require('node:test');
const assert = require('node:assert/strict');
const Pharmacy = require('../models/Pharmacy');
const Review = require('../models/Review');
const { ownerReviews } = require('../controllers/ownerReviewController');
const { reviewPage } = require('../services/reviewPage');
const res = () => ({ code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } });
const id = '507f1f77bcf86cd799439011';
test('owner lookup uses authenticated identity and rejects invalid/non-owned/deleted pharmacies', async t => {
  t.mock.method(Pharmacy, 'findOne', filter => { assert.deepEqual(filter, { _id: id, owner: 'authenticated-owner' }); return { select: async () => null }; });
  const request = { params: { id }, query: {}, user: { _id: 'authenticated-owner' }, body: { owner: 'spoofed' } };
  const denied = res(); await ownerReviews(request, denied); assert.equal(denied.code, 404);
  const invalid = res(); await ownerReviews({ ...request, params: { id: 'bad' } }, invalid); assert.equal(invalid.code, 400);
  const page = res(); await ownerReviews({ ...request, query: { page: -1 } }, page); assert.equal(page.code, 400);
});
test('shared review aggregation returns same summary, bounded sorted safe reviews and full distribution', async t => {
  t.mock.method(Review, 'aggregate', async pipeline => {
    const facets = pipeline[1].$facet; assert.ok(facets.breakdown); assert.deepEqual(facets.reviews[0], { $sort: { createdAt: -1, _id: -1 } }); assert.deepEqual(facets.reviews[2], { $limit: 10 });
    assert.equal(facets.reviews.at(-1).$project.customer, undefined);
    return [{ summary: [{ averageRating: 4, reviewCount: 2 }], breakdown: [{ _id: 5, count: 1 }, { _id: 3, count: 1 }], reviews: [] }];
  });
  const result = await reviewPage(id, 1, true); assert.deepEqual(result.summary, { averageRating: 4, reviewCount: 2 }); assert.deepEqual(result.breakdown, { 1: 0, 2: 0, 3: 1, 4: 0, 5: 1 });
  Review.aggregate.mock.mockImplementation(async () => [{ reviews: [], summary: [], breakdown: [] }]);
  const empty = await reviewPage(id, 1, true); assert.deepEqual(empty.summary, { averageRating: 0, reviewCount: 0 }); assert.equal(Object.values(empty.breakdown).reduce((a, b) => a + b), 0);
});
test('owner analytics unexpected errors never expose database internals', async t => {
  t.mock.method(Pharmacy, 'findOne', () => { throw new Error('private stack'); });
  const result = res(); await ownerReviews({ params: { id }, query: {}, user: { _id: id } }, result); assert.equal(result.code, 500); assert.doesNotMatch(JSON.stringify(result.data), /private|stack/);
});
