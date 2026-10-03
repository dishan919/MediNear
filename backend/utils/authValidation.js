const { USER_ROLES } = require("./roles");

function validateAuth(body = {}, register = false) {
  const { name, email, phone, password } = body;
  const errors = {};
  if (typeof email !== "string" || !email.trim()) errors.email = "Email address is required.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = "Enter a valid email address.";
  if (typeof password !== "string" || !password) errors.password = "Password is required.";
  if (register) {
    if (body.role !== undefined && !USER_ROLES.includes(body.role)) {
      errors.role = "Choose Customer or Pharmacy Owner.";
    }
    if (typeof name !== "string" || !name.trim()) errors.fullName = "Full name is required.";
    if (typeof phone !== "string" || !phone.trim()) errors.phone = "Phone number is required.";
    else if (!/^\+?[\d\s().-]+$/.test(phone.trim()) || !/^\d{9,15}$/.test(phone.replace(/\D/g, ""))) {
      errors.phone = "Enter a phone number with 9–15 digits.";
    }
    if (typeof password === "string" && password && (password.length < 8 ||
      Buffer.byteLength(password, "utf8") > 72 || !/[a-z]/.test(password) ||
      !/[A-Z]/.test(password) || !/[0-9]/.test(password))) {
      errors.password = "Use at least 8 characters with uppercase, lowercase and a number (maximum 72 bytes).";
    }
  }
  return errors;
}

module.exports = { validateAuth };

