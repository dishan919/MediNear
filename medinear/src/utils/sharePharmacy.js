export function buildPharmacyShareUrl(pharmacyId, origin) {
  if (typeof pharmacyId !== 'string' || !/^[a-f0-9]{24}$/i.test(pharmacyId)) throw new Error('Invalid pharmacy ID');
  const host = new URL(origin);
  if (!['http:', 'https:'].includes(host.protocol)) throw new Error('Invalid origin');
  return new URL(`/pharmacy/${pharmacyId}`, host.origin).href;
}
function legacyCopy(url, document) {
  if (!document?.body || typeof document.execCommand !== 'function') return false;
  const active = document.activeElement;
  const textarea = document.createElement('textarea');
  textarea.value = url; textarea.readOnly = true;
  textarea.style.position = 'fixed'; textarea.style.left = '-9999px';
  try {
    document.body.appendChild(textarea); textarea.select();
    return document.execCommand('copy') === true;
  } catch { return false; }
  finally { textarea.remove(); active?.focus?.({ preventScroll: true }); }
}
export async function copyText(url, navigator, document) {
  try {
    if (typeof navigator?.clipboard?.writeText === 'function') {
      await navigator.clipboard.writeText(url); return true;
    }
  } catch { /* Fall back for denied permissions or older/non-secure browsers. */ }
  return legacyCopy(url, document);
}
// Keep the existing Share Pharmacy interface using the same generic clipboard implementation.
export const copyPharmacyLink = copyText;
export async function sharePharmacy(pharmacy, environment = {}) {
  const navigator = environment.navigator ?? globalThis.navigator;
  const document = environment.document ?? globalThis.document;
  const origin = environment.origin ?? globalThis.location?.origin;
  let url;
  try {
    url = buildPharmacyShareUrl(pharmacy._id, origin);
    if (typeof navigator?.share === 'function') {
      await navigator.share({ title: `${pharmacy.name} - MediNear`, text: `View ${pharmacy.name} on MediNear.`, url });
      return { status: 'shared', message: 'Pharmacy shared.' };
    }
  } catch (error) {
    if (error.name === 'AbortError') return { status: 'cancelled', message: '' };
    return { status: 'error', message: 'Unable to share this pharmacy. Please try again.' };
  }
  if (await copyPharmacyLink(url, navigator, document)) return { status: 'copied', message: 'Pharmacy link copied.' };
  return { status: 'error', message: 'Unable to copy the pharmacy link. Please copy it from the address bar.', url };
}
