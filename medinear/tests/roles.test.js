import test from "node:test";
import assert from "node:assert/strict";
import { getHomeRoute, getUserRole } from "../src/auth/roles.js";
import { validateRegister } from "../src/utils/authValidation.js";

test("login destinations follow the authenticated user's role", () => {
  assert.equal(getHomeRoute({ role: "customer" }), "/");
  assert.equal(getHomeRoute({ role: "pharmacy_owner" }), "/pharmacy/dashboard");
  assert.equal(getHomeRoute({}), "/");
  assert.equal(getUserRole({ role: "admin" }), "customer");
});

test("registration accepts both supported roles and rejects other values", () => {
  const form = { fullName: "Test", email: "test@example.com", phone: "0771234567", password: "SecurePass1", confirmPassword: "SecurePass1" };
  for (const role of ["customer", "pharmacy_owner"]) assert.deepEqual(validateRegister({ ...form, role }), {});
  assert.ok(validateRegister({ ...form, role: "admin" }).role);
});
