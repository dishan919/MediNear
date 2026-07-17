const mongoose = require("mongoose");

const pharmacySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Pharmacy name is required"],
      trim: true,
    },

    address: {
      type: String,
      required: [true, "Address is required"],
      trim: true,
    },

    district: {
      type: String,
      required: [true, "District is required"],
      trim: true,
    },

    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },

    latitude: {
      type: Number,
      required: [true, "Latitude is required"],
    },

    longitude: {
      type: Number,
      required: [true, "Longitude is required"],
    },

    open24Hours: {
      type: Boolean,
      default: false,
    },

    isOpen: {
      type: Boolean,
      default: true,
    },

    image: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

const Pharmacy = mongoose.model("Pharmacy", pharmacySchema);

module.exports = Pharmacy;