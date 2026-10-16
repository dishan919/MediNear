const { isMedicineUsable, isMedicineAvailable } = require('../../shared/medicineExpiry.mjs');
const { openingStatus } = require("./openingHours");
const { distanceKm } = require("./distance");
const { matchesMedicine, publicMedicine } = require("./inventory");
const { provinceForDistrict, canonicalDistrict } = require("./locations");
function publicPharmacy(p, now) {
  return { _id: p._id, name: p.name, address: p.address, district: canonicalDistrict(p.district) || p.district, province: p.province || provinceForDistrict(p.district), phone: p.phone, latitude: p.latitude, longitude: p.longitude, image: p.image, timezone: p.timezone || "Asia/Colombo", openingHours: p.openingHours, ...openingStatus(p, now) };
}
function rankPharmacies(pharmacies, options = {}, now = new Date()) {
  const query = (options.medicine || "").trim();
  return pharmacies.map(p => {
    const result = publicPharmacy(p, now);
    const medicines = (p.inventory || []).filter(m => isMedicineUsable(m, now) && (options.includeOutOfStock || m.quantity > 0) && matchesMedicine(m, query));
    return { ...result, medicines: query ? medicines.map(m => publicMedicine(m, now)) : [], availability: query ? (medicines.some(m => isMedicineAvailable(m, now)) ? "Available" : "Unavailable") : null, distance: distanceKm(options.lat, options.lng, p.latitude, p.longitude) };
  }).filter(p => (!options.province || p.province === options.province) && (!options.district || p.district === options.district) && (!query || p.availability === "Available" || (options.includeOutOfStock && p.medicines.length)) && (!(options.openNow || options.emergency) || p.isOpen === true) && (!options.hour24 || p.open24Hours) && (options.radius === undefined || (p.distance !== null && p.distance <= options.radius)))
    .sort((a, b) => {
      const priority = p => p.isOpen === true ? 0 : p.isOpen === null ? 1 : 2;
      const distanceOrder = (a.distance ?? Infinity) - (b.distance ?? Infinity);
      const statusOrder = priority(a) - priority(b);
      return (query ? Number(a.availability !== "Available") - Number(b.availability !== "Available") : 0) || (options.sort === 'nearest' ? distanceOrder || statusOrder : statusOrder || distanceOrder) || a.name.localeCompare(b.name) || String(a._id).localeCompare(String(b._id));
    }).map((p, i) => ({ ...p, rank: i + 1, rankingReason: `${query ? `${p.availability === "Available" ? "Medicine available" : "Out of stock"}; ` : ""}${p.openStatus}; ${p.distance === null ? "distance unavailable" : `${p.distance.toFixed(1)} km away`}` }));
}
module.exports = { rankPharmacies, publicPharmacy };
