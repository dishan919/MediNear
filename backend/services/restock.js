const { isMedicineUsable } = require('../../shared/medicineExpiry.mjs');
const Subscription = require('../models/RestockSubscription');
const Notification = require('../models/Notification');
function isRestock(oldQuantity, newQuantity) { return Number.isFinite(oldQuantity) && oldQuantity <= 0 && newQuantity > 0; }
async function fulfillRestock(pharmacy, medicine, session) {
  if (!isMedicineUsable(medicine)) return;
  const subscriptions = await Subscription.find({ pharmacy: pharmacy._id, medicine: medicine._id, active: true }).session(session);
  for (const subscription of subscriptions) {
    await Notification.create([{
      user: subscription.customer, subscription: subscription._id,
      title: 'Medicine Available', message: `${medicine.name} is now available at ${pharmacy.name}`,
      pharmacy: pharmacy._id, medicine: medicine._id, medicineName: medicine.name,
    }], { session });
    await Subscription.updateOne({ _id: subscription._id, active: true }, { $set: { active: false, fulfilledAt: new Date() } }, { session });
  }
}
module.exports = { isRestock, fulfillRestock };
