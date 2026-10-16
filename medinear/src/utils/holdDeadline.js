export function pickupDates(request) {
  const accepted = typeof request.acceptedAt === 'string' ? Date.parse(request.acceptedAt) : NaN;
  const expires = typeof request.expiresAt === 'string' ? Date.parse(request.expiresAt) : NaN;
  return Number.isFinite(accepted) && accepted > 0 && Number.isFinite(expires) && expires > accepted ? { accepted, expires } : null;
}
export function remainingPickupTime(expiresAt, now) {
  if (!Number.isFinite(expiresAt) || !Number.isFinite(now)) return 'Time remaining unavailable. Refresh hold requests.';
  const minutes = Math.ceil((expiresAt - now) / 60000);
  if (minutes <= 0) return 'Pickup deadline reached. Refresh hold requests to confirm status.';
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  return hours ? `${hours} hr ${rest} min remaining` : `${rest} min remaining`;
}
export function estimatedServerTime(serverNow, receivedAt, monotonicNow = globalThis.performance?.now()) {
  return Number.isFinite(serverNow) && Number.isFinite(receivedAt) && Number.isFinite(monotonicNow) ? serverNow + Math.max(0, monotonicNow - receivedAt) : NaN;
}
export function deadlineFields(item) {
  const result = {};
  for (const key of ['acceptedAt', 'expiresAt', 'completedAt', 'expiredAt']) if (item[key] !== undefined) result[key] = item[key];
  return result;
}
export function serverTimeAnchor(value) {
  const serverNow = typeof value === 'string' ? Date.parse(value) : NaN;
  return { serverNow, receivedAt: globalThis.performance?.now() };
}
