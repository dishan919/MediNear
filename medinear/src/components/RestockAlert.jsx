import { useRef, useState } from 'react';
import { useAlerts } from '../auth/AlertsContext';
import { alertApi } from '../api/alerts';
export function RestockAlertView({ subscription, loading, error, busy, onAction, onRetry }) {
  return <div className="mn-restock" aria-busy={busy || loading}>
    {subscription && <p role="status">{'Restock alert active \u2713'}</p>}
    {error ? <><p role="alert">{error}</p><button type="button" className="mn-text-button" disabled={busy || loading} onClick={onRetry}>Retry alert status</button></> : <button type="button" className="mn-button mn-secondary" disabled={loading || busy} onClick={onAction}>{loading ? 'Loading alert status...' : busy ? 'Saving alert...' : subscription ? 'Cancel Alert' : 'Notify Me When Available'}</button>}
  </div>;
}
export default function RestockAlert({ pharmacyId, medicineId }) {
  const alerts = useAlerts();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef(false);
  if (!alerts) return null;
  const subscription = alerts.subscriptions.find(s => s.pharmacy === pharmacyId && s.medicine === medicineId);
  async function act() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { if (subscription) await alertApi.cancel(subscription._id); else await alertApi.subscribe(pharmacyId, medicineId); await alerts.refresh(); }
    catch (e) { setError(e.response?.data?.message || 'Unable to update alert. Please try again.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return <RestockAlertView subscription={subscription} loading={alerts.loading} error={error || alerts.error} busy={busy} onAction={act} onRetry={async () => { setError(''); await alerts.refresh(true); }} />;
}
