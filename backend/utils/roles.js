const USER_ROLES = ["customer", "pharmacy_owner"];

// Missing or obsolete roles never grant owner privileges.
function getUserRole(user) {
  return user.role === "pharmacy_owner" ? "pharmacy_owner" : "customer";
}

module.exports = { USER_ROLES, getUserRole };
