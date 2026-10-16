import { useSyncExternalStore } from 'react';
import { pharmacyClock } from '../utils/pharmacyClock';
import { formatExpiryDate, getMedicineExpiryStatus } from '../../../shared/medicineExpiry.mjs';
import '../styles/MedicineExpiry.css';
export function MedicineExpiryView({ expiryDate, now = new Date() }) {
  const status = getMedicineExpiryStatus(expiryDate, now);
  return <div className="mn-medicine-expiry">{status.date && <time dateTime={status.date}>{formatExpiryDate(expiryDate)}</time>}<span className={`mn-expiry-label mn-expiry-${status.status}`}>{status.label}</span></div>;
}
export default function MedicineExpiry(props) {
  const timestamp = useSyncExternalStore(pharmacyClock.subscribe, pharmacyClock.getSnapshot, pharmacyClock.getSnapshot);
  return <MedicineExpiryView {...props} now={new Date(timestamp)} />;
}
export function MedicineExpiryField({ value, onChange }) {
  return <label>Expiry Date (optional)<input type="date" value={value} onChange={event => onChange(event.target.value)} /><span className="mn-field-help">Valid through the displayed date in Sri Lanka. Leave blank if not set.</span></label>;
}
