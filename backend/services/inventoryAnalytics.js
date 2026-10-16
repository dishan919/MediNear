const { getStockStatus } = require('../../shared/stockStatus.mjs');
const { getMedicineExpiryStatus } = require('../../shared/medicineExpiry.mjs');
const ATTENTION_LIMIT = 10;
const ATTENTION_PRIORITY = ['expired', 'out-of-stock', 'expiring-soon', 'low-stock'];
function inventoryAnalytics(inventory, now = new Date()) {
  const items = Array.isArray(inventory) ? inventory.filter(item => item && typeof item === 'object') : [];
  const summary = { totalMedicines: items.length, totalStockUnits: 0, lowStock: 0, outOfStock: 0, expiringSoon: 0, expired: 0 };
  const attention = []; let units = 0n;
  for (const [index, item] of items.entries()) {
    const validQuantity = Number.isSafeInteger(item.quantity) && item.quantity >= 0;
    if (validQuantity) units += BigInt(item.quantity);
    const stock = getStockStatus(item.quantity), expiry = getMedicineExpiryStatus(item.expiryDate, now);
    if (stock.status === 'low-stock') summary.lowStock++;
    if (stock.status === 'out-of-stock') summary.outOfStock++;
    if (expiry.status === 'expiring-soon') summary.expiringSoon++;
    if (expiry.status === 'expired') summary.expired++;
    const issues = ATTENTION_PRIORITY.flatMap(code => code === stock.status ? [{ code, label: stock.label }] : code === expiry.status ? [{ code, label: expiry.label }] : []);
    if (issues.length) attention.push({
      _id: item._id == null ? `legacy-${index}` : String(item._id),
      name: typeof item.name === 'string' && item.name.trim() ? item.name : 'Unnamed medicine',
      quantity: validQuantity ? item.quantity : null, expiryDate: expiry.date,
      stockStatus: stock.status, expiryStatus: expiry.status, issues,
    });
  }
  if (units > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Inventory stock total exceeds the supported exact numeric range');
  summary.totalStockUnits = Number(units);
  attention.sort((a, b) => ATTENTION_PRIORITY.indexOf(a.issues[0].code) - ATTENTION_PRIORITY.indexOf(b.issues[0].code) || a.name.localeCompare(b.name, 'en') || a._id.localeCompare(b._id));
  return { summary, needsAttention: attention.slice(0, ATTENTION_LIMIT), attentionTotal: attention.length, attentionLimit: ATTENTION_LIMIT, hasMore: attention.length > ATTENTION_LIMIT };
}
module.exports = { inventoryAnalytics, ATTENTION_LIMIT, ATTENTION_PRIORITY };
