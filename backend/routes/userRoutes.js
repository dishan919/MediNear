const express = require("express");

const {
  getUserProfile,
  updateUserProfile,
  getFavorites,
  addFavorite,
  removeFavorite,
  clearFavorites,
} = require("../controllers/userController");

const {
  protect,
  requireRole,
} = require("../middleware/authMiddleware");

const router = express.Router();
router.use(require("./profilePhotoRoutes")());
const customer = [protect, requireRole("customer")];

router.get("/profile", protect, getUserProfile);
router.put("/profile", protect, updateUserProfile);

router.get("/favorites", ...customer, getFavorites);

router.post(
  "/favorites/:pharmacyId",
  ...customer,
  addFavorite
);

router.delete(
  "/favorites/:pharmacyId",
  ...customer,
  removeFavorite
);

router.delete(
  "/favorites",
  ...customer,
  clearFavorites
);

module.exports = router;