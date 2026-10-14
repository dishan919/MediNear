import locations from '../../../shared/sriLankaLocations.json' with { type: 'json' };
export { locations };
export function provinceForDistrict(district) {
  return Object.keys(locations).find(province => locations[province].includes(district));
}
export function changeProvince(params, province) {
  const next = new URLSearchParams(params);
  if (province) next.set('province', province); else next.delete('province');
  if (!locations[province]?.includes(next.get('district'))) next.delete('district');
  return next;
}
export function geolocationMessage(error) {
  const fallback = ' You can still search by province and district.';
  return ({ 1: 'Location access was denied.', 2: 'Your location is unavailable.', 3: 'Finding your location timed out.' }[error?.code] || 'Unable to find your location.') + fallback;
}
// Called only by the explicit location button. No watchers or persistence.
export function requestLocation(geolocation, onSuccess, onError) {
  if (!geolocation) { onError({ code: 0, unsupported: true }); return; }
  geolocation.getCurrentPosition(onSuccess, onError, { timeout: 10000, maximumAge: 60000 });
}
