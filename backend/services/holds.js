const { HOLD_DURATION_MS } = require('./holdPolicy');
const mongoose = require('mongoose');
const Pharmacy = require('../models/Pharmacy');
const HoldRequest = require('../models/HoldRequest');
const { supportsTransactions } = require('./databaseCapabilities');
const problem = (status, message) => Object.assign(new Error(message), { status });
function validQuantity(quantity) { return Number.isSafeInteger(quantity) && quantity > 0; }
async function acceptHold(id, pharmacyId, ownerId, clock = () => new Date()) {
  if (!await supportsTransactions()) throw problem(503, 'Accepting holds requires MongoDB Atlas or a replica set. The request and inventory were not changed.');
  let accepted;
  await mongoose.connection.transaction(async session => {
    const acceptedAt = clock(), expiresAt = new Date(acceptedAt.getTime() + HOLD_DURATION_MS);
    const hold = await HoldRequest.findOneAndUpdate({ _id: id, pharmacy: pharmacyId, status: 'pending' }, { $set: { status: 'accepted', acceptedAt, expiresAt } }, { session, returnDocument: 'after', runValidators: true });
    if (!hold) throw problem(409, 'This request is no longer pending. Refresh the requests.');
    const stock = await Pharmacy.updateOne({ _id: pharmacyId, owner: ownerId, inventory: { $elemMatch: { _id: hold.medicine, quantity: { $gte: hold.quantity } } } }, {
      // Existing owner inventory saves use optimistic concurrency: invalidate stale snapshots.
      $inc: { 'inventory.$.quantity': -hold.quantity, __v: 1 },
      $set: { 'inventory.$.updatedAt': new Date() },
    }, { session });
    if (stock.modifiedCount !== 1) throw problem(409, 'There is not enough current stock, or the medicine/pharmacy is no longer available. The request remains pending.');
    accepted = hold;
  });
  return accepted;
}
async function holdPage(filter, page, owner = false) {
  const [data] = await HoldRequest.aggregate([
    { $match: filter },
    { $facet: {
      total: [{ $count: 'count' }],
      requests: [
        { $sort: { createdAt: -1, _id: -1 } }, { $skip: (page - 1) * 10 }, { $limit: 10 },
        { $lookup: { from: 'pharmacies', localField: 'pharmacy', foreignField: '_id', pipeline: [{ $project: { name: 1, inventory: { $map: { input: '$inventory', as: 'item', in: { _id: '$$item._id', name: '$$item.name' } } } } }], as: 'pharmacyData' } },
        ...(owner ? [{ $lookup: { from: 'users', localField: 'customer', foreignField: '_id', pipeline: [{ $project: { _id: 0, name: 1 } }], as: 'customerData' } }] : []),
        { $set: { pharmacyData: { $arrayElemAt: ['$pharmacyData', 0] } } },
        { $project: {
          quantity: 1, status: 1, createdAt: 1, updatedAt: 1, acceptedAt: 1, expiresAt: 1, completedAt: 1, expiredAt: 1,
          pharmacyName: { $ifNull: ['$pharmacyData.name', 'Pharmacy unavailable'] },
          medicineName: { $ifNull: [{ $arrayElemAt: [{ $map: { input: { $filter: { input: { $ifNull: ['$pharmacyData.inventory', []] }, as: 'item', cond: { $eq: ['$$item._id', '$medicine'] } } }, as: 'item', in: '$$item.name' } }, 0] }, 'Medicine unavailable'] },
          ...(owner ? { customerName: { $ifNull: [{ $arrayElemAt: ['$customerData.name', 0] }, 'Customer'] } } : {}),
        } },
      ],
    } },
  ]);
  const total = data?.total[0]?.count || 0;
  return { requests: data?.requests || [], page, hasMore: page * 10 < total, total };
}
// Zero/missing/wrong-type/inverted dates are not safe evidence for returning stock.
const validDeadline = {
  acceptedAt: { $type: 'date', $gt: new Date(0) },
  expiresAt: { $type: 'date' },
  $expr: { $gt: ['$expiresAt', '$acceptedAt'] },
};
async function expireHold(id, scope, now = new Date()) {
  if (!await supportsTransactions()) throw problem(503, 'Expiring holds requires MongoDB Atlas or a replica set. Hold status and inventory were not changed.');
  let expired = null;
  await mongoose.connection.transaction(async session => {
    const hold = await HoldRequest.findOneAndUpdate({ ...scope, _id: id, status: 'accepted', ...validDeadline, expiresAt: { ...validDeadline.expiresAt, $lte: now } }, { $set: { status: 'expired', expiredAt: now } }, { session, returnDocument: 'after', runValidators: true });
    expired = null;
    if (!hold) return; // Another expiration/completion won, or the deadline is not due.
    if (!validQuantity(hold.quantity)) throw problem(409, 'Hold quantity is invalid. No stock was restored.');
    const stock = await Pharmacy.updateOne({ _id: hold.pharmacy, inventory: { $elemMatch: { _id: hold.medicine, quantity: { $gte: 0, $lte: Number.MAX_SAFE_INTEGER - hold.quantity } } } }, {
      $inc: { 'inventory.$.quantity': hold.quantity, __v: 1 }, $set: { 'inventory.$.updatedAt': now },
    }, { session });
    if (stock.modifiedCount !== 1) throw problem(409, 'Unable to restore held stock: pharmacy/medicine is missing or stock is invalid. Hold status was not changed.');
    // Returning held stock is not an owner restock: do not call fulfillRestock.
    expired = hold;
  });
  return expired;
}
async function expireDueHolds(scope, now = new Date()) {
  const invalid = await HoldRequest.exists({ ...scope, status: 'accepted', $nor: [validDeadline] });
  if (invalid) throw problem(409, 'An accepted hold has missing or invalid pickup dates. Contact the pharmacy/support to reconcile it; no expiry was guessed.');
  const due = { ...scope, status: 'accepted', expiresAt: { $lte: now } };
  // Bounded work per request; retries drain any larger backlog without unbounded reads.
  const batch = await HoldRequest.find(due).sort({ expiresAt: 1, _id: 1 }).limit(50).select('_id').lean();
  for (const hold of batch) await expireHold(hold._id, scope, now);
  if (batch.length === 50 && await HoldRequest.exists(due)) throw problem(503, 'More overdue holds need processing. Please refresh to continue.');
}
async function completeHold(id, pharmacyId, now = new Date()) {
  const hold = await HoldRequest.findOneAndUpdate({ _id: id, pharmacy: pharmacyId, status: 'accepted', ...validDeadline, expiresAt: { ...validDeadline.expiresAt, $gt: now } }, { $set: { status: 'completed', completedAt: now } }, { returnDocument: 'after', runValidators: true });
  if (!hold) throw problem(409, 'Only an accepted hold before its pickup deadline can be marked as collected. Refresh the requests.');
  return hold;
}
module.exports = { acceptHold, validQuantity, holdPage, problem, expireHold, expireDueHolds, completeHold };
