import test from "node:test";
import assert from "node:assert/strict";
import { validateLogin, validateRegister } from "../src/utils/authValidation.js";

const valid = { fullName: "Test User", email: "user@example.com", phone: "+94 77 123 4567", password: "SecurePass1", confirmPassword: "SecurePass1" };
test("registration accepts valid local and international phone numbers", () => {
  assert.deepEqual(validateRegister(valid), {});
  assert.deepEqual(validateRegister({ ...valid, phone: "0771234567" }), {});
});
test("all required errors are returned together", () => {
  assert.equal(Object.keys(validateRegister({ fullName: " ", email: "", phone: "", password: "", confirmPassword: "" })).length, 5);
});
test("invalid email, phone, weak password and mismatch are rejected", () => {
  assert.equal(Object.keys(validateRegister({ ...valid, email: "x@", phone: "abcdefghijk", password: "weak", confirmPassword: "other" })).length, 4);
  for (const phone of ["123", "1".repeat(16), "+94+771234567", "0771234567abc"]) assert.ok(validateRegister({ ...valid, phone }).phone);
  for (const password of ["lowercase1", "UPPERCASE1", "NoNumbersHere", "A1" + "é".repeat(36)]) assert.ok(validateRegister({ ...valid, password }).password);
});
test("login validates email but allows existing passwords with older rules", () => {
  assert.deepEqual(validateLogin({ email: "user@example.com", password: "old123" }), {});
  assert.ok(validateLogin({ email: "invalid", password: "" }).email);
  assert.ok(validateLogin({ email: "invalid", password: "" }).password);
});

