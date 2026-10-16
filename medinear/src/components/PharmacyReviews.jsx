import { useEffect, useRef, useState } from 'react';
import api from '../api/api';
import { useAuth } from '../auth/AuthContext';
import { getUserRole } from '../auth/roles';
import { useToast } from '../auth/ToastContext';
import { createReviewRunner, emptyReview, reviewDraft, ratingText, reviewsService, reviewToast, validateReview, MAX_REVIEW_COMMENT } from '../utils/reviews';
import '../styles/Reviews.css';

export function ReviewForm({ values, errors, busy, editing, onChange, onSubmit, onCancel }) {
  return <form onSubmit={onSubmit} noValidate aria-busy={busy} className="mn-review-form">
    <fieldset disabled={busy} aria-describedby={errors.rating ? 'review-rating-error' : undefined} aria-invalid={!!errors.rating}>
      <legend>Rating</legend><div className="mn-review-stars">
        {[1, 2, 3, 4, 5].map(rating => <label key={rating}><input type="radio" name="review-rating" value={rating} checked={values.rating === rating} onChange={() => onChange('rating', rating)} /><span aria-hidden="true">&#9733;</span><span className="mn-sr-only">{`${rating} ${rating === 1 ? 'star' : 'stars'}`}</span></label>)}
      </div>
    </fieldset>
    {errors.rating && <p id="review-rating-error" className="mn-inline-error" role="alert">{errors.rating}</p>}
    <label htmlFor="review-comment">Review (optional)</label>
    <textarea id="review-comment" value={values.comment} maxLength={MAX_REVIEW_COMMENT} disabled={busy} onChange={event => onChange('comment', event.target.value)} placeholder="Share your service experience with this pharmacy..." aria-invalid={!!errors.comment} aria-describedby={`review-help${errors.comment ? ' review-comment-error' : ''}`} />
    <p id="review-help" className="mn-muted">Review general service quality, not medical advice or medicine recommendations. Avoid personal medical information, prescriptions and private contact details. Maximum 500 characters.</p>
    {errors.comment && <p id="review-comment-error" className="mn-inline-error" role="alert">{errors.comment}</p>}
    <div className="mn-review-actions"><button type="submit" className="mn-button mn-primary" disabled={busy}>{busy ? 'Saving Review...' : editing ? 'Save Changes' : 'Submit Review'}</button>{editing && <button type="button" className="mn-button mn-secondary" disabled={busy} onClick={onCancel}>Cancel</button>}</div>
  </form>;
}
function ReviewContent({ review }) {
  const date = new Date(review.createdAt);
  return <><p aria-label={`${review.rating} out of 5 stars`}><span aria-hidden="true">{'\u2605'.repeat(review.rating)}{'\u2606'.repeat(5 - review.rating)}</span></p>{review.authorName && <h4>{review.authorName}</h4>}{review.comment && <p className="mn-review-comment">{review.comment}</p>}{!Number.isNaN(date.getTime()) && <time dateTime={date.toISOString()}>{date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Colombo' })}</time>}</>;
}
export function ReviewsView({ data, own, customer, loading, error, actionError, busy, editing, confirming, values, errors, onRetry, onEdit, onDeleteRequest, onDeleteConfirm, onDeleteCancel, onChange, onSubmit, onCancel, onPage }) {
  return <section className="mn-reviews" aria-labelledby="customer-reviews-title"><h2 id="customer-reviews-title">Customer Reviews</h2>
    {loading ? <p role="status">Loading reviews...</p> : error ? <div role="alert"><p>{error}</p><button type="button" className="mn-button mn-secondary" onClick={onRetry}>Retry reviews</button></div> : <>
      <p className="mn-review-summary" role="status">{!!data.summary.reviewCount && <span aria-hidden="true">{'\u2605'.repeat(Math.round(data.summary.averageRating))}{'\u2606'.repeat(5 - Math.round(data.summary.averageRating))} </span>}{ratingText(data.summary)}</p>
      {actionError && <div role="alert"><p className="mn-inline-error">{actionError}</p><button type="button" className="mn-text-button" disabled={busy} onClick={onRetry}>Retry reviews</button></div>}
      {customer && <div className="mn-own-review"><h3>Your Review</h3>{own && !editing ? <><ReviewContent review={own} />{confirming ? <div role="group" aria-label="Delete your review?"><p>Delete your review?</p><div className="mn-review-actions"><button type="button" className="mn-button mn-secondary" disabled={busy} onClick={onDeleteCancel} autoFocus>Cancel</button><button type="button" className="mn-button mn-danger" disabled={busy} onClick={onDeleteConfirm}>{busy ? 'Deleting...' : 'Delete'}</button></div></div> : <div className="mn-review-actions"><button type="button" className="mn-button mn-secondary" disabled={busy} onClick={onEdit}>Edit Review</button><button type="button" className="mn-button mn-danger" disabled={busy} onClick={onDeleteRequest}>Delete Review</button></div>}</> : <ReviewForm values={values} errors={errors} busy={busy} editing={editing} onChange={onChange} onSubmit={onSubmit} onCancel={onCancel} />}</div>}
      {!data.summary.reviewCount && customer && <p>Be the first to review this pharmacy.</p>}
      <ul className="mn-review-list">{data.reviews.map(review => <li key={review._id}><ReviewContent review={review} /></li>)}</ul>
      {(data.page > 1 || data.hasMore) && <nav className="mn-review-actions" aria-label="Review pages"><button type="button" className="mn-button mn-secondary" disabled={busy || data.page <= 1} onClick={() => onPage(data.page - 1)}>Previous reviews</button><span>Page {data.page}</span><button type="button" className="mn-button mn-secondary" disabled={busy || !data.hasMore} onClick={() => onPage(data.page + 1)}>Next reviews</button></nav>}
    </>}
  </section>;
}
function ReviewsSession({ pharmacyId, customer }) {
  const { showToast } = useToast();
  const [service] = useState(() => reviewsService(api, pharmacyId, () => localStorage.getItem('token')));
  const [runner] = useState(createReviewRunner);
  const [data, setData] = useState({ reviews: [], summary: { averageRating: 0, reviewCount: 0 }, page: 1, hasMore: false });
  const [own, setOwn] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false), [editing, setEditing] = useState(false), [confirming, setConfirming] = useState(false);
  const [values, setValues] = useState(emptyReview), [errors, setErrors] = useState({}), [page, setPage] = useState(1), [refresh, setRefresh] = useState(0);
  const region = useRef(null), focusErrors = useRef(false);
  useEffect(() => () => runner.dispose(), [runner]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    Promise.all([service.list(page, controller.signal), customer ? service.mine(controller.signal) : null]).then(([result, mine]) => {
      if (!controller.signal.aborted) { setData(result); setOwn(mine); }
    }).catch(() => { if (!controller.signal.aborted) setError('Unable to load reviews. Please try again.'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [service, customer, page, refresh]);
  useEffect(() => {
    if (focusErrors.current) { region.current?.querySelector('[aria-invalid="true"] input, textarea[aria-invalid="true"]')?.focus(); focusErrors.current = false; }
  }, [errors]);
  function reset() { setEditing(false); setConfirming(false); setValues(emptyReview()); setErrors({}); setActionError(''); }
  function perform(action) {
    setActionError('');
    runner.run(signal => action === 'delete' ? service.remove(own._id, signal) : service.save(action === 'edit' ? own._id : null, values, signal), {
      busy: setBusy,
      success(review) { setOwn(action === 'delete' ? null : review); reset(); showToast(reviewToast(action)); setPage(1); setRefresh(value => value + 1); },
      error(e) {
        if (e.response?.status === 400 && e.response.data?.errors) { focusErrors.current = true; setErrors(e.response.data.errors); }
        else setActionError(e.response?.status === 409 ? 'You have already reviewed this pharmacy. Retry reviews to load your existing review.' : 'Unable to save your review. Please try again.');
      },
    });
  }
  function submit(event) { event.preventDefault(); const next = validateReview(values); focusErrors.current = true; setErrors(next); if (!Object.keys(next).length) perform(own ? 'edit' : 'create'); }
  return <div ref={region}><ReviewsView data={data} own={own} customer={customer} loading={loading} error={error} actionError={actionError} busy={busy} editing={editing} confirming={confirming} values={values} errors={errors} onRetry={() => { reset(); setPage(1); setRefresh(value => value + 1); }} onEdit={() => { setValues(reviewDraft(own)); setEditing(true); setErrors({}); setActionError(''); }} onDeleteRequest={() => setConfirming(true)} onDeleteConfirm={() => perform('delete')} onDeleteCancel={() => setConfirming(false)} onChange={(field, value) => { setValues(current => ({ ...current, [field]: value })); setErrors(current => ({ ...current, [field]: undefined })); }} onSubmit={submit} onCancel={reset} onPage={setPage} /></div>;
}
export default function PharmacyReviews({ pharmacyId }) {
  const { user } = useAuth() || {};
  const customer = !!user && getUserRole(user) === 'customer';
  return <ReviewsSession key={`${pharmacyId}:${user?.id || user?._id || 'guest'}:${customer}`} pharmacyId={pharmacyId} customer={customer} />;
}
