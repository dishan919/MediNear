import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import api from '../api/api';
import PharmacyCard from './PharmacyCard';
import { getRecentlyViewedPharmacies, removeRecentlyViewedPharmacy, clearRecentlyViewedPharmacies, resolveRecentPharmacies } from '../utils/recentPharmacies';
import '../styles/RecentlyViewed.css';

export function RecentlyViewedView({ pharmacies, loading, error, onRemove, onClear, onRetry }) {
  if (!pharmacies.length && !loading && !error) return null;
  return <section className="mn-recent-pharmacies" aria-label="Recently Viewed Pharmacies">
    <div className="mn-recent-pharmacies-heading"><h2>Recently Viewed Pharmacies</h2><button type="button" className="mn-text-button" onClick={onClear}>Clear Recently Viewed</button></div>
    {loading && <p className="mn-muted" role="status">Loading recently viewed pharmacies...</p>}
    {error && <div className="mn-muted" role="status"><p>Some recently viewed pharmacies could not be loaded.</p><button type="button" className="mn-text-button" onClick={onRetry}>Try again</button></div>}
    <div className="mn-recent-pharmacies-grid">{pharmacies.map(pharmacy => <PharmacyCard key={pharmacy._id} pharmacy={pharmacy} compactRecent onRemoveRecentlyViewed={onRemove} />)}</div>
  </section>;
}
export default function RecentlyViewedPharmacies() {
  const { user } = useAuth() || {};
  const [pharmacies, setPharmacies] = useState([]), [loading, setLoading] = useState(false), [error, setError] = useState(false), [retry, setRetry] = useState(0), [ids, setIds] = useState(() => getRecentlyViewedPharmacies());
  const request = useRef(null);
  const accountId = user?.id || user?._id, customer = user?.role === 'customer';
  useEffect(() => {
    const controller = new AbortController(); request.current = controller; setError(false);
    if (!customer || !accountId || !ids.length) { setPharmacies([]); setLoading(false); return () => controller.abort(); }
    setLoading(true);
    resolveRecentPharmacies(api, ids, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      result.missing.forEach(id => removeRecentlyViewedPharmacy(id));
      setPharmacies(result.pharmacies); setError(result.failed);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [ids, customer, accountId, retry]);
  if (!customer || !accountId) return null;
  function remove(id) { request.current?.abort(); setIds(removeRecentlyViewedPharmacy(id)); setPharmacies(current => current.filter(p => p._id !== id)); }
  function clear() { request.current?.abort(); clearRecentlyViewedPharmacies(); setIds([]); setPharmacies([]); setError(false); setLoading(false); }
  return <RecentlyViewedView pharmacies={pharmacies} loading={loading} error={error} onRemove={remove} onClear={clear} onRetry={() => setRetry(value => value + 1)} />;
}
