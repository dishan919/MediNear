// Pharmacy contacts are Sri Lankan. Do not guess country codes for ambiguous data.
export function normalizePharmacyPhone(phone) {
  if (typeof phone !== 'string') return '';
  const value = phone.trim();
  // Owner phone inputs allow formatting. Reject letters, extensions, URL characters
  // and embedded control characters before removing only known separators.
  if (!/^\+?[0-9 ().-]+$/.test(value)) return '';
  const compact = value.replace(/[ ().-]/g, '');
  if (/^0[1-9][0-9]{8}$/.test(compact)) return `94${compact.slice(1)}`;
  if (/^\+?94[1-9][0-9]{8}$/.test(compact)) return compact.replace(/^\+/, '');
  return '';
}

export function pharmacyWhatsAppUrl(phone) {
  const number = normalizePharmacyPhone(phone);
  return number ? `https://wa.me/${number}` : '';
}
