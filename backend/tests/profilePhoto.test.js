const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { validatePhoto, photoStorage, MAX_PHOTO_BYTES } = require('../services/profilePhotos');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE2sAAAAASUVORK5CYII=', 'base64');
test('server image validation checks signatures, declared MIME, empty files and byte limits', () => {
  assert.equal(validatePhoto(png, 'image/png'), 'png');
  for (const mime of ['image/svg+xml', 'text/javascript', 'application/octet-stream']) assert.throws(() => validatePhoto(png, mime), e => e.status === 415);
  assert.throws(() => validatePhoto(Buffer.from('<script>alert(1)</script>'), 'image/png'), e => e.status === 400);
  assert.throws(() => validatePhoto(png, 'image/jpeg'), e => e.status === 400);
  assert.throws(() => validatePhoto(Buffer.alloc(0), 'image/png'), e => e.status === 400);
  assert.throws(() => validatePhoto(Buffer.alloc(MAX_PHOTO_BYTES + 1), 'image/png'), e => e.status === 413);
});
test('HTTP customer upload, replacement, safe static access, ownership and profile edit regression', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'medinear-photo-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const storage = photoStorage(directory);
  const oldSecret = process.env.JWT_SECRET; process.env.JWT_SECRET = 'photo-test-secret';
  t.after(() => { if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret; });
  const customer = new User({ name: 'Dissa Kutty', email: 'photo@example.test', password: 'hashed-test', phone: '0771234567', address: 'Colombo', role: 'customer' });
  const other = new User({ name: 'Other', email: 'other@example.test', password: 'hashed-test', role: 'customer' });
  const owner = new User({ name: 'Owner', email: 'owner@example.test', password: 'hashed-test', role: 'pharmacy_owner' });
  const accounts = new Map([customer, other, owner].map(user => [String(user._id), user]));
  t.mock.method(User, 'findById', id => { const user = accounts.get(String(id)); return { select: async () => user, then: (resolve, reject) => Promise.resolve(user).then(resolve, reject) }; });
  let failUpdate = false;
  t.mock.method(User, 'findOneAndUpdate', (filter, update, options) => ({ select: async () => {
    if (failUpdate) throw new Error('Simulated database failure');
    assert.equal(options.returnDocument, 'before');
    assert.equal(filter._id.toString(), customer._id.toString());
    const previous = { profileImage: customer.profileImage }; customer.profileImage = update.$set.profileImage; return previous;
  } }));
  t.mock.method(customer, 'save', async () => customer);
  const app = express(); app.use(express.json()); app.use('/api/users', require('../routes/profilePhotoRoutes')(storage)); app.use('/api/users', require('../routes/userRoutes')); app.use('/api/auth', require('../routes/authRoutes'));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const token = user => jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
  async function upload(body = png, mime = 'image/png', user = customer) {
    const r = await fetch(origin + '/api/users/profile/photo', { method: 'PUT', headers: { 'Content-Type': mime, ...(user ? { Authorization: `Bearer ${token(user)}` } : {}) }, body });
    return { status: r.status, data: await r.json() };
  }
  assert.equal((await upload(png, 'image/png', null)).status, 401);
  assert.equal((await upload(png, 'image/png', owner)).status, 403);
  assert.equal((await upload(png, 'image/svg+xml')).status, 415);
  assert.equal((await upload(Buffer.from('not an image'))).status, 400);
  assert.equal((await upload(Buffer.alloc(MAX_PHOTO_BYTES + 1))).status, 413);
  assert.equal((await fs.readdir(directory)).length, 0);
  const saved = await upload(); assert.equal(saved.status, 200); assert.equal(saved.data.profileImage, customer.profileImage);
  assert.ok(!saved.data.profileImage.includes(directory));
  const first = customer.profileImage;
  const file = await fetch(origin + first); assert.equal(file.status, 200); assert.equal(file.headers.get('x-content-type-options'), 'nosniff'); assert.deepEqual(Buffer.from(await file.arrayBuffer()), png);
  async function read(url) { return (await fetch(origin + url, { headers: { Authorization: `Bearer ${token(customer)}` } })).json(); }
  assert.equal((await read('/api/users/profile')).user.profileImage, first);
  assert.equal((await read('/api/auth/profile')).user.profileImage, first);
  const second = await upload(); assert.equal(second.status, 200); assert.notEqual(second.data.profileImage, first);
  assert.equal((await fetch(origin + first)).status, 404); assert.equal((await fs.readdir(directory)).length, 1);
  const protectedPhoto = await storage.write(String(other._id), png, 'png');
  await storage.remove(protectedPhoto, String(customer._id)); assert.equal((await fetch(origin + protectedPhoto)).status, 200);
  await storage.remove('/api/users/profile-photos/../../package.json', String(customer._id));
  await fs.writeFile(path.join(directory, 'script.js'), 'alert(1)');
  assert.equal((await fetch(origin + '/api/users/profile-photos/script.js')).status, 404);
  const current = customer.profileImage; failUpdate = true;
  const log = t.mock.method(console, 'error', () => {});
  assert.equal((await upload()).status, 500); assert.equal(customer.profileImage, current);
  assert.equal((await fs.readdir(directory)).length, 3); failUpdate = false; log.mock.restore();
  const edited = await fetch(origin + '/api/users/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token(customer)}` }, body: JSON.stringify({ name: 'Updated Name', phone: '0779999999', address: 'Galle' }) });
  assert.equal(edited.status, 200); const edit = await edited.json(); assert.equal(edit.user.name, 'Updated Name'); assert.equal(edit.user.profileImage, current); assert.equal(edit.user.email, 'photo@example.test');
});

test('DELETE photo is customer-scoped, idempotent, safe for missing/unmanaged files and preserves fields', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'medinear-remove-photo-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const storage = photoStorage(directory);
  const secret = process.env.JWT_SECRET; process.env.JWT_SECRET = 'remove-photo-test';
  t.after(() => { if (secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = secret; });
  const customer = new User({ name: 'Customer', email: 'remove@example.test', password: 'private-hash', role: 'customer', phone: '0771234567', address: 'Colombo' });
  const other = new User({ name: 'Other', email: 'keep@example.test', password: 'private-hash', role: 'customer' });
  const owner = new User({ name: 'Owner', email: 'owner-remove@example.test', password: 'private-hash', role: 'pharmacy_owner' });
  const users = new Map([customer, other, owner].map(user => [String(user._id), user]));
  t.mock.method(User, 'findById', id => ({ select: async () => users.get(String(id)) }));
  let fail = false;
  t.mock.method(User, 'findOneAndUpdate', (filter, update, options) => ({ select: async fields => {
    if (fail) throw new Error('Database failed');
    assert.equal(options.returnDocument, 'before'); assert.equal(fields.includes('password'), false);
    const user = users.get(String(filter._id)); if (!user) return null;
    const previous = user.toObject(); user.profileImage = update.$set.profileImage; return previous;
  } }));
  const app = express(); app.use(express.json()); app.use('/api/users', require('../routes/profilePhotoRoutes')(storage));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  async function remove(user = customer, body) {
    const r = await fetch(origin + '/api/users/profile/photo', { method: 'DELETE', headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${jwt.sign({ userId: user._id }, process.env.JWT_SECRET)}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: r.status, data: await r.json() };
  }
  customer.profileImage = await storage.write(String(customer._id), png, 'png');
  other.profileImage = await storage.write(String(other._id), png, 'png'); const kept = other.profileImage;
  const original = customer.profileImage;
  assert.equal((await remove(null)).status, 401); assert.equal((await remove(owner)).status, 403);
  assert.equal(customer.profileImage, original);
  fail = true; const log = t.mock.method(console, 'error', () => {});
  assert.equal((await remove()).status, 500); assert.equal(customer.profileImage, original);
  assert.equal((await fetch(origin + original)).status, 200); fail = false; log.mock.restore();
  const removed = await remove(customer, { userId: String(other._id), profileImage: kept });
  assert.equal(removed.status, 200); assert.equal(removed.data.user.profileImage, ''); assert.equal(customer.profileImage, '');
  assert.equal(removed.data.message, 'Profile photo removed.'); assert.equal(removed.data.user.password, undefined);
  for (const field of ['name', 'email', 'phone', 'address']) assert.equal(removed.data.user[field], customer[field]);
  assert.equal((await fetch(origin + original)).status, 404); assert.equal((await fetch(origin + kept)).status, 200); assert.equal(other.profileImage, kept);
  assert.equal((await remove()).status, 200);
  customer.profileImage = await storage.write(String(customer._id), png, 'png');
  await storage.remove(customer.profileImage, String(customer._id));
  assert.equal((await remove()).status, 200); assert.equal(customer.profileImage, '');
  const asset = path.join(directory, 'default.svg'); await fs.writeFile(asset, '<svg></svg>');
  for (const value of ['/default.svg', '/api/users/profile-photos/../../default.svg', kept]) {
    customer.profileImage = value; assert.equal((await remove()).status, 200);
    assert.equal(customer.profileImage, ''); assert.equal(await fs.readFile(asset, 'utf8'), '<svg></svg>');
    assert.equal((await fetch(origin + kept)).status, 200);
  }
});
