export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export function validatePhotoFile(file) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Choose a JPEG, PNG or WebP image.';
  if (!file.size) return 'Choose a non-empty image file.';
  if (file.size > MAX_PHOTO_BYTES) return 'Photo must be 2 MB or smaller.';
  return '';
}
export function photoSource(value, apiBase, origin = globalThis.location?.origin || 'http://localhost:5173') {
  if (typeof value !== 'string' || !value) return '';
  if (value.startsWith('blob:')) return value;
  if (/^\/api\/users\/profile-photos\/[a-f0-9]{24}-[a-f0-9-]{36}\.(jpg|png|webp)$/.test(value)) {
    try { return new URL(value, new URL(apiBase, origin)).href; } catch { return ''; }
  }
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
export async function uploadProfilePhoto(api, file, token) {
  const response = await api.put('/users/profile/photo', file, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': file.type } });
  return response.data;
}

export async function removeProfilePhoto(api, token) {
  const response = await api.delete('/users/profile/photo', { headers: { Authorization: `Bearer ${token}` } });
  return response.data;
}
