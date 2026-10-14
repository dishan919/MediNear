import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { validatePhotoFile, photoSource, uploadProfilePhoto, MAX_PHOTO_BYTES } from '../src/utils/profilePhoto.js';
test('photo file selection accepts JPEG/PNG/WebP and rejects invalid, empty or oversized files', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) assert.equal(validatePhotoFile({ type, size: 100 }), '');
  assert.match(validatePhotoFile({ type: 'image/svg+xml', size: 100 }), /JPEG, PNG or WebP/);
  assert.match(validatePhotoFile({ type: 'image/png', size: MAX_PHOTO_BYTES + 1 }), /2 MB/);
  assert.match(validatePhotoFile({ type: 'image/png', size: 0 }), /non-empty/);
  assert.equal(validatePhotoFile({ type: 'image/png', size: MAX_PHOTO_BYTES }), '');
});
test('managed photo paths use API origin; preview URLs are supported and unsafe values rejected', () => {
  const managed = '/api/users/profile-photos/507f1f77bcf86cd799439011-12345678-1234-1234-1234-123456789abc.png';
  assert.equal(photoSource(managed, 'https://api.example.test/api'), 'https://api.example.test' + managed);
  assert.equal(photoSource(managed, '/api', 'https://medinear.example.test'), 'https://medinear.example.test' + managed);
  assert.equal(photoSource('blob:https://example.test/preview', '/api'), 'blob:https://example.test/preview');
  assert.equal(photoSource('javascript:alert(1)', '/api'), '');
  assert.equal(photoSource('/api/users/profile-photos/../../secret', '/api'), '');
});
test('photo upload uses existing API and token, raw file bytes, server response and error propagation', async () => {
  const file = { type: 'image/png', size: 100 }; let call;
  const api = { put: async (...args) => { call = args; return { data: { profileImage: '/managed-photo', message: 'Saved' } }; } };
  assert.equal((await uploadProfilePhoto(api, file, 'session')).profileImage, '/managed-photo');
  assert.equal(call[0], '/users/profile/photo'); assert.equal(call[1], file);
  assert.deepEqual(call[2].headers, { Authorization: 'Bearer session', 'Content-Type': 'image/png' });
  api.put = async () => { throw new Error('Upload failed'); };
  await assert.rejects(uploadProfilePhoto(api, file, 'session'), /Upload failed/);
});
test('photo UI renders initials, saved photo, preview controls, busy state and useful failures', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { ProfileAvatar, PhotoControls, default: Photo } = await vite.ssrLoadModule('/src/components/ProfilePhoto.jsx');
    const render = component => renderToString(component);
    const fallback = render(createElement(ProfileAvatar, { name: 'Dissa Kutty', initials: 'DK' }));
    assert.match(fallback, /DK/); assert.doesNotMatch(fallback, /<img/);
    const saved = render(createElement(ProfileAvatar, { src: 'https://example.test/photo.png', name: 'Dissa Kutty', initials: 'DK' }));
    assert.match(saved, /<img/); assert.match(saved, /profile photo/);
    const preview = render(createElement(PhotoControls, { preview: true }));
    assert.match(preview, /Photo preview/); assert.match(preview, /Save Photo/); assert.match(preview, /Cancel/);
    const busy = render(createElement(PhotoControls, { preview: true, busy: true }));
    assert.match(busy, /Saving Photo/); assert.match(busy, /aria-busy="true"/); assert.equal((busy.match(/disabled/g) || []).length, 3);
    const failed = render(createElement(PhotoControls, { error: 'Upload failed', message: '' }));
    assert.match(failed, /role="alert"/); assert.match(failed, /Upload failed/);
    assert.match(render(createElement(Photo, { user: { name: 'Dissa Kutty', role: 'customer' }, initials: 'DK' })), /Change Photo/);
    assert.doesNotMatch(render(createElement(Photo, { user: { name: 'Owner', role: 'pharmacy_owner' }, initials: 'O' })), /Change Photo/);
  } finally { await vite.close(); }
});
