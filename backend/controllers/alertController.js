const mongoose = require('mongoose');
const Pharmacy = require('../models/Pharmacy');
const Subscription = require('../models/RestockSubscription');
const Notification = require('../models/Notification');
const { supportsTransactions } = require('../services/databaseCapabilities');
const logServerError = require('../utils/logServerError');
const error = (status, message) => Object.assign(new Error(message), { status });
function id(value) { if (typeof value !== 'string' || !/^[a-f0-9]{24}$/i.test(value)) throw error(400, 'Invalid ID'); return value; }
function handler(action) {
  return async (req, res) => {
    try { await action(req, res); }
    catch (e) {
      const invalid = ['ValidationError', 'CastError'].includes(e.name);
      const status = e.code === 11000 ? 409 : e.status || (invalid ? 400 : 500);
      if (status >= 500) logServerError(`${req.method} ${req.route?.path || 'alerts'}`, e);
      res.status(status).json({ success: false, message: e.code === 11000 ? 'Restock alert already active' : e.status ? e.message : invalid ? 'Invalid alert input' : 'Unable to process alerts. Please try again.' });
    }
  };
}
async function pharmacyMedicine(pharmacyId, medicineId, session) {
  const query = Pharmacy.findById(pharmacyId);
  const pharmacy = await (session ? query.session(session) : query);
  if (!pharmacy) throw error(404, 'Pharmacy not found');
  const medicine = pharmacy.inventory.id(medicineId);
  if (!medicine) throw error(404, 'Medicine not found');
  return { pharmacy, medicine };
}
exports.subscribe = handler(async (req, res) => {
  const pharmacyId = id(req.body?.pharmacy), medicineId = id(req.body?.medicine);
  // Validate before topology inspection so bad input gets its normal 4xx response.
  const { medicine } = await pharmacyMedicine(pharmacyId, medicineId);
  if (medicine.quantity > 0) throw error(409, 'Medicine is already available');
  let subscription;
  if (await supportsTransactions()) {
    // Atlas/replica-set path preserves serialization with concurrent restocks.
    await mongoose.connection.transaction(async session => {
      const { medicine: current } = await pharmacyMedicine(pharmacyId, medicineId, session);
      if (current.quantity > 0) throw error(409, 'Medicine is already available');
      await Pharmacy.updateOne({ _id: pharmacyId }, { $inc: { __v: 1 } }, { session });
      [subscription] = await Subscription.create([{ customer: req.user._id, pharmacy: pharmacyId, medicine: medicineId }], { session });
    });
  } else {
    // Standalone can persist the single subscription document. Critical restock
    // writes are intentionally refused there, so no weaker restock path is used.
    [subscription] = await Subscription.create([{ customer: req.user._id, pharmacy: pharmacyId, medicine: medicineId }]);
  }
  res.status(201).json({ success: true, subscription });
});
exports.subscriptions = handler(async (req, res) => {
  const filter = { customer: req.user._id, active: true };
  const checkingMedicine = req.query.pharmacy !== undefined || req.query.medicine !== undefined;
  if (checkingMedicine) {
    filter.pharmacy = id(req.query.pharmacy); filter.medicine = id(req.query.medicine);
    await pharmacyMedicine(filter.pharmacy, filter.medicine);
  }
  const subscriptions = await Subscription.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, subscriptions, ...(checkingMedicine ? { subscribed: subscriptions.length > 0 } : {}) });
});
exports.unsubscribe = handler(async (req, res) => {
  const subscription = await Subscription.findOneAndUpdate({ _id: id(req.params.id), customer: req.user._id, active: true }, { $set: { active: false } }, { returnDocument: 'after' });
  if (!subscription) throw error(404, 'Active subscription not found');
  res.json({ success: true, subscription });
});
exports.notifications = handler(async (req, res) => {
  const filter = { user: req.user._id };
  const [notifications, unreadCount] = await Promise.all([Notification.find(filter).sort({ createdAt: -1 }).limit(100), Notification.countDocuments({ ...filter, read: false })]);
  res.json({ success: true, notifications, unreadCount });
});
exports.markRead = handler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate({ _id: id(req.params.id), user: req.user._id }, { $set: { read: true } }, { returnDocument: 'after' });
  if (!notification) throw error(404, 'Notification not found');
  res.json({ success: true, notification });
});
