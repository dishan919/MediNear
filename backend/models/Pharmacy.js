const mongoose = require("mongoose");
const { locations } = require("../services/locations");

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

    province: { type: String, enum: Object.keys(locations), trim: true },
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
      min: -90, max: 90,
    },

    longitude: {
      type: Number,
      required: [true, "Longitude is required"],
      min: -180, max: 180,
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
    optimisticConcurrency: true,
  }
);

// Legacy pharmacies without a province remain valid until their area is edited.
pharmacySchema.pre("validate", function () {
  if (this.province && !locations[this.province]?.includes(this.district)) this.invalidate("district", "District does not belong to the selected province");
});

const Pharmacy = mongoose.model("Pharmacy", pharmacySchema);

module.exports = Pharmacy;
