export function formatPrice(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? `LKR ${new Intl.NumberFormat('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`
    : 'Price unavailable';
}
export function formatUpdated(value, timezone = 'Asia/Colombo') {
  if (!value || Number.isNaN(new Date(value).getTime())) return 'Update time unavailable';
  try { return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone }).format(new Date(value)); }
  catch { return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Colombo' }).format(new Date(value)); }
}
export function imageSource(value, kind = 'medicine') {
  const fallback = `/${kind === 'pharmacy' ? 'pharmacy' : 'medicine'}-placeholder.svg`;
  if (typeof value !== 'string' || !value.trim()) return fallback;
  // Local assets are permitted; remote image URLs must use HTTPS.
  if (/^\/(?!\/)/.test(value) && !value.includes('\\')) return value;
  try { const url = new URL(value); if (url.protocol === 'https:' && !url.username && !url.password) return value; } catch { /* Fall through to local placeholder. */ }
  return fallback;
}
export function coordinatesFromSearch(search) {
  const params = new URLSearchParams(search);
  if (!params.has('lat') || !params.has('lng') || !params.get('lat') || !params.get('lng')) return null;
  const lat = Number(params.get('lat')), lng = Number(params.get('lng'));
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}
export function filterMedicines(medicines, text) {
  const query = text.trim().toLowerCase();
  return medicines.filter(m => [m.name, m.genericName, m.brand].some(value => (value || '').toLowerCase().includes(query)));
}
export function directionsUrl(pharmacy) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${pharmacy.latitude},${pharmacy.longitude}`)}`;
}
