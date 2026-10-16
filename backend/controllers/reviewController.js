const mongoose = require('mongoose');
const Pharmacy = require('../models/Pharmacy');
const Review = require('../models/Review');

function validateReview(body, partial = false) {
  const errors = {}, values = {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { errors: { rating: 'Choose a rating from 1 to 5.' }, values };
  if (!partial || body.rating !== undefined) {
    if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) errors.rating = 'Choose a rating from 1 to 5.';
    else values.rating = body.rating;
  }
  if (body.comment !== undefined) {
    if (typeof body.comment !== 'string' || body.comment.length > 500) errors.comment = 'Use no more than 500 characters.';
    else values.comment = body.comment.trim();
  } else if (!partial) values.comment = '';
  if (partial && !Object.keys(values).length && !Object.keys(errors).length) errors.rating = 'Provide a rating or review comment.';
  return { errors, values };
}
const publicOwnReview = review => review && ({ _id: review._id, rating: review.rating, comment: review.comment, createdAt: review.createdAt, updatedAt: review.updatedAt });
const failure = (res, error) => {
  if (error.code === 11000) return res.status(409).json({ success: false, message: 'You have already reviewed this pharmacy. Edit your existing review instead.' });
  return res.status(500).json({ success: false, message: 'Unable to load or save reviews. Please try again.' });
};
async function pharmacyExists(req, res) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) { res.status(400).json({ success: false, message: 'Invalid pharmacy ID.' }); return false; }
  if (!await Pharmacy.exists({ _id: req.params.id })) { res.status(404).json({ success: false, message: 'Pharmacy not found.' }); return false; }
  return true;
}
async function listReviews(req, res) {
  try {
    if (!await pharmacyExists(req, res)) return;
    const page = req.query.page === undefined ? 1 : Number(req.query.page);
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000) return res.status(400).json({ success: false, message: 'Invalid reviews page.' });
    const limit = 10;
    const [data] = await Review.aggregate([
      { $match: { pharmacy: new mongoose.Types.ObjectId(req.params.id) } },
      { $facet: {
        summary: [{ $group: { _id: null, averageRating: { $avg: '$rating' }, reviewCount: { $sum: 1 } } }],
        reviews: [
          { $sort: { createdAt: -1, _id: -1 } }, { $skip: (page - 1) * limit }, { $limit: limit },
          { $lookup: { from: 'users', localField: 'customer', foreignField: '_id', pipeline: [{ $project: { name: 1, _id: 0 } }], as: 'author' } },
          { $project: { rating: 1, comment: 1, createdAt: 1, updatedAt: 1, authorName: { $ifNull: [{ $arrayElemAt: ['$author.name', 0] }, 'Customer'] } } },
        ],
      } },
    ]);
    const stats = data?.summary[0];
    const summary = { averageRating: stats?.averageRating || 0, reviewCount: stats?.reviewCount || 0 };
    res.json({ success: true, reviews: data?.reviews || [], summary, page, hasMore: page * limit < summary.reviewCount });
  } catch (error) { return failure(res, error); }
}
async function ownReview(req, res) {
  try {
    if (!await pharmacyExists(req, res)) return;
    const review = await Review.findOne({ pharmacy: req.params.id, customer: req.user._id });
    res.json({ success: true, review: publicOwnReview(review) });
  } catch (error) { return failure(res, error); }
}
async function createReview(req, res) {
  try {
    if (!await pharmacyExists(req, res)) return;
    const { errors, values } = validateReview(req.body);
    if (Object.keys(errors).length) return res.status(400).json({ success: false, message: 'Please correct the highlighted fields.', errors });
    const review = await Review.create({ ...values, pharmacy: req.params.id, customer: req.user._id });
    res.status(201).json({ success: true, review: publicOwnReview(review) });
  } catch (error) { return failure(res, error); }
}
async function mutateReview(req, res) {
  try {
    if (!await pharmacyExists(req, res)) return;
    if (!mongoose.isObjectIdOrHexString(req.params.reviewId)) return res.status(400).json({ success: false, message: 'Invalid review ID.' });
    const filter = { _id: req.params.reviewId, pharmacy: req.params.id, customer: req.user._id };
    if (req.method === 'DELETE') {
      const review = await Review.findOneAndDelete(filter);
      if (!review) return res.status(404).json({ success: false, message: 'Your review was not found.' });
      return res.json({ success: true, message: 'Review deleted.' });
    }
    const { errors, values } = validateReview(req.body, true);
    if (Object.keys(errors).length) return res.status(400).json({ success: false, message: 'Please correct the highlighted fields.', errors });
    const review = await Review.findOneAndUpdate(filter, { $set: values }, { returnDocument: 'after', runValidators: true });
    if (!review) return res.status(404).json({ success: false, message: 'Your review was not found.' });
    return res.json({ success: true, review: publicOwnReview(review) });
  } catch (error) { return failure(res, error); }
}
module.exports = { listReviews, ownReview, createReview, mutateReview, validateReview, publicOwnReview };
