const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../../models/User');

test('authenticated password change persists hashed credentials, isolates accounts and preserves JWT session', async () => {
  require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true });
  require('../../scripts/seed').assertDevelopmentDatabase(process.env.MONGO_URI, process.env.NODE_ENV);
  process.env.JWT_SECRET ||= randomUUID();
  let server; const ids = [];
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    const app = express(); app.use(express.json());
    app.use('/api/auth', require('../../routes/authRoutes')); app.use('/api/users', require('../../routes/userRoutes'));
    server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
    async function request(url, body, token, method = 'POST') {
      const res = await fetch(`http://127.0.0.1:${server.address().port}/api${url}`, { method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: res.status, data: await res.json() };
    }
    const accounts = [];
    for (const role of ['customer', 'pharmacy_owner']) {
      const body = { name: 'Password Integration', email: `${randomUUID()}@medinear.test`, phone: '0771234567', password: 'OldSecure123', role };
      const registered = await request('/auth/register', body); assert.equal(registered.status, 201);
      ids.push(registered.data.user.id); accounts.push({ ...body, id: registered.data.user.id, token: registered.data.token });
    }
    const [first, second] = accounts;
    const secondHash = (await User.findById(second.id)).password;
    const change = (body, token) => request('/users/password', body, token, 'PATCH');
    assert.equal((await change({ currentPassword: first.password, newPassword: 'NewSecure456' })).status, 401);
    assert.equal((await change({ currentPassword: 'wrong', newPassword: 'NewSecure456' }, first.token)).data.message, 'Current password is incorrect.');
    assert.equal((await change({ currentPassword: first.password, newPassword: 'weak' }, first.token)).status, 400);
    assert.equal((await change({ currentPassword: first.password, newPassword: first.password }, first.token)).status, 400);
    for (const account of accounts) {
      const result = await change({ currentPassword: account.password, newPassword: 'NewSecure456', userId: second.id }, account.token);
      assert.equal(result.status, 200); assert.deepEqual(result.data, { success: true, message: 'Password changed successfully.' });
      const stored = await User.findById(account.id);
      assert.notEqual(stored.password, 'NewSecure456'); assert.ok(await bcrypt.compare('NewSecure456', stored.password));
      assert.equal((await request('/auth/login', { email: account.email, password: account.password })).status, 401);
      assert.equal((await request('/auth/login', { email: account.email, password: 'NewSecure456' })).status, 200);
      assert.equal((await request('/users/profile', undefined, account.token, 'GET')).status, 200);
      if (account === first) assert.equal((await User.findById(second.id)).password, secondHash);
    }
  } finally {
    if (ids.length) await User.deleteMany({ _id: { $in: ids } });
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
  }
});
