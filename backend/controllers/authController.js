const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { validateAuth } = require("../utils/authValidation");
const hashPassword = require("../utils/hashPassword");
const { getUserRole } = require("../utils/roles");

function generateToken(userId) {
  return jwt.sign(
    {
      userId,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    }
  );
}

async function registerUser(req, res) {
  try {
    const errors = validateAuth(req.body, true);
    if (Object.keys(errors).length) {
      return res.status(400).json({
        success: false,
        message: "Please correct the highlighted fields.",
        errors,
      });
    }
    const { name, email, phone, password, role = "customer" } = req.body;

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account already exists with this email",
        errors: { email: "An account already exists with this email." },
      });
    }

    const hashedPassword = await hashPassword(password);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      password: hashedPassword,
      role,
    });

    const token = generateToken(user._id);

    return res.status(201).json({
      success: true,
      name: user.name,
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        fullName: user.name,
        email: user.email,
        phone: user.phone,
        role: getUserRole(user),
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false,
        message: "An account already exists with this email",
        errors: { email: "An account already exists with this email." } });
    }
    console.error("Register error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while registering user",
    });
  }
}

async function loginUser(req, res) {
  try {
    const errors = validateAuth(req.body);
    if (Object.keys(errors).length) {
      return res.status(400).json({
        success: false,
        message: "Please correct the highlighted fields.",
        errors,
      });
    }
    const { email, password } = req.body;

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const passwordIsCorrect = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordIsCorrect) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        fullName: user.name,
        email: user.email,
        phone: user.phone,
        role: getUserRole(user),
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while logging in",
    });
  }
}
async function getProfile(req, res) {
  try {
    return res.status(200).json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        fullName: req.user.name,
        email: req.user.email,
        phone: req.user.phone,
        role: getUserRole(req.user),
        createdAt: req.user.createdAt,
      },
    });
  } catch (error) {
    console.error("Profile error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error while loading profile",
    });
  }
}

module.exports = {
  registerUser,
  loginUser,
   getProfile,
};
