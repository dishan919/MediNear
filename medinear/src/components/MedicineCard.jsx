import AssetImage from './AssetImage';
import { formatPrice, formatUpdated } from '../utils/medicineDisplay';
import '../styles/MedicineUI.css';
export default function MedicineCard({ medicine, compact = false, timezone = 'Asia/Colombo' }) {
  const available = medicine.quantity > 0;
  return <article className={`mn-medicine ${compact ? 'mn-medicine-compact' : ''}`}>
    <AssetImage src={medicine.imageUrl} alt={`${medicine.name} medicine`} className="mn-medicine-image" />
    <div className="mn-medicine-body"><div className="mn-medicine-heading"><div><h3>{medicine.name}</h3>{medicine.genericName && <p>{medicine.genericName}</p>}{medicine.brand && <p className="mn-brand">Brand: {medicine.brand}</p>}</div><span className={`mn-badge ${available ? 'mn-positive' : 'mn-negative'}`}>{available ? 'Available' : 'Out of Stock'}</span></div>
      <dl className="mn-medicine-stats"><div><dt>Price</dt><dd>{formatPrice(medicine.price)}</dd></div><div><dt>Stock</dt><dd>{medicine.quantity == null ? 'Stock unavailable' : `${medicine.quantity} units`}</dd></div>{!compact && <div className="mn-updated"><dt>Last Updated</dt><dd>{formatUpdated(medicine.updatedAt, timezone)}</dd></div>}</dl>
    </div>
  </article>;
}
