const mongoose = require("mongoose");

const pharmacySchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    timezone: { type: String, default: "Asia/Colombo" },
    openingHours: { type: [{ day: Number, closed: Boolean, allDay: Boolean, open: String, close: String, _id: false }], default: undefined },
    inventory: [{
      name: { type: String, required: true, trim: true, maxlength: 120 },
      genericName: { type: String, trim: true, maxlength: 120 },
      brand: { type: String, trim: true, maxlength: 120 },
      imageUrl: { type: String, trim: true, default: "", maxlength: 2048 },
      createdAt: { type: Date, default: Date.now },
      quantity: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
      price: { type: Number, min: 0 },
      updatedAt: { type: Date, default: Date.now },
    }],
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
