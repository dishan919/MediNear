const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Review = require('../models/Review');
const Pharmacy = require('../models/Pharmacy');
const { validateReview, publicOwnReview, createReview, mutateReview } = require('../controllers/reviewController');
const res = () => ({ code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } });
const pharmacy = new mongoose.Types.ObjectId(), customer = new mongoose.Types.ObjectId(), reviewId = new mongoose.Types.ObjectId();

test('review schema requires references, integer rating 1-5 and unique pharmacy/customer index', async () => {
  assert.ok(new Review({}).validateSync().errors.pharmacy);
  assert.ok(new Review({}).validateSync().errors.customer);
  for (const rating of [1, 5]) assert.equal(new Review({ pharmacy, customer, rating }).validateSync(), undefined);
  for (const rating of [0, 6, 1.5, NaN]) assert.ok(new Review({ pharmacy, customer, rating }).validateSync());
  assert.ok(Review.schema.indexes().some(([fields, options]) => fields.pharmacy === 1 && fields.customer === 1 && options.unique));
});
test('review validation rejects invalid ratings, supports optional trimmed comments and enforces 500 characters', () => {
  for (const rating of [0, 6, 2.5, '5', null, {}, undefined, true, Infinity]) assert.ok(validateReview({ rating }).errors.rating);
  assert.deepEqual(validateReview({ rating: 1, comment: '  Helpful staff.  ' }).values, { rating: 1, comment: 'Helpful staff.' });
  assert.deepEqual(validateReview({ rating: 5 }).values, { rating: 5, comment: '' });
  assert.equal(Object.keys(validateReview({ rating: 5, comment: 'x'.repeat(500) }).errors).length, 0);
  for (const comment of [null, 12, {}, 'x'.repeat(501)]) assert.ok(validateReview({ rating: 5, comment }).errors.comment);
  assert.ok(validateReview(null).errors.rating); assert.ok(validateReview({}, true).errors.rating);
  assert.deepEqual(validateReview({ comment: 'updated', customer: 'attacker', pharmacy: 'attacker' }, true).values, { comment: 'updated' });
});
test('safe own review response excludes all identity and private account data', () => {
  const safe = publicOwnReview({ _id: reviewId, rating: 5, comment: 'Good', customer, pharmacy, email: 'private', password: 'hash', token: 'secret' });
  assert.deepEqual(Object.keys(safe), ['_id', 'rating', 'comment', 'createdAt', 'updatedAt']);
  assert.equal(publicOwnReview(null), null);
});
test('create derives ownership and catches database unique conflict without exposing internals', async t => {
  t.mock.method(Pharmacy, 'exists', async () => true);
  t.mock.method(Review, 'create', async values => { assert.equal(values.customer, customer); assert.equal(values.pharmacy, String(pharmacy)); assert.equal(values.comment, 'Good'); return { ...values, _id: reviewId }; });
  const req = { user: { _id: customer }, params: { id: String(pharmacy) }, body: { rating: 5, comment: ' Good ', customer: 'attacker' } };
  const success = res(); await createReview(req, success); assert.equal(success.code, 201); assert.equal(success.data.review.customer, undefined);
  Review.create.mock.mockImplementation(async () => { throw Object.assign(new Error('private index details'), { code: 11000 }); });
  const duplicate = res(); await createReview(req, duplicate); assert.equal(duplicate.code, 409); assert.doesNotMatch(JSON.stringify(duplicate.data), /private index/);
});
test('mutations filter by authenticated author, pharmacy and review; immutable fields are not updated', async t => {
  t.mock.method(Pharmacy, 'exists', async () => true);
  const req = { method: 'PATCH', user: { _id: customer }, params: { id: String(pharmacy), reviewId: String(reviewId) }, body: { rating: 4, customer: 'attacker', pharmacy: 'attacker' } };
  t.mock.method(Review, 'findOneAndUpdate', async (filter, update, options) => {
    assert.deepEqual(filter, { _id: String(reviewId), pharmacy: String(pharmacy), customer });
    assert.deepEqual(update, { $set: { rating: 4 } }); assert.equal(options.runValidators, true); return null;
  });
  const denied = res(); await mutateReview(req, denied); assert.equal(denied.code, 404);
  t.mock.method(Review, 'findOneAndDelete', async filter => { assert.equal(filter.customer, customer); return null; });
  const deletion = res(); await mutateReview({ ...req, method: 'DELETE' }, deletion); assert.equal(deletion.code, 404);
});
test('invalid IDs, deleted pharmacy and unexpected database errors give safe failures', async t => {
  const req = { params: { id: String(pharmacy), reviewId: 'bad' }, user: { _id: customer }, body: { rating: 5 } };
  t.mock.method(Pharmacy, 'exists', async () => false);
  const missing = res(); await createReview(req, missing); assert.equal(missing.code, 404);
  const invalid = res(); await createReview({ ...req, params: { id: 'bad' } }, invalid); assert.equal(invalid.code, 400);
  Pharmacy.exists.mock.mockImplementation(async () => true);
  const invalidReview = res(); await mutateReview(req, invalidReview); assert.equal(invalidReview.code, 400);
  Pharmacy.exists.mock.mockImplementation(async () => { throw new Error('private mongo stack'); });
  const failure = res(); await createReview(req, failure); assert.equal(failure.code, 500); assert.doesNotMatch(JSON.stringify(failure.data), /mongo|stack/);
});
