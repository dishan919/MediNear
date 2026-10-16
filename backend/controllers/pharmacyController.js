const { isMedicineUsable } = require('../../shared/medicineExpiry.mjs');
const mongoose = require('mongoose');
const Pharmacy = require('../models/Pharmacy');
const { isRestock, fulfillRestock } = require('../services/restock');
const { supportsTransactions } = require('../services/databaseCapabilities');
const logServerError = require('../utils/logServerError');
const { publicPharmacy, rankPharmacies } = require('../services/ranking');
const { validateHours } = require('../services/openingHours');
const { validCoordinates, distanceKm } = require('../services/distance');
const { validateMedicine, publicMedicine } = require('../services/inventory');
const { validateArea, provinceForDistrict, canonicalDistrict } = require('../services/locations');
const ownerId = req => req.user?._id || req.user?.id;
const fail = (res, error) => {
  if (!error.status && !['VersionError', 'ValidationError', 'CastError'].includes(error.name)) logServerError('pharmacy request', error);
  if (error.name === 'VersionError') return res.status(409).json({ success: false, message: 'Inventory changed. Reload and try again.' });
  return res.status(error.status || (['ValidationError', 'CastError'].includes(error.name) ? 400 : 500)).json({
    success: false,
    message: error.status || error.name === 'ValidationError' ? error.message : 'Unable to process pharmacy request',
  });
};
const invalid = message => Object.assign(new Error(message), { status: 400 });
async function owned(req) {
  if (req.user?.role !== 'pharmacy_owner') throw Object.assign(new Error('Owner access required'), { status: 403 });
  if (!mongoose.isValidObjectId(req.params.id)) throw invalid('Invalid pharmacy ID');
  const pharmacy = await Pharmacy.findById(req.params.id);
  if (!pharmacy) throw Object.assign(new Error('Pharmacy not found'), { status: 404 });
  if (!pharmacy.owner || String(pharmacy.owner) !== String(ownerId(req))) throw Object.assign(new Error('This pharmacy does not belong to you'), { status: 403 });
  return pharmacy;
}
function profile(body, creating = false, current = {}) {
  const result = {};
  for (const field of ['name', 'address', 'district', 'phone', 'image', 'province']) {
    if (body[field] !== undefined) {
      if (typeof body[field] !== 'string' || body[field].length > 500 || (field !== 'image' && !body[field].trim())) throw invalid(`Invalid ${field}`);
      result[field] = body[field].trim();
    } else if (creating && !['image', 'province'].includes(field)) throw invalid(`${field} is required`);
  }
  for (const [field, max] of [['latitude', 90], ['longitude', 180]]) {
    if (body[field] !== undefined) {
      if (typeof body[field] !== 'number' || !Number.isFinite(body[field]) || Math.abs(body[field]) > max) throw invalid(`Invalid ${field}`);
      result[field] = body[field];
    } else if (creating) throw invalid(`${field} is required`);
  }
  if (creating || body.province !== undefined || body.district !== undefined) {
    const district = canonicalDistrict(result.district ?? current.district) || result.district || current.district;
    const province = result.province ?? (body.district !== undefined ? provinceForDistrict(district) : current.province || provinceForDistrict(district));
    try { validateArea(province, district); } catch (e) { throw invalid(e.message); }
    result.province = province; result.district = district;
  }
  return result;
}
async function getAllPharmacies(req, res) {
  try { const pharmacies = (await Pharmacy.find().sort({ createdAt: -1 })).map(p => publicPharmacy(p)); res.json({ success: true, count: pharmacies.length, pharmacies }); } catch (e) { fail(res, e); }
}
async function getPharmacyById(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw invalid('Invalid pharmacy ID');
    const p = await Pharmacy.findById(req.params.id);
    if (!p) return res.status(404).json({ success: false, message: 'Pharmacy not found' });
    let distance = null;
    if (req.query.lat !== undefined || req.query.lng !== undefined) {
      if (typeof req.query.lat !== 'string' || typeof req.query.lng !== 'string' || req.query.lat.trim() === '' || req.query.lng.trim() === '' || !validCoordinates(Number(req.query.lat), Number(req.query.lng))) throw invalid('Valid latitude and longitude required together');
      distance = distanceKm(Number(req.query.lat), Number(req.query.lng), p.latitude, p.longitude);
    }
    res.json({ success: true, pharmacy: { ...publicPharmacy(p), distance, medicines: (p.inventory || []).filter(m => isMedicineUsable(m)).map(m => publicMedicine(m)) } });
  } catch (e) { fail(res, e); }
}
async function getOwnedPharmacies(req, res) {
  try { res.json({ success: true, pharmacies: await Pharmacy.find({ owner: ownerId(req) }).sort({ name: 1 }) }); } catch (e) { fail(res, e); }
}
async function createPharmacy(req, res) {
  try { const pharmacy = await Pharmacy.create({ ...profile(req.body, true), owner: ownerId(req) }); res.status(201).json({ success: true, pharmacy }); } catch (e) { fail(res, e); }
}
async function updatePharmacy(req, res) {
  try { const p = await owned(req); Object.assign(p, profile(req.body, false, p)); await p.save(); res.json({ success: true, pharmacy: p }); } catch (e) { fail(res, e); }
}
async function deletePharmacy(req, res) {
  try { await owned(req); await Pharmacy.deleteOne({ _id: req.params.id, owner: ownerId(req) }); res.json({ success: true }); } catch (e) { fail(res, e); }
}
async function updateHours(req, res) {
  try {
    const p = await owned(req); const timezone = req.body.timezone || p.timezone || 'Asia/Colombo';
    try { p.openingHours = validateHours(req.body.openingHours, timezone); } catch (e) { throw invalid(e.message); }
    p.timezone = timezone; await p.save(); res.json({ success: true, pharmacy: p });
  } catch (e) { fail(res, e); }
}
async function inventory(req, res) {
  try {
    const p = await owned(req);
    if (req.method === 'GET') return res.json({ success: true, inventory: p.inventory });
    let medicine;
    let restocked = false;
    if (req.params.medicineId) {
      medicine = p.inventory.id(req.params.medicineId);
      if (!medicine) return res.status(404).json({ success: false, message: 'Medicine not found' });
    }
    if (req.method === 'DELETE') medicine.deleteOne();
    else {
      let data;
      try { data = validateMedicine(req.method === 'PATCH' ? { ...medicine.toObject(), ...req.body } : req.body); } catch (e) { throw invalid(e.message); }
      restocked = medicine && isRestock(medicine.quantity, data.quantity) && isMedicineUsable(data);
      if (medicine) medicine.set({ ...data, price: data.price }); else p.inventory.push(data);
    }
    if (restocked) {
      if (!await supportsTransactions()) throw Object.assign(new Error('Restocking requires MongoDB Atlas or a replica set. Inventory was not changed.'), { status: 503 });
      await mongoose.connection.transaction(async session => {
        await p.save({ session });
        await fulfillRestock(p, medicine, session);
      });
    } else await p.save();
    res.status(req.method === 'POST' ? 201 : 200).json({ success: true, inventory: p.inventory });
  } catch (e) { fail(res, e); }
}
async function searchPharmacies(req, res) {
  try {
    const options = {};
    if (Object.keys(req.query).some(key => /^(province|district|lat|lng|radius|sort)\[/.test(key))) throw invalid('Location filters must be scalar values');
    for (const field of ['province', 'district']) if (req.query[field] !== undefined) options[field] = req.query[field];
    try { validateArea(options.province, options.district); } catch (e) { throw invalid(e.message); }
    if (req.query.sort !== undefined && !['smart', 'nearest'].includes(req.query.sort)) throw invalid('Invalid sort order');
    options.sort = req.query.sort || 'smart';
    if (req.query.medicine !== undefined && (typeof req.query.medicine !== 'string' || req.query.medicine.length > 120)) throw invalid('Medicine query must be at most 120 characters');
    options.medicine = req.query.medicine || '';
    for (const field of ['openNow', 'hour24', 'emergency', 'includeOutOfStock']) {
      if (req.query[field] !== undefined && !['true', 'false'].includes(req.query[field])) throw invalid(`Invalid ${field} filter`);
      options[field] = req.query[field] === 'true';
    }
    if (req.query.lat !== undefined || req.query.lng !== undefined) {
      if (typeof req.query.lat !== 'string' || typeof req.query.lng !== 'string') throw invalid('Valid latitude and longitude required together');
      options.lat = Number(req.query.lat); options.lng = Number(req.query.lng);
      if (req.query.lat.trim() === '' || req.query.lng.trim() === '' || !validCoordinates(options.lat, options.lng)) throw invalid('Valid latitude and longitude required together');
    }
    if (req.query.radius !== undefined) {
      if (typeof req.query.radius !== 'string') throw invalid('Invalid radius');
      options.radius = Number(req.query.radius);
      if (!Number.isFinite(options.radius) || options.radius <= 0 || options.radius > 500 || options.lat === undefined) throw invalid('Radius requires location and must be 0–500 km');
    }
    if (options.sort === 'nearest' && options.lat === undefined) throw invalid('Nearest ordering requires location');
    // Embedded inventory query uses literal text, never user-provided regular expressions.
    const pharmacies = rankPharmacies(await Pharmacy.find().lean(), options);
    res.json({ success: true, count: pharmacies.length, pharmacies, locationAvailable: options.lat !== undefined });
  } catch (e) { fail(res, e); }
}
module.exports = { getAllPharmacies, getPharmacyById, createPharmacy, updatePharmacy, deletePharmacy, getOwnedPharmacies, updateHours, inventory, searchPharmacies };
