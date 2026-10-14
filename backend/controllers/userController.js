const User = require("../models/User");
const Pharmacy = require("../models/Pharmacy");
const { getUserRole } = require("../utils/roles");
const { publicPharmacy } = require("../services/ranking");

// GET /api/users/profile
// Get currently logged-in user's profile
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      user: { ...user.toObject(), role: getUserRole(user) },
    });
  } catch (error) {
    console.error("Get profile error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to get user profile",
    });
  }
};

// PUT /api/users/profile
// Update currently logged-in user's profile
const updateUserProfile = async (req, res) => {
  try {
    const { name, phone, address, profileImage } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update only provided values
    if (name !== undefined) {
      user.name = name.trim();
    }

    if (phone !== undefined) {
      user.phone = phone.trim();
    }

    if (address !== undefined) {
      user.address = address.trim();
    }

    if (profileImage !== undefined) {
      user.profileImage = profileImage.trim();
    }

    user.role = getUserRole(user);
    const updatedUser = await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        address: updatedUser.address,
        profileImage: updatedUser.profileImage,
        role: updatedUser.role,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to update user profile",
    });
  }
};
const getFavorites = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate(
      "favorites"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      favorites: (user.favorites || []).filter(Boolean).map(p => publicPharmacy(p)),
    });
  } catch {

    return res.status(500).json({
      success: false,
      message: "Unable to load favorites",
    });
  }
};

// Atomic set operations prevent duplicates even when requests arrive concurrently.
const changeFavorite = (saved) => async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    if (!require("mongoose").isObjectIdOrHexString(pharmacyId)) {
      return res.status(400).json({ success: false, message: "Invalid pharmacy ID" });
    }
    if (!await Pharmacy.findById(pharmacyId)) {
      return res.status(404).json({ success: false, message: "Pharmacy not found" });
    }
    const user = await User.findByIdAndUpdate(req.user._id,
      saved ? { $addToSet: { favorites: pharmacyId } } : { $pull: { favorites: pharmacyId } },
      { returnDocument: "after" }
    ).populate("favorites");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    return res.status(200).json({ success: true, saved,
      message: saved ? "Pharmacy saved" : "Pharmacy removed from saved pharmacies",
      favorites: (user.favorites || []).filter(Boolean).map(p => publicPharmacy(p)),
    });
  } catch {
    return res.status(500).json({ success: false, message: "Unable to update saved pharmacies" });
  }
};
const addFavorite = changeFavorite(true);
const removeFavorite = changeFavorite(false);

const clearFavorites = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      favorites: [],
    });

    return res.status(200).json({
      success: true,
      message: "All favorites removed",
      favorites: [],
    });
  } catch {

    return res.status(500).json({
      success: false,
      message: "Unable to clear favorites",
    });
  }
};
module.exports = {
  getUserProfile,
  updateUserProfile,
   getFavorites,
  addFavorite,
  removeFavorite,
  clearFavorites,
};
