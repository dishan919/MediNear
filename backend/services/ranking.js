const { openingStatus } = require("./openingHours");
const { distanceKm } = require("./distance");
const { matchesMedicine, publicMedicine } = require("./inventory");
function publicPharmacy(p, now) {
  return { _id: p._id, name: p.name, address: p.address, district: p.district, phone: p.phone, latitude: p.latitude, longitude: p.longitude, image: p.image, timezone: p.timezone || "Asia/Colombo", openingHours: p.openingHours, ...openingStatus(p, now) };
}
function rankPharmacies(pharmacies, options = {}, now = new Date()) {
  const query = (options.medicine || "").trim();
  return pharmacies.map(p => {
    const result = publicPharmacy(p, now);
    const medicines = (p.inventory || []).filter(m => m.quantity > 0 && matchesMedicine(m, query));
    return { ...result, medicines: query ? medicines.map(publicMedicine) : [], availability: query ? (medicines.length ? "Available" : "Unavailable") : null, distance: distanceKm(options.lat, options.lng, p.latitude, p.longitude) };
  }).filter(p => (!query || p.availability === "Available") && (!(options.openNow || options.emergency) || p.isOpen === true) && (!options.hour24 || p.open24Hours) && (options.radius === undefined || (p.distance !== null && p.distance <= options.radius)))
    .sort((a, b) => {
      const priority = p => p.isOpen === true ? 0 : p.isOpen === null ? 1 : 2;
      return priority(a) - priority(b) || (a.distance ?? Infinity) - (b.distance ?? Infinity) || a.name.localeCompare(b.name) || String(a._id).localeCompare(String(b._id));
    }).map((p, i) => ({ ...p, rank: i + 1, rankingReason: `${query ? "Medicine available; " : ""}${p.openStatus}; ${p.distance === null ? "distance unavailable" : `${p.distance.toFixed(1)} km away`}` }));
}
module.exports = { rankPharmacies, publicPharmacy };
