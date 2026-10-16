import { useEffect, useState } from 'react';
import api from '../api/api';
import { ReviewContent } from './PharmacyReviews';
import { loadOwnerReviews, ratingPercentage } from '../utils/ownerReviews';
import '../styles/OwnerReviews.css';

export function OwnerReviewsView({ pharmacyId, data, loading, error, onRetry, onPage }) {
  return <section className="mn-owner-panel mn-owner-reviews" aria-labelledby="owner-reviews-title"><h2 id="owner-reviews-title">Customer Reviews</h2>
    {!pharmacyId ? <p className="mn-empty">Select or create a pharmacy to view its customer reviews.</p> : loading ? <p role="status">Loading reviews...</p> : error ? <div role="alert"><p>{error}</p><button type="button" className="mn-button mn-secondary" onClick={onRetry}>Retry reviews</button></div> : data && <>
      <dl className="mn-owner-review-stats"><div><dt>Average Rating</dt><dd>{data.summary.reviewCount ? <span aria-label={`${data.summary.averageRating.toFixed(1)} out of 5 stars`}>{data.summary.averageRating.toFixed(1)} <span aria-hidden="true">&#9733;</span></span> : 'No ratings yet'}</dd></div><div><dt>Total Reviews</dt><dd>{data.summary.reviewCount}</dd></div></dl>
      {!data.summary.reviewCount && <div className="mn-empty"><p>No customer reviews yet.</p><p>Once customers review your pharmacy, the rating summary will appear here.</p></div>}
      <h3>Rating Breakdown</h3><ul className="mn-rating-breakdown">{[5, 4, 3, 2, 1].map(rating => {
        const count = data.breakdown[rating], percentage = ratingPercentage(count, data.summary.reviewCount);
        const label = `${rating} ${rating === 1 ? 'star' : 'stars'}: ${count} ${count === 1 ? 'review' : 'reviews'} (${Math.round(percentage)}%)`;
        return <li key={rating}><span>{rating} <span aria-hidden="true">&#9733;</span><span className="mn-sr-only">{rating === 1 ? 'star' : 'stars'}</span></span><div className="mn-rating-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage} aria-valuetext={label}><div style={{ width: `${percentage}%` }} /></div><span>{count} <span className="mn-rating-percent">({Math.round(percentage)}%)</span></span></li>;
      })}</ul>
      <h3>Recent Reviews</h3><ul className="mn-review-list">{data.reviews.map(review => <li key={review._id}><ReviewContent review={review} /></li>)}</ul>
      {(data.page > 1 || data.hasMore) && <nav className="mn-review-actions" aria-label="Owner review pages"><button type="button" className="mn-button mn-secondary" disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>Previous reviews</button><span>Page {data.page}</span><button type="button" className="mn-button mn-secondary" disabled={!data.hasMore} onClick={() => onPage(data.page + 1)}>Next reviews</button></nav>}
    </>}
  </section>;
}
function OwnerReviewsSession({ pharmacyId }) {
  const [data, setData] = useState(null), [loading, setLoading] = useState(!!pharmacyId), [error, setError] = useState(''), [page, setPage] = useState(1), [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!pharmacyId) return;
    const controller = new AbortController(); setLoading(true); setError('');
    loadOwnerReviews(api, pharmacyId, page, controller.signal, localStorage.getItem('token')).then(result => { if (!controller.signal.aborted) setData(result); }).catch(e => {
      if (!controller.signal.aborted) setError(e.response?.status === 404 ? 'This pharmacy is unavailable or does not belong to your account.' : 'Unable to load review analytics. Please try again.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [pharmacyId, page, retry]);
  return <OwnerReviewsView pharmacyId={pharmacyId} data={data} loading={loading} error={error} onRetry={() => setRetry(value => value + 1)} onPage={next => { setLoading(true); setPage(next); }} />;
}
export default function OwnerReviews({ pharmacyId }) { return <OwnerReviewsSession key={pharmacyId || 'no-pharmacy'} pharmacyId={pharmacyId} />; }
