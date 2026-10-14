export const RECENT_PHARMACIES_KEY = 'medinear_recent_pharmacies';
export const MAX_RECENT_PHARMACIES = 5;
function storageForBrowser() { try { return globalThis.localStorage; } catch { return undefined; } }
function validId(value) { return typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value) ? value.toLowerCase() : ''; }
export function getRecentlyViewedPharmacies(storage = storageForBrowser()) {
  try {
    const raw = storage?.getItem(RECENT_PHARMACIES_KEY);
    const value = JSON.parse(raw || '[]');
    if (!Array.isArray(value)) { storage?.removeItem(RECENT_PHARMACIES_KEY); return []; }
    const ids = [...new Set(value.map(validId).filter(Boolean))].slice(0, MAX_RECENT_PHARMACIES);
    if (raw && JSON.stringify(ids) !== raw) storage?.setItem(RECENT_PHARMACIES_KEY, JSON.stringify(ids));
    return ids;
  } catch { try { storage?.removeItem(RECENT_PHARMACIES_KEY); } catch { /* unavailable */ } return []; }
}
export function addRecentlyViewedPharmacy(id, storage = storageForBrowser()) {
  const valid = validId(id), current = getRecentlyViewedPharmacies(storage);
  if (!valid) return current;
  const next = [valid, ...current.filter(value => value !== valid)].slice(0, MAX_RECENT_PHARMACIES);
  try { storage?.setItem(RECENT_PHARMACIES_KEY, JSON.stringify(next)); } catch { /* No persistence when storage is blocked. */ }
  return next;
}
export function removeRecentlyViewedPharmacy(id, storage = storageForBrowser()) {
  const next = getRecentlyViewedPharmacies(storage).filter(value => value !== validId(id));
  try { if (next.length) storage?.setItem(RECENT_PHARMACIES_KEY, JSON.stringify(next)); else storage?.removeItem(RECENT_PHARMACIES_KEY); } catch { /* unavailable */ }
  return next;
}
export function clearRecentlyViewedPharmacies(storage = storageForBrowser()) {
  try { storage?.removeItem(RECENT_PHARMACIES_KEY); } catch { /* unavailable */ }
  return [];
}
export function recordPharmacyDetailsView(user, response, expectedId, storage) {
  const id = validId(response?.pharmacy?._id);
  if (user?.role !== 'customer' || !(user.id || user._id) || response?.success !== true || !id || id !== validId(expectedId)) return null;
  return addRecentlyViewedPharmacy(id, storage);
}
export async function resolveRecentPharmacies(api, ids, signal) {
  const results = await Promise.allSettled(ids.map(id => Promise.resolve().then(() => api.get(`/pharmacies/${id}`, { signal }))));
  const pharmacies = [], missing = []; let failed = false;
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      if ([404, 410].includes(result.reason.response?.status)) missing.push(ids[index]);
      else failed = true;
    } else {
      const data = result.value.data;
      if (data?.success === true && validId(data.pharmacy?._id) === ids[index]) {
        // Never render inventories or search rankings in the recent section.
        const { _id, name, district, province, openingHours, timezone } = data.pharmacy;
        pharmacies.push({ _id, name, district, province, openingHours, timezone });
      } else failed = true;
    }
  });
  return { pharmacies, missing, failed };
}
