import { copyText } from './sharePharmacy.js';
function usableAddress(address) {
  return typeof address === 'string' && !!address.trim() && !['undefined', 'null', 'not added', 'address unavailable', 'not available', 'n/a', 'unknown', '-'].includes(address.trim().toLowerCase());
}
export function displayedPharmacyAddress(pharmacy) {
  if (!usableAddress(pharmacy?.address)) return '';
  return `${pharmacy.address}${pharmacy.district ? `, ${pharmacy.district}` : ''}`;
}
export async function copyPharmacyAddress(address, environment = {}) {
  if (!usableAddress(address)) return { status: 'error', message: 'No pharmacy address is available to copy.' };
  try {
    if (await copyText(address, environment.navigator ?? globalThis.navigator, environment.document ?? globalThis.document)) return { status: 'copied', message: 'Address copied.' };
  } catch { /* Keep the details page usable even if a browser clipboard API fails. */ }
  return { status: 'error', message: 'Unable to copy the address. Please select and copy the displayed address.' };
}
