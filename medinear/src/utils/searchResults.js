export function visiblePharmacyResults(pharmacies, pharmacyText = '') {
  const query = pharmacyText.trim().toLowerCase(), seen = new Set();
  return pharmacies.filter(pharmacy => {
    if (![pharmacy.name, pharmacy.address, pharmacy.district].some(value => (value || '').toLowerCase().includes(query))) return false;
    if (seen.has(pharmacy._id)) return false;
    seen.add(pharmacy._id); return true;
  });
}
export function searchResultCountText(results) {
  if (!results.length) return 'No pharmacies found';
  return `${results.length} ${results.length === 1 ? 'pharmacy' : 'pharmacies'} found`;
}
