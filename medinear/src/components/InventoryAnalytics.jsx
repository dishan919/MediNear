import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import api from '../api/api';
import { formatExpiryDate } from '../../../shared/medicineExpiry.mjs';
import { INVENTORY_METRICS, loadInventoryAnalytics } from '../utils/inventoryAnalytics';
import '../styles/InventoryAnalytics.css';
export function InventoryAnalyticsView({ pharmacyId, loading, error, data, onRetry, onViewInventory }) {
  return <section className="mn-owner-panel mn-inventory-analytics" aria-labelledby="inventory-analytics-title"><h2 id="inventory-analytics-title">Inventory Analytics</h2>
    {!pharmacyId ? <p className="mn-empty">Select or create your pharmacy before viewing inventory analytics.</p> : loading ? <p role="status">Loading inventory analytics...</p> : error ? <div role="alert"><p>{error}</p><button type="button" className="mn-button mn-secondary" onClick={onRetry}>Retry analytics</button></div> : data && <>
      <button type="button" className="mn-text-button" onClick={onRetry}>Refresh analytics</button>
      <dl className="mn-inventory-metrics">{INVENTORY_METRICS.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{data.summary[key]}</dd></div>)}</dl>
      <h3>Needs Attention</h3>
      {!data.needsAttention.length ? <p className="mn-empty">{data.summary.totalMedicines ? 'Your inventory currently has no low-stock, out-of-stock, expiring-soon or expired items.' : 'No inventory items need attention.'}</p> : <>
        {data.hasMore && <p>Showing {data.needsAttention.length} of {data.attentionTotal} items needing attention.</p>}
        <ul className="mn-inventory-attention">{data.needsAttention.map(item => <li key={item._id}><h4>{item.name}</h4><p>Quantity: {item.quantity === null ? 'Stock unavailable' : item.quantity}</p><div className="mn-attention-badges">{item.issues.map(issue => <span className="mn-badge" key={issue.code}>{issue.label}</span>)}</div>{item.expiryDate && <p>Expiry: <time dateTime={item.expiryDate}>{formatExpiryDate(item.expiryDate)}</time></p>}</li>)}</ul>
      </>}
      <button type="button" className="mn-button mn-secondary" onClick={onViewInventory}>View Inventory</button>
    </>}
  </section>;
}
function InventoryAnalyticsSession({ pharmacyId, onViewInventory }) {
  const [data, setData] = useState(null), [loading, setLoading] = useState(!!pharmacyId), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!pharmacyId) return;
    const controller = new AbortController(); setLoading(true); setError('');
    loadInventoryAnalytics(api, pharmacyId, controller.signal, localStorage.getItem('token')).then(result => { if (!controller.signal.aborted) setData(result); }).catch(error => {
      if (!controller.signal.aborted) setError(error.response?.status === 404 ? 'This pharmacy is unavailable or does not belong to your account.' : 'Unable to load inventory analytics. Please try again.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [pharmacyId, retry]);
  return <InventoryAnalyticsView pharmacyId={pharmacyId} data={data} loading={loading} error={error} onRetry={() => setRetry(value => value + 1)} onViewInventory={onViewInventory} />;
}
export default function InventoryAnalytics(props) {
  const { user } = useAuth() || {};
  if (user?.role !== 'pharmacy_owner') return null;
  return <InventoryAnalyticsSession key={`${props.pharmacyId || 'no-pharmacy'}:${user.id || user._id}`} {...props} />;
}
