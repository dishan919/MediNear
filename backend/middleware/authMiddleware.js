const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { getUserRole } = require("../utils/roles");

async function protect(req, res, next) {
  try {
    const authorizationHeader = req.headers.authorization;

    if (
      !authorizationHeader ||
      !authorizationHeader.startsWith("Bearer ")
    ) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is required",
      });
    }

    const token = authorizationHeader.split(" ")[1];

    const decodedToken = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const user = await User.findById(
      decodedToken.userId
    ).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account not found",
      });
    }

    user.role = getUserRole(user);
    req.user = user;

    next();
  } catch (error) {
    console.error("Authentication error:", error.message);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token has expired. Please login again.",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid authentication token",
    });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Please login." });
    }
    if (getUserRole(req.user) !== role) {
      return res.status(403).json({ success: false, message: "You do not have access to this resource." });
    }
    next();
  };
}

module.exports = {
  protect,
  requireRole,
};
