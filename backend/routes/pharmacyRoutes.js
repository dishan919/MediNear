const express = require("express");

const {
  getAllPharmacies,
  getPharmacyById,
  createPharmacy,
  updatePharmacy,
  deletePharmacy,
} = require("../controllers/pharmacyController");

const router = express.Router();

router.get("/", getAllPharmacies);

router.get("/:id", getPharmacyById);

router.post("/", createPharmacy);

router.put("/:id", updatePharmacy);

router.delete("/:id", deletePharmacy);

module.exports = router;