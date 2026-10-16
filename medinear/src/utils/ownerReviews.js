export function ratingPercentage(count, total) { return total ? count / total * 100 : 0; }
// Validate before rendering; retain only the existing public review fields.
export function parseOwnerReviews(data) {
  const invalid = () => { throw new Error('Invalid review analytics response'); };
  if (!data?.success || !data.summary || !data.breakdown || !Array.isArray(data.reviews) || data.reviews.length > 10) return invalid();
  const { averageRating, reviewCount } = data.summary;
  if (!Number.isSafeInteger(reviewCount) || reviewCount < 0 || !Number.isFinite(averageRating) || (reviewCount ? averageRating < 1 || averageRating > 5 : averageRating !== 0)) return invalid();
  const breakdown = {};
  for (const rating of [1, 2, 3, 4, 5]) {
    const count = data.breakdown[rating]; if (!Number.isSafeInteger(count) || count < 0) return invalid(); breakdown[rating] = count;
  }
  if (Object.values(breakdown).reduce((sum, count) => sum + count, 0) !== reviewCount || !Number.isSafeInteger(data.page) || data.page < 1 || typeof data.hasMore !== 'boolean') return invalid();
  const reviews = data.reviews.map(review => {
    if (!review || typeof review._id !== 'string' || !Number.isInteger(review.rating) || review.rating < 1 || review.rating > 5 || typeof review.comment !== 'string' || typeof review.authorName !== 'string' || typeof review.createdAt !== 'string' || Number.isNaN(Date.parse(review.createdAt))) return invalid();
    return { _id: review._id, rating: review.rating, comment: review.comment, authorName: review.authorName, createdAt: review.createdAt };
  });
  return { summary: { averageRating, reviewCount }, breakdown, reviews, page: data.page, hasMore: data.hasMore };
}
export async function loadOwnerReviews(api, pharmacyId, page, signal, token) {
  const response = await api.get(`/pharmacies/${pharmacyId}/reviews/owner-dashboard`, { params: { page }, signal, headers: { Authorization: `Bearer ${token}` } });
  return parseOwnerReviews(response.data);
}
