const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { registerUser, loginUser, getProfile } = require("../controllers/authController");
const { requireRole, protect } = require("../middleware/authMiddleware");
const { getUserRole } = require("../utils/roles");
const jwt = require("jsonwebtoken");

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.data = data; return this; } };
}

test("schema allows exactly two roles and defaults legacy accounts to customer", async () => {
  const user = new User({ name: "Test", email: "test@example.com", password: "hashed-value" });
  assert.equal(user.role, "customer");
  assert.deepEqual(User.schema.path("role").enumValues, ["customer", "pharmacy_owner"]);
  user.role = "admin";
  await assert.rejects(user.validate(), (error) => Boolean(error.errors.role));
});

test("both registrations persist validated roles and hashed passwords; login reads stored role", async (t) => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "unit-test-only-secret";
  t.after(() => { if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret; });
  let stored;
  t.mock.method(User, "findOne", async () => null);
  t.mock.method(User, "create", async (data) => { stored = { ...data, _id: "507f1f77bcf86cd799439011" }; return stored; });
  for (const role of ["customer", "pharmacy_owner", undefined]) {
    User.findOne.mock.mockImplementation(async () => null);
    const body = { name: "Test", email: "test@example.com", phone: "0771234567", password: "SecurePass1" };
    if (role !== undefined) body.role = role;
    const registered = response();
    await registerUser({ body }, registered);
    assert.equal(registered.statusCode, 201);
    assert.equal(stored.role, role || "customer");
    assert.notEqual(stored.password, body.password);
    assert.ok(await bcrypt.compare(body.password, stored.password));
    assert.equal(registered.data.user.password, undefined);
    User.findOne.mock.mockImplementation(async () => stored);
    const loggedIn = response();
    await loginUser({ body: { email: body.email, password: body.password, role: "admin" } }, loggedIn);
    assert.equal(loggedIn.statusCode, 200);
    assert.equal(loggedIn.data.user.role, role || "customer");
    assert.equal(loggedIn.data.user.password, undefined);
    if (role === undefined) {
      delete stored.role;
      const legacy = response();
      await loginUser({ body }, legacy);
      assert.equal(legacy.data.user.role, "customer");
    }
  }
  delete stored.role;
  const legacyProfile = response();
  await getProfile({ user: stored }, legacyProfile);
  assert.equal(legacyProfile.data.user.role, "customer");
});

test("invalid registration roles fail before any database operation", async (t) => {
  t.mock.method(User, "findOne", () => { assert.fail("invalid roles must not reach MongoDB"); });
  for (const role of ["admin", "pharmacy", "owner", "", null, {}, ["pharmacy_owner"]]) {
    const res = response();
    await registerUser({ body: { name: "Test", email: "test@example.com", phone: "0771234567", password: "SecurePass1", role } }, res);
    assert.equal(res.statusCode, 400);
    assert.ok(res.data.errors.role);
  }
});

test("owner middleware denies guests, customers and obsolete roles", () => {
  const authorize = requireRole("pharmacy_owner");
  for (const user of [undefined, {}, { role: "customer" }, { role: "admin" }, { role: "pharmacy" }]) {
    const res = response();
    authorize({ user }, res, () => { assert.fail("unauthorized access"); });
    assert.equal(res.statusCode, user ? 403 : 401);
  }
  let called = false;
  authorize({ user: { role: "pharmacy_owner" } }, response(), () => { called = true; });
  assert.ok(called);
  assert.equal(getUserRole({}), "customer");
});

test("session protection and profile safely handle a database user without a role", async (t) => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "unit-test-only-secret";
  t.after(() => { if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret; });
  t.mock.method(User, "findById", () => ({ select: async () => ({ _id: "legacy-id", name: "Legacy" }) }));
  const req = { headers: { authorization: `Bearer ${jwt.sign({ userId: "legacy-id", role: "pharmacy_owner" }, process.env.JWT_SECRET)}` } };
  let called = false;
  await protect(req, response(), () => { called = true; });
  assert.ok(called);
  assert.equal(req.user.role, "customer");
  const res = response();
  await getProfile(req, res);
  assert.equal(res.data.user.role, "customer");
});
