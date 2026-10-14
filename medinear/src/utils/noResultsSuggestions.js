import { coordinatesFromSearch } from './medicineDisplay.js';
const optionalFilters = ['province', 'district', 'radius', 'openNow', 'hour24', 'emergency', 'pharmacy'];
export function hasRestrictiveFilters(params) {
  return !!(params.get('province') || params.get('district') || params.get('pharmacy')?.trim() ||
    (coordinatesFromSearch(params.toString()) && params.get('radius')) ||
    ['openNow', 'hour24', 'emergency'].some(key => params.get(key) === 'true') ||
    (params.get('medicine')?.trim() && params.get('includeOutOfStock') !== 'true'));
}
export function noResultsSuggestions(params) {
  const suggestions = [];
  if (params.get('medicine')?.trim()) suggestions.push('Check the medicine name or try a different medicine.');
  if (coordinatesFromSearch(params.toString()) && params.get('radius')) suggestions.push('Increase the search radius.');
  if (params.get('province') || params.get('district')) suggestions.push('Try another district or remove the location filter.');
  if (params.get('emergency') === 'true') suggestions.push('Try removing Emergency Mode to include pharmacies that are currently closed.');
  else if (params.get('openNow') === 'true') suggestions.push('Try including pharmacies that are currently closed.');
  if (params.get('hour24') === 'true') suggestions.push('Try removing the 24-hour filter.');
  if (params.get('medicine')?.trim() && params.get('includeOutOfStock') !== 'true') suggestions.push('Try including pharmacies where the medicine is currently out of stock.');
  if (params.get('pharmacy')?.trim()) suggestions.push('Remove the pharmacy name or address filter.');
  if (!suggestions.length) suggestions.push('Try searching for a medicine or a different pharmacy name.');
  return suggestions.slice(0, 4);
}
export function clearNoResultsFilters(params) {
  const next = new URLSearchParams(params);
  optionalFilters.forEach(key => next.delete(key));
  // Remove the availability restriction through its existing filter flag, not a new rule.
  if (next.get('medicine')?.trim()) next.set('includeOutOfStock', 'true');
  else next.delete('includeOutOfStock');
  return next;
}
