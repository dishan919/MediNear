const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { changePassword } = require('../controllers/passwordController');
const { protect } = require('../middleware/authMiddleware');
const { loginUser } = require('../controllers/authController');
const { validateAuth, validatePassword } = require('../utils/authValidation');
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.data = data; return this; } });

test('password endpoint rejects unauthenticated requests through existing protect', async () => {
  const res = response(); await protect({ headers: {} }, res, () => assert.fail('unauthenticated'));
  assert.equal(res.statusCode, 401);
});
test('change verifies current password, hashes replacement, ignores client identity and supports subsequent login', async t => {
  const old = 'OldSecure123', next = 'NewSecure456';
  const user = { _id: '507f1f77bcf86cd799439011', email: 'test@example.test', name: 'Test', role: 'customer', password: await bcrypt.hash(old, 10) };
  const originalHash = user.password; let updates = 0;
  t.mock.method(User, 'findById', async id => { assert.equal(id, user._id); return { ...user }; });
  t.mock.method(User, 'updateOne', async (filter, update) => {
    assert.deepEqual(filter, { _id: user._id, password: originalHash });
    user.password = update.$set.password; updates++; return { modifiedCount: 1 };
  });
  const request = (currentPassword, newPassword) => ({ user: { _id: user._id }, body: { currentPassword, newPassword, userId: 'another-user', _id: 'another-user' } });
  const wrong = response(); await changePassword(request('wrong', next), wrong);
  assert.equal(wrong.statusCode, 400); assert.equal(wrong.data.errors.currentPassword, 'Current password is incorrect.');
  const same = response(); await changePassword(request(old, old), same);
  assert.equal(same.statusCode, 400); assert.match(same.data.errors.newPassword, /different/);
  assert.equal(updates, 0);
  const res = response(); await changePassword(request(old, next), res);
  assert.equal(res.statusCode, 200); assert.equal(updates, 1);
  assert.notEqual(user.password, next); assert.equal(await bcrypt.compare(next, user.password), true);
  assert.equal(await bcrypt.compare(old, user.password), false); assert.equal(bcrypt.getRounds(user.password), 10);
  assert.deepEqual(res.data, { success: true, message: 'Password changed successfully.' });
  t.mock.method(User, 'findOne', async () => user);
  const previous = process.env.JWT_SECRET; process.env.JWT_SECRET = 'password-unit-test-only';
  t.after(() => { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; });
  const denied = response(); await loginUser({ body: { email: user.email, password: old } }, denied); assert.equal(denied.statusCode, 401);
  const accepted = response(); await loginUser({ body: { email: user.email, password: next } }, accepted); assert.equal(accepted.statusCode, 200);
});
test('change password reuses registration policy including UTF-8 bcrypt limit', async t => {
  t.mock.method(User, 'findById', () => assert.fail('invalid input must not query database'));
  for (const password of ['', 'short', 'abcdefgh', 'ABCDEFG1', 'Abcdefgh', 'A1' + 'a'.repeat(71), 'A1a' + '\u00e9'.repeat(35), {}, null]) {
    assert.ok(validatePassword(password));
    assert.equal(validatePassword(password), validateAuth({ password }, true).password);
    const res = response(); await changePassword({ body: { currentPassword: 'old', newPassword: password } }, res);
    assert.equal(res.statusCode, 400); assert.ok(res.data.errors.newPassword);
  }
  for (const body of [undefined, {}, { currentPassword: 5, newPassword: 'NewSecure456' }]) {
    const res = response(); await changePassword({ body }, res); assert.equal(res.statusCode, 400); assert.ok(res.data.errors.currentPassword);
  }
});
test('missing account, database errors and concurrent changes return safe feedback', async t => {
  t.mock.method(User, 'findById', async () => null);
  const req = { user: { _id: 'id' }, body: { currentPassword: 'OldSecure123', newPassword: 'NewSecure456' } };
  const missing = response(); await changePassword(req, missing); assert.equal(missing.statusCode, 401);
  User.findById.mock.mockImplementation(async () => { throw new Error('private database internals'); });
  const failed = response(); await changePassword(req, failed); assert.equal(failed.statusCode, 500); assert.doesNotMatch(JSON.stringify(failed.data), /private/);
  const password = await bcrypt.hash(req.body.currentPassword, 10);
  User.findById.mock.mockImplementation(async () => ({ _id: 'id', password }));
  t.mock.method(User, 'updateOne', async () => ({ modifiedCount: 0 }));
  const conflict = response(); await changePassword(req, conflict); assert.equal(conflict.statusCode, 409);
  assert.doesNotMatch(JSON.stringify(conflict.data), /\$2[aby]\$/);
});
