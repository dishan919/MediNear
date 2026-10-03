const express = require("express");

const {
  getAllPharmacies,
  getPharmacyById,
  createPharmacy,
  updatePharmacy,
  deletePharmacy,
} = require("../controllers/pharmacyController");

const router = express.Router();
const { protect, requireRole } = require("../middleware/authMiddleware");

router.get("/", getAllPharmacies);

router.get("/:id", getPharmacyById);

router.post("/", protect, requireRole("pharmacy_owner"), createPharmacy);

router.put("/:id", protect, requireRole("pharmacy_owner"), updatePharmacy);

router.delete("/:id", protect, requireRole("pharmacy_owner"), deletePharmacy);

module.exports = router;
