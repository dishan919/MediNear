const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { registerUser, loginUser } = require("../controllers/authController");
const { validateAuth } = require("../utils/authValidation");
const { protect } = require("../middleware/authMiddleware");

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.data = data; return this; } };
}
test("server rejects missing and non-string inputs without database access", async () => {
  const res = response();
  await registerUser({ body: { name: {}, email: [], phone: 123, password: {} } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(Object.keys(res.data.errors).length, 4);
  assert.ok(validateAuth({ email: "x@", password: "old123" }).email);
  assert.ok(validateAuth({ name: "Test", email: "x@y.com", phone: "abcdefghi", password: "weak" }, true).phone);
});
test("existing registration and login controllers hash passwords and issue usable JWTs", async (t) => {
  t.mock.method(User, "findOne", async () => null);
  let stored;
  t.mock.method(User, "create", async (data) => { stored = { ...data, _id: "507f1f77bcf86cd799439011", role: "customer" }; return stored; });
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-only-secret-with-no-production-use";
  t.after(() => { if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret; });
  const registered = response();
  await registerUser({ body: { name: " Test User ", email: " TEST@example.com ", phone: "0771234567", password: "SecurePass1" } }, registered);
  assert.equal(registered.statusCode, 201);
  assert.notEqual(stored.password, "SecurePass1");
  assert.ok(await bcrypt.compare("SecurePass1", stored.password));
  assert.equal(stored.email, "test@example.com");
  assert.equal(registered.data.user.fullName, "Test User");
  assert.equal(registered.data.user.password, undefined);
  User.findOne.mock.mockImplementation(async () => stored);
  const denied = response();
  await loginUser({ body: { email: stored.email, password: "wrong" } }, denied);
  assert.equal(denied.statusCode, 401);
  const loggedIn = response();
  await loginUser({ body: { email: stored.email, password: "SecurePass1" } }, loggedIn);
  assert.equal(loggedIn.statusCode, 200);
  assert.equal(jwt.verify(loggedIn.data.token, process.env.JWT_SECRET).userId, stored._id);
  t.mock.method(User, "findById", () => ({ select: async () => ({ _id: stored._id, name: stored.name }) }));
  let nextCalled = false;
  await protect({ headers: { authorization: `Bearer ${loggedIn.data.token}` } }, response(), () => { nextCalled = true; });
  assert.ok(nextCalled);
  const duplicate = response();
  await registerUser({ body: { name: "Test", email: stored.email, phone: "0771234567", password: "SecurePass1" } }, duplicate);
  assert.equal(duplicate.statusCode, 409);
  assert.ok(duplicate.data.errors.email);
});

