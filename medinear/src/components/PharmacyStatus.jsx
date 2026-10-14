import { useSyncExternalStore } from 'react';
import { openingStatus } from '../../../shared/pharmacyHours.mjs';
import { pharmacyClock } from '../utils/pharmacyClock';
import '../styles/PharmacyStatus.css';

export function PharmacyStatusView({ pharmacy, now }) {
  const status = openingStatus(pharmacy, now);
  return <div className="mn-pharmacy-status">
    <div className="mn-badge-row"><span className={`mn-badge ${status.isOpen === true ? 'mn-positive' : status.isOpen === false ? 'mn-negative' : 'mn-neutral'}`}>{status.open24Hours ? 'Open 24 Hours' : status.openStatus}</span></div>
    {status.timingText && <p className="mn-status-timing">{status.timingText}</p>}
  </div>;
}
export default function PharmacyStatus({ pharmacy }) {
  const timestamp = useSyncExternalStore(pharmacyClock.subscribe, pharmacyClock.getSnapshot, pharmacyClock.getSnapshot);
  return <PharmacyStatusView pharmacy={pharmacy} now={new Date(timestamp)} />;
}
