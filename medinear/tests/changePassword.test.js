import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { createPasswordSubmission, validatePasswordChange } from '../src/utils/changePassword.js';
import { validateRegister } from '../src/utils/authValidation.js';
const values = () => ({ currentPassword: 'OldSecure123', newPassword: 'NewSecure456', confirmPassword: 'NewSecure456' });
function harness(api) {
  const state = { values: values(), errors: {}, error: '', busy: false, successes: 0 };
  const submission = createPasswordSubmission(api, {
    errors(value) { state.errors = value; }, error(value) { state.error = value; }, busy(value) { state.busy = value; },
    success() { state.successes++; state.values = { currentPassword: '', newPassword: '', confirmPassword: '' }; },
  }, () => 'test-session');
  return { state, submission };
}
test('empty fields and confirmation mismatch block requests; new password follows registration policy', async () => {
  const h = harness({ patch() { assert.fail('validation should stop request'); } });
  await h.submission.submit({ currentPassword: '', newPassword: '', confirmPassword: '' });
  assert.deepEqual(Object.keys(h.state.errors), ['currentPassword', 'newPassword', 'confirmPassword']);
  await h.submission.submit({ ...values(), confirmPassword: 'Different456' });
  assert.equal(h.state.errors.confirmPassword, 'New passwords do not match.');
  for (const password of ['short', 'abcdefgh1', 'ABCDEFGH1', 'Abcdefgh', 'Aa1' + 'a'.repeat(70), 'Aa1' + '\u00e9'.repeat(35)]) {
    assert.equal(validatePasswordChange({ ...values(), newPassword: password }).newPassword,
      validateRegister({ fullName: 'Test', email: 'x@y.test', phone: '0771234567', password, confirmPassword: password }).password);
  }
});
test('request has only current/new passwords and Bearer token; pending request blocks duplicates', async () => {
  let resolve, calls = 0;
  const h = harness({ patch(url, body, config) {
    calls++; assert.equal(url, '/users/password');
    assert.deepEqual(body, { currentPassword: 'OldSecure123', newPassword: 'NewSecure456' });
    assert.deepEqual(config.headers, { Authorization: 'Bearer test-session' });
    return new Promise(done => { resolve = done; });
  } });
  const pending = h.submission.submit(h.state.values);
  assert.equal(h.state.busy, true); await h.submission.submit(h.state.values); assert.equal(calls, 1);
  resolve({ data: { success: true } }); await pending;
  assert.equal(h.state.successes, 1); assert.equal(h.state.busy, false);
  assert.deepEqual(h.state.values, { currentPassword: '', newPassword: '', confirmPassword: '' });
});
test('incorrect current password stays inline, network/server errors are safe and loading restores', async () => {
  const h = harness({ async patch() { throw { response: { status: 400, data: { errors: { currentPassword: 'Current password is incorrect.' } } } }; } });
  await h.submission.submit(values()); assert.equal(h.state.errors.currentPassword, 'Current password is incorrect.'); assert.equal(h.state.busy, false);
  const failed = harness({ async patch() { throw { response: { status: 500, data: { message: 'private internals' } } }; } });
  await failed.submission.submit(values()); assert.match(failed.state.error, /Unable to change password/); assert.doesNotMatch(failed.state.error, /private/);
  assert.equal(failed.state.busy, false); assert.equal(failed.state.successes, 0);
});
test('unmount prevents response callbacks and StrictMode effect replay remains usable', async () => {
  let resolve; const h = harness({ patch: () => new Promise(done => { resolve = done; }) });
  const pending = h.submission.submit(values()); h.submission.dispose(); resolve(); await pending;
  assert.equal(h.state.successes, 0);
  h.submission.activate(); const again = h.submission.submit(values()); resolve(); await again;
  assert.equal(h.state.successes, 1);
});
test('form renders accessible password fields, existing show/hide controls and disabled submitting button', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { ChangePasswordForm, default: ChangePassword } = await vite.ssrLoadModule('/src/components/ChangePassword.jsx');
    const markup = renderToString(createElement(ChangePasswordForm, { values: values(), errors: { currentPassword: 'Current password is incorrect.' }, busy: true }));
    for (const label of ['Current Password', 'New Password', 'Confirm New Password', 'Changing Password...', 'Current password is incorrect.']) assert.ok(markup.includes(label));
    assert.equal((markup.match(/type="password"/g) || []).length, 3);
    assert.equal((markup.match(/aria-label="Show /g) || []).length, 3);
    assert.match(markup, /autoComplete="current-password"/); assert.match(markup, /autoComplete="new-password"/);
    assert.match(markup, /aria-busy="true"/); assert.equal((markup.match(/disabled=""/g) || []).length, 7);
    const { ToastContext } = await vite.ssrLoadModule('/src/auth/ToastContext.jsx');
    assert.match(renderToString(createElement(ToastContext.Provider, { value: { showToast() {} } }, createElement(ChangePassword))), /Change Password/);
    const source = readFileSync(new URL('../src/components/ChangePassword.jsx', import.meta.url), 'utf8');
    assert.match(source, /setValues\(emptyFields\(\)\)/); assert.match(source, /showToast\(\{ message: 'Password changed successfully\.', type: 'success' \}\)/);
    const profile = readFileSync(new URL('../src/pages/Profile.jsx', import.meta.url), 'utf8');
    assert.match(profile, /<ChangePassword \/>/); assert.match(profile, /<ProfilePhoto /);
  } finally { await vite.close(); }
});
