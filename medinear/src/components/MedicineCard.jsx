import { useSyncExternalStore } from 'react';
import { pharmacyClock } from '../utils/pharmacyClock';
import { isMedicineUsable, getMedicineExpiryStatus } from '../../../shared/medicineExpiry.mjs';
import MedicineExpiry from './MedicineExpiry';
import RequestHold from './RequestHold';
import StockBadge from './StockBadge';
import { formatStockQuantity } from '../utils/stockStatus';
import RestockAlert from './RestockAlert';
import AssetImage from './AssetImage';
import { formatPrice, formatUpdated } from '../utils/medicineDisplay';
import '../styles/MedicineUI.css';
export default function MedicineCard({ medicine, pharmacyId, compact = false, timezone = 'Asia/Colombo' }) {
  const timestamp = useSyncExternalStore(pharmacyClock.subscribe, pharmacyClock.getSnapshot, pharmacyClock.getSnapshot);
  const usable = isMedicineUsable(medicine, new Date(timestamp));
  return <article className={`mn-medicine ${compact ? 'mn-medicine-compact' : ''}`}>
    <AssetImage src={medicine.imageUrl} alt={`${medicine.name} medicine`} className="mn-medicine-image" />
    <div className="mn-medicine-body"><div className="mn-medicine-heading"><div><h3>{medicine.name}</h3>{medicine.genericName && <p>{medicine.genericName}</p>}{medicine.brand && <p className="mn-brand">Brand: {medicine.brand}</p>}</div><>{usable ? <StockBadge quantity={medicine.quantity} /> : <span className="mn-badge mn-negative">{getMedicineExpiryStatus(medicine.expiryDate, new Date(timestamp)).label}</span>}</></div>
      <dl className="mn-medicine-stats"><div><dt>Price</dt><dd>{formatPrice(medicine.price)}</dd></div><div><dt>Stock</dt><dd>{usable ? formatStockQuantity(medicine.quantity) : 'Unavailable'}</dd></div>{!compact && <div className="mn-updated"><dt>Last Updated</dt><dd>{formatUpdated(medicine.updatedAt, timezone)}</dd></div>}</dl>
      {medicine.expiryDate != null && <MedicineExpiry expiryDate={medicine.expiryDate} />}
      <RequestHold pharmacyId={pharmacyId} medicine={medicine} />
      {usable && medicine.quantity === 0 && pharmacyId && <RestockAlert pharmacyId={pharmacyId} medicineId={medicine._id} />}
    </div>
  </article>;
}
