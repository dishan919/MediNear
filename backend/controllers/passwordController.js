const bcrypt = require("bcryptjs");
const User = require("../models/User");
const hashPassword = require("../utils/hashPassword");
const { validatePassword } = require("../utils/authValidation");

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body || {};
  const errors = {};
  if (typeof currentPassword !== "string" || !currentPassword) errors.currentPassword = "Current password is required.";
  const problem = validatePassword(newPassword);
  if (problem) errors.newPassword = problem;
  if (Object.keys(errors).length) return res.status(400).json({ success: false, message: "Please correct the highlighted fields.", errors });
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(401).json({ success: false, message: "User account not found. Please login again." });
    if (!await bcrypt.compare(currentPassword, user.password)) {
      return res.status(400).json({ success: false, message: "Current password is incorrect.", errors: { currentPassword: "Current password is incorrect." } });
    }
    if (await bcrypt.compare(newPassword, user.password)) {
      const message = "New password must be different from your current password.";
      return res.status(400).json({ success: false, message, errors: { newPassword: message } });
    }
    const password = await hashPassword(newPassword);
    // Do not overwrite a password changed by a concurrent request.
    const result = await User.updateOne({ _id: user._id, password: user.password }, { $set: { password } });
    if (!result.modifiedCount) return res.status(409).json({ success: false, message: "Password changed during this request. Please try again with your current password." });
    return res.status(200).json({ success: true, message: "Password changed successfully." });
  } catch {
    return res.status(500).json({ success: false, message: "Unable to change password. Please try again." });
  }
}
module.exports = { changePassword };
