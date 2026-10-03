function validCoordinates(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}
function distanceKm(lat, lng, latitude, longitude) {
  if (!validCoordinates(lat, lng) || !validCoordinates(latitude, longitude)) return null;
  const rad = n => n * Math.PI / 180;
  const a = Math.sin(rad(latitude - lat) / 2) ** 2 + Math.cos(rad(lat)) * Math.cos(rad(latitude)) * Math.sin(rad(longitude - lng) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(Math.min(1, a)), Math.sqrt(Math.max(0, 1 - a)));
}
module.exports = { validCoordinates, distanceKm };
