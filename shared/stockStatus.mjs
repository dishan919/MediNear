export const LOW_STOCK_THRESHOLD = 5;
export function getStockStatus(quantity) {
  if (!Number.isSafeInteger(quantity)) return { status: 'unknown', label: 'Stock unavailable' };
  if (quantity <= 0) return { status: 'out-of-stock', label: 'Out of Stock' };
  if (quantity <= LOW_STOCK_THRESHOLD) return { status: 'low-stock', label: 'Low Stock' };
  return { status: 'available', label: 'Available' };
}
export function formatStockQuantity(quantity) {
  if (!Number.isSafeInteger(quantity) || quantity < 0) return 'Stock unavailable';
  return getStockStatus(quantity).status === 'low-stock' ? `Only ${quantity} remaining` : `${quantity} units`;
}
