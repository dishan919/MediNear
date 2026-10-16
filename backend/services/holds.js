const mongoose = require('mongoose');
const Pharmacy = require('../models/Pharmacy');
const HoldRequest = require('../models/HoldRequest');
const { supportsTransactions } = require('./databaseCapabilities');
const problem = (status, message) => Object.assign(new Error(message), { status });
function validQuantity(quantity) { return Number.isSafeInteger(quantity) && quantity > 0; }
async function acceptHold(id, pharmacyId, ownerId) {
  if (!await supportsTransactions()) throw problem(503, 'Accepting holds requires MongoDB Atlas or a replica set. The request and inventory were not changed.');
  let accepted;
  await mongoose.connection.transaction(async session => {
    const hold = await HoldRequest.findOneAndUpdate({ _id: id, pharmacy: pharmacyId, status: 'pending' }, { $set: { status: 'accepted' } }, { session, returnDocument: 'after', runValidators: true });
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
          quantity: 1, status: 1, createdAt: 1, updatedAt: 1,
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
module.exports = { acceptHold, validQuantity, holdPage, problem };
