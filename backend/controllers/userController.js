const User = require("../models/User");
const Pharmacy = require("../models/Pharmacy");

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
      user,
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
      favorites: user.favorites || [],
    });
  } catch (error) {
    console.error("Get favorites error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load favorites",
    });
  }
};

const addFavorite = async (req, res) => {
  try {
    const { pharmacyId } = req.params;

    const pharmacy = await Pharmacy.findById(pharmacyId);

    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: "Pharmacy not found",
      });
    }

    const user = await User.findById(req.user._id);

    const alreadyFavorite = user.favorites.some(
      (id) => id.toString() === pharmacyId
    );

    if (!alreadyFavorite) {
      user.favorites.push(pharmacyId);
      await user.save();
    }

    await user.populate("favorites");

    return res.status(200).json({
      success: true,
      message: alreadyFavorite
        ? "Pharmacy already in favorites"
        : "Pharmacy added to favorites",
      favorites: user.favorites,
    });
  } catch (error) {
    console.error("Add favorite error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to add favorite",
    });
  }
};

const removeFavorite = async (req, res) => {
  try {
    const { pharmacyId } = req.params;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        $pull: {
          favorites: pharmacyId,
        },
      },
      {
        new: true,
      }
    ).populate("favorites");

    return res.status(200).json({
      success: true,
      message: "Pharmacy removed from favorites",
      favorites: user.favorites,
    });
  } catch (error) {
    console.error("Remove favorite error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to remove favorite",
    });
  }
};

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
  } catch (error) {
    console.error("Clear favorites error:", error);

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