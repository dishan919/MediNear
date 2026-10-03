export function getHomeRoute(user) {
  return user?.role === "pharmacy_owner" ? "/pharmacy/dashboard" : "/";
}

export function getUserRole(user) {
  return user?.role === "pharmacy_owner" ? "pharmacy_owner" : "customer";
}
