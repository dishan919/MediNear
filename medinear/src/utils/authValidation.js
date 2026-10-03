export function validateLogin(values) {
  const errors = {};
  if (!values.email.trim()) {
    errors.email = "Email address is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (!values.password) errors.password = "Password is required.";
  return errors;
}

export function validateRegister(values) {
  const errors = validateLogin(values);
  if (values.role !== undefined && !["customer", "pharmacy_owner"].includes(values.role)) {
    errors.role = "Choose Customer or Pharmacy Owner.";
  }
  if (!values.fullName.trim()) errors.fullName = "Full name is required.";
  if (!values.phone.trim()) {
    errors.phone = "Phone number is required.";
  } else if (!/^\+?[\d\s().-]+$/.test(values.phone.trim()) ||
    !/^\d{9,15}$/.test(values.phone.replace(/\D/g, ""))) {
    errors.phone = "Enter a phone number with 9–15 digits, such as +94 77 123 4567.";
  }
  if (values.password && (values.password.length < 8 ||
    new TextEncoder().encode(values.password).length > 72 ||
    !/[a-z]/.test(values.password) || !/[A-Z]/.test(values.password) ||
    !/[0-9]/.test(values.password))) {
    errors.password = "Use at least 8 characters with uppercase, lowercase and a number (maximum 72 bytes).";
  }
  if (!values.confirmPassword) {
    errors.confirmPassword = "Please confirm your password.";
  } else if (values.password !== values.confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }
  return errors;
}
