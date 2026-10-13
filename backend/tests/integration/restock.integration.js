const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const Pharmacy = require('../../models/Pharmacy');
const Subscription = require('../../models/RestockSubscription');
const Notification = require('../../models/Notification');
const { fulfillRestock } = require('../../services/restock');
const { assertDevelopmentDatabase } = require('../../scripts/seed');
test('replica-set restock transaction commits notifications and rolls back failures', async t => {
  require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true });
  assertDevelopmentDatabase(process.env.MONGO_URI, process.env.NODE_ENV);
  let pharmacy;
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    if (!hello.setName && hello.msg !== 'isdbgrid') { t.skip('Local MongoDB is standalone; restock transactions require a replica set (Atlas supports them).'); return; }
    await Promise.all([Subscription.init(), Notification.init()]);
    const customer = new mongoose.Types.ObjectId();
    pharmacy = await Pharmacy.create({ name: `Restock integration ${randomUUID()}`, address: 'Test', district: 'Test', phone: '123', latitude: 6, longitude: 79, inventory: [{ name: 'Vitamin C', quantity: 0 }] });
    const medicineId = pharmacy.inventory[0]._id;
    const subscription = await Subscription.create({ customer, pharmacy: pharmacy._id, medicine: medicineId });
    await assert.rejects(Subscription.create({ customer, pharmacy: pharmacy._id, medicine: medicineId }), e => e.code === 11000);
    async function restock(abort) {
      await mongoose.connection.transaction(async session => {
        const p = await Pharmacy.findById(pharmacy._id).session(session);
        const medicine = p.inventory.id(medicineId); medicine.quantity = 20;
        await p.save({ session }); await fulfillRestock(p, medicine, session);
        if (abort) throw new Error('Deliberate test rollback');
      });
    }
    await assert.rejects(restock(true), /Deliberate test rollback/);
    assert.equal((await Pharmacy.findById(pharmacy._id)).inventory[0].quantity, 0);
    assert.equal((await Subscription.findById(subscription._id)).active, true);
    assert.equal(await Notification.countDocuments({ pharmacy: pharmacy._id }), 0);
    await restock(false);
    assert.equal((await Pharmacy.findById(pharmacy._id)).inventory[0].quantity, 20);
    assert.equal((await Subscription.findById(subscription._id)).active, false);
    const notification = await Notification.findOne({ pharmacy: pharmacy._id });
    assert.equal(String(notification.user), String(customer));
    assert.equal(notification.read, false);
  } finally {
    if (pharmacy) {
      await Notification.deleteMany({ pharmacy: pharmacy._id });
      await Subscription.deleteMany({ pharmacy: pharmacy._id });
      await Pharmacy.deleteOne({ _id: pharmacy._id });
    }
    await mongoose.disconnect();
  }
});
