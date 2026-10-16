export const EXPIRING_SOON_DAYS = 30;
const DAY_MS = 86400000;
const businessDateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit' });
// Dates are calendar keys stored as UTC midnight, never local-midnight timestamps.
export function expiryDateKey(value) {
  if (value === null || value === undefined || value === '') return '';
  let key;
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime()) || value.toISOString().slice(11) !== '00:00:00.000Z') return null;
    key = value.toISOString().slice(0, 10);
  } else if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) key = value;
    else if (/^\d{4}-\d{2}-\d{2}T00:00:00(?:\.000)?Z$/.test(value)) key = value.slice(0, 10);
    else return null;
  } else return null;
  const date = new Date(`${key}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && key.slice(0, 4) !== '0000' && date.toISOString().slice(0, 10) === key ? key : null;
}
export function parseExpiryDate(value) {
  const key = expiryDateKey(value);
  if (key === null) throw new Error('Expiry Date must be a valid calendar date (YYYY-MM-DD), or blank.');
  return key ? new Date(`${key}T00:00:00.000Z`) : null;
}
export function expiryCutoffDate(now = new Date()) {
  const parts = Object.fromEntries(businessDateFormatter.formatToParts(now).map(part => [part.type, part.value]));
  return new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00.000Z`);
}
export function getMedicineExpiryStatus(value, now = new Date()) {
  const key = expiryDateKey(value);
  if (!key) return { status: 'unknown', label: key === null ? 'Expiry unavailable' : 'Expiry not set', date: null, eligible: key !== null };
  const daysRemaining = Math.round((new Date(`${key}T00:00:00.000Z`) - expiryCutoffDate(now)) / DAY_MS);
  const status = daysRemaining < 0 ? 'expired' : daysRemaining <= EXPIRING_SOON_DAYS ? 'expiring-soon' : 'valid';
  return { status, label: { expired: 'Expired', 'expiring-soon': 'Expiring Soon', valid: 'Valid' }[status], date: key, daysRemaining, eligible: status !== 'expired' };
}
export function isMedicineUsable(medicine, now = new Date()) { return getMedicineExpiryStatus(medicine?.expiryDate, now).eligible; }
export function isMedicineAvailable(medicine, now = new Date()) { return Number.isSafeInteger(medicine?.quantity) && medicine.quantity > 0 && isMedicineUsable(medicine, now); }
export function formatExpiryDate(value) {
  const key = expiryDateKey(value);
  return key ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${key}T00:00:00.000Z`)) : key === null ? 'Expiry unavailable' : 'Expiry not set';
}
export function filterByExpiry(medicines, filter = 'all', now = new Date()) {
  return filter === 'all' ? medicines : medicines.filter(medicine => getMedicineExpiryStatus(medicine.expiryDate, now).status === filter);
}
export function expirySummary(medicines, now = new Date()) {
  const counts = { 'expiring-soon': 0, expired: 0 };
  for (const medicine of medicines) { const { status } = getMedicineExpiryStatus(medicine.expiryDate, now); if (Object.hasOwn(counts, status)) counts[status]++; }
  return counts;
}
