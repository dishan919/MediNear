const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const User = require('../../models/User');
const { photoStorage } = require('../../services/profilePhotos');
test('MongoDB login -> photo upload -> refresh -> edit -> replace -> logout/login persistence', async () => {
  require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true });
  require('../../scripts/seed').assertDevelopmentDatabase(process.env.MONGO_URI, process.env.NODE_ENV);
  process.env.JWT_SECRET ||= randomUUID();
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'medinear-photo-integration-'));
  let server, user;
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    const email = `${randomUUID()}@medinear.test`, password = 'PhotoIntegration123!';
    user = await User.create({ name: 'Photo Customer', email, password: await require('../../utils/hashPassword')(password), role: 'customer', phone: '0771234567', address: 'Colombo' });
    const app = express(); app.use(express.json()); app.use('/api/users', require('../../routes/profilePhotoRoutes')(photoStorage(directory))); app.use('/api/users', require('../../routes/userRoutes')); app.use('/api/auth', require('../../routes/authRoutes'));
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    async function request(url, method = 'GET', token, body, mime = 'application/json') {
      const r = await fetch(origin + url, { method, headers: { 'Content-Type': mime, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: mime === 'application/json' ? JSON.stringify(body) : body } : {}) });
      return { status: r.status, data: await r.json() };
    }
    const login = () => request('/api/auth/login', 'POST', undefined, { email, password });
    const signedIn = await login(); assert.equal(signedIn.status, 200); const token = signedIn.data.token;
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE2sAAAAASUVORK5CYII=', 'base64');
    const uploaded = await request('/api/users/profile/photo', 'PUT', token, png, 'image/png');
    assert.equal(uploaded.status, 200); const first = uploaded.data.profileImage;
    assert.equal((await User.findById(user._id)).profileImage, first);
    assert.equal((await request('/api/users/profile', 'GET', token)).data.user.profileImage, first);
    assert.equal((await request('/api/auth/profile', 'GET', token)).data.user.profileImage, first);
    const edit = await request('/api/users/profile', 'PUT', token, { name: 'Updated Customer', phone: '0779999999', address: 'Galle' });
    assert.equal(edit.status, 200); assert.equal(edit.data.user.profileImage, first);
    const replaced = await request('/api/users/profile/photo', 'PUT', token, png, 'image/png');
    assert.equal(replaced.status, 200); assert.notEqual(replaced.data.profileImage, first);
    assert.equal((await fetch(origin + first)).status, 404);
    assert.equal((await fs.readdir(directory)).length, 1);
    const relogin = await login(); assert.equal(relogin.status, 200); assert.equal(relogin.data.user.profileImage, replaced.data.profileImage);
    const refreshed = await request('/api/users/profile', 'GET', relogin.data.token);
    assert.equal(refreshed.data.user.name, 'Updated Customer'); assert.equal(refreshed.data.user.address, 'Galle'); assert.equal(refreshed.data.user.email, email); assert.equal(refreshed.data.user.profileImage, replaced.data.profileImage);
    const removed = await request('/api/users/profile/photo', 'DELETE', relogin.data.token);
    assert.equal(removed.status, 200); assert.equal(removed.data.user.profileImage, '');
    assert.equal((await User.findById(user._id)).profileImage, '');
    assert.equal((await fs.readdir(directory)).length, 0);
    assert.equal((await request('/api/users/profile', 'GET', relogin.data.token)).data.user.profileImage, '');
    const afterRemovalLogin = await login(); assert.equal(afterRemovalLogin.data.user.profileImage, '');
    const uploadedAgain = await request('/api/users/profile/photo', 'PUT', afterRemovalLogin.data.token, png, 'image/png');
    assert.equal(uploadedAgain.status, 200);
    assert.equal((await User.findById(user._id)).profileImage, uploadedAgain.data.profileImage);
    assert.equal((await fetch(origin + uploadedAgain.data.profileImage)).status, 200);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (user) await User.deleteOne({ _id: user._id });
    await mongoose.disconnect(); await fs.rm(directory, { recursive: true, force: true });
  }
});
