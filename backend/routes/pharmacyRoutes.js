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
const features = require("../controllers/pharmacyController");
const owner = [protect, requireRole("pharmacy_owner")];
router.get("/search", features.searchPharmacies);
router.get("/mine", ...owner, features.getOwnedPharmacies);
router.put("/:id/hours", ...owner, features.updateHours);
router.get("/:id/inventory", ...owner, features.inventory);
router.post("/:id/inventory", ...owner, features.inventory);
router.patch("/:id/inventory/:medicineId", ...owner, features.inventory);
router.delete("/:id/inventory/:medicineId", ...owner, features.inventory);

router.get("/", getAllPharmacies);

router.get("/:id", getPharmacyById);

router.post("/", protect, requireRole("pharmacy_owner"), createPharmacy);

router.put("/:id", protect, requireRole("pharmacy_owner"), updatePharmacy);

router.delete("/:id", protect, requireRole("pharmacy_owner"), deletePharmacy);

module.exports = router;
