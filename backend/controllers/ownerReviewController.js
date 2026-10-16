const mongoose = require('mongoose');
const Pharmacy = require('../models/Pharmacy');
const { reviewPage } = require('../services/reviewPage');
async function ownerReviews(req, res) {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid pharmacy ID.' });
    const page = req.query.page === undefined ? 1 : Number(req.query.page);
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000) return res.status(400).json({ success: false, message: 'Invalid reviews page.' });
    const pharmacy = await Pharmacy.findOne({ _id: req.params.id, owner: req.user._id }).select('_id');
    if (!pharmacy) return res.status(404).json({ success: false, message: 'Owned pharmacy not found.' });
    return res.json({ success: true, ...await reviewPage(req.params.id, page, true) });
  } catch {
    return res.status(500).json({ success: false, message: 'Unable to load pharmacy review analytics. Please try again.' });
  }
}
module.exports = { ownerReviews };
