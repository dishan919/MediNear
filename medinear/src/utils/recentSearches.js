export const RECENT_SEARCHES_KEY = 'medinear_recent_searches';
export const MAX_RECENT_SEARCHES = 5;
function browserStorage() {
  try { return globalThis.localStorage; } catch { return undefined; }
}
export function normalizeMedicineSearch(term) {
  if (typeof term !== 'string') return '';
  const normalized = term.trim();
  return normalized.length <= 120 ? normalized : '';
}
export function getRecentSearches(storage = browserStorage()) {
  try {
    const value = JSON.parse(storage?.getItem(RECENT_SEARCHES_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value.map(normalizeMedicineSearch).filter(term => {
      const key = term.toLowerCase();
      if (!term || seen.has(key)) return false;
      seen.add(key); return true;
    }).slice(0, MAX_RECENT_SEARCHES);
  } catch { return []; }
}
export function addRecentSearch(term, storage = browserStorage()) {
  const normalized = normalizeMedicineSearch(term), recent = getRecentSearches(storage);
  if (!normalized) return recent;
  const next = [normalized, ...recent.filter(value => value.toLowerCase() !== normalized.toLowerCase())].slice(0, MAX_RECENT_SEARCHES);
  try { storage?.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next)); } catch { /* Search still works when browser storage is unavailable. */ }
  return next;
}
export function clearRecentSearches(storage = browserStorage()) {
  try { storage?.removeItem(RECENT_SEARCHES_KEY); } catch { /* Keep the search page usable. */ }
  return [];
}
export function medicineSearchParams(params, term) {
  const next = new URLSearchParams(params), normalized = normalizeMedicineSearch(term);
  if (normalized) next.set('medicine', normalized); else next.delete('medicine');
  return next;
}
// Track only explicit searches. Stale responses, typing and Clear History invalidate the intent.
export function createRecentSearchRecorder(storage) {
  let pending;
  return {
    begin(term) { const normalized = normalizeMedicineSearch(term); pending = normalized ? { term: normalized } : undefined; return pending; },
    current: () => pending,
    cancel() { pending = undefined; },
    complete(intent, searchedTerm, success) {
      if (!intent || pending !== intent || !success || intent.term !== normalizeMedicineSearch(searchedTerm)) return null;
      pending = undefined;
      return addRecentSearch(intent.term, storage);
    },
  };
}
