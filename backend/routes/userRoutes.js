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
} = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/profile", protect, getUserProfile);
router.put("/profile", protect, updateUserProfile);

router.get("/favorites", protect, getFavorites);

router.post(
  "/favorites/:pharmacyId",
  protect,
  addFavorite
);

router.delete(
  "/favorites/:pharmacyId",
  protect,
  removeFavorite
);

router.delete(
  "/favorites",
  protect,
  clearFavorites
);

module.exports = router;