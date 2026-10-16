const mongoose = require('mongoose');
const Pharmacy = require('../models/Pharmacy');
const HoldRequest = require('../models/HoldRequest');
const { acceptHold, validQuantity, holdPage, problem } = require('../services/holds');
const objectId = id => { if (!mongoose.isObjectIdOrHexString(id)) throw problem(400, 'Invalid request, pharmacy or medicine ID.'); return new mongoose.Types.ObjectId(id); };
const safeHold = hold => ({ _id: hold._id, quantity: hold.quantity, status: hold.status, createdAt: hold.createdAt, updatedAt: hold.updatedAt });
const fail = (res, error) => res.status(error.code === 11000 ? 409 : error.status || 500).json({ success: false, message: error.code === 11000 ? 'You already have a pending request for this medicine. Check My Hold Requests in your profile.' : error.status ? error.message : 'Unable to process hold request. Please try again.' });
async function ownerPharmacy(req) {
  const id = objectId(req.params.id);
  if (!await Pharmacy.exists({ _id: id, owner: req.user._id })) throw problem(404, 'Owned pharmacy not found.');
  return id;
}
function pageNumber(req) {
  const page = req.query.page === undefined ? 1 : Number(req.query.page);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) throw problem(400, 'Invalid requests page.');
  return page;
}
async function create(req, res) {
  try {
    const pharmacyId = objectId(req.params.id), medicineId = objectId(req.body?.medicineId), quantity = req.body?.quantity;
    if (!validQuantity(quantity)) throw problem(400, 'Quantity must be a positive whole number.');
    const pharmacy = await Pharmacy.findById(pharmacyId);
    if (!pharmacy) throw problem(404, 'Pharmacy not found.');
    const medicine = pharmacy.inventory.id(medicineId);
    if (!medicine) throw problem(404, 'Medicine not found at this pharmacy.');
    if (!Number.isSafeInteger(medicine.quantity) || medicine.quantity < quantity) throw problem(409, 'Requested quantity exceeds current available stock.');
    const hold = await HoldRequest.create({ customer: req.user._id, pharmacy: pharmacyId, medicine: medicineId, quantity, status: 'pending' });
    res.status(201).json({ success: true, request: safeHold(hold) });
  } catch (error) { fail(res, error); }
}
async function mine(req, res) {
  try { res.json({ success: true, ...await holdPage({ customer: objectId(req.user._id) }, pageNumber(req)) }); }
  catch (error) { fail(res, error); }
}
async function ownerList(req, res) {
  try { const pharmacy = await ownerPharmacy(req); res.json({ success: true, ...await holdPage({ pharmacy }, pageNumber(req), true) }); }
  catch (error) { fail(res, error); }
}
async function cancel(req, res) {
  try {
    const request = await HoldRequest.findOneAndUpdate({ _id: objectId(req.params.requestId), customer: req.user._id, status: 'pending' }, { $set: { status: 'cancelled' } }, { returnDocument: 'after', runValidators: true });
    if (!request) throw problem(409, 'Your pending request was not found or can no longer be cancelled.');
    res.json({ success: true, request: safeHold(request) });
  } catch (error) { fail(res, error); }
}
async function ownerAction(req, res) {
  try {
    const pharmacy = await ownerPharmacy(req), id = objectId(req.params.requestId);
    if (!await HoldRequest.exists({ _id: id, pharmacy })) throw problem(404, 'Hold request not found at this pharmacy.');
    let request;
    if (req.params.action === 'accept') request = await acceptHold(id, pharmacy, req.user._id);
    else {
      request = await HoldRequest.findOneAndUpdate({ _id: id, pharmacy, status: 'pending' }, { $set: { status: 'rejected' } }, { returnDocument: 'after', runValidators: true });
      if (!request) throw problem(409, 'This request is no longer pending. Refresh the requests.');
    }
    res.json({ success: true, request: safeHold(request) });
  } catch (error) { fail(res, error); }
}
module.exports = { create, mine, ownerList, cancel, ownerAction };
