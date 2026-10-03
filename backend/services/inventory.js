function validateMedicine(body) {
  if (!body || typeof body !== "object") throw new Error("Medicine details required");
  const result = {};
  for (const field of ["name", "genericName", "brand"]) {
    const value = body[field] ?? "";
    if (typeof value !== "string" || value.trim().length > 120 || (field === "name" && !value.trim())) throw new Error("Medicine name is required; text fields must be at most 120 characters");
    result[field] = value.trim();
  }
  if (!Number.isSafeInteger(body.quantity) || body.quantity < 0) throw new Error("Quantity must be a non-negative whole number");
  result.quantity = body.quantity;
  result.imageUrl = validateImageUrl(body.imageUrl);
  if (body.price !== undefined && body.price !== null && body.price !== "") {
    if (typeof body.price !== "number" || !Number.isFinite(body.price) || body.price < 0) throw new Error("Price must be a non-negative number");
    result.price = body.price;
  }
  return { ...result, updatedAt: new Date() };
}
function matchesMedicine(medicine, query) {
  return [medicine.name, medicine.genericName, medicine.brand].some(value => (value || "").toLowerCase().includes(query.toLowerCase()));
}
function validateImageUrl(value) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string" || value.length > 2048) throw new Error("Image URL must be a valid HTTPS URL (up to 2048 characters)");
  const url = value.trim();
  if (!url) return "";
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error("Image URL must be a valid HTTPS URL"); }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error("Image URL must use HTTPS without embedded credentials");
  return url;
}
function publicMedicine(m) {
  return { _id: m._id, name: m.name, genericName: m.genericName, brand: m.brand, imageUrl: m.imageUrl || "", price: m.price, quantity: m.quantity, availability: m.quantity > 0 ? "Available" : "Out of Stock", createdAt: m.createdAt, updatedAt: m.updatedAt };
}
module.exports = { validateMedicine, matchesMedicine, validateImageUrl, publicMedicine };
