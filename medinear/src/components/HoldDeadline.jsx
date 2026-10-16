import { useSyncExternalStore } from 'react';
import { pharmacyClock } from '../utils/pharmacyClock';
import { formatUpdated } from '../utils/medicineDisplay';
import { pickupDates, remainingPickupTime, estimatedServerTime } from '../utils/holdDeadline';
export function HoldDeadlineView({ request, now }) {
  if (request.status !== 'accepted') return null;
  const dates = pickupDates(request);
  if (!dates) return <p>Pickup deadline unavailable. Contact the pharmacy to confirm your hold.</p>;
  return <div className="mn-hold-deadline"><p>Pickup by: <time dateTime={request.expiresAt}>{formatUpdated(request.expiresAt, 'Asia/Colombo')}</time> (Sri Lanka time)</p><p>Time remaining: {remainingPickupTime(dates.expires, now)}</p></div>;
}
export default function HoldDeadline({ request, serverNow, receivedAt }) {
  // Reuse the shared minute clock for invalidation; elapsed monotonic time avoids browser wall-clock skew.
  useSyncExternalStore(pharmacyClock.subscribe, pharmacyClock.getSnapshot, pharmacyClock.getSnapshot);
  return <HoldDeadlineView request={request} now={estimatedServerTime(serverNow, receivedAt)} />;
}

export function HoldCollectionAction({ request, serverNow, receivedAt, active, onAction }) {
  useSyncExternalStore(pharmacyClock.subscribe, pharmacyClock.getSnapshot, pharmacyClock.getSnapshot);
  const dates = pickupDates(request), now = estimatedServerTime(serverNow, receivedAt);
  if (request.status !== 'accepted' || !dates || !Number.isFinite(now) || now >= dates.expires) return null;
  return <div className="mn-hold-actions"><button type="button" className="mn-button mn-primary" disabled={!!active} onClick={() => onAction(request._id, 'complete')}>{active?.id === request._id && active?.action === 'complete' ? 'Marking as Collected...' : 'Mark as Collected'}</button></div>;
}
