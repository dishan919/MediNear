// Explicit local-MongoDB check: npm run test:integration. Never runs with npm test.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const User = require("../../models/User");
const authRoutes = require("../../routes/authRoutes");
const pharmacyRoutes = require("../../routes/pharmacyRoutes");
const hashPassword = require("../../utils/hashPassword");
const { assertDevelopmentDatabase, developmentUsers, seedUsers } = require("../../scripts/seed");

test("real MongoDB registration, login, sessions, authorization and development accounts", async () => {
  dotenv.config({ path: path.join(__dirname, "../../.env"), quiet: true });
  assertDevelopmentDatabase(process.env.MONGO_URI, process.env.NODE_ENV);
  process.env.JWT_SECRET ||= randomUUID();
  let server;
  const insertedIds = [];
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    const app = express();
    app.use(express.json());
    app.use("/api/auth", authRoutes);
    app.use("/api/pharmacies", pharmacyRoutes);
    server = await new Promise((resolve) => {
      const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });
    const origin = `http://127.0.0.1:${server.address().port}/api`;
    async function request(route, body, token, method = body ? "POST" : "GET") {
      const response = await fetch(origin + route, {
        method,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: response.status, data: await response.json() };
    }

    const suffix = randomUUID();
    for (const role of ["customer", "pharmacy_owner"]) {
      const account = { name: "Integration Test", email: `${role}-${suffix}@medinear.test`, phone: "0771234567", password: "IntegrationPass123!", role };
      const registered = await request("/auth/register", account);
      assert.equal(registered.status, 201);
      insertedIds.push(registered.data.user.id);
      const record = await User.collection.findOne({ email: account.email });
      assert.equal(record.name, account.name);
      assert.equal(record.phone, account.phone);
      assert.equal(record.role, role);
      assert.ok(record.createdAt instanceof Date);
      assert.notEqual(record.password, account.password);
      assert.ok(await bcrypt.compare(account.password, record.password));
      assert.equal(registered.data.user.password, undefined);
      const loggedIn = await request("/auth/login", { email: account.email, password: account.password, role: "admin" });
      assert.equal(loggedIn.status, 200);
      assert.equal(loggedIn.data.user.role, role);
      assert.equal(loggedIn.data.user.password, undefined);
      const profile = await request("/auth/profile", undefined, loggedIn.data.token);
      assert.equal(profile.status, 200);
      assert.equal(profile.data.user.role, role);
      assert.equal(profile.data.user.password, undefined);

      // Invalid/absent pharmacy records exercise authorization without changing pharmacy data.
      const missingPharmacy = new mongoose.Types.ObjectId().toString();
      const expected = role === "customer" ? 403 : 400;
      assert.equal((await request("/pharmacies", {}, loggedIn.data.token)).status, expected);
      assert.equal((await request(`/pharmacies/${missingPharmacy}`, {}, loggedIn.data.token, "PUT")).status, role === "customer" ? 403 : 404);
      assert.equal((await request(`/pharmacies/${missingPharmacy}`, undefined, loggedIn.data.token, "DELETE")).status, role === "customer" ? 403 : 404);
      assert.equal((await request("/auth/login", { email: account.email, password: "wrong" })).status, 401);
    }
    assert.equal((await request("/auth/profile")).status, 401);
    assert.equal((await request("/pharmacies", {})).status, 401);
    const invalidEmail = `invalid-${suffix}@medinear.test`;
    assert.equal((await request("/auth/register", { name: "Invalid", email: invalidEmail, phone: "0771234567", password: "IntegrationPass123!", role: "admin" })).status, 400);
    assert.equal(await User.collection.countDocuments({ email: invalidEmail }), 0);

    const legacyEmail = `legacy-${suffix}@medinear.test`;
    const legacy = await User.collection.insertOne({ name: "Legacy Test", email: legacyEmail, phone: "0771234567", password: await hashPassword("IntegrationPass123!") });
    insertedIds.push(legacy.insertedId);
    const legacyLogin = await request("/auth/login", { email: legacyEmail, password: "IntegrationPass123!" });
    assert.equal(legacyLogin.status, 200);
    assert.equal(legacyLogin.data.user.role, "customer");
    assert.equal((await request("/pharmacies", {}, legacyLogin.data.token)).status, 403);

    const seedFilter = { email: { $in: developmentUsers.map((account) => account.email) } };
    const beforeSeed = await User.collection.find(seedFilter).sort({ email: 1 }).toArray();
    assert.ok((await seedUsers()).every((result) => !result.created));
    assert.deepEqual(await User.collection.find(seedFilter).sort({ email: 1 }).toArray(), beforeSeed);
    for (const account of developmentUsers) {
      assert.equal(await User.collection.countDocuments({ email: account.email }), 1);
      const record = await User.collection.findOne({ email: account.email });
      assert.equal(record.name, account.name);
      assert.equal(record.phone, account.phone);
      assert.equal(record.role, account.role);
      assert.ok(await bcrypt.compare(account.password, record.password));
      assert.ok(record.createdAt instanceof Date);
      assert.equal((await request("/auth/login", { email: account.email, password: account.password })).status, 200);
    }
    console.log(`Verified database ${mongoose.connection.name}, collection ${User.collection.name}; temporary integration users will be removed.`);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (insertedIds.length && mongoose.connection.readyState === 1) {
      await User.collection.deleteMany({ _id: { $in: insertedIds.map((id) => new mongoose.Types.ObjectId(id)) } });
    }
    await mongoose.disconnect();
  }
});
