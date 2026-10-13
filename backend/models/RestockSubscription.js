const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  pharmacy: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', required: true },
  medicine: { type: mongoose.Schema.Types.ObjectId, required: true },
  active: { type: Boolean, default: true, required: true },
  fulfilledAt: Date,
}, { timestamps: true });
schema.index({ customer: 1, pharmacy: 1, medicine: 1 }, { unique: true, partialFilterExpression: { active: true } });
schema.index({ pharmacy: 1, medicine: 1, active: 1 });
module.exports = mongoose.model('RestockSubscription', schema);
