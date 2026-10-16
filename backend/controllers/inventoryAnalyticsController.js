const mongoose = require('mongoose');
const Pharmacy = require('../models/Pharmacy');
const { inventoryAnalytics } = require('../services/inventoryAnalytics');
async function getInventoryAnalytics(req, res) {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid pharmacy ID.' });
    const pharmacy = await Pharmacy.findOne({ _id: req.params.id, owner: req.user._id })
      .select('inventory._id inventory.name inventory.quantity inventory.expiryDate -_id').lean();
    if (!pharmacy) return res.status(404).json({ success: false, message: 'Owned pharmacy not found.' });
    const now = new Date();
    return res.json({ success: true, ...inventoryAnalytics(pharmacy.inventory, now), generatedAt: now });
  } catch {
    return res.status(500).json({ success: false, message: 'Unable to load inventory analytics. Please try again.' });
  }
}
module.exports = { getInventoryAnalytics };
