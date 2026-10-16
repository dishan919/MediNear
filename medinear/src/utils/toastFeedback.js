export function copyAddressFeedback(result) {
  return { message: result.status === 'copied' ? 'Address copied.' : 'Could not copy address.', type: result.status === 'copied' ? 'success' : 'error' };
}
export function shareFeedback(result) {
  if (result.status === 'copied') return { message: 'Pharmacy link copied.', type: 'success' };
  if (result.status === 'error' && !result.url) return { message: result.message, type: 'error' };
  return null;
}
export function favoriteFeedback(saved) {
  return { message: saved ? 'Pharmacy saved.' : 'Pharmacy removed.', type: 'success' };
}
export function photoFeedback(removed = false) {
  return { message: removed ? 'Profile photo removed.' : 'Profile photo updated.', type: 'success' };
}
