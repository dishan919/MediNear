const mongoose = require('mongoose');
const Review = require('../models/Review');

async function reviewPage(pharmacyId, page, includeBreakdown = false) {
    const limit = 10;
    const [data] = await Review.aggregate([
      { $match: { pharmacy: new mongoose.Types.ObjectId(pharmacyId) } },
      { $facet: {
        ...(includeBreakdown ? { breakdown: [{ $group: { _id: '$rating', count: { $sum: 1 } } }] } : {}),
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
    const result = { reviews: data?.reviews || [], summary, page, hasMore: page * limit < summary.reviewCount };
    if (includeBreakdown) {
      result.breakdown = Object.fromEntries([1, 2, 3, 4, 5].map(rating => [rating, 0]));
      for (const group of data?.breakdown || []) result.breakdown[group._id] = group.count;
    }
    return result;
}
module.exports = { reviewPage };
