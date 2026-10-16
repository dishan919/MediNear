import { expiryDateKey } from '../../../shared/medicineExpiry.mjs';
export const INVENTORY_METRICS = [
  ['totalMedicines', 'Total Medicines'], ['totalStockUnits', 'Total Stock Units'],
  ['lowStock', 'Low Stock'], ['outOfStock', 'Out of Stock'], ['expiringSoon', 'Expiring Soon'], ['expired', 'Expired'],
];
export function parseInventoryAnalytics(data) {
  const fail = () => { throw new Error('Invalid inventory analytics response'); };
  if (data?.success !== true || !data.summary || !Array.isArray(data.needsAttention) || !Number.isSafeInteger(data.attentionLimit) || data.attentionLimit < 1 || data.needsAttention.length > data.attentionLimit || data.needsAttention.length > 10) return fail();
  const summary = {};
  for (const [key] of INVENTORY_METRICS) {
    const value = data.summary[key]; if (!Number.isSafeInteger(value) || value < 0) return fail(); summary[key] = value;
  }
  if (['lowStock', 'outOfStock', 'expiringSoon', 'expired'].some(key => summary[key] > summary.totalMedicines) || summary.lowStock + summary.outOfStock > summary.totalMedicines) return fail();
  if (!Number.isSafeInteger(data.attentionTotal) || data.attentionTotal < data.needsAttention.length || data.attentionTotal > summary.totalMedicines || typeof data.hasMore !== 'boolean' || data.hasMore !== (data.attentionTotal > data.needsAttention.length)) return fail();
  const needsAttention = data.needsAttention.map(item => {
    if (!item || typeof item._id !== 'string' || typeof item.name !== 'string' || !(item.quantity === null || Number.isSafeInteger(item.quantity) && item.quantity >= 0) || expiryDateKey(item.expiryDate) === null || !Array.isArray(item.issues) || !item.issues.length) return fail();
    const issues = item.issues.map(issue => {
      if (!issue || !['expired', 'out-of-stock', 'expiring-soon', 'low-stock'].includes(issue.code) || typeof issue.label !== 'string') return fail();
      return { code: issue.code, label: issue.label };
    });
    return { _id: item._id, name: item.name, quantity: item.quantity, expiryDate: item.expiryDate, issues };
  });
  return { summary, needsAttention, attentionTotal: data.attentionTotal, hasMore: data.hasMore };
}
export async function loadInventoryAnalytics(api, pharmacyId, signal, token) {
  const response = await api.get(`/pharmacies/${pharmacyId}/inventory/analytics`, { signal, headers: { Authorization: `Bearer ${token}` } });
  return parseInventoryAnalytics(response.data);
}
