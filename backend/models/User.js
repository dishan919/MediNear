const mongoose = require("mongoose");

const { USER_ROLES } = require("../utils/roles");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
    },

    phone: {
      type: String,
      default: "",
      trim: true,
    },

    address: {
      type: String,
      default: "",
      trim: true,
    },

    profileImage: {
      type: String,
      default: "",
      trim: true,
    },

    role: {
      type: String,
      enum: USER_ROLES,
      default: "customer",
      required: true,
    },
    favorites: [
  {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Pharmacy",
  },
],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);
