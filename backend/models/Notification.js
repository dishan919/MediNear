const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'RestockSubscription', required: true, unique: true },
  type: { type: String, enum: ['medicine_restock'], default: 'medicine_restock' },
  title: { type: String, required: true },
  message: { type: String, required: true },
  pharmacy: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', required: true },
  medicine: { type: mongoose.Schema.Types.ObjectId, required: true },
  medicineName: { type: String, required: true },
  read: { type: Boolean, default: false },
}, { timestamps: true });
schema.index({ user: 1, read: 1, createdAt: -1 });
module.exports = mongoose.model('Notification', schema);
