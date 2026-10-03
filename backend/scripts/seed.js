const path = require("node:path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const User = require("../models/User");
const hashPassword = require("../utils/hashPassword");

const developmentUsers = [
  { name: "Test Customer", email: "customer@medinear.test", phone: "0771234567", role: "customer", password: "DevCustomer123!" },
  { name: "Test Pharmacy Owner", email: "owner@medinear.test", phone: "0777654321", role: "pharmacy_owner", password: "DevOwner123!" },
];

function assertDevelopmentDatabase(uri, environment) {
  if (environment === "production") throw new Error("Development seeding is disabled in production.");
  let parsed;
  try { parsed = new URL(uri); } catch { throw new Error("A valid development MONGO_URI is required."); }
  if (parsed.protocol !== "mongodb:" ||
      !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)) {
    throw new Error("Development seeding is limited to a local MongoDB database.");
  }
}

async function seedUsers(model = User) {
  const results = [];
  for (const account of developmentUsers) {
    const password = await hashPassword(account.password);
    const now = new Date();
    const result = await model.updateOne({ email: account.email }, {
      $setOnInsert: { ...account, password, createdAt: now, updatedAt: now },
    }, { upsert: true, runValidators: true, setDefaultsOnInsert: true, timestamps: false });
    results.push({ email: account.email, created: result.upsertedCount === 1 });
  }
  return results;
}

async function main() {
  dotenv.config({ path: path.join(__dirname, "../.env"), quiet: true });
  assertDevelopmentDatabase(process.env.MONGO_URI, process.env.NODE_ENV);
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  await User.init();
  const results = await seedUsers();
  console.log(`Development database: ${mongoose.connection.name}; collection: ${User.collection.name}`);
  for (const result of results) {
    console.log(`${result.email}: ${result.created ? "created" : "already exists (unchanged)"}`);
  }
}

if (require.main === module) {
  main().catch(() => {
    // Connection errors can contain credentials; keep CLI output secret-free.
    console.error("Development seed failed. Check that NODE_ENV is not production and a local MongoDB is available.");
    process.exitCode = 1;
  }).finally(() => mongoose.disconnect());
}

module.exports = { seedUsers, assertDevelopmentDatabase, developmentUsers };
