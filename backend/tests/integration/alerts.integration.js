const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const User = require('../../models/User');
const Pharmacy = require('../../models/Pharmacy');
const Subscription = require('../../models/RestockSubscription');
const Notification = require('../../models/Notification');
const { assertDevelopmentDatabase } = require('../../scripts/seed');
const hashPassword = require('../../utils/hashPassword');

test('real local MongoDB login -> alert read/subscribe/reload/cancel and notifications', async () => {
  require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true });
  assertDevelopmentDatabase(process.env.MONGO_URI, process.env.NODE_ENV);
  process.env.JWT_SECRET ||= randomUUID();
  const userIds = []; let pharmacy, server;
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    await Promise.all([Subscription.init(), Notification.init()]);
    const password = `${randomUUID()}Aa1!`;
    for (const role of ['customer', 'customer', 'pharmacy_owner']) {
      const user = await User.create({ name: 'Temporary alert integration', email: `${randomUUID()}@medinear.test`, phone: '0771234567', password: await hashPassword(password), role });
      userIds.push(user._id);
    }
    const [customerId, otherId, ownerId] = userIds;
    pharmacy = await Pharmacy.create({ owner: ownerId, name: `Alert integration ${randomUUID()}`, address: 'Test', district: 'Test', phone: '123', latitude: 6, longitude: 79, inventory: [{ name: 'Vitamin C', quantity: 0 }] });
    const app = express(); app.use(express.json());
    app.use('/api/auth', require('../../routes/authRoutes'));
    app.use('/api/pharmacies', require('../../routes/pharmacyRoutes'));
    app.use('/api', require('../../routes/alertRoutes'));
    server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
    async function request(url, method = 'GET', token, body) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api${url}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, data: await response.json() };
    }
    const tokens = [];
    for (const userId of userIds) {
      const user = await User.findById(userId);
      const response = await request('/auth/login', 'POST', undefined, { email: user.email, password });
      assert.equal(response.status, 200); tokens.push(response.data.token);
    }
    const [customer, other, owner] = tokens;
    const body = { pharmacy: String(pharmacy._id), medicine: String(pharmacy.inventory[0]._id), customer: String(otherId) };
    const statusUrl = `/restock-subscriptions?pharmacy=${body.pharmacy}&medicine=${body.medicine}`;
    assert.equal((await request('/auth/profile', 'GET', customer)).data.user.id, String(customerId));
    assert.equal((await request('/restock-subscriptions', 'GET', customer)).status, 200);
    assert.equal((await request(statusUrl, 'GET', customer)).data.subscribed, false);
    assert.equal((await request(statusUrl)).status, 401);
    assert.equal((await request(statusUrl, 'GET', owner)).status, 403);
    assert.equal((await request('/restock-subscriptions?pharmacy=bad&medicine=bad', 'GET', customer)).status, 400);
    assert.equal((await request('/restock-subscriptions', 'POST', customer, { ...body, medicine: null })).status, 400);
    assert.equal((await request('/restock-subscriptions', 'POST', customer, { ...body, medicine: String(new mongoose.Types.ObjectId()) })).status, 404);
    assert.equal((await request('/restock-subscriptions', 'POST', customer, { ...body, pharmacy: String(new mongoose.Types.ObjectId()) })).status, 404);
    const added = await request('/restock-subscriptions', 'POST', customer, body);
    assert.equal(added.status, 201, 'Regression: standalone subscription previously returned 500 / MongoDB error 20');
    assert.equal(added.data.subscription.customer, String(customerId));
    // A second independent HTTP request represents authoritative reload state.
    assert.equal((await request(statusUrl, 'GET', customer)).data.subscribed, true);
    assert.equal((await request('/restock-subscriptions', 'GET', customer)).data.subscriptions.some(s => s._id === added.data.subscription._id), true);
    assert.equal((await request('/restock-subscriptions', 'POST', customer, body)).status, 409);
    assert.equal((await request(statusUrl, 'GET', other)).data.subscribed, false);
    const cancelUrl = `/restock-subscriptions/${added.data.subscription._id}`;
    assert.equal((await request(cancelUrl, 'DELETE', other)).status, 404);
    assert.equal((await request(cancelUrl, 'DELETE', customer)).status, 200);
    assert.equal((await request(statusUrl, 'GET', customer)).data.subscribed, false);
    assert.equal((await request('/restock-subscriptions', 'GET', customer)).data.subscriptions.length, 0);
    const again = await request('/restock-subscriptions', 'POST', customer, body);
    assert.equal(again.status, 201);
    // Fixture verifies ordinary notification endpoints, not a fake UI response.
    const notification = await Notification.create({ user: customerId, subscription: again.data.subscription._id, pharmacy: pharmacy._id, medicine: body.medicine, medicineName: 'Vitamin C', title: 'Medicine Available', message: 'Integration notification' });
    assert.equal((await request('/notifications', 'GET', customer)).data.unreadCount, 1);
    assert.equal((await request('/notifications', 'GET', other)).data.notifications.length, 0);
    const readUrl = `/notifications/${notification._id}/read`;
    assert.equal((await request(readUrl, 'PATCH', other)).status, 404);
    assert.equal((await request(readUrl, 'PATCH', customer)).status, 200);
    assert.equal((await request('/notifications', 'GET', customer)).data.unreadCount, 0);
    assert.equal((await request(`/pharmacies/${pharmacy._id}`)).data.pharmacy.medicines[0].quantity, 0);
    assert.equal((await request('/pharmacies/search?medicine=Vitamin%20C&includeOutOfStock=true')).data.pharmacies.some(p => p._id === String(pharmacy._id)), true);
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    if (!hello.setName && hello.msg !== 'isdbgrid') {
      const result = await request(`/pharmacies/${pharmacy._id}/inventory/${body.medicine}`, 'PATCH', owner, { quantity: 20 });
      assert.equal(result.status, 503);
      assert.equal((await Pharmacy.findById(pharmacy._id)).inventory[0].quantity, 0);
      assert.equal((await Subscription.findById(again.data.subscription._id)).active, true);
      assert.equal(await Notification.countDocuments({ pharmacy: pharmacy._id }), 1);
    }
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (pharmacy) {
      await Notification.deleteMany({ pharmacy: pharmacy._id });
      await Subscription.deleteMany({ pharmacy: pharmacy._id });
      await Pharmacy.deleteOne({ _id: pharmacy._id });
    }
    if (userIds.length) await User.deleteMany({ _id: { $in: userIds } });
    await mongoose.disconnect();
  }
});
