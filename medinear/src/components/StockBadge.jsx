import { getStockStatus } from '../utils/stockStatus';
export default function StockBadge({ quantity }) {
  const stock = getStockStatus(quantity);
  const style = { available: 'mn-positive', 'low-stock': 'mn-warning', 'out-of-stock': 'mn-negative', unknown: 'mn-neutral' }[stock.status];
  return <span className={`mn-badge ${style}`}>{stock.label}</span>;
}
