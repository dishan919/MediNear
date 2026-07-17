const Pharmacy = require("../models/Pharmacy");

// @description Get all pharmacies
// @route GET /api/pharmacies
// @access Public
const getAllPharmacies = async (req, res) => {
  try {
    const pharmacies = await Pharmacy.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: pharmacies.length,
      pharmacies,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Unable to retrieve pharmacies",
      error: error.message,
    });
  }
};

// @description Get one pharmacy using ID
// @route GET /api/pharmacies/:id
// @access Public
const getPharmacyById = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);

    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: "Pharmacy not found",
      });
    }

    res.status(200).json({
      success: true,
      pharmacy,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Unable to retrieve pharmacy",
      error: error.message,
    });
  }
};

// @description Add new pharmacy
// @route POST /api/pharmacies
// @access Public for testing
const createPharmacy = async (req, res) => {
  try {
    const {
      name,
      address,
      district,
      phone,
      latitude,
      longitude,
      open24Hours,
      isOpen,
      image,
    } = req.body;

    if (
      !name ||
      !address ||
      !district ||
      !phone ||
      latitude === undefined ||
      longitude === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name, address, district, phone, latitude and longitude are required",
      });
    }

    const pharmacy = await Pharmacy.create({
      name,
      address,
      district,
      phone,
      latitude,
      longitude,
      open24Hours,
      isOpen,
      image,
    });

    res.status(201).json({
      success: true,
      message: "Pharmacy created successfully",
      pharmacy,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Unable to create pharmacy",
      error: error.message,
    });
  }
};

// @description Update pharmacy
// @route PUT /api/pharmacies/:id
// @access Public for testing
const updatePharmacy = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: "Pharmacy not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Pharmacy updated successfully",
      pharmacy,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Unable to update pharmacy",
      error: error.message,
    });
  }
};

// @description Delete pharmacy
// @route DELETE /api/pharmacies/:id
// @access Public for testing
const deletePharmacy = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findByIdAndDelete(req.params.id);

    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: "Pharmacy not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Pharmacy deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Unable to delete pharmacy",
      error: error.message,
    });
  }
};

module.exports = {
  getAllPharmacies,
  getPharmacyById,
  createPharmacy,
  updatePharmacy,
  deletePharmacy,
};