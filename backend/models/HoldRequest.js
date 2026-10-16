const mongoose = require('mongoose');
const holdSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  pharmacy: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', required: true, immutable: true },
  medicine: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
  quantity: { type: Number, required: true, min: 1, validate: Number.isSafeInteger, immutable: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected', 'cancelled'], default: 'pending', required: true },
}, { timestamps: true });
holdSchema.index({ customer: 1, pharmacy: 1, medicine: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } });
holdSchema.index({ customer: 1, createdAt: -1, _id: -1 });
holdSchema.index({ pharmacy: 1, createdAt: -1, _id: -1 });
module.exports = mongoose.model('HoldRequest', holdSchema);
