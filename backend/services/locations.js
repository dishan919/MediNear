const locations = require('../../shared/sriLankaLocations.json');
function provinceForDistrict(district) {
  if (typeof district !== 'string') return undefined;
  return Object.keys(locations).find(province => locations[province].some(value => value.toLowerCase() === district.trim().toLowerCase()));
}
function canonicalDistrict(district) {
  const province = provinceForDistrict(district);
  return province && locations[province].find(value => value.toLowerCase() === district.trim().toLowerCase());
}
function validateArea(province, district) {
  if (province !== undefined && (typeof province !== 'string' || !Object.hasOwn(locations, province))) throw new Error('Invalid province');
  if (district !== undefined && (typeof district !== 'string' || !Object.values(locations).flat().includes(district))) throw new Error('Invalid district');
  if (province && district && !locations[province].includes(district)) throw new Error('District does not belong to the selected province');
}
module.exports = { locations, provinceForDistrict, canonicalDistrict, validateArea };
