export const MAX_REVIEW_COMMENT = 500;
export const emptyReview = () => ({ rating: 0, comment: '' });
export const reviewDraft = review => ({ rating: review.rating, comment: review.comment || '' });
export function validateReview(values) {
  const errors = {};
  if (!Number.isInteger(values.rating) || values.rating < 1 || values.rating > 5) errors.rating = 'Choose a rating from 1 to 5.';
  if (typeof values.comment !== 'string' || values.comment.length > MAX_REVIEW_COMMENT) errors.comment = 'Use no more than 500 characters.';
  return errors;
}
export function ratingText(summary) {
  return summary?.reviewCount ? `${summary.averageRating.toFixed(1)} out of 5 (${summary.reviewCount} ${summary.reviewCount === 1 ? 'review' : 'reviews'})` : 'No reviews yet.';
}
export function reviewsService(api, pharmacyId, token) {
  const path = `/pharmacies/${pharmacyId}/reviews`;
  const config = signal => ({ signal, headers: { Authorization: `Bearer ${token()}` } });
  return {
    async list(page, signal) { return (await api.get(path, { params: { page }, signal })).data; },
    async mine(signal) { return (await api.get(`${path}/mine`, config(signal))).data.review; },
    async save(reviewId, values, signal) {
      const body = { rating: values.rating, comment: values.comment.trim() };
      const response = reviewId ? await api.patch(`${path}/${reviewId}`, body, config(signal)) : await api.post(path, body, config(signal));
      return response.data.review;
    },
    async remove(reviewId, signal) { await api.delete(`${path}/${reviewId}`, config(signal)); },
  };
}
export const reviewToast = action => ({ type: 'success', message: { create: 'Review submitted.', edit: 'Review updated.', delete: 'Review deleted.' }[action] });
// One in-flight mutation, including before React renders the disabled controls.
export function createReviewRunner() {
  let pending = false, controller;
  return {
    dispose() { controller?.abort(); },
    async run(action, callbacks) {
      if (pending) return;
      pending = true; controller = new AbortController(); const signal = controller.signal;
      callbacks.busy(true);
      try { const result = await action(signal); if (!signal.aborted) callbacks.success(result); }
      catch (error) { if (!signal.aborted) callbacks.error(error); }
      finally { pending = false; if (!signal.aborted) callbacks.busy(false); }
    },
  };
}
