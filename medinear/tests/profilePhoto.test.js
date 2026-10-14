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

test('remove-photo service calls only current account endpoint and preserves backend failure', async () => {
  const { removeProfilePhoto } = await import('../src/utils/profilePhoto.js'); let call;
  const api = { delete: async (...args) => { call = args; return { data: { user: { profileImage: '' }, message: 'Profile photo removed.' } }; } };
  const result = await removeProfilePhoto(api, 'session');
  assert.equal(result.user.profileImage, ''); assert.equal(call[0], '/users/profile/photo');
  assert.deepEqual(call[1], { headers: { Authorization: 'Bearer session' } });
  api.delete = async () => { throw new Error('Deletion failed'); };
  await assert.rejects(removeProfilePhoto(api, 'session'), /Deletion failed/);
});
test('remove controls require confirmation, Cancel sends no delete, busy blocks changes and cleared photo shows initials', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { PhotoControls, ProfileAvatar, default: Photo } = await vite.ssrLoadModule('/src/components/ProfilePhoto.jsx');
    const render = element => renderToString(element);
    assert.match(render(createElement(PhotoControls, { hasPhoto: true })), /Remove Photo/);
    assert.doesNotMatch(render(createElement(PhotoControls, { hasPhoto: false })), /Remove Photo/);
    const saved = render(createElement(Photo, { user: { role: 'customer', name: 'Dissa', profileImage: 'https://example.test/photo.png' }, initials: 'D' }));
    assert.match(saved, /Remove Photo/); assert.match(saved, /Change Photo/);
    // Exercise the existing dependency-free controlled-view callback pattern.
    let confirming = false, requests = 0;
    const view = () => PhotoControls({ hasPhoto: true, confirming, onRemoveRequest: () => { confirming = true; }, onRemoveCancel: () => { confirming = false; }, onRemoveConfirm: () => { requests++; } });
    const buttons = element => {
      if (!element || typeof element !== 'object') return [];
      if (element.type === 'button') return [element];
      return [element.props?.children].flat(Infinity).flatMap(buttons);
    };
    buttons(view()).find(button => button.props.children === 'Remove Photo').props.onClick();
    assert.equal(requests, 0); assert.match(render(view()), /Remove profile photo\?/);
    buttons(view()).find(button => button.props.children === 'Cancel').props.onClick();
    assert.equal(confirming, false); assert.equal(requests, 0); assert.doesNotMatch(render(view()), /Remove profile photo\?/);
    const busy = render(createElement(PhotoControls, { hasPhoto: true, confirming: true, removing: true, busy: true }));
    assert.match(busy, /Removing\.\.\./); assert.equal((busy.match(/disabled/g) || []).length, 3);
    assert.match(render(createElement(ProfileAvatar, { src: '', name: 'Dissa Kutty', initials: 'DK' })), /DK/);
    assert.doesNotMatch(render(createElement(ProfileAvatar, { src: '', name: 'Dissa Kutty', initials: 'DK' })), /<img/);
  } finally { await vite.close(); }
});
