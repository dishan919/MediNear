const mongoose = require('mongoose');
const reviewSchema = new mongoose.Schema({
  pharmacy: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
  comment: { type: String, trim: true, maxlength: 500, default: '' },
}, { timestamps: true });
reviewSchema.index({ pharmacy: 1, customer: 1 }, { unique: true });
reviewSchema.index({ pharmacy: 1, createdAt: -1, _id: -1 });
module.exports = mongoose.model('Review', reviewSchema);
